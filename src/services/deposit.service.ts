import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  CommonResponseObj,
  FetchBetRangeRequest,
  FetchDepositCountRequest,
  FetchDepositRangeRequest,
  FetchPlayerDepositRequest,
  ValidateTransactionRequest,
} from 'src/proto/wallet.pb';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class DepositService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectQueue('deposit')
    private depositQueue: Queue,
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

  async validateDepositCode ({clientId, code}: ValidateTransactionRequest): Promise<CommonResponseObj> {
    
    const transaction = await this.transactionRepository.findOne({
        where: {
            client_id: clientId,
            transaction_no: code,
            tranasaction_type: 'credit'
        }
    })

    if (transaction && transaction.status === 0) {
        return {
            success: true,
            message: "Transaction found",
            data: transaction,
            status: HttpStatus.OK
        }
    } else if(transaction && transaction.status === 1) {
        return {
            success: false,
            message: "Code has already been used",
            status: HttpStatus.BAD_REQUEST
        }
    } else if(transaction && transaction.status === 2) {
      return {
        success: false,
        message: "Code has expired",
        status: HttpStatus.BAD_REQUEST
      }
    } else {
        return {
            success: false,
            message: "Transaction not found",
            status: HttpStatus.NOT_FOUND
        }
    }
  }

  async processShopDeposit(data): Promise<CommonResponseObj> {
    try {
      // get withdrawal request
      const transaction = await this.transactionRepository.findOne({where: {id: data.id, status: 0}});

      if (!transaction) {
        return {
          success: false,
          status: HttpStatus.BAD_REQUEST,
          message: 'Deposit request already processed'
        }
      }

      // check if the authorizing agent and the withdrawer are the same person
      if (transaction.user_id === data.userId) {
        return {
          success: false,
          status: HttpStatus.BAD_REQUEST,
          message: 'You cannot process your own request'
        }
      }

      // get user wallet
      const wallet = await this.walletRepository.findOne({
        where: {
          user_id: data.userId,
          client_id: data.clientId,
        },
      });

      if (wallet.available_balance < transaction.amount) {
        return {
          success: false,
          status: HttpStatus.BAD_REQUEST,
          message: 'You do not have enough funds to complete this request'
        }
      }
      // acreate deposit job data
      const jobData = {
        amount: transaction.amount,
        clientId: data.clientId,
        fromUserId: data.userId,
        fromUsername: data.username,
        toUserId: transaction.user_id,
        toUsername: transaction.username,
        role: data.userRole,
        transactionCode: transaction.transaction_no
      }

      console.log(jobData)

      // add request to queue
      await this.depositQueue.add('shop-deposit', jobData, {
        jobId: `shop-deposit:${transaction.id}`
      });

      return {
        success: true,
        status: HttpStatus.OK,
        message: "Transaction has been processed",
        data: {
          balance: wallet.available_balance - transaction.amount
        }
      }
    } catch (e) {
      return {
        success: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An error occured while processing your request.'
      }
    }
  }
}
