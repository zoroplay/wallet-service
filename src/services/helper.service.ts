import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import * as dayjs from 'dayjs';
import { post } from 'src/common/axios';
import { Transaction } from 'src/entity/transaction.entity';
import { Repository } from 'typeorm';

@Injectable()
export class HelperService {
    protected trackierUrl = 'https://api.trackierigaming.io';

    constructor(
        @InjectRepository(Transaction)
        private transactionRepository: Repository<Transaction>
    ) {}

    async saveTransaction (data) {
        // construct data
        const model = [];
        
        const transaction1          = new Transaction();
        transaction1.client_id      = data.clientId;
        transaction1.user_id        = data.fromUserId;
        transaction1.username       = data.fromUsername;
        transaction1.transaction_no = data.transactionNo;
        transaction1.amount         = data.amount;
        transaction1.tranasaction_type = 'debit'
        transaction1.subject        = data.subject;
        transaction1.description    = data.description;
        transaction1.source         = data.source;
        transaction1.channel        = data.channel;
        transaction1.balance        = data.fromUserBalance;
        transaction1.status         = data.status || 0;
      
        model.push(transaction1);
      
        const transaction2          = new Transaction();
        transaction2.client_id      = data.clientId;
        transaction2.user_id        = data.toUserId;
        transaction2.username       = data.toUsername;
        transaction2.transaction_no = data.transactionNo;
        transaction2.amount         = data.amount;
        transaction2.tranasaction_type = 'credit'
        transaction2.subject        = data.subject;
        transaction2.description    = data.description;
        transaction2.source         = data.source;
        transaction2.channel        = data.channel;
        transaction2.balance        = data.toUserBalance;
        transaction2.status         = data.status || 0;
      
        model.push(transaction2);
      
        for (const item of model) {
          await this.transactionRepository.save(item);
        }

    }

    async sendActivity(data) {
        const payload = {
            bets: 0,
            // date: dayjs().format('YYYY-MM-DD'),
            timestamp: dayjs().unix(),
            fees: 0,
            wins: 0,
            bonuses: 0,
            currency: "ngn",
            deposits: 0,
            productId: "1",
            customerId: data.username,
            withdrawls: 0,
            adjustments: 0,
            chargebacks: 0,
            transactionId: data.transactionId
        }
        switch (data.subject) {
            case 'Deposit':
                payload.deposits = parseFloat(data.amount);
                payload.productId = "1"
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

        console.log(payload)
        
        const authres: any = await this.getAccessToken();

        if (!authres.success) {
            console.log('Unable to get trackier auth token')
            return;
        } else {

            await axios.post(`${this.trackierUrl}/api/admin/v2/activities`, payload, {
                headers: {
                    'x-api-key': process.env.TRACKIER_API_KEY,
                    authorization: `BEARER ${authres.data.accessToken}`,
                },
            }).then(res => {
                console.log('trackier activity', res.data);
            }).catch(err => {
                console.log('trackier error', err.response.data);
            });
        }
        
    }

    async getAccessToken() {
        const resp = await axios.post(
          `${this.trackierUrl}/api/public/v2/oauth/access-refresh-token`,
          {
            auth_code: "$2a$04$geRYyxPlSFlL6uMVUQNgnOV0YvXQB4cr3usXLfp7b0WzZHpky61nO",
          }
        );

        return resp.data;
    }
}


