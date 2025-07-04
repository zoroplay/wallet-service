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
import { CallbackLog } from 'src/entity/callback-log.entity';
import { create } from 'xmlbuilder2';

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
    @InjectRepository(CallbackLog)
    private callbacklogRepository: Repository<CallbackLog>,

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

    // ✅ Choose URLs based on client_id
    const isTestClient = client_id === 4;

    const TIGO_TOKEN = isTestClient
      ? 'https://accessgwtest.tigo.co.tz:8443/Kamili2DM-GetToken'
      : 'https://tmk-accessgw.tigo.co.tz:8443/Kamili22DMGetTokenPush';

    console.log('TOKEN:', TIGO_TOKEN);

    const PAY_URL = isTestClient
      ? 'https://accessgwtest.tigo.co.tz:8443/Kamili2DM-PushBillPay'
      : 'https://tmk-accessgw.tigo.co.tz:8443/Kamili22DMPushBillPay';

    console.log('PAY_URL:', PAY_URL);

    try {
      const requestBody = new URLSearchParams();
      requestBody.append('username', paymentSettings.public_key);
      requestBody.append('password', paymentSettings.secret_key);
      requestBody.append('grant_type', 'password');
      const token = await axios.post(TIGO_TOKEN, requestBody, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      console.log(token);

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

      const response = await axios.post(PAY_URL, payload, {
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

  async handleW2aWebhook(data) {
    console.log('TIGO-W2A-WEBHOOK');
    console.log(data);

    try {
      const paymentSettings = await this.tigoSettings(data.client_id);
      if (!paymentSettings)
        return {
          success: false,
          message: 'Tigo has not been configured for client',
        };
      console.log('TEST 2');

      const user = await this.walletRepository.findOne({
        where: { username: data.msisdn },
      });

      if (!user) {
        await this.callbacklogRepository.save({
          client_id: data.clientId,
          request: 'User not found',
          response: JSON.stringify(data.rawBody),
          status: 1,
          type: 'Webhook',
          transaction_id: data.txnId,
          paymentMethod: 'Tigo',
        });
        return {
          success: false,
          message: 'User not found',
          status: HttpStatus.NOT_FOUND,
        };
      }
      console.log('THE_USER:::', user);
      console.log('THE_USER_ID:::', user.user_id);
      const existingTransaction = await this.transactionRepository.findOne({
        where: {
          client_id: data.clientId,
          transaction_no: data.txnId,
          tranasaction_type: 'credit',
        },
      });
      console.log('CHECK_EXIST:::', existingTransaction);

      if (
        existingTransaction &&
        existingTransaction.transaction_no === data.txnId &&
        existingTransaction.status === 1
      ) {
        await this.callbacklogRepository.save({
          client_id: data.clientId,
          request: 'Transaction already successful',
          response: JSON.stringify(data.rawBody),
          status: 1,
          type: 'Webhook',
          transaction_id: existingTransaction.transaction_no,
          paymentMethod: 'Tigo',
        });
        return {
          success: false,
          refId: data.txnId,
          message: 'Transaction already successful',
        };
      }

      const trx = await this.helperService.saveTransaction({
        amount: data.amount,
        channel: 'tigo-w2a',
        clientId: data.clientId,
        toUserId: user.user_id,
        toUsername: data.msisdn,
        toUserBalance: user.available_balance,
        fromUserId: user.user_id,
        fromUsername: 'System',
        fromUserbalance: 0,
        status: 0,
        source: 'mobile',
        subject: 'Deposit',
        description: 'Mobile Deposit (Tigo)',
        transactionNo: data.txnId,
      });

      console.log('TRX', trx);

      const transaction = await this.transactionRepository.findOne({
        where: {
          client_id: data.clientId,
          transaction_no: data.txnId,
          tranasaction_type: 'credit',
        },
      });

      console.log('TRX', transaction);
      console.log('TRX-USER-ID', transaction.user_id);

      if (!transaction) {
        await this.callbacklogRepository.save({
          client_id: data.clientId,
          request: 'Transaction not found',
          response: JSON.stringify(data.rawBody),
          status: 0,
          type: 'Webhook',
          transaction_id: data.txnId,
          paymentMethod: 'Tigo',
        });

        return {
          success: false,
          message: 'Transaction not found',
          status: HttpStatus.NOT_FOUND,
        };
      }

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
        await this.callbacklogRepository.save({
          client_id: data.clientId,
          request: 'Wallet not found',
          response: JSON.stringify(data.rawBody),
          status: 0,
          type: 'Webhook',
          transaction_id: data.txnId,
          paymentMethod: 'Tigo',
        });
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

      await this.callbacklogRepository.save({
        client_id: data.clientId,
        request: 'Completed',
        response: JSON.stringify(data.rawBody),
        status: 1,
        type: 'Webhook',
        transaction_id: data.txnId,
        paymentMethod: 'Tigo',
      });

      return {
        success: true,
        refId: data.txnId,
        message: 'Transaction successfully verified and processed',
      };
    } catch (error) {
      console.log('Tigo error', error);
      return { success: false, message: 'error occurred' };
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

      if (!transaction) {
        await this.callbacklogRepository.save({
          client_id: data.clientId,
          request: 'Transaction not found',
          response: JSON.stringify(data.rawBody),
          status: 0,
          type: 'Webhook',
          transaction_id: data.reference,
          paymentMethod: 'Tigo',
        });
        return {
          success: false,
          message: 'Transaction not found',
          status: HttpStatus.NOT_FOUND,
        };
      }

      if (transaction.status === 1) {
        await this.callbacklogRepository.save({
          client_id: data.clientId,
          request: 'Transaction already successful',
          response: JSON.stringify(data.rawBody),
          status: 1,
          type: 'Webhook',
          transaction_id: data.reference,
          paymentMethod: 'Tigo',
        });
        return {
          success: true,
          message: 'Transaction already successful',
        };
      }

      const wallet = await this.walletRepository.findOne({
        where: { user_id: transaction.user_id },
      });

      console.log('🔍 Found Wallet:', JSON.stringify(wallet, null, 2));

      if (!wallet) {
        console.error('❌ Wallet not found for user_id:', transaction.user_id);
        await this.callbacklogRepository.save({
          client_id: data.clientId,
          request: 'Wallet not found',
          response: JSON.stringify(data.rawBody),
          status: 0,
          type: 'Webhook',
          transaction_id: data.reference,
          paymentMethod: 'Tigo',
        });
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

      await this.callbacklogRepository.save({
        client_id: data.clientId,
        request: 'Completed',
        response: JSON.stringify(data.rawBody),
        status: 1,
        type: 'Webhook',
        transaction_id: data.reference,
        paymentMethod: 'Tigo',
      });

      return {
        success: true,
        message: 'Transaction successfully verified and processed',
      };
    } catch (error) {
      console.log('Tigo error', error);
      return { success: false, message: 'error occurred' };
    }
  }

  async handleWithdrawal(data) {
    console.log('TIGO-WEBHOOK');

    console.log('TEST');

    const paymentSettings = await this.tigoSettings(data.client_id);
    if (!paymentSettings)
      return {
        success: false,
        message: 'Tigo has not been configured for client',
      };
    console.log('TEST 2');

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

      console.log('✅ Withdrawal successful:', response.data);
      return response.data;
    } catch (error) {
      console.error(
        '❌ Error during Tigo payment Withdrawal:',
        error.response?.data || error.message,
      );
      return {
        success: false,
        message: 'Payment request failed',
        error: error.response?.data || error.message,
      };
    }
  }

  async handleDisbusment(data, clientId) {
    const paymentSettings = await this.tigoSettings(clientId);
    if (!paymentSettings)
      return {
        success: false,
        message: 'Tigo has not been configured for client',
      };

    const xmlPayload = create({ version: '1.0' })
      .ele('COMMAND')
      .ele('TYPE')
      .txt('REQMFICI')
      .up()
      .ele('REFERENCEID')
      .txt(data.referenceId)
      .up()
      .ele('MSISDN')
      .txt(data.userMsisdn)
      .up()
      .ele('PIN')
      .txt(paymentSettings.secret_key)
      .up()
      .ele('MSISDN1')
      .txt(paymentSettings.merchant_id)
      .up()
      .ele('AMOUNT')
      .txt(data.amount.toString())
      .up()
      .ele('SENDERNAME')
      .txt(data.datauserName)
      .up()
      .ele('BRAND_ID')
      .txt('5714')
      .up()
      .ele('LANGUAGE1')
      .txt('en')
      .end({ prettyPrint: true });

    const url =
      clientId === 4
        ? 'https://accessgwtest.tigo.co.tz:8443/Kamili2DM-MFICashIn'
        : 'https://tmk-accessgw.tigo.co.tz:8443/Kamili22DMMFICashIn';

    try {
      const res = await axios.post(url, xmlPayload, {
        headers: { 'Content-Type': 'application/xml' },
      });

      console.log('Tigo Withdrawal Response:', res.data);
      return {
        success: true,
        rawResponse: res.data,
      };
    } catch (error) {
      console.error(
        'Tigo withdrawal error:',
        error.response?.data || error.message,
      );
      return {
        success: false,
        message: 'Withdrawal failed',
        error: error.response?.data || error.message,
      };
    }
  }
}
