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

  async initiatePayment(data, client_id) {
    console.log(client_id);
    const timestamp = new Date().toISOString();
    const baseUrl = process.env.PROVIDUS_BASE_URL as string;
    const url = `${baseUrl}/api/PiPCreateDynamicAccountNumber`;
    const clientId = process.env.PROVIDUS_CLIENT_ID as string;

    const signature = this.generateSignature(timestamp);

    const headers = {
      'Content-Type': 'application/json',
      'Client-Id': clientId,
      'X-Auth-Signature': signature,
    };
    const payload = { account_name: data.username, ...data };

    try {
      const response = await axios.post(url, payload, {
        headers,
      });
      console.log(response.data);

      return response.data;
    } catch (error) {
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

  private generateSignature(timestamp: string): string {
    const dataToSign = `${process.env.PROVIDUS_CLIENT_ID}:${timestamp}`;
    return crypto
      .createHmac('sha512', process.env.PROVIDUS_CLIENT_ID)
      .update(dataToSign)
      .digest('hex')
      .toUpperCase();
  }
}
