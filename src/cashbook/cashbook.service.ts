/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { CashInService } from './services/cashin.service';
import { CashOutService } from './services/cashout.service';
import { ExpensesService } from './services/expenses.service';
import { ExpenseTypesService } from './services/expense_type.service';
import {
  BranchRequest,
  CashbookApproveCashInOutRequest,
  CashbookApproveExpenseRequest,
  CashbookCreateCashInOutRequest,
  CashbookCreateExpenseRequest,
  CashbookCreateExpenseTypeRequest,
  CashbookIdRequest,
  FetchLastApprovedRequest,
  FetchReportRequest,
  FetchSalesReportRequest,
  HandleReportRequest,
} from 'src/proto/wallet.pb';
import { SalesReportService } from './services/sales_report.service';

@Injectable()
export class CashbookService {
  constructor(
    private cashinService: CashInService,
    private cashoutService: CashOutService,
    private expenseService: ExpensesService,
    private expensetypeService: ExpenseTypesService,
    private salesReportService: SalesReportService,
  ) {}
  // Cashin
  async approveCashin(data: CashbookApproveCashInOutRequest) {
    return this.cashinService.approve(data);
  }
  async addCashin(data: CashbookCreateCashInOutRequest) {
    return this.cashinService.addCashin(data);
  }

  async findOneCashin(data: CashbookIdRequest) {
    return this.cashinService.findOne(data);
  }
  async deleteOneCashin(data: CashbookIdRequest) {
    return this.cashinService.remove(data);
  }
  async findAllCashin() {
    return this.cashinService.findAllCashin();
  }

  async findAllBranchCashin(data: BranchRequest) {
    return this.cashinService.findAllBranchCashin(data);
  }

  async findAllBranchPendingCashinWDate(data: BranchRequest) {
    return this.cashinService.findAllBranchPendingCashinWDate(data);
  }

  //  Cash Out
  async approveCashout(data: CashbookApproveCashInOutRequest) {
    return this.cashoutService.approve(data);
  }

  async addCashout(data: CashbookCreateCashInOutRequest) {
    // console.log(`adding cashout`, data);
    return this.cashoutService.addCashOut(data);
  }

  async findAllBranchCashout(data: BranchRequest) {
    return this.cashoutService.findAllBranch(data);
  }

  async findAllCashout() {
    return this.cashoutService.findAll();
  }
  async findOneCashout(data: CashbookIdRequest) {
    return this.cashoutService.findOne(data);
  }
  async deleteOneCashout(data: CashbookIdRequest) {
    return this.cashoutService.remove(data);
  }

  //  Expenses
  async approveExpense(data: CashbookApproveExpenseRequest) {
    return this.expenseService.approve(data);
  }

  async addExpense(data: CashbookCreateExpenseRequest) {
    return this.expenseService.create(data);
  }
  async updateExpense(data: CashbookCreateExpenseRequest) {
    return this.expenseService.update(data);
  }

  async findOneExpenses(data: CashbookIdRequest) {
    return this.expenseService.findOne(data);
  }

  async deleteOneExpenses(data: CashbookIdRequest) {
    return this.expenseService.remove(data);
  }

  async findAllExpenses() {
    return this.expenseService.findAll();
  }

  async findAllBranchExpenses(param: BranchRequest) {
    return this.expenseService.findAllBranch(param);
  }
  //  Expense Type
  async addExpensetype(data: CashbookCreateExpenseTypeRequest) {
    return this.expensetypeService.create(data);
  }

  async findAllExpenseTypes() {
    return this.expensetypeService.findAll();
  }

  async fetchBranchReport(data: FetchReportRequest) {
    return this.salesReportService.fetchReport(data);
  }

  async handleReport(data: HandleReportRequest) {
    return this.salesReportService.handleReport(data);
  }
  async fetchLastApproved(data: FetchLastApprovedRequest) {
    return this.salesReportService.fetchLastApproved(data);
  }
  async verifyFinalTransaction(data: FetchLastApprovedRequest) {
    return this.salesReportService.verifyFinalTransaction(data);
  }
  async fetchSalesReport(data: FetchSalesReportRequest) {
    return this.salesReportService.fetchSalesReport(data);
  }
  async fetchMonthlyShopReport(data: FetchReportRequest) {
    return this.salesReportService.fetchMonthlyShopReport(data);
  }
}
