import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Repository } from 'typeorm';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import * as crypto from 'crypto';
import { HelperService } from './helper.service';
import { generateTrxNo } from 'src/common/helpers';
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
      where: { provider: 'togo', client_id },
    });
  }

  private async getToken(): Promise<string> {
    try {
      const BASE_URL = process.env.TIGO_API_BASE_URL;
      const USERNAME = process.env.TIGO_USERNAME;
      const PASSWORD = process.env.TIGO_PASSWORD;
      const GRANT_TYPE = process.env.TIGO_GRANT_TYPE;

      const response = await axios.post(`${BASE_URL}/token`, {
        username: USERNAME,
        password: PASSWORD,
        grant_type: GRANT_TYPE,
      });

      if (response.data && response.data.access_token) {
        return response.data.access_token;
      }

      throw new Error('Failed to fetch access token');
    } catch (error) {
      console.error('Error fetching token:', error.message);
      throw new BadRequestException('Authentication failed');
    }
  }

  //    async initiatePayment = async ( data) {
  //      try {
  //        const response = await axios.post(
  //          `${BASE_URL}/API/BillerPayment/BillerPay`,
  //          paymentDetails,
  //          {
  //            headers: {
  //              Authorization: `Bearer ${token}`,
  //              'Content-Type': 'application/json',
  //              Username: USERNAME,
  //              Password: PASSWORD,
  //            },
  //          },
  //        );

  //        if (response.data && response.data.ResponseCode === '000') {
  //          return response.data; // Payment successful
  //        }

  //        throw new Error(response.data.ResponseDescription || 'Payment failed');
  //      } catch (error) {
  //        console.error('Error initiating payment:', error.message);
  //        throw error;
  //      }
  //    };
}
