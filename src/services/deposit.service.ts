import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  FetchBetRangeRequest,
  FetchDepositCountRequest,
  FetchDepositRangeRequest,
  FetchPlayerDepositRequest,
  TransactionEntity,
} from 'src/proto/wallet.pb';
import { Transaction } from 'src/entity/transaction.entity';

@Injectable()
export class DepositService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  async fetchDepositCount(payload: FetchDepositCountRequest) {
    try {
      const deposits = await this.transactionRepository.count({
        where: {
          subject: 'Deposit',
          created_at: Between(payload.startDate, payload.endDate),
        },
      });

      console.log(deposits, 'count');
      return { success: true, status: HttpStatus.OK, data: deposits };
    } catch (error) {
      return { success: true, status: HttpStatus.OK, error: error.message };
    }
  }

  async fetchBetRange(payload: FetchBetRangeRequest) {
    try {
      const deposits = await this.transactionRepository.find({
        where: {
          subject: 'Bet Deposit',
          amount: Between(payload.minAmount, payload.maxAmount),
          created_at: Between(payload.startDate, payload.endDate),
        },
      });

      const userIds = deposits.map((deposit) => {
        return Number(deposit.user_id);
      });
      console.log(userIds);
      return { success: true, status: HttpStatus.OK, data: userIds };
    } catch (error) {
      return { success: true, status: HttpStatus.OK, error: error.message };
    }
  }
  async fetchDepositRange(payload: FetchDepositRangeRequest) {
    try {
      const deposits = await this.transactionRepository.find({
        where: {
          subject: 'Deposit',
          amount: Between(payload.minAmount, payload.maxAmount),
          created_at: Between(payload.startDate, payload.endDate),
        },
      });

      const userIds = deposits.map((deposit) => {
        return Number(deposit.user_id);
      });
      console.log(userIds);
      return { success: true, status: HttpStatus.OK, data: userIds };
    } catch (error) {
      return { success: true, status: HttpStatus.OK, error: error.message };
    }
  }
  async fetchPlayerDeposit(payload: FetchPlayerDepositRequest) {
    try {
      let deposits = await this.transactionRepository.find({
        where: {
          subject: 'Deposit',
          client_id: payload.clientId,
          created_at: Between(payload.startDate, payload.endDate),
        },
      });
      deposits = deposits.map((deposit) => {
        return {
          ...deposit,
          userId: deposit.user_id,
          clientId: deposit.client_id,
          transactionNo: deposit.transaction_no,
          transactionType: deposit.transaction_type,
          createdAt: deposit.created_at,
          updatedAt: deposit.updated_at,
        };
      });
      return { success: true, status: HttpStatus.OK, data: deposits };
    } catch (error) {
      return { success: true, status: HttpStatus.OK, error: error.message };
    }
  }
}
