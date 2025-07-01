import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Repository } from 'typeorm';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import { HelperService } from './helper.service';
import { ConfigService } from '@nestjs/config';
import { IdentityService } from 'src/identity/identity.service';
import { CallbackLog } from 'src/entity/callback-log.entity';

@Injectable()
export class FidelityService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepository: Repository<Withdrawal>,
    private readonly configService: ConfigService,
    private identityService: IdentityService,

    @InjectRepository(CallbackLog)
    private callbacklogRepository: Repository<CallbackLog>,

    private helperService: HelperService,
  ) {}

  private async fidelitySettings(client_id: number) {
    return await this.paymentMethodRepository.findOne({
      where: { provider: 'fidelity', client_id },
    });
  }

  async initiatePay(data, client_id) {
    try {
      const setting = await this.fidelitySettings(client_id);

      if (!setting) {
        return {
          success: false,
          message: 'Fidelity has not been configured for client',
        };
      }
      console.log('DATA:::', data);
      console.log(client_id);
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error(
        '❌ Error during PayGate payment initiation:',
        error.response || error.message,
      );

      return {
        success: false,
        message: 'Payment request failed',
        error: error.response?.data || error.message,
      };
    }
  }

  async handleWebhook(data) {
    console.log('REAL_DATA::::', data);
    try {
      console.log('RAW_BODY:::', data.rawBody.payload);

      const transaction = await this.transactionRepository.findOne({
        where: {
          client_id: data.clientId,
          transaction_no: data.reference,
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
          transaction_id: data.transactionReference,
          paymentMethod: 'Fidelity',
        });
        return {
          success: false,
          message: 'Transaction not found',
          statusCode: HttpStatus.NOT_FOUND,
        };
      }

      if (
        data.rawBody.webhookBody.type === 'success' &&
        data.rawBody.webhookBody.statusOk === true &&
        data.rawBody.webhookBody.status === 201
      ) {
        if (transaction.status === 1) {
          await this.callbacklogRepository.save({
            client_id: data.clientId,
            request: 'Transaction already successful',
            response: JSON.stringify(data.rawBody),
            status: 1,
            type: 'Webhook',
            transaction_id: data.transactionReference,
            paymentMethod: 'Fidelity',
          });
          console.log('ℹ️ Transaction already marked successful.');
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
            request: 'Wallet not found',
            response: JSON.stringify(data.rawBody),
            status: 0,
            type: 'Webhook',
            transaction_id: data.transactionReference,
            paymentMethod: 'Fidelity',
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
          status: 0,
          type: 'Webhook',
          transaction_id: data.transactionReference,
          paymentMethod: 'Fidelity',
        });
        return {
          statusCode: HttpStatus.OK,
          success: true,
          message: 'Transaction successfully verified and processed',
        };
      }
    } catch (error) {
      console.error('❌ OPay webhook processing error:', error.message);
      return {
        success: false,
        message: 'Error occurred during processing',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async handleCallback(data) {
    console.log('REAL_DATA CALLBACK::::', data);
    try {
      console.log('RAW_BODY:::', data);

      const transaction = await this.transactionRepository.findOne({
        where: {
          client_id: data.clientId,
          transaction_no: data.transactionRef,
          tranasaction_type: 'credit',
        },
      });
      console.log('TRX', transaction);

      if (!transaction) {
        await this.callbacklogRepository.save({
          client_id: data.clientId,
          request: 'Transaction not found',
          response: JSON.stringify(data),
          status: 0,
          type: 'Callback',
          transaction_id: data.transactionRef,
          paymentMethod: 'Fidelity',
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
          response: JSON.stringify(data),
          status: 1,
          type: 'Callback',
          transaction_id: data.transactionRef,
          paymentMethod: 'Fidelity',
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
        console.error('❌ Wallet not found for user_id:', transaction.user_id);
        await this.callbacklogRepository.save({
          client_id: data.clientId,
          request: 'Wallet not found',
          response: JSON.stringify(data),
          status: 0,
          type: 'Callback',
          transaction_id: data.transactionRef,
          paymentMethod: 'Fidelity',
        });
        return {
          success: false,
          message: 'Wallet not found for this user',
          statusCode: HttpStatus.NOT_FOUND,
        };
      }

      console.log('WALLET', wallet);

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
        response: JSON.stringify(data),
        status: 1,
        type: 'Callback',
        transaction_id: data.transactionRef,
        paymentMethod: 'Fidelity',
      });
      return {
        statusCode: HttpStatus.OK,
        success: true,
        message: 'Transaction successfully verified and processed',
      };
    } catch (error) {
      console.error('❌ OPay webhook processing error:', error.message);
      return {
        success: false,
        message: 'Error occurred during processing',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }
}
