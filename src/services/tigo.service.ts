import { HttpStatus, Injectable } from '@nestjs/common';
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

@Injectable()
export class TigoService {
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

  private async tigoSettings(client_id: number) {
    return await this.paymentMethodRepository.findOne({
      where: { provider: 'tigo', client_id },
    });
  }

  async initiatePayment(data, client_id) {
    // ✅ Get Tigo settings only once
    const paymentSettings = await this.tigoSettings(client_id);
    if (!paymentSettings)
      return {
        success: false,
        message: 'Tigo has not been configured for client',
      };

    try {
      const TIGO_TOKEN =
        'https://accessgwtest.tigo.co.tz:8443/Kamili2DM-GetToken';
      const requestBody = new URLSearchParams();
      requestBody.append('username', paymentSettings.public_key);
      requestBody.append('password', paymentSettings.secret_key);
      requestBody.append('grant_type', 'password');
      const token = await axios.post(TIGO_TOKEN, requestBody, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (!token) {
        console.error('❌ Failed to retrieve access token');
        return {
          success: false,
          message: 'Authentication failed',
        };
      }

      const payload = {
        ...data,
        BillerMSISDN: paymentSettings.merchant_id,
      };

      const payUrl =
        'https://accessgwtest.tigo.co.tz:8443/Kamili2DM-PushBillPay';
      const response = await axios.post(payUrl, payload, {
        headers: {
          Authorization: `Bearer ${token.data.access_token}`, // ✅ Missing authorization header added
          Username: paymentSettings.public_key,
          Password: paymentSettings.secret_key,
          'Content-Type': 'application/json',
        },
      });

      console.log('✅ Payment successful:', response.data);
      return response.data;
    } catch (error: any) {
      console.error(
        '❌ Error during Tigo payment initiation:',
        error.response?.data || error.message,
      );
      return {
        success: false,
        message: 'Payment request failed',
        error: error.response?.data || error.message,
      };
    }
  }

  async handleWebhook(data) {
    console.log('TIGO-WEBHOOK');

    console.log('TEST');
    try {
      const paymentSettings = await this.tigoSettings(data.client_id);
      if (!paymentSettings)
        return {
          success: false,
          message: 'Tigo has not been configured for client',
        };
      console.log('TEST 2');
      const transaction = await this.transactionRepository.findOne({
        where: {
          client_id: data.clientId,
          transaction_no: data.reference,
          tranasaction_type: 'credit',
        },
      });

      console.log('TRX', transaction);

      if (!transaction)
        return {
          success: false,
          message: 'Transaction not found',
          status: HttpStatus.NOT_FOUND,
        };

      if (transaction.status === 1)
        return {
          success: true,
          message: 'Transaction already successful',
        };

      const wallet = await this.walletRepository.findOne({
        where: { user_id: transaction.user_id },
      });

      console.log('🔍 Found Wallet:', JSON.stringify(wallet, null, 2));

      if (!wallet) {
        console.error('❌ Wallet not found for user_id:', transaction.user_id);
        return {
          success: false,
          message: 'Wallet not found for this user',
          status: HttpStatus.NOT_FOUND,
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

      return {
        success: true,
        message: 'Transaction successfully verified and processed',
      };
    } catch (error) {
      console.log('Tigo error', error);
      return { success: false, message: 'error occurred' };
    }
  }
}
