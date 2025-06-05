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

    try {
      const response = await axios.post(url, data, { headers });
      console.log('RESPONSE', response);
      console.log('RESPONSE', response.data);
      console.log('SESSIONID:::', response.data.sessionId);

      return {
        success: true,
        data: response.data,
      };
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
    console.log('REAL_DATA::::', data);
    try {
      console.log('RAW_BODY:::', data);

      const transaction = await this.transactionRepository.findOne({
        where: {
          client_id: data.clientId,
          transaction_no: data.accountNumber,
          tranasaction_type: 'credit',
        },
      });

      if (!transaction) {
        return {
          requestSuccessful: true,
          sessionId: data.sessionId,
          responseMessage: 'rejected transaction',
          responseCode: '02',
        };
      }

      if (transaction.status === 1) {
        console.log('ℹ️ Transaction already marked successful.');
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
      console.log('FINALLY');
      return {
        requestSuccessful: true,
        sessionId: data.sessionId,
        responseMessage: 'success',
        responseCode: '00',
      };
    } catch (error) {
      console.error('❌ OPay webhook processing error:', error.message);
      return {
        requestSuccessful: true,
        sessionId: data.sessionId,
        responseMessage: 'rejected transaction',
        responseCode: '02',
      };
    }
  }
}
