import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import { HelperService } from './helper.service';
import { IdentityService } from 'src/identity/identity.service';
import axios from 'axios';
import { GlobusResponse } from 'src/proto/wallet.pb';

@Injectable()
export class GlobusService {
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

  private async globusSettings(client_id: number) {
    return await this.paymentMethodRepository.findOne({
      where: {
        provider: 'globus',
        client_id,
      },
    });
  }

  private sha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async initiatePayment(data, client_id) {
    try {
      const settings = await this.globusSettings(client_id);

      if (!settings)
        return {
          success: false,
          message: 'Globus has not been configured for client',
        };

      const clientId = settings.public_key;

      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      const username = this.sha256(`${date}${clientId}`);
      const password = this.sha256(clientId);

      const auth = await axios.post(
        'https://omniauth.globusbank.com/AuthService/connect/token',
        {
          grant_type: 'password',
          username: username,
          password: password,
          client_id: settings.public_key,
          client_secret: settings.secret_key,
          scope: 'KORET',
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const accessToken = auth.data.access_token;

      const payload = {
        ...data,
        linkedPartnerAccountNumber: settings.merchant_id,
      };

      console.log(payload);

      const url = `${settings.base_url}/api/v2/virtual-account-max`;
      console.log('CHECK 1');
      console.log('URL::::', url);

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ClientID: clientId,
        },
      });

      console.log('DATA::::', response.data);
      console.log('RESULT:::', response.data.result);
      return {
        status: true,
        data: response.data.result,
      };
    } catch (error) {
      console.log('THE_ERROR', error);
      console.error(
        'Globus Error:',
        error.response ? error.response.data : error.message,
      );
      return {
        success: false,
        message: error.response ? error.response.data : error.message,
      };
    }
  }

  async handleWebhook(param): Promise<GlobusResponse> {
    try {
      const settings = await this.globusSettings(param.clientId);

      if (!settings) {
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          success: false,
          message: 'Globus has not been configured for client',
        };
      }
      console.log(param);

      console.log('I GOT BEFORE TRX ');

      if (settings.public_key !== param.headers) {
        return {
          success: false,
          message: 'Transaction already successful',
          statusCode: HttpStatus.BAD_REQUEST,
        };
      }

      if (
        param.callbackData.transactionStatus === 'Successful' &&
        param.callbackData.paymentStatus === 'Complete'
      ) {
        const transaction = await this.transactionRepository.findOne({
          where: {
            client_id: param.clientId,
            transaction_no: param.callbackData.partnerReference,
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
      console.error('❌ OPay webhook processing error:', error.message);
      return {
        success: false,
        message: 'Error occurred during processing',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }
}
