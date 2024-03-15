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
      const deposits = await this.transactionRepository.createQueryBuilder('transaction')
        .select("user_id, COUNT(*) as deposits")
        .where("client_id = :clientId", {clientId: payload.clientId})
        .andWhere("subject = :deposit", {deposit: "Deposit"})
        .andWhere("user_id != 0")
        .andWhere("created_at >= :startDate", {startDate: payload.startDate})
        .andWhere("created_at <= :endDate", {endDate: payload.endDate})
        .groupBy("user_id")
        .having("COUNT(*) >= :count", {count: payload.count})
        .getRawMany();

      const userIds = deposits.map((deposit) => {
        return Number(deposit.user_id);
      });


      return { success: true, status: HttpStatus.OK, data: userIds };
    } catch (error) {
      return { success: true, status: HttpStatus.OK, error: error.message };
    }
  }

  async fetchBetRange(payload: FetchBetRangeRequest) {
    try {
      const deposits = await this.transactionRepository.find({
        where: {
          subject: 'Bet Deposit (Sport)',
          amount: Between(payload.minAmount, payload.maxAmount),
          created_at: Between(payload.startDate, payload.endDate),
          client_id: payload.clientId
        },
      });

      const userIds = deposits.map((deposit) => {
        return Number(deposit.user_id);
      });
      // console.log(userIds);
      return { success: true, status: HttpStatus.OK, data: userIds };
    } catch (error) {
      return { success: true, status: HttpStatus.OK, error: error.message };
    }
  }

  async fetchDepositRange(payload: FetchDepositRangeRequest) {
    try {

      const deposits = await this.transactionRepository.createQueryBuilder('transaction')
        .select("user_id")
        .where("client_id = :clientId", {clientId: payload.clientId})
        .andWhere("subject = :deposit", {deposit: "Deposit"})
        .andWhere("user_id != 0")
        .andWhere("amount >= :minAmount", {minAmount: payload.minAmount})
        .andWhere("amount <= :maxAmount", {maxAmount: payload.maxAmount})
        .andWhere("created_at >= :startDate", {startDate: payload.startDate})
        .andWhere("created_at <= :endDate", {endDate: payload.endDate})
        .groupBy("user_id")
        .getRawMany();

      const userIds = deposits.map((deposit) => {
        return Number(deposit.user_id);
      });

      return { success: true, status: HttpStatus.OK, data: userIds };
    } catch (error) {
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
