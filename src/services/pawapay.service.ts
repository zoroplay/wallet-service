/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
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

    private helperService: HelperService,
  ) {}

  async generatePaymentLink(data, clientId): Promise<{
    success: boolean;
    data?: any;
    depositId?: string;
    message?: string;
  }> {
    try {
      const settings = await this.pawapaySettings(clientId);

      const depositId = uuidv4();
      const requestBody = {
        depositId,
        returnUrl: data.callback_url,
        statementDescription: 'Online Deposit',
        amount: data.amount,
        msisdn: data.username,
        currency: data.currency,
        reason: 'Deposit',
      };
      const res = await axios.post(
        `${settings.base_url}/widget/sessions`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.secret_key}`,
          },
        },
      );
      return { success: true, data: res.data, depositId };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
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
    return `${algorithm}=:${digest}:`;
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
      const settings = await this.pawapaySettings(clientId)

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
        `${process.env.PAWA_PAY_API}/refunds`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Content-Digest': contentDigest,
            Authorization: `Bearer ${process.env.PAWA_PAY_API_TOKEN}`,
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
    clientId: number
  }): Promise<{
    success: boolean;
    data?: any;
    transactionNo?: string;
    message?: string;
  }> {
    try {
      const settings = await this.pawapaySettings(clientId);

      const _corr = await this.predictCorrespondent(`255${user.username}`);

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

  async createPayout({
    user,
    amount,
    payoutId,
    operator,
    clientId
  }: {
    user: any;
    amount: number;
    payoutId: string;
    operator: string;
    clientId: number;
  }): Promise<{
    success: boolean;
    data?: any;
    transactionNo?: string;
    message?: string;
  }> {
    try {
      const settings = await this.pawapaySettings(clientId)

      const _corr = await this.predictCorrespondent(`255${user.username}`);
      const requestBody = {
        payoutId,
        amount: amount,
        currency: 'TZS',
        // country: _corr.data.country,
        // correspondent: _corr.data.correspondent,
        country: 'TZA',
        correspondent: operator,
        recipient: {
          type: 'MSISDN',
          address: { value: `255${user.username}` },
        },
        statementDescription: 'Online Payouts',
        customerTimestamp: new Date(),
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
        `${settings.base_url}/payouts`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.secret_key}`,
            'Content-Digest': contentDigest,
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
        transactionNo: res.data.payoutId,
      };
    } catch (e) {
      return {
        success: false,
        message: e.message,
      };
    }
  }

  async cancelPayout(payoutId: string, clientId: number): Promise<{
    success: boolean;
    data?: any;
    transactionNo?: string;
    message?: string;
  }> {
    try {
      const settings = await this.pawapaySettings(clientId)

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
    clientId
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
    const settings = await this.pawapaySettings(clientId)

    const _corr = await this.predictCorrespondent(`255${user.username}`);
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

  async depositResendCallback(depositId) {
    try {
      const res = await axios.post(
        `${process.env.PAWA_PAY_API}/deposits/resend-callback`,
        JSON.stringify({
          depositId,
        }),
        {
          headers: {
            Authorization: `Bearer ${process.env.PAWA_PAY_API_TOKEN}`,
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

  async payoutResendCallback(payoutId) {
    try {
      const res = await axios.post(
        `${process.env.PAWA_PAY_API}/payouts/resend-callback`,
        JSON.stringify({
          payoutId,
        }),
        {
          headers: {
            Authorization: `Bearer ${process.env.PAWA_PAY_API_TOKEN}`,
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

  async refundResendCallback(refundId) {
    try {
      const { data } = await axios.post(
        `${process.env.PAWA_PAY_API}/refunds/resend-callback`,
        JSON.stringify({
          refundId,
        }),
        {
          headers: {
            Authorization: `Bearer ${process.env.PAWA_PAY_API_TOKEN}`,
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

  async fetchDeposits(depositId) {
    try {
      const res = await axios.get(
        `${process.env.PAWA_PAY_API}/deposits/${depositId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAWA_PAY_API_TOKEN}`,
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

  async fetchPayouts(payoutId) {
    try {
      const res = await axios.get(
        `${process.env.PAWA_PAY_API}/payouts/${payoutId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAWA_PAY_API_TOKEN}`,
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

  async fetchRefunds(refundId) {
    try {
      const { data } = await axios.get(
        `${process.env.PAWA_PAY_API}/refunds/${refundId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.PAWA_PAY_API_TOKEN}`,
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

  async fetchAvailability() {
    try {
      const res = await axios.get(`${process.env.PAWA_PAY_API}/availability`, {
        headers: {
          Authorization: `Bearer ${process.env.PAWA_PAY_API_TOKEN}`,
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

  async fetchActiveConf() {
    try {
      const res = await axios.get(`${process.env.PAWA_PAY_API}/active-conf`, {
        headers: {
          Authorization: `Bearer ${process.env.PAWA_PAY_API_TOKEN}`,
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

  async fetchPublicKey() {
    try {
      const { data } = await axios.get(
        `${process.env.PAWA_PAY_API}/public-key/http`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAWA_PAY_API_TOKEN}`,
          },
        },
      );

      return { success: true, data };
    } catch (e) {
      return {
        success: false,
        message: e.message,
      };
    }
  }

  async predictCorrespondent(phoneNumber: string) {
    try {
      const res = await axios.post(
        `${process.env.PAWA_PAY_API_V1}/predict-correspondent`,
        { msisdn: phoneNumber },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.PAWA_PAY_API_TOKEN}`,
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

  async fetchWalletBalances() {
    try {
      const res: any = await axios.get(
        `${process.env.PAWA_PAY_API}/wallet-balances`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAWA_PAY_API_TOKEN}`,
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

  async fetchCountryWalletBalances(country: string) {
    try {
      const res: any = await axios.get(
        `${process.env.PAWA_PAY_API}/wallet-balances/${country}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAWA_PAY_API_TOKEN}`,
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

  private async pawapaySettings(client_id: number) {
    return await this.paymentMethodRepository.findOne({
      where: {
        provider: 'pawapay',
        client_id,
      },
    });
  }
}
