import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Repository } from 'typeorm';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import { HelperService } from './helper.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { IdentityService } from 'src/identity/identity.service';
import * as crypto from 'crypto';
import { ProvidusResponse } from 'src/proto/wallet.pb';
import { CallbackLog } from 'src/entity/callback-log.entity';

@Injectable()
export class ProvidusService {
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

  private async providusSettings(client_id: number) {
    return await this.paymentMethodRepository.findOne({
      where: { provider: 'providus', client_id },
    });
  }

  private generateSignature(clientId: string, secret: string): string {
    const raw = `${clientId}:${secret}`;
    return crypto.createHash('sha512').update(raw).digest('hex');
  }

  async initiatePayment(data, client_id) {
    const settings = await this.providusSettings(client_id);
    if (!settings) {
      return {
        status: false,
        message: `Payment method not found`,
      };
    }
    //console.log('THE-DATA', data);

    const url = `${settings.base_url}/PiPCreateDynamicAccountNumber`;
    const clientId = settings.merchant_id;
    const clientSecret = settings.secret_key;

    const signatureInput = `${clientId}:${clientSecret}`;
    const xAuthSignature = crypto
      .createHash('sha512')
      .update(signatureInput)
      .digest('hex');

    console.log('X-Auth-Signature:', xAuthSignature);

    const headers = {
      'Content-Type': 'application/json',
      'Client-Id': clientId,
      'X-Auth-Signature': xAuthSignature,
    };

    console.log('HEADERS:', headers);
    //console.log('DATA:', data);

    try {
      const response = await axios.post(url, data, { headers });
      console.log('RESPONSE', response.data);

      return response.data;
    } catch (error) {
      console.error(
        '❌ Error during Providus payment initiation:',
        error.response?.data || error.message,
      );
      return {
        success: false,
        message: 'Payment request failed',
        error: error.response?.data || error.message,
      };
    }
  }

  async handleWebhook(data): Promise<ProvidusResponse> {
    try {
      console.log('data', data);
      const settings = await this.providusSettings(data.client_id);
      if (!settings) {
        return {
          requestSuccessful: true,
          sessionId: data.sessionId,
          responseMessage: 'Payment method not found',
          responseCode: '03',
        };
      }

      if (
        data.settlementId === undefined ||
        data.settlementId === null ||
        data.settlementId === ''
      ) {
        return {
          requestSuccessful: true,
          sessionId: data.sessionId,
          responseMessage: 'rejected transaction',
          responseCode: '02',
        };
      }

      if (
        data.accountNumber === undefined ||
        data.accountNumber === null ||
        data.accountNumber === ''
      ) {
        return {
          requestSuccessful: true,
          sessionId: data.rawBody.webhookBody.sessionId,
          responseMessage: 'rejected transaction',
          responseCode: '02',
        };
      }

      const clientId = settings.merchant_id;
      const clientSecret = settings.secret_key;

      const expectedSignature = crypto
        .createHash('sha512')
        .update(`${clientId}:${clientSecret}`)
        .digest('hex');

      const receivedSignature = (data.headers || '').trim();

      if (expectedSignature.toLowerCase() !== receivedSignature.toLowerCase()) {
        return {
          requestSuccessful: true,
          sessionId: data.sessionId,
          responseMessage: 'rejected transaction',
          responseCode: '02',
        };
      }

      // 🔎 Find the transaction first
      const transaction = await this.transactionRepository.findOne({
        where: {
          client_id: data.clientId,
          transaction_no: data.accountNumber,
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
          transaction_id: data.accountNumber,
          paymentMethod: 'Providus',
        });
        return {
          requestSuccessful: true,
          sessionId: data.sessionId,
          responseMessage: 'rejected transaction',
          responseCode: '02',
        };
      }

      // 🔍 Check if the settlementId has already been processed (globally)
      // if (data.settlementId) {
      //   const existingSettlement = await this.transactionRepository.findOne({
      //     where: { settlementId: data.settlementId },
      //   });

      //   if (existingSettlement) {
      //     return {
      //       requestSuccessful: true,
      //       sessionId: data.sessionId,
      //       responseMessage: 'duplicate transaction',
      //       responseCode: '01',
      //     };
      //   }

      //   // ✅ Update current transaction with settlementId if missing
      //   if (!transaction.settlementId) {
      //     await this.transactionRepository.update(
      //       { id: transaction.id },
      //       { settlementId: data.settlementId },
      //     );
      //     console.log(
      //       '✅ Updated settlementId for transaction:',
      //       transaction.transaction_no,
      //     );
      //   }
      // }

      if (transaction.status === 1) {
        console.log('ℹ️ Transaction already marked successful.');
        await this.callbacklogRepository.save({
          client_id: data.clientId,
          request: 'Transaction already successful',
          response: JSON.stringify(data.rawBody),
          status: 1,
          type: 'Webhook',
          transaction_id: data.accountNumber,
          paymentMethod: 'Providus',
        });
        return {
          requestSuccessful: true,
          sessionId: data.sessionId,
          responseMessage: 'duplicate transaction',
          responseCode: '01',
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
          response: JSON.stringify(data.rawBody),
          status: 0,
          type: 'Webhook',
          transaction_id: data.accountNumber,
          paymentMethod: 'Providus',
        });
        return {
          requestSuccessful: true,
          sessionId: data.sessionId,
          responseMessage: 'rejected transaction',
          responseCode: '02',
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

      console.log('✅ Transaction successfully processed');
      await this.callbacklogRepository.save({
        client_id: data.clientId,
        request: 'Completed',
        response: JSON.stringify(data.rawBody),
        status: 0,
        type: 'Webhook',
        transaction_id: data.accountNumber,
        paymentMethod: 'Providus',
      });
      return {
        requestSuccessful: true,
        sessionId: data.sessionId,
        responseMessage: 'success',
        responseCode: '00',
      };
    } catch (error) {
      console.error('❌ Providus webhook processing error:', error.message);
      return {
        requestSuccessful: true,
        sessionId: data.sessionId,
        responseMessage: 'system failure, retry',
        responseCode: '03',
      };
    }
  }
}
