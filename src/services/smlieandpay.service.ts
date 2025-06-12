import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Repository } from 'typeorm';
import { HelperService } from './helper.service';
import { IdentityService } from 'src/identity/identity.service';
import axios from 'axios';
import { SmileAndPayResponse } from 'src/proto/wallet.pb';

@Injectable()
export class SmileAndPayService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepository: Repository<Withdrawal>,
    private identityService: IdentityService,

    private helperService: HelperService,
  ) {}

  private async smileAndPaySettings(client_id: number) {
    return await this.paymentMethodRepository.findOne({
      where: {
        provider: 'smileandpay',
        client_id,
      },
    });
  }

  async initiatePayment(data, client_id) {
    try {
      const settings = await this.smileAndPaySettings(client_id);

      if (!settings)
        return {
          success: false,
          message: 'SmileAndPay has not been configured for client',
        };

      console.log('PAYLOAD::::', data);

      const url = `${settings.base_url}/payments/initiate-transaction`;

      const response = await axios.post(url, data, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.public_key,
          'x-api-secret': settings.secret_key,
        },
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.log('THE_ERROR', error);
      console.error(
        'SmlieAndPay Error:',
        error.response ? error.response.data : error.message,
      );
      return {
        success: false,
        message: error.response ? error.response.data : error.message,
      };
    }
  }

  async handleWebhook(param): Promise<SmileAndPayResponse> {
    console.log('PARAM:::::::', param);
    try {
      const settings = await this.smileAndPaySettings(param.clientId);

      if (!settings) {
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          success: false,
          message: 'SmileAndPay has not been configured for client',
        };
      }
      console.log('HEADERS:::', param.headers);

      const transaction = await this.transactionRepository.findOne({
        where: {
          client_id: param.clientId,
          transaction_no: param.transactionReference,
          tranasaction_type: 'credit',
        },
      });

      if (!transaction) {
        return {
          success: false,
          message: 'Transaction not found',
          statusCode: HttpStatus.NOT_FOUND,
        };
      }

      if (transaction.status === 1) {
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
        console.error('❌ Wallet not found for user_id:', transaction.user_id);
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
      return {
        statusCode: HttpStatus.OK,
        success: true,
        message: 'Transaction successfully verified and processed',
      };
    } catch (error) {
      console.error('❌ SmileAndPay webhook processing error:', error.message);
      return {
        success: false,
        message: 'Error occurred during processing',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async verifyTransaction(param) {
    try {
      const settings = await this.smileAndPaySettings(param.client_id);
      console.log('LOG::::', param);
      if (!settings)
        return {
          success: false,
          message: 'SmileAndPay has not been configured for client',
        };
      const url = `${settings.base_url}/payments/transaction/${param.orderReference}/status/check`;

      const response = await axios.get(
        url,

        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.public_key,
            'x-api-secret': settings.secret_key,
          },
        },
      );
      console.log(response.data.status);

      if (response.data.status === 'PAID') {
        const transaction = await this.transactionRepository.findOne({
          where: {
            client_id: param.clientId,
            transaction_no: param.orderReference,
            tranasaction_type: 'credit',
          },
        });

        if (!transaction) {
          return {
            success: false,
            message: 'Transaction not found',
            statusCode: HttpStatus.NOT_FOUND,
          };
        }

        if (transaction.status === 1) {
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
        return {
          statusCode: HttpStatus.OK,
          success: true,
          message: 'Transaction successfully verified and processed',
        };
      }
    } catch (error) {
      console.error(
        'SmileAndPay Verify Error:',
        error.response?.data || error.message,
      );
      return {
        success: false,
        message: error.response?.data || error.message,
      };
    }
  }
}
