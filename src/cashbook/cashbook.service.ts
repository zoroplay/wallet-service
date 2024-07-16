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
  IdRequest,
} from 'src/proto/wallet.pb';

@Injectable()
export class CashbookService {
  constructor(
    private cashinService: CashInService,
    private cashoutService: CashOutService,
    private expenseService: ExpensesService,
    private expensetypeService: ExpenseTypesService,
  ) {}
  // Cashin
  async approveCashin(data: CashbookApproveCashInOutRequest) {
    return this.cashinService.approve(data);
  }
  async addCashin(data: CashbookCreateCashInOutRequest) {
    return this.cashinService.addCashin(data);
  }

  async findOneCashin(data: IdRequest) {
    return this.cashinService.findOne(data);
  }
  async deleteOneCashin(data: IdRequest) {
    return this.cashinService.remove(data);
  }
  async findAllCashin() {
    return this.cashinService.findAllCashin();
  }

  async findAllBranchCashin(data: BranchRequest) {
    return this.cashinService.findAllBranchCashin(data);
  }

  async findAllBranchApprovedCashinWDate(data: BranchRequest) {
    return this.cashinService.findAllBranchApprovedCashinWDate(data);
  }

  async findAllBranchPendingCashinWDate(data: BranchRequest) {
    return this.cashinService.findAllBranchPendingCashinWDate(data);
  }

  //  Cash Out
  async approveCashout(data: CashbookApproveCashInOutRequest) {
    return this.cashoutService.approve(data);
  }

  async addCashout(data: CashbookCreateCashInOutRequest) {
    console.log(`adding cashout`, data);
    return this.cashoutService.addCashOut(data);
  }

  async findAllBranchCashout(data: BranchRequest) {
    return this.cashoutService.findAllBranch(data);
  }

  async findAllCashout() {
    return this.cashoutService.findAll();
  }
  async findOneCashout(data: IdRequest) {
    return this.cashoutService.findOne(data);
  }
  async deleteOneCashout(data: IdRequest) {
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

  async findOneExpenses(data: IdRequest) {
    return this.expenseService.findOne(data);
  }

  async deleteOneExpenses(data: IdRequest) {
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
}
