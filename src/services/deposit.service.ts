import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Not, Repository } from 'typeorm';
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
      const deposits = await this.transactionRepository.createQueryBuilder('t')
        .select("t.user_id, COUNT(*) as total, w.available_balance")
        .innerJoin("wallets", "w", "w.user_id = t.user_id")
        .where("t.client_id = :clientId", {clientId: payload.clientId})
        .andWhere("subject = :deposit", {deposit: "Deposit"})
        .andWhere("t.user_id != 0")
        .andWhere("t.status = 1")
        .andWhere("t.created_at >= :startDate", {startDate: payload.startDate})
        .andWhere("t.created_at <= :endDate", {endDate: payload.endDate})
        .groupBy("t.user_id")
        .having("COUNT(*) >= :count", {count: payload.count})
        .getRawMany();

        const data = deposits.map((deposit) => {
          return {userId: deposit.user_id, total: deposit.total, balance: deposit.available_balance}
        });


      return { success: true, status: HttpStatus.OK, data };
    } catch (error) {
      return { success: true, status: HttpStatus.OK, error: error.message };
    }
  }

  async fetchBetRange(payload: FetchBetRangeRequest) {
    try {
      const bets = await this.transactionRepository.createQueryBuilder('t')
        .select("t.user_id, SUM(amount) as total, COUNT(*) as count, w.available_balance")
        .innerJoin("wallets", "w", "w.user_id = t.user_id")
        .where("t.client_id = :clientId", {clientId: payload.clientId})
        .andWhere("subject = :deposit", {deposit: "Bet Deposit (Sport)"})
        .andWhere("t.user_id != 0")
        .andWhere("t.status = 1")
        .andWhere("amount >= :minAmount", {minAmount: payload.minAmount})
        .andWhere("amount <= :maxAmount", {maxAmount: payload.maxAmount})
        .andWhere("t.created_at >= :startDate", {startDate: payload.startDate})
        .andWhere("t.created_at <= :endDate", {endDate: payload.endDate})
        .groupBy("t.user_id")
        .addGroupBy("w.available_balance")
        .getRawMany();

      const data = bets.map((deposit) => {
        return {userId: deposit.user_id, total: deposit.total, count: deposit.count, balance: deposit.available_balance}
      });
      console.log(data);
      return { success: true, status: HttpStatus.OK, data };
    } catch (error) {
      return { success: true, status: HttpStatus.OK, error: error.message };
    }
  }

  async fetchDepositRange(payload: FetchDepositRangeRequest) {
    try {

      const deposits = await this.transactionRepository.createQueryBuilder('t')
        .select("t.user_id, SUM(amount) as total, w.available_balance")
        .innerJoin("wallets", "w", "w.user_id = t.user_id")
        .where("t.client_id = :clientId", {clientId: payload.clientId})
        .andWhere("subject = :deposit", {deposit: "Deposit"})
        .andWhere("t.user_id != 0")
        .andWhere("t.status = 1")
        .andWhere("amount >= :minAmount", {minAmount: payload.minAmount})
        .andWhere("amount <= :maxAmount", {maxAmount: payload.maxAmount})
        .andWhere("t.created_at >= :startDate", {startDate: payload.startDate})
        .andWhere("t.created_at <= :endDate", {endDate: payload.endDate})
        .groupBy("t.user_id")
        .addGroupBy("w.available_balance")
        .getRawMany();


      const data = deposits.map((deposit) => {
        return {userId: deposit.user_id, total: deposit.total, balance: deposit.available_balance}
      });

      return { success: true, status: HttpStatus.OK, data };
    } catch (error) {
      console.log(error)
      return { success: false, status: HttpStatus.INTERNAL_SERVER_ERROR, error: error.message };
    }
  }

  async fetchPlayerDeposit(payload: FetchPlayerDepositRequest) {
    try {
      const deposits = await this.transactionRepository.count({
        where: {
          subject: 'Deposit',
          user_id: payload.userId,
          created_at: Between(payload.startDate, payload.endDate),
          status: 1
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
