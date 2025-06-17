/* eslint-disable prettier/prettier */
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';
import { generateTrxNo } from 'src/common/helpers';
import { Wallet } from 'src/entity/wallet.entity';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import {
  CommonResponseArray,
  CommonResponseObj,
  FetchUsersWithdrawalRequest,
  GetUserAccountsResponse,
  ListWithdrawalRequestResponse,
  ListWithdrawalRequests,
  ValidateTransactionRequest,
  WithdrawRequest,
  WithdrawResponse,
} from 'src/proto/wallet.pb';
import { Between, Repository } from 'typeorm';
import { IdentityService } from 'src/identity/identity.service';
import { WithdrawalAccount } from 'src/entity/withdrawal_account.entity';
import { Bank } from 'src/entity/bank.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PaymentService } from './payments.service';

@Injectable()
export class WithdrawalService {
  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(Withdrawal)
    private withdrawalRepository: Repository<Withdrawal>,
    @InjectRepository(WithdrawalAccount)
    private withdrawalAccountRepository: Repository<WithdrawalAccount>,

    @InjectQueue('withdrawal')
    private readonly withdrawalQueue: Queue,
    private paymentService: PaymentService,
    private readonly identityService: IdentityService,
  ) {}

  async requestWithdrawal(data: WithdrawRequest): Promise<WithdrawResponse> {
    // console.log(data);
    try {
      const wallet = await this.walletRepository.findOne({
        where: {
          user_id: data.userId,
          client_id: data.clientId,
        },
      });

      if (!wallet)
        return {
          success: false,
          status: HttpStatus.NOT_FOUND,
          message: 'Wallet not found',
          data: null,
        };

      if (parseFloat(wallet.available_balance.toString()) < data.amount)
        return {
          success: false,
          status: HttpStatus.BAD_REQUEST,
          message:
            'You have insufficient funds to cover the withdrawal request.',
          data: null,
        };

      //To-Do: other validation minimum and max withdrawal
      // get auto disbursement settings
      const autoDisbursement = await this.identityService.getWithdrawalSettings(
        { clientId: data.clientId, userId: data.userId },
      );

      if (autoDisbursement.minimumWithdrawal > data.amount)
        return {
          success: false,
          status: HttpStatus.BAD_REQUEST,
          message:
            'Minimum withdrawable amount is ' +
            autoDisbursement.minimumWithdrawal,
          data: null,
        };

      if (autoDisbursement.maximumWithdrawal < data.amount)
        return {
          success: false,
          status: HttpStatus.BAD_REQUEST,
          message:
            'Maximum withdrawable amount is ' +
            autoDisbursement.maximumWithdrawal,
          data: null,
        };

      const jobData: any = { ...data };
      jobData.autoDisbursement = autoDisbursement;
      jobData.withdrawalCode = generateTrxNo();
      jobData.balance = wallet.available_balance;

      // console.log('adding to withdrawal queue', jobData)
      await this.withdrawalQueue.add('withdrawal-request', jobData, {
        jobId: `${data.userId}:${data.clientId}:${data.accountNumber || data.type}:${data.amount}`,
        delay: 5000,
      });

      return {
        success: true,
        status: HttpStatus.OK,
        message: 'Successful',
        data: {
          balance: jobData.balance,
          code: jobData.withdrawalCode,
        },
      };
    } catch (e) {
      // console.log(e.message);
      
      return {
        success: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Unable to process request',
        data: null,
      };
    }
  }

  async fetchUsersWithdrawal(
    data: FetchUsersWithdrawalRequest,
  ): Promise<CommonResponseArray> {
    try {
      let withdrawal;
      if (data.pending) {
        withdrawal = await this.withdrawalRepository.find({
          where: {
            user_id: data.userId,
            client_id: data.clientId,
            status: 0,
          },
        });
      } else {
        withdrawal = await this.withdrawalRepository.find({
          where: {
            user_id: data.userId,
            client_id: data.clientId,
          },
        });
      }
      const _withdrawal = await Promise.all(
        withdrawal.map(async (_withdrawal_) => {
          const { account_name, account_number, bank_code, bank_name, ...all } =
            _withdrawal_;
          const created_at = dayjs(new Date(_withdrawal_.created_at)).format(
            'YYYY-MM-DD HH:mm:ss',
          );
          return {
            ...all,
            created_at,
          };
        }),
      );
      return {
        success: true,
        status: HttpStatus.OK,
        message: 'Successful',
        data: _withdrawal,
      };
    } catch (e) {
      return {
        success: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Unable to process request',
        data: null,
      };
    }
  }

  // async listWithdrawalRequest(
  //   data: ListWithdrawalRequests,
  // ): Promise<ListWithdrawalRequestResponse> {
  //   try {
  //     console.log("WITHDRAWAL")
  //     const { clientId, from, to, userId, status } = data;

  //     const start = dayjs(from, 'DD-MM-YYYY HH:mm:ss').format(
  //       'YYYY-MM-DD HH:mm:ss',
  //     );
  //     const end = dayjs(to, 'DD-MM-YYYY HH:mm:ss').format(
  //       'YYYY-MM-DD HH:mm:ss',
  //     );

  //     // console.log(start, end);

  //     let requests = [];
  //     const res = await this.withdrawalRepository.find({
  //       where: {
  //         client_id: clientId,
  //         created_at: Between(start, end),
  //       },
  //       take: 100,
  //       order: { created_at: 'DESC' },
  //     });
  //     if (res.length) {
  //       for (const request of res) {
  //         requests.push({
  //           id: request.id,
  //           username: request.username,
  //           userId: request.user_id,
  //           amount: request.amount,
  //           accountNumber: request.account_number,
  //           accountName: request.account_name,
  //           bankName: request.bank_name,
  //           updatedBy: request.updated_by,
  //           status: request.status,
  //           created: request.created_at,
  //         });
  //       }
  //     }
  //     return {
  //       success: true,
  //       status: HttpStatus.OK,
  //       message: 'Success',
  //       data: requests,
  //     };
  //   } catch (e) {
  //     return {
  //       success: false,
  //       status: HttpStatus.INTERNAL_SERVER_ERROR,
  //       message: 'Something went wrong',
  //       data: null,
  //     };
  //   }
  // }

  async listWithdrawalRequest(
    data: ListWithdrawalRequests,
  ): Promise<ListWithdrawalRequestResponse> {
    const {
      clientId,
      from,
      to,
      status,
      userId,
      username,
      bankName,
      page = 1,
      limit = 10,
    } = data;

    const skip = (page - 1) * limit;

    const start = dayjs(from, 'DD-MM-YYYY HH:mm:ss').format(
        'YYYY-MM-DD HH:mm:ss',
      );
      const end = dayjs(to, 'DD-MM-YYYY HH:mm:ss').format(
        'YYYY-MM-DD HH:mm:ss',
      );
      
    const queryBuilder = this.withdrawalRepository
      .createQueryBuilder('withdrawal')
      .andWhere('withdrawal.client_id = :clientId', { clientId });

    if (from && to) {
      queryBuilder.andWhere('withdrawal.created_at BETWEEN :start AND :end', {
        start,
        end,
      });
    }

    if (status !== undefined && status !== null) {
      queryBuilder.andWhere('withdrawal.status = :status', { status });
    }

    if (userId) {
      queryBuilder.andWhere('withdrawal.user_id = :userId', { userId });
    }

    if (username) {
      queryBuilder.andWhere('withdrawal.username = :username', {
        username: `%${username}%`,
      });
    }

    if (bankName) {
      queryBuilder.andWhere('withdrawal.bank_name = :bankName', {
        bankName: `%${bankName}%`,
      });
    }

    const [dataList, total] = await queryBuilder
      .orderBy('withdrawal.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Total amount aggregation
    const totalAmountResult = await this.withdrawalRepository
      .createQueryBuilder('withdrawal')
      .select('SUM(withdrawal.amount)', 'total')
      .andWhere('withdrawal.client_id = :clientId', { clientId });

    if (start && end) {
      totalAmountResult.andWhere('withdrawal.created_at BETWEEN :start AND :end', {
        start,
        end,
      });
    }

    const totalAmountRow = await totalAmountResult.getRawOne();
    const totalAmount = parseFloat(totalAmountRow?.total || 0);

    const mappedData = dataList.map((withdrawal) => ({
      id: withdrawal.id,
      userId: withdrawal.user_id,
      username: withdrawal.username,
      amount: Number(withdrawal.amount),
      accountNumber: withdrawal.account_number,
      accountName: withdrawal.account_name,
      bankName: withdrawal.bank_name,
      updatedBy: withdrawal.updated_at,
      status: withdrawal.status,
      created: withdrawal.created_at,
    }));

    return {
      success: true,
      status: 200,
      message: 'Withdrawal requests fetched successfully',
      data: mappedData,
      totalAmount,
      total,
      page,
      limit,
    };
  }

  async getUserBankAccounts(data): Promise<GetUserAccountsResponse> {
    try {
      const accounts = await this.withdrawalAccountRepository
        .createQueryBuilder('account')
        .leftJoinAndSelect(Bank, 'bank', 'bank.code = account.bank_code')
        .where('account.user_id = :userId', { userId: data.userId })
        .getMany();

      // console.log(accounts);

      let response = [];
      if (accounts.length) {
        for (const account of accounts) {
          response.push({
            bankCode: account.bank_code,
            accountName: account.account_name,
            accountNumber: account.account_number,
            bankName: '',
          });
        }
      }
      return { data: response };
    } catch (e) {
      console.log('something went wrong', e.message);
      return { data: [] };
    }
  }

  async validateWithdrawalCode(
    data: ValidateTransactionRequest,
  ): Promise<CommonResponseObj> {
    try {
      // find withdrawal request
      const withdrawalRequest = await this.withdrawalRepository.findOne({
        where: {
          withdrawal_code: data.code,
          client_id: data.clientId,
        },
      });

      if (!withdrawalRequest) {
        return {
          success: false,
          status: HttpStatus.NOT_FOUND,
          message: 'Invalid code provided',
        };
      } else if (withdrawalRequest && withdrawalRequest.status !== 0) {
        return {
          success: false,
          status: HttpStatus.NOT_FOUND,
          message: 'Code has already been used',
        };
      } else {
        const respData = {
          requestId: withdrawalRequest.id,
          amount: withdrawalRequest.amount,
          withdrawalCharge: 0,
          withdrawalFinalAmount: 0,
          username: withdrawalRequest.username,
        };

        return {
          success: true,
          status: HttpStatus.OK,
          message: 'Valid',
          data: respData,
        };
      }
    } catch (e) {
      return {
        success: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Unable to validate request. Something went wrong',
      };
    }
  }

  async processShopWithdrawal(payload) {
    try {
      // get withdrawal request
      const withdrawReqeust = await this.withdrawalRepository.findOne({
        where: { id: payload.id, status: 0 },
      });

      if (!withdrawReqeust) {
        return {
          success: false,
          status: HttpStatus.BAD_REQUEST,
          message: 'Withdrawal request already processed',
        };
      }

      // check if the authorizing agent and the withdrawer are the same person
      if (withdrawReqeust.user_id === payload.userId) {
        return {
          success: false,
          status: HttpStatus.BAD_REQUEST,
          message: 'You cannot process your own request',
        };
      }

      // get user wallet
      const wallet = await this.walletRepository.findOne({
        where: {
          user_id: payload.userId,
          client_id: payload.clientId,
        },
      });

      // add user balance to payload
      payload.balance = wallet.available_balance;
      payload.amount = withdrawReqeust.amount;

      // add request to queue
      await this.withdrawalQueue.add('shop-withdrawal', payload, {
        jobId: `shop-withdrawal:${withdrawReqeust.id}`,
      });

      return {
        success: true,
        status: HttpStatus.OK,
        message: 'Withdrawal request successful',
      };
    } catch (e) {
      return {
        success: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An error occured while processing request. Please try again',
      };
    }
  }
}
