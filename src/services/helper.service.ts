/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import * as dayjs from 'dayjs';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Repository } from 'typeorm';
import 'dotenv/config';

@Injectable()
export class HelperService {
  protected trackierUrl = 'https://api.trackierigaming.io';

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
  ) {}

  async saveTransaction(data) {
    // construct data
    const model = [];

    const transaction1 = new Transaction();
    transaction1.client_id = data.clientId;
    transaction1.user_id = data.fromUserId;
    transaction1.username = data.fromUsername;
    transaction1.transaction_no = data.transactionNo;
    transaction1.amount = data.amount;
    transaction1.tranasaction_type = 'debit';
    transaction1.subject = data.subject;
    transaction1.description = data.description;
    transaction1.source = data.source;
    transaction1.channel = data.channel;
    transaction1.balance = data.fromUserBalance;
    transaction1.status = data.status || 0;

    model.push(transaction1);

    const transaction2 = new Transaction();
    transaction2.client_id = data.clientId;
    transaction2.user_id = data.toUserId;
    transaction2.username = data.toUsername;
    transaction2.transaction_no = data.transactionNo;
    transaction2.amount = data.amount;
    transaction2.tranasaction_type = 'credit';
    transaction2.subject = data.subject;
    transaction2.description = data.description;
    transaction2.source = data.source;
    transaction2.channel = data.channel;
    transaction2.balance = data.toUserBalance;
    transaction2.status = data.status || 0;

    model.push(transaction2);

    for (const item of model) {
      await this.transactionRepository.save(item);
    }
  }

  async sendActivity(data, keys) {
    const payload = {
      bets: 0,
      // date: dayjs().format('YYYY-MM-DD'),
      timestamp: dayjs().unix(),
      fees: 0,
      wins: 0,
      bonuses: 0,
      currency: 'ngn',
      deposits: 0,
      productId: '1',
      customerId: data.username,
      withdrawls: 0,
      adjustments: 0,
      chargebacks: 0,
      transactionId: data.transactionId,
    };
    switch (data.subject) {
      case 'Deposit':
        payload.deposits = parseFloat(data.amount);
        payload.productId = '1';
        break;
      case 'Withdrawal Request':
        payload.withdrawls = parseFloat(data.amount);
        break;
      case 'Sport Win':
        payload.wins = parseFloat(data.amount);
        break;
      case 'Bet Deposit (Sport)':
        payload.bets = parseFloat(data.amount);
        break;
      default:
        break;
    }

    // console.log(payload)
    const apiKey = keys.ApiKey;
    const authCode = keys.AuthCode;

    // console.log(apiKey, authCode);

    if (apiKey) {
      const authres: any = await this.getAccessToken(authCode);

      if (!authres.success) {
        console.log('Unable to get trackier auth token');
        return;
      } else {
        // check if customer exist on trackier
        const customer = await this.getTrackierCustomer(
          apiKey,
          authres.data.accessToken,
          payload.customerId,
        );
        // send activity
        if (customer.success && customer.data) {
          await axios
            .post(`${this.trackierUrl}/api/admin/v2/activities`, payload, {
              headers: {
                'x-api-key': apiKey,
                authorization: `BEARER ${authres.data.accessToken}`,
              },
            })
            .then((res) => {
              // console.log("trackier activity suc", res.data);
            })
            .catch((err) => {
              console.log('trackier error', err.response.data);
            });
        }
      }
    }
  }

  async getAccessToken(auth_code) {
    const resp = await axios.post(
      `${this.trackierUrl}/api/public/v2/oauth/access-refresh-token`,
      {
        auth_code,
      },
    );

    return resp.data;
  }

  async getTrackierCustomer(apiKey, token, customerId) {
    const resp = await axios.get(
      `${this.trackierUrl}/api/admin/v2/customers/${customerId}`,
      {
        headers: {
          'x-api-key': apiKey,
          authorization: `BEARER ${token}`,
        },
      },
    );

    return resp.data;
  }

  async updateWallet(amount, user_id) {
    // update user wallet
    await this.walletRepository.update(
      {
        user_id,
      },
      {
        available_balance: amount,
      },
    );
  }

  async getCorrespondent(msisdn: string):Promise<string> {
    if (!msisdn.startsWith('255')) {
      throw new Error(
        'Only Tanzanian numbers (starting with 255) are supported',
      );
    }

    const prefix = msisdn.slice(3, 6); // Extract the next 3 digits after country code

    const vodacomPrefixes = [
      '754',
      '755',
      '756',
      '757',
      '758',
      '759',
      '763',
      '764',
      '765',
      '766',
      '767',
      '768',
      '769',
    ];
    const airtelPrefixes = [
      '682',
      '683',
      '684',
      '685',
      '686',
      '687',
      '688',
      '689',
    ];
    const tigoPrefixes = ['655', '656', '657', '658', '659', '660', '661'];

    if (vodacomPrefixes.includes(prefix)) return 'VODACOM_TZA';
    if (airtelPrefixes.includes(prefix)) return 'AIRTEL_TZA';
    if (tigoPrefixes.includes(prefix)) return 'TIGO_TZA';

    throw new Error('Unsupported provider');
  }
}
