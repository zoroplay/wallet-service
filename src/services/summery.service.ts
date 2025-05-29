import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from 'src/entity/transaction.entity';
import { IdentityService } from 'src/identity/identity.service';
import {
  CommonResponseObj,
  GetShopUserWalletSummaryRequest,
  GetShopUserWalletSummaryResponse,
} from 'src/proto/wallet.pb';
import { Repository } from 'typeorm';

@Injectable()
export class SummeryService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

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
      rangeZ?: 'day' | 'week' | 'month' | 'year';
      from?: Date;
      to?: Date;
    } = {},
  ) {
    try {
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

      const totalDeposit = parseFloat(depositSum?.sum || '0');
      const totalWithdrawal = parseFloat(withdrawalSum?.sum || '0');

      return {
        success: true,
        status: 200,
        message: 'Wallet summary fetched successfully',
        totalDeposit,
        totalWithdrawal,
      };
    } catch (error) {
      return {
        success: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error fetching wallet summary: ${error.message}`,
        data: [],
      };
    }
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
        success: identityResponse.success || false,
        status: identityResponse.status,
        message: identityResponse.message,
        data: identityResponse.data || [],
      };

      if (!users.data || !Array.isArray(users.data.data)) {
        return {
          success: false,
          status: HttpStatus.BAD_REQUEST,
          message: 'Invalid data structure: users.data.data is not an array',
          data: [],
        };
      }

      const userDataArray = users.data.data;

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

        console.log('Summary:', {
          userId: agentUser.id,
          totalDeposit,
          totalWithdrawal,
        });

        // Push the full summary object to the array
        agentUsersSummary.push({
          userId: String(agentUser.id), // Convert userId to a string
          totalDepositAmount: totalDeposit, // Rename to match .proto schema
          totalWithdrawalAmount: totalWithdrawal, // Rename to match .proto schema
        });
      }

      // Log the final summary array for debugging
      console.log(
        'Final Agent Users Summary:',
        JSON.stringify(agentUsersSummary, null, 2),
      );

      // Step 3: Return the response with the agent users summary
      return {
        success: true,
        status: HttpStatus.OK,
        message: 'Wallet summary fetched successfully',
        data: agentUsersSummary, // Matches the repeated DailyTotals field in .proto
      };
    } catch (e) {
      return {
        success: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error fetching wallet summary: ${e.message}`,
        data: [], // Empty array for the repeated DailyTotals field
      };
    }
  }

  async getNetCashFlow(
    clientId: number,
    options: {
      rangeZ?: 'day' | 'week' | 'month' | 'year' | 'yesterday';
      from?: Date;
      to?: Date;
    } = {},
  ) {
    try {
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

      // Step 1: Fetch all shop users for the client
      const identityResponse = await this.identityService.getAgents({
        clientId,
      });

      console.log('DATA:::', identityResponse);

      const users: CommonResponseObj = {
        success: identityResponse.success || false,
        status: identityResponse.status,
        message: identityResponse.message,
        data: identityResponse.data || [],
      };

      if (!users.data || !Array.isArray(users.data.data)) {
        return {
          success: false,
          status: HttpStatus.BAD_REQUEST,
          message: 'Invalid data structure: users.data.data is not an array',
          data: [],
        };
      }

      let shopUsers = users.data.data;

      // Filter only shop users (rolename: 'Shop' and role_id: 11)
      shopUsers = shopUsers.filter(
        (user) => user.rolename === 'Shop' && user.role_id === 11,
      );

      console.log('Filtered Shop Users:', shopUsers);

      if (shopUsers.length === 0) {
        return {
          success: false,
          status: HttpStatus.NOT_FOUND,
          message: 'No shop users found for the client',
          data: [],
        };
      }

      const summary = [];

      for (const shopUser of shopUsers) {
        const userId = shopUser.id;

        const deposit = await this.transactionRepository
          .createQueryBuilder('t')
          .select(['COUNT(*) AS count', 'SUM(t.amount) AS total'])
          .where('t.client_id = :clientId', { clientId })
          .andWhere('t.user_id = :userId', { userId })
          .andWhere('t.tranasaction_type = :type', { type: 'credit' })
          .andWhere('t.subject = :subject', { subject: 'Deposit' })
          .andWhere('t.status = 1')
          .andWhere('t.created_at BETWEEN :start AND :end', { start, end })
          .getRawOne();

        const withdrawal = await this.transactionRepository
          .createQueryBuilder('t')
          .select(['COUNT(*) AS count', 'SUM(t.amount) AS total'])
          .where('t.client_id = :clientId', { clientId })
          .andWhere('t.user_id = :userId', { userId })
          .andWhere('t.tranasaction_type = :type', { type: 'debit' })
          .andWhere('t.subject = :subject', { subject: 'Withdrawal' })
          .andWhere('t.status = 1')
          .andWhere('t.created_at BETWEEN :start AND :end', { start, end })
          .getRawOne();

        summary.push({
          userId,
          numberOfDeposits: parseInt(deposit?.count || '0', 10),
          totalDeposits: parseFloat(deposit?.total || '0'),
          numberOfWithdrawals: parseInt(withdrawal?.count || '0', 10),
          totalWithdrawals: parseFloat(withdrawal?.total || '0'),
        });
      }

      return {
        success: true,
        status: HttpStatus.OK,
        message: 'Shop user net cash flow summary fetched successfully',
        data: summary,
      };
    } catch (error) {
      return {
        success: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error fetching shop user net cash flow summary: ${error.message}`,
        data: [],
      };
    }
  }
}
