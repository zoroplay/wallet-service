import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { generateTrxNo } from 'src/common/helpers';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Repository } from 'typeorm';
import { HelperService } from './helper.service';
import * as dayjs from 'dayjs';
import { OpayWebhookRequest } from 'src/proto/wallet.pb';

@Injectable()
export class OPayService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,

    private helperService: HelperService,
  ) {}

  async updateNotify(param: OpayWebhookRequest) {
    try {
      // find transaction
      const transaction = await this.transactionRepository
        .createQueryBuilder()
        .where('client_id = :clientId', { clientId: param.clientId })
        .andWhere('description = :orderNo', { orderNo: param.orderNo })
        .andWhere('tranasaction_type = :type', { type: 'credit' })
        .getOne();

      if (!transaction) {
        const ref = generateTrxNo();
        // find wallet
        const wallet = await this.walletRepository
          .createQueryBuilder()
          .where('client_id = :clientId', { clientId: param.clientId })
          .andWhere('username = :username', { username: param.username })
          .getOne();

        const amount = parseFloat(param.amount) / 100;
        const balance =
          parseFloat(wallet.available_balance.toString()) +
          parseFloat(amount.toString());

        // update user wallet
        await this.walletRepository.update(
          {
            id: wallet.id,
          },
          {
            available_balance: balance,
          },
        );

        //save transaction
        await this.helperService.saveTransaction({
          amount: amount,
          channel: 'opay',
          clientId: param.clientId,
          toUserId: wallet.user_id,
          toUsername: wallet.username,
          toUserBalance: balance,
          fromUserId: 0,
          fromUsername: 'System',
          fromUserbalance: 0,
          source: 'external',
          subject: 'Deposit',
          description: param.orderNo,
          transactionNo: ref,
          status: 1,
        });

        return {
          responseCode: '00000',
          responseMessage: 'SUCCESSFULL',
          data: {
            UserID: param.username,
            OrderNo: param.orderNo,
            TransAmount: param.amount,
            PaymentReference: ref,
            Status: 0,
          },
        };
      } else {
        return {
          responseCode: '05011',
          responseMessage: 'Duplicate transaction',
          data: {},
        };
      }
    } catch (e) {
      console.log('opay error', e);
      return {
        responseCode: '10967',
        responseMessage: 'Internal server error',
        data: {},
      };
    }
  }

  async reQueryLookUp({ clientId, orderNo }) {
    // find transaction
    const transaction = await this.transactionRepository
      .createQueryBuilder()
      .where('client_id = :clientId', { clientId })
      .andWhere('description = :orderNo', { orderNo })
      .andWhere('tranasaction_type = :type', { type: 'credit' })
      .getOne();

    if (transaction) {
      const Status =
        transaction.status === 1
          ? '00'
          : transaction.status === 0
            ? '01'
            : '02';
      return {
        responseCode: '00000',
        responseMessage: 'SUCCESSFULL',
        data: {
          UserID: transaction.user_id,
          OrderNo: orderNo,
          TransDate: dayjs(transaction.created_at).format('YYYY-MM-DD'),
          TransAmount: transaction.amount,
          PaymentReference: transaction.transaction_no,
          Status,
        },
      };
    } else {
      return {
        responseCode: '19089',
        responseMessage: 'Transaction not found',
        data: {},
      };
    }
  }
}
