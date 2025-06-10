import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import { HelperService } from './helper.service';
import { IdentityService } from 'src/identity/identity.service';
import axios from 'axios';

@Injectable()
export class GlobusService {
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

  private async globusSettings(client_id: number) {
    return await this.paymentMethodRepository.findOne({
      where: {
        provider: 'globus',
        client_id,
      },
    });
  }

  private sha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async initiatePayment(data, client_id) {
    try {
      const settings = await this.globusSettings(client_id);

      if (!settings)
        return {
          success: false,
          message: 'Globus has not been configured for client',
        };

      const clientId = settings.public_key;

      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      const username = this.sha256(`${date}${clientId}`);
      const password = this.sha256(clientId);

      const auth = await axios.post(
        'https://omniauth.globusbank.com/AuthService/connect/token',
        {
          grant_type: 'password',
          username: username,
          password: password,
          client_id: settings.public_key,
          client_secret: settings.secret_key,
          scope: 'KORET',
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const accessToken = auth.data.access_token;
      console.log(accessToken);

      const payload = {
        ...data,
        linkedPartnerAccountNumber: settings.merchant_id,
      };

      console.log(payload);

      const url = `${settings.base_url}/api/account/virtual-account-max`;
      console.log('CHECK 1');
      console.log('URL', url);

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          ClientID: clientId,
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'SBE/1.0',
          Accept: 'application/json',
        },
      });

      console.log('THE_FULL RESPONSE', response);

      console.log(response.data);
      return response.data;
    } catch (error) {
      console.error(
        'Globus Error:',
        error.response ? error.response.data : error.message,
      );
      return {
        success: false,
        message: error.response ? error.response.data : error.message,
      };
    }
  }
}
