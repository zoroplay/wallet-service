/* eslint-disable prettier/prettier */
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';

import { IdentityService } from 'src/identity/identity.service';
import { AppService } from 'src/app.service';
import {
  FetchLastApprovedRequest,
  FetchReportRequest,
  FetchSalesReportRequest,
  HandleReportRequest,
} from 'src/proto/wallet.pb';
import { handleError, handleResponse } from 'src/common/helpers';
import { startOfDay, endOfDay, subHours } from 'date-fns';
import { Transaction } from 'src/entity/transaction.entity';
import { CashIn } from '../entities/cashin.entity';
import { CashOut } from '../entities/cashout.entity';
import { Expenses } from '../entities/expenses.entity';
import { SalesReport } from '../entities/sales_report.entity';
import { Wallet } from 'src/entity/wallet.entity';

@Injectable()
export class SalesReportService {
  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(CashIn)
    private readonly cashinRepository: Repository<CashIn>,
    @InjectRepository(CashOut)
    private readonly cashoutRepository: Repository<CashOut>,
    @InjectRepository(Expenses)
    private readonly expensesRepository: Repository<Expenses>,
    @InjectRepository(SalesReport)
    private salesReportRepository: Repository<SalesReport>,

    private identityService: IdentityService,

    private appService: AppService,
  ) {}

  async verifyFinalTransaction({
    branchId,
    clientId,
  }: FetchLastApprovedRequest) {
    try {
      const lastReport = await this.salesReportRepository
        .createQueryBuilder('sales_reports')
        .where('sales_reports.clientId = :clientId', { clientId })
        .andWhere('sales_reports.branchId = :branchId', { branchId })
        .orderBy('sales_reports.createdAt', 'DESC')
        .getOne();
      const lastTransaction = await this.transactionRepository
        .createQueryBuilder('transactions')
        .where('transactions.client_id = :clientId', { clientId })
        .andWhere('transactions.user_id = :branchId', { branchId })
        .andWhere('transactions.status = :status', { status: 1 })
        .orderBy('transactions.created_at', 'DESC')
        .getOne();

      if (!lastReport || !lastTransaction) {
        return handleResponse(null, 'records handled, Proceed with the day');
      }

      const lastReportStartDate = startOfDay(lastReport.date);
      const lastTransactionStartDate = startOfDay(lastTransaction.created_at);

      if (
        lastReportStartDate.getDate() === lastTransactionStartDate.getDate()
      ) {
        return handleResponse(null, 'records handled, Proceed with the day');
      } else {
        return handleError(
          `record for ${lastTransactionStartDate.toDateString()} to be handled, Proceed to cashbook to handle report`,
          null,
          HttpStatus.NOT_FOUND,
        );
      }
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
  async fetchSalesReport({
    status,
    branchId,
    clientId,
  }: FetchSalesReportRequest) {
    try {
      const res = await this.salesReportRepository.findBy({
        branchId,
        status,
        clientId,
      });
      return handleResponse(res, 'sales reports fetched successfully');
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
  async fetchLastApproved({ branchId, clientId }: FetchLastApprovedRequest) {
    try {
      const res = await this.salesReportRepository
        .createQueryBuilder('sales_reports')
        .where('sales_reports.clientId = :clientId', { clientId })
        .andWhere('sales_reports.branchId = :branchId', { branchId })
        .andWhere('sales_reports.status = :status', { status: 1 })
        .orderBy('sales_reports.verifiedAt', 'DESC')
        .getOne();
      return handleResponse(res, 'last approved records fetched successfully');
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async handleReport(data: HandleReportRequest) {
    try {
      const datestr: any = new Date(data.date);
      const startDate: any = startOfDay(datestr);
      const endDate: any = endOfDay(datestr);

      const isData = await this.salesReportRepository.findOneBy({
        branchId: data.branchId,
        clientId: data.clientId,
        date: Between(startDate, endDate),
      });
      if (!isData) {
        const salesReportData = new SalesReport();
        salesReportData.clientId = data.clientId;
        salesReportData.branchId = data.branchId;
        salesReportData.openingBalance = data.openingBalance;
        salesReportData.closingBalance = data.closingBalance;
        salesReportData.onlinePayouts = data.onlinePayouts;
        salesReportData.onlineSales = data.onlineSales;
        salesReportData.normalSales = data.normalSales;
        salesReportData.normalPayouts = data.normalPayouts;
        salesReportData.otherPayouts = data.otherPayouts;
        salesReportData.otherSales = data.otherSales;
        salesReportData.cashin = data.cashin;
        salesReportData.cashout = data.cashout;
        salesReportData.expenses = data.expenses;
        salesReportData.date = datestr;
        salesReportData.createdAt = new Date();

        const res = await this.salesReportRepository.save(salesReportData);
        return handleResponse(res, 'report for date recorded successfully');
      }
      if (isData.status === 1) {
        return handleError(
          'report for date already approved, Cannot Modify',
          null,
          HttpStatus.CONFLICT,
        );
      }
      if (isData.status === 0) {
        await this.salesReportRepository.update(
          { id: isData.id },
          {
            otherSales: data.otherSales,
            otherPayouts: data.otherPayouts,
            closingBalance: data.closingBalance,
            updatedAt: new Date(),
          },
        );
        const res = await this.salesReportRepository.findOneBy({
          id: isData.id,
        });

        return handleResponse(res, 'report for date updated successfully');
      }
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async currentReport({ clientId, userId }: FetchReportRequest) {
    try {
      const userIds = await this.fetchUserIds(userId, clientId);
      const date = new Date();
      const startDate = startOfDay(date);
      const endDate = endOfDay(date);
      const [onlineSales, onlinePayouts] = await Promise.all([
        await this.transactionRepository
          .createQueryBuilder('transactions')
          .select('SUM(transactions.amount)', 'sum')
          .where('transactions.client_id = :clientId', { clientId })
          .andWhere('transactions.user_id IN (:...userIds)', { userIds })
          .andWhere('transactions.status = :status', { status: 1 })
          .andWhere('transactions.subject = :subject', { subject: 'Deposit' })
          .andWhere('transactions.created_at BETWEEN :startDate AND :endDate', {
            startDate,
            endDate,
          })
          .getRawOne(),
        await this.transactionRepository
          .createQueryBuilder('transactions')
          .select('SUM(transactions.amount)', 'sum')
          .where('transactions.client_id = :clientId', { clientId })
          .andWhere('transactions.user_id IN (:...userIds)', { userIds })
          .andWhere('transactions.status = :status', { status: 1 })
          .andWhere('transactions.subject = :subject', {
            subject: 'Withdrawal',
          })
          .andWhere('transactions.created_at BETWEEN :startDate AND :endDate', {
            startDate,
            endDate,
          })
          .getRawOne(),
      ]);

      const credit = onlineSales.sum ? Number(onlineSales.sum) : 0;
      const debit = onlinePayouts.sum ? Number(onlinePayouts.sum) : 0;

      const res = {
        balance: credit - debit,
        deposit: credit,
        withdrawal: debit,
      };

      return handleResponse(res, 'report for today fetched successfully');
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
  async fetchReport({ clientId, userId, date }: FetchReportRequest) {
    try {
      const userIds = await this.fetchUserIds(userId, clientId);
      const date_1 = new Date(date);
      const newDate = subHours(date, 24);
      const startDate = startOfDay(date_1);
      const endDate = endOfDay(date_1);
      const prevStartDate = startOfDay(newDate);
      const prevEndDate = endOfDay(newDate);

      const [
        isReport,
        onlineSales,
        onlinePayouts,
        normalSales,
        normalPayouts,
        prevOnlineSales,
        prevOnlinePayouts,
        prevNormalSales,
        prevNormalPayouts,
        cashin,
        cashout,
        expense,
      ] = await Promise.all([
        await this.salesReportRepository.findOneBy({
          branchId: userId,
          clientId,
          date: Between(startDate, endDate),
        }),
        await this.transactionRepository
          .createQueryBuilder('transactions')
          .select('SUM(transactions.amount)', 'sum')
          .where('transactions.client_id = :clientId', { clientId })
          .andWhere('transactions.user_id IN (:...userIds)', { userIds })
          .andWhere('transactions.status = :status', { status: 1 })
          .andWhere('transactions.subject = :subject', { subject: 'Deposit' })
          .andWhere('transactions.channel = :channel', { channel: 'sbengine' })
          .andWhere('transactions.created_at BETWEEN :startDate AND :endDate', {
            startDate,
            endDate,
          })
          .getRawOne(),
        await this.transactionRepository
          .createQueryBuilder('transactions')
          .select('SUM(transactions.amount)', 'sum')
          .where('transactions.client_id = :clientId', { clientId })
          .andWhere('transactions.user_id IN (:...userIds)', { userIds })
          .andWhere('transactions.status = :status', { status: 1 })
          .andWhere('transactions.subject = :subject', {
            subject: 'Withdrawal',
          })
          .andWhere('transactions.channel = :channel', { channel: 'sbengine' })
          .andWhere('transactions.created_at BETWEEN :startDate AND :endDate', {
            startDate,
            endDate,
          })
          .getRawOne(),
        await this.transactionRepository
          .createQueryBuilder('transactions')
          .select('SUM(transactions.amount)', 'sum')
          .where('transactions.client_id = :clientId', { clientId })
          .andWhere('transactions.user_id IN (:...userIds)', { userIds })
          .andWhere('transactions.status = :status', { status: 1 })
          .andWhere('transactions.subject = :subject', {
            subject: 'Bet Deposit (Sport)',
          })
          .andWhere('transactions.created_at BETWEEN :startDate AND :endDate', {
            startDate,
            endDate,
          })
          .getRawOne(),
        await this.transactionRepository
          .createQueryBuilder('transactions')
          .select('SUM(transactions.amount)', 'sum')
          .where('transactions.client_id = :clientId', { clientId })
          .andWhere('transactions.user_id IN (:...userIds)', { userIds })
          .andWhere('transactions.status = :status', { status: 1 })
          .andWhere('transactions.subject = :subject', { subject: 'Sport Win' })
          .andWhere('transactions.created_at BETWEEN :startDate AND :endDate', {
            startDate,
            endDate,
          })
          .getRawOne(),
        await this.transactionRepository
          .createQueryBuilder('transactions')
          .select('SUM(transactions.amount)', 'sum')
          .where('transactions.client_id = :clientId', { clientId })
          .andWhere('transactions.user_id IN (:...userIds)', { userIds })
          .andWhere('transactions.status = :status', { status: 1 })
          .andWhere('transactions.subject = :subject', { subject: 'Deposit' })
          .andWhere('transactions.channel = :channel', { channel: 'sbengine' })
          .andWhere(
            'transactions.created_at BETWEEN :prevStartDate AND :prevEndDate',
            {
              prevStartDate,
              prevEndDate,
            },
          )
          .getRawOne(),
        await this.transactionRepository
          .createQueryBuilder('transactions')
          .select('SUM(transactions.amount)', 'sum')
          .where('transactions.client_id = :clientId', { clientId })
          .andWhere('transactions.user_id IN (:...userIds)', { userIds })
          .andWhere('transactions.status = :status', { status: 1 })
          .andWhere('transactions.subject = :subject', {
            subject: 'Withdrawal',
          })
          .andWhere('transactions.channel = :channel', { channel: 'sbengine' })
          .andWhere(
            'transactions.created_at BETWEEN :prevStartDate AND :prevEndDate',
            {
              prevStartDate,
              prevEndDate,
            },
          )
          .getRawOne(),
        await this.transactionRepository
          .createQueryBuilder('transactions')
          .select('SUM(transactions.amount)', 'sum')
          .where('transactions.client_id = :clientId', { clientId })
          .andWhere('transactions.user_id IN (:...userIds)', { userIds })
          .andWhere('transactions.status = :status', { status: 1 })
          .andWhere('transactions.subject = :subject', {
            subject: 'Bet Deposit (Sport)',
          })
          .andWhere(
            'transactions.created_at BETWEEN :prevStartDate AND :prevEndDate',
            {
              prevStartDate,
              prevEndDate,
            },
          )
          .getRawOne(),
        await this.transactionRepository
          .createQueryBuilder('transactions')
          .select('SUM(transactions.amount)', 'sum')
          .where('transactions.client_id = :clientId', { clientId })
          .andWhere('transactions.user_id IN (:...userIds)', { userIds })
          .andWhere('transactions.status = :status', { status: 1 })
          .andWhere('transactions.subject = :subject', { subject: 'Sport Win' })
          .andWhere(
            'transactions.created_at BETWEEN :prevStartDate AND :prevEndDate',
            {
              prevStartDate,
              prevEndDate,
            },
          )
          .getRawOne(),

        await this.cashinRepository.sum('amount', {
          branch_id: userId,
          status: 1,
          verified_at: Between(startDate, endDate),
        }),
        await this.cashoutRepository.sum('amount', {
          branch_id: userId,
          status: 1,
          verified_at: Between(startDate, endDate),
        }),
        await this.expensesRepository
          .createQueryBuilder('expenses')
          .select('SUM(expenses.amount)', 'sum')
          .where('expenses.branch_id = :branchId', { branchId: userId })
          .andWhere('expenses.status = :status', { status: 1 })
          .andWhere('expenses.verified_at BETWEEN :startDate AND :endDate', {
            startDate,
            endDate,
          })
          .getRawOne(),
      ]);

      const onlineSales_ = onlineSales.sum ? Number(onlineSales.sum) : 0;
      const onlinePayouts_ = onlinePayouts.sum ? Number(onlinePayouts.sum) : 0;
      const normalSales_ = normalSales.sum ? Number(normalSales.sum) : 0;
      const normalPayouts_ = normalPayouts.sum ? Number(normalPayouts.sum) : 0;
      const prevOnlineSales_ = prevOnlineSales.sum
        ? Number(prevOnlineSales.sum)
        : 0;
      const prevOnlinePayouts_ = prevOnlinePayouts.sum
        ? Number(prevOnlinePayouts.sum)
        : 0;
      const prevNormalSales_ = prevNormalSales.sum
        ? Number(prevNormalSales.sum)
        : 0;
      const prevNormalPayouts_ = prevNormalPayouts.sum
        ? Number(prevNormalPayouts.sum)
        : 0;
      const expense_ = expense.sum ? Number(expense.sum) : 0;
      const cashout_ = cashout ? Number(cashout) : 0;
      const cashin_ = cashin ? Number(cashin) : 0;
      const credit = onlineSales_ + normalSales_;
      const debit = onlinePayouts_ + normalPayouts_;
      const prev_credit = prevOnlineSales_ + prevNormalSales_;
      const prev_debit = prevOnlinePayouts_ + prevNormalPayouts_;

      const res = {
        openingBalance: prev_credit - prev_debit,
        closingBalance: credit - debit,
        onlinePayouts: onlinePayouts_,
        onlineSales: onlineSales_,
        normalSales: normalSales_,
        normalPayouts: normalPayouts_,
        cashin: cashin_,
        cashout: cashout_,
        expenses: expense_,
        status: !isReport ? null : isReport.status === 1 ? 1 : 0,
      };

      return handleResponse(res, 'report for date fetched successfully');
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
  async fetchMonthlyShopReport({ clientId, userId }: FetchReportRequest) {
    try {
      const currentDate = new Date();

      // Calculate the first day of the current month
      const firstDayOfMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1,
      );
      console.log(
        'URRENT DATE',
        currentDate,
        firstDayOfMonth,
        'FIRST OF NONTHS',
        clientId,
        userId,
      );
      const userIds = await this.fetchUserIds(userId, clientId);

      const [
        _manager_balance,
        _cashier_balance,
        _total_sales,
        _total_payouts,
        _total_expenses,
      ] = await Promise.all([
        await this.walletRepository
          .createQueryBuilder('wallets')
          .select('SUM(wallets.available_balance)', 'sum')
          .where('wallets.user_id = :userId', { userId })
          .andWhere('wallets.client_id = :clientId', { clientId })
          .andWhere('wallets.created_at BETWEEN :startDate AND :endDate', {
            startDate: firstDayOfMonth,
            endDate: currentDate,
          })
          .getRawOne(),
        await this.walletRepository
          .createQueryBuilder('wallets')
          .select('SUM(wallets.available_balance)', 'sum')
          .where('wallets.client_id = :clientId', { clientId })
          .andWhere('wallets.user_id IN (:...userIds)', { userIds })
          .andWhere('wallets.status = :status', { status: 1 })
          .andWhere('wallets.created_at BETWEEN :startDate AND :endDate', {
            startDate: firstDayOfMonth,
            endDate: currentDate,
          })
          .getRawOne(),
        await this.transactionRepository
          .createQueryBuilder('transactions')
          .select('SUM(transactions.amount)', 'sum')
          .where('transactions.client_id = :clientId', { clientId })
          .andWhere('transactions.user_id IN (:...userIds)', { userIds })
          .andWhere('transactions.status = :status', { status: 1 })
          .andWhere('transactions.subject = :subject', { subject: 'Deposit' })
          .andWhere('transactions.created_at BETWEEN :startDate AND :endDate', {
            startDate: firstDayOfMonth,
            endDate: currentDate,
          })
          .getRawOne(),
        await this.transactionRepository
          .createQueryBuilder('transactions')
          .select('SUM(transactions.amount)', 'sum')
          .where('transactions.client_id = :clientId', { clientId })
          .andWhere('transactions.user_id IN (:...userIds)', { userIds })
          .andWhere('transactions.status = :status', { status: 1 })
          .andWhere('transactions.subject = :subject', {
            subject: 'Withdrawal',
          })
          .andWhere('transactions.created_at BETWEEN :startDate AND :endDate', {
            startDate: firstDayOfMonth,
            endDate: currentDate,
          })
          .getRawOne(),
        await this.expensesRepository
          .createQueryBuilder('expenses')
          .select('SUM(expenses.amount)', 'sum')
          .where('expenses.client_id = :clientId', { clientId })
          .andWhere('expenses.branch_id IN (:...userIds)', { userIds })
          .andWhere('expenses.status = :status', { status: 1 })
          .andWhere('expenses.created_at BETWEEN :startDate AND :endDate', {
            startDate: firstDayOfMonth,
            endDate: currentDate,
          })
          .getRawOne(),
      ]);
      console.log(
        _manager_balance.sum,
        '__________',
        _cashier_balance.sum,
        '__________',
        _total_sales.sum,
        '__________',
        _total_payouts.sum,
        '__________',
        _total_expenses.sum,
      );
      const manager_balance = _manager_balance.sum
        ? Number(_manager_balance.sum)
        : 0;
      const cashier_balance = _cashier_balance.sum
        ? Number(_cashier_balance.sum)
        : 0;

      const res = {
        manager_balance,
        cashier_balance,
        branch_balance: manager_balance + cashier_balance,
        total_sales: _total_sales.sum ? Number(_total_sales.sum) : 0,
        total_payouts: _total_payouts.sum ? Number(_total_payouts.sum) : 0,
        total_expenses: _total_expenses.sum ? Number(_total_expenses.sum) : 0,
      };

      return handleResponse(res, 'report for month fetched successfully');
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async fetchUserIds(userId, clientId) {
    // fetch agent users
    const usersRes = await this.identityService.getAgentUser({
      clientId,
      userId,
    });

    let userIds = [];

    if (usersRes.success) {
      userIds = usersRes.data.map((user) => user.id);
    }

    return userIds;
  }
}
