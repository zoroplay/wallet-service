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

  private generateSignature(
    timestamp: string,
    clientId: string,
    secretKey: string,
  ): string {
    const dataToSign = `${clientId}:${timestamp}`;
    // const secretKey = process.env.PROVIDUS_CLIENT_SECRET;

    return crypto
      .createHmac('sha512', secretKey)
      .update(dataToSign)
      .digest('hex')
      .toUpperCase();
  }

  async initiatePayment(data, client_id) {
    const settings = await this.providusSettings(client_id);
    if (!settings) {
      return {
        status: false,
        message: `Payment method not found`,
      };
    }
    console.log('THE-DATA', data);

    const timestamp = new Date().toISOString();

    const url = `${settings.base_url}/api/PiPCreateDynamicAccountNumber`;

    const clientIdEncoded = settings.merchant_id;
    const clientIdDecoded = Buffer.from(clientIdEncoded, 'base64').toString(
      'utf-8',
    );
    const sectKey = settings.secret_key;

    const signature = this.generateSignature(
      timestamp,
      clientIdDecoded,
      sectKey,
    );

    const headers = {
      'Content-Type': 'application/json',
      'Client-Id': clientIdEncoded,
      'X-Auth-Signature': signature,
    };

    try {
      const response = await axios.post(url, data, { headers });
      console.log('RESPONSE', response.data);

      console.log('RESPONSE2', response);
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
}
