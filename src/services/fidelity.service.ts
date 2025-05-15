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
import * as crypto from 'crypto';

@Injectable()
export class FidelityService {
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

  private async fidelitySettings(client_id: number) {
    return await this.paymentMethodRepository.findOne({
      where: { provider: 'fidelity', client_id },
    });
  }

  async initiatePay(data, client_id) {
    try {
      console.log('DATA:::', data);

      const rawKey = process.env.PAYGATE_PUB_KEY;
      const encodedKey = Buffer.from(rawKey).toString('base64');

      const url = 'https://api-paygate.fidelitybank.ng/live/card/card_charge';
      const response = await axios.post(url, data, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${encodedKey}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('✅ Success:', response.data);
      console.log('✅✅ COMPLETE:', response);

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error(
        '❌ Error during PayGate payment initiation:',
        error.response || error.message,
      );

      return {
        success: false,
        message: 'Payment request failed',
        error: error.response?.data || error.message,
      };
    }
  }
}
