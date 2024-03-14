import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  FetchBetRangeRequest,
  FetchDepositCountRequest,
  FetchDepositRangeRequest,
  FetchPlayerDepositRequest,
} from 'src/proto/wallet.pb';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';

@Injectable()
export class DepositService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
  ) {}

  async fetchDepositCount(payload: FetchDepositCountRequest) {
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
          transactionType: deposit.tranasaction_type,
          createdAt: deposit.created_at,
          updatedAt: deposit.updated_at,
        };
      });
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
      const deposits = await this.transactionRepository.count({
        where: {
          subject: 'Deposit',
          user_id: payload.userId,
          created_at: Between(payload.startDate, payload.endDate),
        },
      });
      
      if (deposits > 0) {
        // console.log(deposits, payload.userId)

        const wallet = await this.walletRepository.findOne({
          where: {
            user_id: payload.userId,
          },
        });

        const data = {
          userId: wallet.user_id,
          balance: wallet.balance,
          availableBalance: wallet.available_balance,
          trustBalance: wallet.trust_balance,
          sportBonusBalance: wallet.sport_bonus_balance,
          virtualBonusBalance: wallet.virtual_bonus_balance,
          casinoBonusBalance: wallet.casino_bonus_balance,
        };

        return { success: true, status: HttpStatus.OK, data: data };

      } else {
        return { success: false, status: HttpStatus.NOT_FOUND, data: null };
      }
      
    } catch (error) {
      return { success: true, status: HttpStatus.OK, error: error.message };
    }
  }
}
