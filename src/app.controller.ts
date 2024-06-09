/* eslint-disable prettier/prettier */
import { Controller } from '@nestjs/common';
import { AppService } from './app.service';
import {
  BranchRequest,
  CashbookApproveCashInOutRequest,
  CashbookApproveExpenseRequest,
  CashbookCreateCashInOutRequest,
  CashbookCreateExpenseRequest,
  // CashbookCreateExpenseCategoryRequest,
  CashbookCreateExpenseTypeRequest,
  CreateWalletRequest,
  CreditUserRequest,
  DebitUserRequest,
  FetchBetRangeRequest,
  FetchDepositCountRequest,
  FetchDepositRangeRequest,
  FetchPlayerDepositRequest,
  GetBalanceRequest,
  GetPaymentMethodRequest,
  IdRequest,
  InitiateDepositRequest,
  ListDepositRequests,
  ListWithdrawalRequests,
  OpayWebhookRequest,
  PaymentMethodRequest,
  UpdateWithdrawalRequest,
  UserTransactionRequest,
  VerifyBankAccountRequest,
  VerifyDepositRequest,
  WALLET_SERVICE_NAME,
  WithdrawRequest,
} from 'src/proto/wallet.pb';
import { GrpcMethod } from '@nestjs/microservices';
import { PaymentService } from './services/payments.service';
import { PaystackService } from './services/paystack.service';
import { OPayService } from './services/opay.service';
import { DepositService } from './services/deposit.service';
import { MonnifyService } from './services/monnify.service';
import { CashbookService } from './cashbook/cashbook.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private paymentService: PaymentService,
    private paystackService: PaystackService,
    private monnifyService: MonnifyService,
    private opayService: OPayService,
    private depositService: DepositService,
    private cashbookService: CashbookService,
  ) {}

  @GrpcMethod(WALLET_SERVICE_NAME, 'FetchBetRange')
  FetchBetRange(payload: FetchBetRangeRequest) {
    return this.depositService.fetchBetRange(payload);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'FetchDepositCount')
  FetchDepositCount(payload: FetchDepositCountRequest) {
    console.log('entered fetchDepositCount');
    return this.depositService.fetchDepositCount(payload);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'FetchPlayerDeposit')
  FetchPlayerDeposit(payload: FetchPlayerDepositRequest) {
    return this.depositService.fetchPlayerDeposit(payload);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'FetchDepositRange')
  FetchDepositRange(payload: FetchDepositRangeRequest) {
    return this.depositService.fetchDepositRange(payload);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'CreateWallet')
  CreateWallet(param: CreateWalletRequest) {
    return this.appService.createWallet(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'GetBalance')
  GetBalance(param: GetBalanceRequest) {
    return this.appService.getBalance(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'GetPlayerWalletData')
  GetPlayerWalletData(param: GetBalanceRequest) {
    return this.appService.getWalletSummary(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'CreditUser')
  CreditUser(param: CreditUserRequest) {
    return this.appService.creditUser(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'DebitUser')
  DebitUser(param: DebitUserRequest) {
    return this.appService.debitUser(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'InititateDeposit')
  InititateDeposit(param: InitiateDepositRequest) {
    return this.paymentService.inititateDeposit(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'VerifyDeposit')
  VerifyDeposit(param: VerifyDepositRequest) {
    return this.paymentService.verifyDeposit(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'SavePaymentMethod')
  SavePaymentMethod(param: PaymentMethodRequest) {
    return this.appService.savePaymentMethod(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'GetPaymentMethods')
  GetPaymentMethod(param: GetPaymentMethodRequest) {
    return this.appService.getPaymentMethods(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'VerifyBankAccount')
  VerifyBankAccount(param: VerifyBankAccountRequest) {
    return this.paymentService.verifyBankAccount(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'RequestWithdrawal')
  RequestWithdrawal(param: WithdrawRequest) {
    return this.appService.requestWithdrawal(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'UpdateWithdrawal')
  UpdateWithdrawal(param: UpdateWithdrawalRequest) {
    return this.paymentService.updateWithdrawalStatus(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'ListWithdrawals')
  ListWithdrawals(param: ListWithdrawalRequests) {
    return this.appService.listWithdrawalRequest(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'ListDeposits')
  ListDeposits(param: ListDepositRequests) {
    return this.appService.listDeposits(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'UserTransactions')
  UserTransactions(param: UserTransactionRequest) {
    return this.appService.getUserTransactions(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'PaystackWebhook')
  PaystackWebhook(param: WithdrawRequest) {
    return this.paystackService.handleWebhook(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'MonnifyWebhook')
  MonnifyWebhook(param: WithdrawRequest) {
    return this.monnifyService.handleWebhook(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'OpayDepositWebhook')
  OpayDepositWebhook(param: OpayWebhookRequest) {
    return this.opayService.updateNotify(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'OpayLookUpWebhook')
  OpayLookUpWebhook(param: OpayWebhookRequest) {
    return this.opayService.reQueryLookUp(param);
  }

  // CashBook Service
  // CASH IN
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookApproveCashIn')
  CashbookApproveCashIn(param: CashbookApproveCashInOutRequest) {
    return this.cashbookService.approveCashin(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookDeleteOneCashIn')
  CashbookDeleteOneCashIn(param: IdRequest) {
    return this.cashbookService.deleteOneCashin(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookFindOneCashIn')
  CashbookFindOneCashIn(param: IdRequest) {
    return this.cashbookService.findOneCashin(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookCreateCashIn')
  CashbookCreateCashIn(param: CashbookCreateCashInOutRequest) {
    return this.cashbookService.addCashin(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookFindAllCashIn')
  CashbookFindAllCashIn() {
    return this.cashbookService.findAllCashin();
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookFindAllBranchCashIn')
  CashbookFindAllBranchCashIn(param: BranchRequest) {
    return this.cashbookService.findAllBranchCashin(param);
  }

  // CASH OUT
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookApproveCashOut')
  CashbookApproveCashOut(param: CashbookApproveCashInOutRequest) {
    return this.cashbookService.approveCashout(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookCreateCashOut')
  CashbookCreateCashOut(param: CashbookCreateCashInOutRequest) {
    return this.cashbookService.addCashout(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookDeleteOneCashOut')
  CashbookDeleteOneCashOut(param: IdRequest) {
    return this.cashbookService.deleteOneCashout(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookFindOneCashOut')
  CashbookFindOneCashOut(param: IdRequest) {
    return this.cashbookService.findOneCashout(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookFindAllCashOut')
  CashbookFindAllCashOut() {
    return this.cashbookService.findAllCashout();
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookFindAllBranchCashOut')
  CashbookFindAllBranchCashOut(param: BranchRequest) {
    return this.cashbookService.findAllBranchCashout(param);
  }

  // EXPENSES
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookApproveExpense')
  CashbookApproveExpense(param: CashbookApproveExpenseRequest) {
    return this.cashbookService.approveExpense(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookCreateExpense')
  CashbookCreateExpense(param: CashbookCreateExpenseRequest) {
    return this.cashbookService.addExpense(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookUpdateOneExpense')
  CashbookUpdateOneExpense(data: CashbookCreateExpenseRequest) {
    return this.cashbookService.updateExpense(data);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookFindOneExpense')
  CashbookDeleteOneExpense(data: IdRequest) {
    return this.cashbookService.findOneExpenses(data);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookFindOneExpense')
  CashbookFindOneExpense(data: IdRequest) {
    return this.cashbookService.deleteOneExpenses(data);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookFindAllBranchExpense')
  CashbookFindAllBranchExpense(data: BranchRequest) {
    return this.cashbookService.findAllBranchExpenses(data);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookFindAllExpense')
  CashbookFindAllExpense() {
    return this.cashbookService.findAllExpenses();
  }

  // EXPENSE TYPES
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookCreateExpenseType')
  CashbookCreateExpenseType(param: CashbookCreateExpenseTypeRequest) {
    return this.cashbookService.addExpensetype(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookFindAllExpenseType')
  CashbookFindAllExpenseType() {
    return this.cashbookService.findAllExpenseTypes();
  }
}
