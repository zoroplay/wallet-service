import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from 'src/entity/transaction.entity';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import { IdentityService } from 'src/identity/identity.service';
import {
  CommonResponseObj,
  GetShopUserWalletSummaryRequest,
  GetShopUserWalletSummaryResponse,
  SummaryResponse,
} from 'src/proto/wallet.pb';
import { Repository } from 'typeorm';

@Injectable()
export class SummeryService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepository: Repository<Withdrawal>,

    private readonly identityService: IdentityService,
  ) {}

  private getDateRange(
    range: 'day' | 'week' | 'month' | 'year' | 'yesterday',
    date = new Date(),
  ) {
    const start = new Date(date);
    const end = new Date(date);

    switch (range) {
      case 'day':
        start.setUTCHours(0, 0, 0, 0);
        end.setUTCHours(23, 59, 59, 999);
        break;
      case 'week': {
        const day = start.getUTCDay();
        const diffToMonday = (day + 6) % 7;
        start.setUTCDate(start.getUTCDate() - diffToMonday);
        start.setUTCHours(0, 0, 0, 0);
        end.setUTCDate(start.getUTCDate() + 6);
        end.setUTCHours(23, 59, 59, 999);
        break;
      }
      case 'month':
        start.setUTCDate(1);
        start.setUTCHours(0, 0, 0, 0);
        end.setUTCMonth(start.getUTCMonth() + 1, 0);
        end.setUTCHours(23, 59, 59, 999);
        break;
      case 'year':
        start.setUTCMonth(0, 1);
        start.setUTCHours(0, 0, 0, 0);
        end.setUTCMonth(11, 31);
        end.setUTCHours(23, 59, 59, 999);

      case 'yesterday':
        // Set start to the beginning of yesterday
        start.setUTCDate(start.getUTCDate() - 1);
        start.setUTCHours(0, 0, 0, 0);

        // Set end to the end of yesterday
        end.setUTCDate(end.getUTCDate() - 1);
        end.setUTCHours(23, 59, 59, 999);
        break;
    }

    return { start, end };
  }

  async getSummary(
    clientId: number,
    options: {
      rangeZ?: 'day' | 'week' | 'month' | 'year' | 'yesterday';
      from?: Date;
      to?: Date;
    } = {},
  ) {
    let start: Date, end: Date;

    if (options.from && options.to) {
      start = new Date(options.from);
      start.setUTCHours(0, 0, 0, 0);
      end = new Date(options.to);
      end.setUTCHours(23, 59, 59, 999);
    } else {
      const { start: defaultStart, end: defaultEnd } = this.getDateRange(
        options.rangeZ || 'day',
      );
      start = defaultStart;
      end = defaultEnd;
    }

    const [depositSum, withdrawalSum] = await Promise.all([
      this.transactionRepository
        .createQueryBuilder('t')
        .select('SUM(t.amount)', 'sum')
        .where('t.client_id = :clientId', { clientId })
        .andWhere('t.tranasaction_type = :type', { type: 'credit' }) // 'credit' = deposit
        .andWhere('t.subject = :subject', { subject: 'Deposit' })
        .andWhere('t.status = 1')
        .andWhere('t.created_at BETWEEN :start AND :end', { start, end })
        .getRawOne(),

      this.transactionRepository
        .createQueryBuilder('t')
        .select('SUM(t.amount)', 'sum')
        .where('t.client_id = :clientId', { clientId })
        .andWhere('t.tranasaction_type = :type', { type: 'debit' }) // 'debit' = withdrawal
        .andWhere('t.subject = :subject', { subject: 'Withdrawal' })
        .andWhere('t.status = 1')
        .andWhere('t.created_at BETWEEN :start AND :end', { start, end })
        .getRawOne(),
    ]);

    const totalDepositAmount = parseFloat(depositSum?.sum || '0');
    const totalWithdrawalAmount = parseFloat(withdrawalSum?.sum || '0');

    return {
      success: true,
      status: 200,
      message: 'Wallet summary fetched successfully',
      totalDepositAmount,
      totalWithdrawalAmount,
    };
  }

  async getShopUserWalletSummary(
    request: GetShopUserWalletSummaryRequest,
  ): Promise<GetShopUserWalletSummaryResponse> {
    const { clientId, dateRange } = request;

    try {
      // Get the date range for the request
      const { start, end } = this.getDateRange(
        dateRange as 'day' | 'week' | 'month' | 'year' | 'yesterday',
      );

      // Step 1: Fetch all agent users for the client (shop)
      const identityResponse = await this.identityService.getAgents({
        clientId,
      });

      // Map the response to the correct type
      const users: CommonResponseObj = {
        success: identityResponse.success || false, // Ensure `success` is always present
        status: identityResponse.status,
        message: identityResponse.message,
        data: identityResponse.data || [], // Ensure `data` is always present
      };

      console.log('Fetched users:', JSON.stringify(users, null, 2));
      console.log('Fetched users:', JSON.stringify(users.data.id, null, 2));

      // Ensure users.data is an array
      // Ensure users.data exists and contains a nested 'data' property
      if (!users.data || !Array.isArray(users.data.data)) {
        return {
          success: false,
          status: HttpStatus.BAD_REQUEST,
          message: 'Invalid data structure: users.data.data is not an array',
          data: [],
        };
      }

      // Use the nested 'data' property
      const userDataArray = users.data.data;

      console.log('Converted users data:', userDataArray);

      if (userDataArray.length === 0) {
        return {
          success: false,
          status: HttpStatus.NOT_FOUND,
          message: 'No agent users found for the client',
          data: [],
        };
      }

      const agentUsersSummary = [];

      // Step 2: Iterate through each agent user and calculate the totals
      for (const agentUser of userDataArray) {
        console.log('Processing user with ID:', agentUser.id);

        // Fetch total deposit (credit) for this agent user
        const [depositSum] = await Promise.all([
          this.transactionRepository
            .createQueryBuilder('t')
            .select('SUM(t.amount)', 'sum')
            .where('t.client_id = :clientId', { clientId })
            .andWhere('t.tranasaction_type = :type', { type: 'credit' })
            .andWhere('t.subject = :subject', { subject: 'Deposit' })
            .andWhere('t.status = 1')
            .andWhere('t.created_at BETWEEN :start AND :end', { start, end })
            .andWhere('t.user_id = :userId', { userId: agentUser.id })
            .getRawOne(),
        ]);

        // Fetch total withdrawal (debit) for this agent user
        const [withdrawalSum] = await Promise.all([
          this.transactionRepository
            .createQueryBuilder('t')
            .select('SUM(t.amount)', 'sum')
            .where('t.client_id = :clientId', { clientId })
            .andWhere('t.tranasaction_type = :type', { type: 'debit' })
            .andWhere('t.subject = :subject', { subject: 'Withdrawal' })
            .andWhere('t.status = 1')
            .andWhere('t.created_at BETWEEN :start AND :end', { start, end })
            .andWhere('t.user_id = :userId', { userId: agentUser.id })
            .getRawOne(),
        ]);

        // Calculate the total sales (deposit - withdrawal)
        const totalDeposit = depositSum ? parseFloat(depositSum.sum || '0') : 0;
        const totalWithdrawal = withdrawalSum
          ? parseFloat(withdrawalSum.sum || '0')
          : 0;
        // const totalSales = totalDeposit - totalWithdrawal;

        // Add the user's wallet summary to the array
        agentUsersSummary.push({
          userId: agentUser.id,
          totalDeposit,
          totalWithdrawal,
        });
      }

      console.log('Agent users summary:', agentUsersSummary);

      // Step 3: Return the response with the agent users summary
      return {
        success: true,
        status: HttpStatus.OK,
        message: 'Wallet summary fetched successfully',
        data: agentUsersSummary,
      };
    } catch (e) {
      return {
        success: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error fetching wallet summary: ${e.message}`,
        data: [],
      };
    }
  }
}
