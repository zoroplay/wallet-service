import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { generateTrxNo } from 'src/common/helpers';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Repository } from 'typeorm';
import { HelperService } from './helper.service';
import * as dayjs from 'dayjs';
import {
  OpayRequest,
  OpayResponse,
  OpayWebhookRequest,
} from 'src/proto/wallet.pb';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import axios from 'axios';
import * as crypto from 'crypto';
import { CallbackLog } from 'src/entity/callback-log.entity';

@Injectable()
export class OPayService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(CallbackLog)
    private callbacklogRepository: Repository<CallbackLog>,

    private helperService: HelperService,
  ) {}

  async updateNotify(param: OpayWebhookRequest) {
    try {
      // find transaction
      const transaction = await this.transactionRepository
        .createQueryBuilder()
        .where('client_id = :clientId', { clientId: param.clientId })
        .andWhere('description = :orderNo', { orderNo: param.orderNo })
        .andWhere('tranasaction_type = :type', { type: 'credit' })
        .getOne();

      if (!transaction) {
        const ref = generateTrxNo();
        // find wallet
        const wallet = await this.walletRepository
          .createQueryBuilder()
          .where('client_id = :clientId', { clientId: param.clientId })
          .andWhere('username = :username', { username: param.username })
          .getOne();

        if (wallet) {
          const amount = parseFloat(param.amount) / 100;
          const balance =
            parseFloat(wallet.available_balance.toString()) +
            parseFloat(amount.toString());

          // update user wallet
          await this.walletRepository.update(
            {
              id: wallet.id,
            },
            {
              available_balance: balance,
            },
          );

          //save transaction
          await this.helperService.saveTransaction({
            amount: amount,
            channel: 'opay',
            clientId: param.clientId,
            toUserId: wallet.user_id,
            toUsername: wallet.username,
            toUserBalance: balance,
            fromUserId: 0,
            fromUsername: 'System',
            fromUserbalance: 0,
            source: 'external',
            subject: 'Deposit',
            description: param.orderNo,
            transactionNo: ref,
            status: 1,
          });

          await this.callbacklogRepository.save({
            client_id: param.clientId,
            request: 'Transaction not found',
            response: JSON.stringify(param),
            status: 0,
            type: 'Webhook',
            transaction_id: ref,
            paymentMethod: 'Opay',
          });

          return {
            responseCode: '00000',
            responseMessage: 'SUCCESSFULL',
            data: {
              UserID: param.username,
              OrderNo: param.orderNo,
              TransAmount: param.amount,
              PaymentReference: ref,
              Status: 0,
            },
          };
        } else {
          await this.callbacklogRepository.save({
            client_id: param.clientId,
            request: 'Transaction not found',
            response: JSON.stringify(param),
            status: 0,
            type: 'Webhook',
            transaction_id: param.orderNo,
            paymentMethod: 'Opay',
          });
          return {
            responseCode: '10967',
            responseMessage: 'Invalid user ID',
            data: {},
          };
        }
      } else {
        await this.callbacklogRepository.save({
          client_id: param.clientId,
          request: 'Transaction not found',
          response: JSON.stringify(param),
          status: 0,
          type: 'Webhook',
          transaction_id: param.orderNo,
          paymentMethod: 'Opay',
        });
        return {
          responseCode: '05011',
          responseMessage: 'Duplicate transaction',
          data: {},
        };
      }
    } catch (e) {
      // console.log('opay error', e);
      return {
        responseCode: '10967',
        responseMessage: 'Internal server error',
        data: {},
      };
    }
  }

  async reQueryLookUp({ clientId, orderNo }) {
    // find transaction
    const transaction = await this.transactionRepository
      .createQueryBuilder()
      .where('client_id = :clientId', { clientId })
      .andWhere('description = :orderNo', { orderNo })
      .andWhere('tranasaction_type = :type', { type: 'credit' })
      .getOne();

    if (transaction) {
      const Status =
        transaction.status === 1
          ? '00'
          : transaction.status === 0
            ? '01'
            : '02';
      return {
        responseCode: '00000',
        responseMessage: 'SUCCESSFULL',
        data: {
          UserID: transaction.user_id,
          OrderNo: orderNo,
          TransDate: dayjs(transaction.created_at).format('YYYY-MM-DD'),
          TransAmount: transaction.amount * 100,
          PaymentReference: transaction.transaction_no,
          Status,
        },
      };
    } else {
      return {
        responseCode: '19089',
        responseMessage: 'Transaction not found',
        data: {},
      };
    }
  }

  private async opaySettings(client_id: number) {
    return await this.paymentMethodRepository.findOne({
      where: {
        provider: 'opay',
        client_id,
      },
    });
  }

  async initiatePayment(data, client_id) {
    try {
      const settings = await this.opaySettings(client_id);

      const response = await axios.post(settings.base_url, data, {
        headers: {
          Authorization: `Bearer ${settings.public_key}`,
          MerchantId: settings.merchant_id,
          'Content-Type': 'application/json',
        },
      });

      console.log('CHECK_3');
      console.log('DONE', response.data.data.cashierUrl);
      console.log('DONE', response.data.data);
      return { success: true, data: response.data.data.cashierUrl };
    } catch (error) {
      console.error('Opay error:', error.response?.data || error.message);
      return {
        success: false,
        message: 'Unable to initiate deposit with Opay',
      };
    }
  }

  async handleWebhook(data: OpayRequest): Promise<OpayResponse> {
    try {
      console.log('RAW_BODY:::', data.rawBody.payload);

      if (data.rawBody.payload.status === 'SUCCESS') {
        const transaction = await this.transactionRepository.findOne({
          where: {
            client_id: data.clientId,
            transaction_no: data.rawBody.payload.reference,
            tranasaction_type: 'credit',
          },
        });

        if (!transaction) {
          await this.callbacklogRepository.save({
            client_id: data.clientId,
            request: 'Transaction not found',
            response: JSON.stringify(data.rawBody),
            status: 0,
            type: 'Webhook',
            transaction_id: data.rawBody.payload.reference,
            paymentMethod: 'Opay',
          });
          return {
            success: false,
            message: 'Transaction not found',
            statusCode: HttpStatus.NOT_FOUND,
          };
        }

        if (transaction.status === 1) {
          console.log('ℹ️ Transaction already marked successful.');
          await this.callbacklogRepository.save({
            client_id: data.clientId,
            request: 'Transaction already processed',
            response: JSON.stringify(data.rawBody),
            status: 1,
            type: 'Webhook',
            transaction_id: data.rawBody.payload.reference,
            paymentMethod: 'Opay',
          });
          return {
            success: true,
            message: 'Transaction already successful',
            statusCode: HttpStatus.OK,
          };
        }

        const wallet = await this.walletRepository.findOne({
          where: { user_id: transaction.user_id },
        });

        if (!wallet) {
          console.error(
            '❌ Wallet not found for user_id:',
            transaction.user_id,
          );
          await this.callbacklogRepository.save({
            client_id: data.clientId,
            request: 'Wallet not found ',
            response: JSON.stringify(data.rawBody),
            status: 0,
            type: 'Webhook',
            transaction_id: data.rawBody.payload.reference,
            paymentMethod: 'Opay',
          });
          return {
            success: false,
            message: 'Wallet not found for this user',
            statusCode: HttpStatus.NOT_FOUND,
          };
        }

        const balance =
          parseFloat(wallet.available_balance.toString()) +
          parseFloat(transaction.amount.toString());

        await this.helperService.updateWallet(balance, transaction.user_id);

        await this.transactionRepository.update(
          { transaction_no: transaction.transaction_no },
          { status: 1, balance },
        );
        console.log('FINALLY');
        await this.callbacklogRepository.save({
          client_id: data.clientId,
          request: 'Completed',
          response: JSON.stringify(data.rawBody),
          status: 1,
          type: 'Webhook',
          transaction_id: data.rawBody.payload.reference,
          paymentMethod: 'Opay',
        });
        return {
          statusCode: HttpStatus.OK,
          success: true,
          message: 'Transaction successfully verified and processed',
        };
      }
    } catch (error) {
      await this.callbacklogRepository.save({
        client_id: data.clientId,
        request: 'Failed',
        response: JSON.stringify(data.rawBody),
        status: 0,
        type: 'Webhook',
        transaction_id: data.rawBody.payload.reference,
        paymentMethod: 'Opay',
      });
      console.error('❌ OPay webhook processing error:', error.message);
      return {
        success: false,
        message: 'Error occurred during processing',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async handlePaymentStatus(data) {
    try {
      console.log('I GOT HERE');
      console.log(data);
      const settings = await this.opaySettings(data.clientId);

      const rawPayload = JSON.stringify(data);
      const hash = crypto
        .createHmac('sha512', settings.secret_key)
        .update(rawPayload)
        .digest('hex');

      if (hash === data.sha512) {
        return {
          success: false,
          message: 'Invalid signature',
          status: HttpStatus.FORBIDDEN,
        };
      }
    } catch (error) {
      console.log('Opay error', error.message);
      return { success: false, message: 'error occurred' };
    }
  }
}