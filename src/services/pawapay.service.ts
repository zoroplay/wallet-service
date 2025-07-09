/* eslint-disable prettier/prettier */
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import { HelperService } from './helper.service';
import { v4 as uuidv4 } from 'uuid';
import { IdentityService } from 'src/identity/identity.service';
import axios from 'axios';
import { CallbackLog } from 'src/entity/callback-log.entity';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
export class PawapayService {
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

    @InjectRepository(CallbackLog)
    private callbacklogRepository: Repository<CallbackLog>,

    @InjectQueue('withdrawal')
    private readonly withdrawalQueue: Queue,

    private helperService: HelperService,
  ) {}

  private async pawapaySettings(client_id: number) {
    return await this.paymentMethodRepository.findOne({
      where: {
        provider: 'pawapay',
        client_id,
      },
    });
  }

  async generatePaymentLink(data, client_id) {
    try {
      console.log('CHECK-1');
      const settings = await this.pawapaySettings(client_id);

      if (!settings)
        return {
          success: false,
          message: 'PawaPay has not been configured for client',
        };
      console.log('PAYLOAD:::', data);

      // const url = 'https://api.pawapay.io';
      // const key = process.env.PAWAPAY_PROD;

      const response = await fetch(`${settings.base_url}/deposits`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.secret_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();
      console.log('FULL RESPONSE:::::::', responseData);

      console.log('CHECK-3');

      return {
        success: true,
        message: 'Payment link generated successfully',
        data: {
          depositId: responseData.depositId,
          status: responseData.status,
        },
      };
    } catch (error) {
      console.error(
        'PawaPay Error:',
        error.response ? error.responseData.data : error.message,
      );
      return {
        success: false,
        message: error.responseData?.data.errorMessage || error.message,
      };
    }
  }

  async verifyTransaction(param) {
    console.log('THE_PARAM:::', param);
    try {
      const paymentSettings = await this.pawapaySettings(param.client_id);
      if (!paymentSettings)
        return {
          success: false,
          message: 'PawaPay has not been configured for client',
        };

      console.log(param.depositId);

      if (param.depositId !== '') {
        const transaction = await this.transactionRepository.findOne({
          where: {
            client_id: param.clientId,
            transaction_no: param.depositId,
            tranasaction_type: 'credit',
          },
        });
        console.log('TRX', transaction.transaction_no);

        if (!transaction) {
          await this.callbacklogRepository.save({
            client_id: param.clientId,
            request: 'Transaction not found',
            response: JSON.stringify(param.rawBody),
            status: 0,
            type: 'Webhook',
            transaction_id: param.depositId,
            paymentMethod: 'PawaPay',
          });
          return {
            success: false,
            message: 'Transaction not found',
            status: HttpStatus.NOT_FOUND,
          };
        }

        if (param.status === 'COMPLETED') {
          if (transaction.status === 1) {
            await this.callbacklogRepository.save({
              client_id: param.clientId,
              request: 'Transaction already successful',
              response: JSON.stringify(param.rawBody),
              status: 1,
              type: 'Webhook',
              transaction_id: param.depositId,
              paymentMethod: 'PawaPay',
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
            console.error(
              '❌ Wallet not found for user_id:',
              transaction.user_id,
            );
            await this.callbacklogRepository.save({
              client_id: param.clientId,
              request: 'Wallet not found ',
              response: JSON.stringify(param.rawBody),
              status: 0,
              type: 'Webhook',
              transaction_id: param.depositId,
              paymentMethod: 'PawaPay',
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
            client_id: param.clientId,
            request: 'Completed',
            response: JSON.stringify(param.rawBody),
            status: 1,
            type: 'Webhook',
            transaction_id: param.depositId,
            paymentMethod: 'PawaPay',
          });

          return {
            success: true,
            message: 'Transaction successfully verified and processed',
          };
        }
      }
    } catch (error) {
      console.log(error);
      return {
        success: false,
        message: `Unable to verify transaction: ${error.message}`,
      };
    }
  }

  async initiatePayout(data, client_id) {
    try {
      console.log('🔄 Initiating Payout');

      const settings = await this.pawapaySettings(client_id);
      if (!settings) {
        return {
          success: false,
          message: 'PawaPay has not been configured for client',
        };
      }

      const response = await axios.get(
        'https://api.sandbox.pawapay.io/v1/wallet-balances',
        {
          headers: {
            Authorization: `Bearer ${settings.secret_key}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const balances = response.data.balances;

      // Find the balance for Tanzanian Shillings (TZS)
      const tanzaniaBalance = balances.find((b) => b.currency === 'TZS');

      if (tanzaniaBalance) {
        console.log(
          `PawaPay Balance for Tanzania: ${tanzaniaBalance.amount} TZS`,
        );
      } else {
        console.log('No balance found for Tanzanian Shillings (TZS)');
      }

      if (tanzaniaBalance < data.balance) {
      }

      console.log('PawaPay Balances:', response.data);

      const payload = {
        payoutId: data.payoutId,
        amount: data.amount,
        currency: data.currency,
        correspondent: data.correspondent,
        recipient: {
          address: data.recipient.address,
        },
        customerTimestamp: new Date().toISOString(),
        statementDescription: data.statementDescription,
        country: data.country || undefined,
        metadata: data.metadata || [],
      };

      console.log('📤 Sending Payout Request:', payload);

      const res = await axios.post(`${settings.base_url}/payouts`, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.secret_key}`,
        },
      });

      console.log('✅ Payout Response:', res.data);
      return { success: true, data: res.data };
    } catch (error) {
      console.error(
        '❌ PawaPay Payout Error:',
        error.response ? error.response.data : error.message,
      );
      return {
        success: false,
        message: error.response ? error.response.data : error.message,
      };
    }
  }

  async requestRefund(depositId, amount) {
    try {
      const refundId = uuidv4(); // Generate a unique refund ID

      const payload = {
        refundId: refundId,
        depositId: depositId,
        amount: amount.toString(), // Convert amount to string
        metadata: [
          { fieldName: 'orderId', fieldValue: 'ORD-123456789' },
          {
            fieldName: 'customerId',
            fieldValue: 'customer@email.com',
            isPII: true,
          },
        ],
      };

      const response = await axios.post(
        'https://api.sandbox.pawapay.io/v1/refunds',
        payload,
        {
          headers: {
            Authorization: 'Bearer YOUR_API_KEY',
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('Refund Request Response:', response.data);
    } catch (error) {
      console.error(
        'Refund Request Failed:',
        error.response ? error.response.data : error.message,
      );
    }
  }

  signRequest(
    contentDigest: string,
    url: string,
    method: string,
  ): { signature: string; signatureInput: string } {
    const signatureInput = `(request-target): ${method.toLowerCase()} ${url}\ncontent-digest: ${contentDigest}`;
    const sign = crypto.createSign('RSA-SHA512');
    sign.update(signatureInput);
    sign.end();
    const signature = sign.sign(process.env.PAWAPAY_PRIVATE_KEY, 'base64');
    const signatureHeader = `keyId="my-key-id",algorithm="rsa-sha512",headers="(request-target) content-digest",signature="${signature}"`;
    return { signature: signatureHeader, signatureInput: signatureInput };
  }

  generateContentDigest(body: any): string {
    const algorithm = 'sha-512';
    const hash = crypto.createHash(algorithm);
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    hash.update(data);
    const digest = hash.digest('base64');
    return `${algorithm}=:${digest}`; // removed final colon
  }

  async createRefund(
    user: any,
    amount: number,
    refundId: string,
    depositId: string,
    clientId: number,
  ): Promise<{
    success: boolean;
    data?: any;
    transactionNo?: string;
    message?: string;
  }> {
    try {
      const settings = await this.pawapaySettings(clientId);

      const requestBody = {
        refundId,
        depositId,
        amount: amount,
        metadata: [
          {
            fieldName: 'customerId',
            fieldValue: user.email,
          },
        ],
      };
      const contentDigest = this.generateContentDigest(requestBody);
      const res = await axios.post(
        `${settings.base_url}/refunds`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Content-Digest': contentDigest,
            Authorization: `Bearer ${settings.secret_key}`,
          },
        },
      );
      if (res.data.status === 'REJECTED')
        return {
          success: false,
          message: res.data.rejectionReason.rejectionMessage,
        };

      if (res.data.status === 'DUPLICATE_IGNORED')
        return {
          success: false,
          message: res.data.rejectionReason.rejectionMessage,
        };

      return {
        success: true,
        data: res.data,
        transactionNo: res.data.refundId,
      };
    } catch (e) {
      return {
        success: false,
        message: e.message,
      };
    }
  }

  async createDeposit({
    user,
    amount,
    operator,
    depositId,
    clientId,
  }: {
    user: any;
    amount: number;
    operator: string;
    depositId: string;
    clientId: number;
  }): Promise<{
    success: boolean;
    data?: any;
    transactionNo?: string;
    message?: string;
  }> {
    try {
      const settings = await this.pawapaySettings(clientId);

      const requestBody = {
        depositId,
        amount: `${amount}`,
        currency: 'TZS',
        country: 'TZA',
        correspondent: operator,
        payer: { type: 'MSISDN', address: { value: `255${user.username}` } },
        statementDescription: 'Online Withdrawal',
        customerTimestamp: new Date(),
        preAuthorisationCode: user.pin,
        metadata: [
          {
            fieldName: 'customerId',
            fieldValue: user.email,
            isPII: true,
          },
        ],
      };

      const contentDigest = this.generateContentDigest(requestBody);
      const res = await axios.post(
        `${settings.base_url}/deposits`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Content-Digest': contentDigest,
            Authorization: `Bearer ${settings.secret_key}`,
          },
        },
      );
      if (res.data.status === 'REJECTED') {
        return {
          success: false,
          message: res.data.rejectionReason.rejectionMessage,
        };
      }
      if (res.data.status === 'DUPLICATE_IGNORED')
        return {
          success: false,
          message: res.data.rejectionReason.rejectionMessage,
        };

      return {
        success: true,
        data: res.data,
        transactionNo: res.data.depositId,
      };
    } catch (error) {
      console.log('error:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async createPayout(data, clientId) {
    console.log(clientId);
    try {
      const settings = await this.pawapaySettings(data.clientId);

      let username = data.username;
      if (!username.startsWith('255')) {
        username = '255' + username.replace(/^0+/, '');
      }

      const correspondent = await this.helperService.getCorrespondent(username);
      console.log(correspondent);

      const payoutPayload = {
        payoutId: data.withdrawal_code,
        amount: data.amount.toString(),
        currency: 'TZS',
        country: 'TZA',
        correspondent: correspondent,
        recipient: {
          address: { value: username },
          type: 'MSISDN',
        },
        statementDescription: 'Online Payouts',
        customerTimestamp: new Date(),
        metadata: [
          {
            fieldName: 'customerId',
            fieldValue: username,
            isPII: true,
          },
        ],
      };

      const res = await axios.post(
        `${settings.base_url}/payouts`,
        payoutPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.secret_key}`,
          },
        },
      );
      console.log('THE RESP', res.data);
      console.log('THE Status', res.data.status);
      if (res.data.status === 'ACCEPTED') {
        return {
          success: true,
          data: res.data,
          transactionNo: res.data.payoutId,
        };
      }
    } catch (e) {
      console.log('FROM', e);
      return {
        success: false,
        message: e.message,
      };
    }
  }

  async pawapayPayout(data) {
    try {
      console.log('FOM PAY', data);
      const wallet = await this.walletRepository.findOne({
        where: {
          user_id: data.userId,
          client_id: data.clientId,
        },
      });

      if (!wallet) {
        return { success: false, message: 'Wallet not found' };
      }

      if (wallet.available_balance < data.amount) {
        return {
          success: false,
          message: 'Insufficient wallet balance for payout',
        };
      }

      const autoDisbursement = await this.identityService.getWithdrawalSettings(
        {
          clientId: data.clientId,
          userId: data.userId,
        },
      );

      console.log('autoDisbursement', autoDisbursement);

      if (autoDisbursement.minimumWithdrawal > data.amount)
        return {
          success: false,
          status: HttpStatus.BAD_REQUEST,
          message:
            'Minimum withdrawable amount is ' +
            autoDisbursement.minimumWithdrawal,
          data: null,
        };

      if (autoDisbursement.maximumWithdrawal < data.amount)
        return {
          success: false,
          status: HttpStatus.BAD_REQUEST,
          message:
            'Maximum withdrawable amount is ' +
            autoDisbursement.maximumWithdrawal,
          data: null,
        };

      const jobData: any = { ...data };
      jobData.autoDisbursement = autoDisbursement;
      jobData.withdrawalCode = uuidv4();
      jobData.balance = wallet.available_balance;

      await this.withdrawalQueue.add('mobile-money-request', jobData, {
        jobId: `${data.userId}:${data.clientId}:${data.operator}:${data.amount}`,
        delay: 5000,
      });

      return {
        success: true,
        status: HttpStatus.OK,
        message: 'Successful',
        data: {
          balance: jobData.balance,
          code: jobData.withdrawalCode,
        },
      };
    } catch (e) {
      return {
        success: false,
        message: e.message,
      };
    }
  }

  async cancelPayout(
    payoutId: string,
    clientId: number,
  ): Promise<{
    success: boolean;
    data?: any;
    transactionNo?: string;
    message?: string;
  }> {
    try {
      const settings = await this.pawapaySettings(clientId);

      const { data }: any = await axios.post(
        `${settings.base_url}/payouts/fail-enqueued/${payoutId}`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.secret_key}`,
          },
        },
      );
      if (data.status === 'REJECTED')
        return {
          success: false,
          message: data.rejectionReason,
        };

      if (data.status === 'DUPLICATE_IGNORED')
        return {
          success: false,
          message: data.rejectionReason,
        };

      return { success: true, data: data, transactionNo: data.payoutId };
    } catch (e) {
      return {
        success: false,
        message: e.message,
      };
    }
  }

  async createBulkPayout({
    user,
    amounts,
    operator,
    clientId,
  }: {
    user: any;
    operator: string;
    amounts: number[];
    clientId: number;
  }): Promise<{
    success: boolean;
    data?: any;
    transactionRefs?: any[];
    message?: string;
  }> {
    const settings = await this.pawapaySettings(clientId);

    try {
      const requestBody = amounts.map((amount) => {
        const payoutId = uuidv4();
        return {
          payoutId,
          amount: `${amount}`,
          currency: 'TZS',
          country: 'TZA',
          correspondent: operator,
          recipient: {
            type: 'MSISDN',
            address: { value: `255${user.username}` },
          },
          statementDescription: 'Online Bulk Payouts',
          customerTimestamp: new Date(),
          preAuthorisationCode: user.pin,
          metadata: [
            {
              fieldName: 'customerId',
              fieldValue: user.email,
              isPII: true,
            },
          ],
        };
      });
      let transactionRefs = requestBody.map((_body) => {
        return {
          transactionRef: _body.payoutId,
          amount: _body.amount,
        };
      });
      const contentDigest = this.generateContentDigest(requestBody);
      const res = await axios.post(
        `${settings.base_url}/payouts/bulk`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.secret_key}`,
            'Content-Digest': contentDigest,
          },
        },
      );
      transactionRefs = transactionRefs.map((transaction, _index) => {
        const _status = res.data.find((_, index) => index === _index);
        return {
          ...transaction,
          status: _status.status,
        };
      });
      return {
        success: true,
        data: res.data,
        transactionRefs,
      };
    } catch (e) {
      return {
        success: false,
        message: e.message,
      };
    }
  }

  async depositResendCallback(depositId, clientId) {
    try {
      const settings = await this.pawapaySettings(clientId);

      const res = await axios.post(
        `${settings.base_url}/deposits/resend-callback`,
        JSON.stringify({
          depositId,
        }),
        {
          headers: {
            Authorization: `Bearer ${settings.secret_key}`,
          },
        },
      );

      return { success: true, data: res.data };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async payoutResendCallback(payoutId, clientId) {
    try {
      const settings = await this.pawapaySettings(clientId);

      const res = await axios.post(
        `${settings.base_url}/payouts/resend-callback`,
        JSON.stringify({
          payoutId,
        }),
        {
          headers: {
            Authorization: `Bearer ${settings.secret_key}`,
          },
        },
      );

      if (res.data.status === 'REJECTED')
        return { success: false, message: res.data.rejectionReason };

      if (res.data.status === 'FAILED ')
        return { success: false, message: res.data.rejectionReason };

      return { success: true, data: res.data };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async refundResendCallback(refundId, clientId) {
    try {
      const settings = await this.pawapaySettings(clientId);

      const { data } = await axios.post(
        `${settings.base_url}/refunds/resend-callback`,
        JSON.stringify({
          refundId,
        }),
        {
          headers: {
            Authorization: `Bearer ${settings.secret_key}`,
          },
        },
      );

      if (data.status === 'REJECTED')
        return { success: false, message: data.rejectionReason };

      if (data.status === 'FAILED ')
        return { success: false, message: data.rejectionReason };

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async fetchDeposits(depositId, clientId) {
    try {
      const settings = await this.pawapaySettings(clientId);

      const res = await axios.get(
        `${settings.base_url}/deposits/${depositId}`,
        {
          headers: {
            Authorization: `Bearer ${settings.secret_key}`,
          },
        },
      );

      if (res[0].status === 'REJECTED')
        return { success: false, message: 'REJECTED' };

      if (res[0].status === 'DUPLICATE_IGNORED')
        return { success: false, message: 'DUPLICATE_IGNORED' };

      return { success: true, data: res[0].data };
    } catch (e) {
      return {
        success: false,
        message: e.message,
      };
    }
  }

  async fetchPayouts(payoutId, clientId) {
    try {
      const settings = await this.pawapaySettings(clientId);

      const res = await axios.get(`${settings.base_url}/payouts/${payoutId}`, {
        headers: {
          Authorization: `Bearer ${settings.secret_key}`,
        },
      });

      if (res[0].status === 'REJECTED')
        return { success: false, message: 'REJECTED' };

      if (res[0].status === 'DUPLICATE_IGNORED')
        return { success: false, message: 'DUPLICATE_IGNORED' };

      return { success: true, data: res[0].data };
    } catch (e) {
      return {
        success: false,
        message: e.message,
      };
    }
  }

  async fetchRefunds(refundId, clientId) {
    try {
      const settings = await this.pawapaySettings(clientId);

      const { data } = await axios.get(
        `${settings.base_url}/refunds/${refundId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.secret_key}`,
          },
        },
      );
      if (data[0].status === 'REJECTED')
        return { success: false, message: 'REJECTED' };

      if (data[0].status === 'DUPLICATE_IGNORED')
        return { success: false, message: 'DUPLICATE_IGNORED' };

      return { success: true, data: data };
    } catch (e) {
      return {
        success: false,
        message: e.message,
      };
    }
  }

  async fetchAvailability(clientId) {
    try {
      const settings = await this.pawapaySettings(clientId);

      const res = await axios.get(`${settings.base_url}/availability`, {
        headers: {
          Authorization: `Bearer ${settings.secret_key}`,
        },
      });

      return { success: true, data: res.data };
    } catch (e) {
      return {
        success: false,
        message: e.message,
      };
    }
  }

  async fetchActiveConf(clientId) {
    try {
      const settings = await this.pawapaySettings(clientId);

      const res = await axios.get(`${settings.base_url}/active-conf`, {
        headers: {
          Authorization: `Bearer ${settings.secret_key}`,
        },
      });

      return { success: true, data: res.data };
    } catch (e) {
      return {
        success: false,
        message: e.message,
      };
    }
  }

  async fetchPublicKey(clientId) {
    const settings = await this.pawapaySettings(clientId);

    try {
      const { data } = await axios.get(`${settings.base_url}/public-key/http`, {
        headers: {
          Authorization: `Bearer ${settings.secret_key}`,
        },
      });

      return { success: true, data };
    } catch (e) {
      return {
        success: false,
        message: e.message,
      };
    }
  }

  async predictCorrespondent(phoneNumber: string, clientId) {
    try {
      const settings = await this.pawapaySettings(clientId);

      const res = await axios.post(
        `${settings.base_url}/predict-correspondent`,
        { msisdn: phoneNumber },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.secret_key}`,
          },
        },
      );
      return { success: true, data: res.data };
    } catch (e) {
      return {
        success: false,
        message: e.message,
      };
    }
  }

  async fetchWalletBalances(clientId) {
    try {
      const settings = await this.pawapaySettings(clientId);

      const res: any = await axios.get(`${settings.base_url}/wallet-balances`, {
        headers: {
          Authorization: `Bearer ${settings.secret_key}`,
        },
      });

      return { success: true, data: res.data.balances };
    } catch (e) {
      return {
        success: false,
        message: e.message,
      };
    }
  }

  async fetchCountryWalletBalances(country: string, clientId) {
    try {
      const settings = await this.pawapaySettings(clientId);

      const res: any = await axios.get(
        `${settings.base_url}/wallet-balances/${country}`,
        {
          headers: {
            Authorization: `Bearer ${settings.secret_key}`,
          },
        },
      );

      return { success: true, data: res.data.balances };
    } catch (e) {
      return {
        success: false,
        message: e.message,
      };
    }
  }
}
