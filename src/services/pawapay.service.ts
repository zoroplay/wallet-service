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

  async generatePaymentLink(data): Promise<{
    success: boolean;
    data?: any;
    depositId?: string;
    message?: string;
  }> {
    try {
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
        `${process.env.PAWA_PAY_API_V1}/widget/sessions`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.PAWA_PAY_API_TOKEN}`,
          },
        },
      );
      return { success: true, data: res.data, depositId };
    } catch (e) {
      return {
        success: false,
        message: 'Unable to initiate deposit with paystack',
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
    const signature = sign.sign(process.env.PRIVATE_KEY, 'base64');
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
  ): Promise<{
    success: boolean;
    data?: any;
    transactionNo?: string;
    message?: string;
  }> {
    try {
      // console.log('user, amount, 2345:', user, amount, 2345);
      const requestBody = {
        refundId,
        depositId,
        amount: amount,
        metadata: [
          {
            fieldName: 'customerId',
            fieldValue: user.email,
            isPII: true,
          },
        ],
      };
      // console.log(33, requestBody);
      const contentDigest = this.generateContentDigest(requestBody);
      // console.log(55, contentDigest);
      const { signature, signatureInput } = this.signRequest(
        contentDigest,
        `${process.env.PAWA_PAY_API_V1}/refunds`,
        'POST',
      );

      console.log(77, signature, signatureInput);
      const res = await axios.post(
        `${process.env.PAWA_PAY_API_V1}/refunds`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Content-Digest': contentDigest,
            Signature: signature,
            'Signature-Input': signatureInput,
            'Accept-Signature': 'ecdsa-p512-sha512',
            'Accept-Digest': 'sha-512',
            Authorization: `Bearer ${process.env.PAWA_PAY_API_TOKEN}`,
          },
        },
      );

      if (res.data.status === 'REJECTED')
        return { success: false, message: res.data.rejectionReason };

      if (res.data.status === 'DUPLICATE_IGNORED')
        return { success: false, message: res.data.rejectionReason };

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

  async createDeposit(
    user: any,
    amount: number,
    depositId: string,
  ): Promise<{
    success: boolean;
    data?: any;
    transactionNo?: string;
    message?: string;
  }> {
    try {
      const requestBody = {
        depositId,
        amount: amount,
        currency: user.currency,
        country: user.country,
        correspondent: 'MTN_MOMO_ZMB',
        payer: { type: 'MSISDN', address: { value: user.username } },
        statementDescription: 'Online Withdrawal',
        customerTimestamp: Date.now(),
        preAuthorisationCode: 'string',
        metadata: [
          {
            fieldName: 'customerId',
            fieldValue: user.email,
            isPII: true,
          },
        ],
      };
      console.log(33, requestBody);
      const contentDigest = this.generateContentDigest(requestBody);
      console.log(55, contentDigest);
      const { signature, signatureInput } = this.signRequest(
        contentDigest,
        `${process.env.PAWA_PAY_API_V1}/deposits`,
        'POST',
      );
      console.log(77, signature, signatureInput);

      const res = await axios.post(
        `${process.env.PAWA_PAY_API_V1}/deposits`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Content-Digest': contentDigest,
            Signature: signature,
            'Signature-Input': signatureInput,
            'Accept-Signature': 'ecdsa-p512-sha512',
            'Accept-Digest': 'sha-512',
            Authorization: `Bearer ${process.env.PAWA_PAY_API_TOKEN}`,
          },
        },
      );

      if (res.data.status === 'REJECTED') {
        console.log('res.data:', res.data);
        return { success: false, message: res.data.rejectionReason };
      }
      if (res.data.status === 'DUPLICATE_IGNORED')
        return { success: false, message: res.data.rejectionReason };

      return {
        success: true,
        data: res.data,
        transactionNo: res.data.depositId,
      };
    } catch (e) {
      return {
        success: false,
        message: 'Unable to initiate deposit with paystack',
      };
    }
  }

  async createPayout(
    user: any,
    amount: number,
    payoutId: string,
  ): Promise<{
    success: boolean;
    data?: any;
    transactionNo?: string;
    message?: string;
  }> {
    try {
      const requestBody = {
        payoutId,
        amount: amount,
        currency: user.currency,
        country: user.country,
        correspondent: 'MTN_MOMO_ZMB',
        recipient: { type: 'MSISDN', address: { value: user.username } },
        statementDescription: 'Online Withdrawal',
        customerTimestamp: Date.now(),
        metadata: [
          {
            fieldName: 'customerId',
            fieldValue: user.email,
            isPII: true,
          },
        ],
      };
      const contentDigest = this.generateContentDigest(requestBody);
      // console.log(55, contentDigest);
      const { signature, signatureInput } = this.signRequest(
        contentDigest,
        `${process.env.PAWA_PAY_API_V1}/payouts`,
        'POST',
      );

      const res = await axios.post(
        `${process.env.PAWA_PAY_API_V1}/payouts`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.PAWA_PAY_API_TOKEN}`,
            'Content-Digest': contentDigest,
            Signature: signature,
            'Signature-Input': signatureInput,
            'Accept-Signature': 'ecdsa-p512-sha512',
            'Accept-Digest': 'sha-512',
          },
        },
      );

      if (res.data.status === 'REJECTED')
        return { success: false, message: res.data.rejectionReason };

      if (res.data.status === 'DUPLICATE_IGNORED')
        return { success: false, message: res.data.rejectionReason };

      return {
        success: true,
        data: res.data,
        transactionNo: res.data.payoutId,
      };
    } catch (e) {
      return {
        success: false,
        message: 'Unable to initiate deposit with paystack',
      };
    }
  }
  async cancelPayout(payoutId: string): Promise<{
    success: boolean;
    data?: any;
    transactionNo?: string;
    message?: string;
  }> {
    try {
      const { data }: any = await axios.post(
        `${process.env.PAWA_PAY_API_V1}/payouts/fail-enqueued/${payoutId}`,

        {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.PAWA_PAY_API_TOKEN}`,
        },
      );

      if (data.status === 'REJECTED')
        return { success: false, message: data.rejectionReason };

      if (data.status === 'FAILED')
        return { success: false, message: data.rejectionReason };

      return { success: true, data: data, transactionNo: data.payoutId };
    } catch (e) {
      return {
        success: false,
        message: 'Unable to initiate deposit with paystack',
      };
    }
  }
  async createBulkPayout(
    user: any,
    amounts: number[],
    payoutId: string,
  ): Promise<{
    success: boolean;
    data?: any;
    transactionNo?: string;
    message?: string;
  }> {
    try {
      const requestBody = amounts.map((amount) => {
        return {
          payoutId,
          amount: amount,
          currency: user.currency,
          country: user.country,
          correspondent: 'MTN_MOMO_ZMB',
          recipient: { type: 'MSISDN', address: { value: user.username } },
          statementDescription: 'Online Withdrawal',
          customerTimestamp: Date.now(),
          metadata: [
            {
              fieldName: 'customerId',
              fieldValue: user.email,
              isPII: true,
            },
          ],
        };
      });
      const res = await axios.post(
        `${process.env.PAWA_PAY_API_V1}/payouts/bulk`,
        JSON.stringify([requestBody]),
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.PAWA_PAY_API_TOKEN}`,
          },
        },
      );
      return {
        success: true,
        data: res.data,
        transactionNo: payoutId,
      };
    } catch (e) {
      return {
        success: false,
        message: 'Unable to initiate deposit with paystack',
      };
    }
  }

  async depositResendCallback(depositId) {
    try {
      const res = await axios.post(
        `${process.env.PAWA_PAY_API_V1}/deposits/resend-callback`,
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
    } catch (e) {
      return {
        success: false,
        message: 'Unable to fetch deposits from paystack',
      };
    }
  }

  async payoutResendCallback(payoutId) {
    try {
      const res = await axios.post(
        `${process.env.PAWA_PAY_API_V1}/payouts/resend-callback`,
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
    } catch (e) {
      return {
        success: false,
        message: 'Unable to fetch payouts from paystack',
      };
    }
  }

  async refundResendCallback(refundId) {
    try {
      const { data } = await axios.post(
        `${process.env.PAWA_PAY_API_V1}/refunds/resend-callback`,
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
    } catch (e) {
      return {
        success: false,
        message: 'Unable to fetch refunds from paystack',
      };
    }
  }

  async fetchDeposits(depositId) {
    try {
      const res = await axios.get(
        `${process.env.PAWA_PAY_API_V1}/deposits/${depositId}`,
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
      console.log(127893, e.message);

      return {
        success: false,
        message: e.message,
      };
    }
  }

  async fetchPayouts(payoutId) {
    try {
      const res = await axios.get(
        `${process.env.PAWA_PAY_API_V1}/payouts/${payoutId}`,
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
        `${process.env.PAWA_PAY_API_V1}/refunds/${refundId}`,
        {
          headers: {
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
        JSON.stringify({ msisdn: phoneNumber }),
        {
          headers: {
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
        `${process.env.PAWA_PAY_API_V1}/wallet-balances`,
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
        `${process.env.PAWA_PAY_API_V1}/wallet-balances/${country}`,
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
