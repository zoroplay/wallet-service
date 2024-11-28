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
  CreateBulkPawapayRequest,
  CreatePawapayRequest,
  CashbookIdRequest,
  CreateWalletRequest,
  CreditUserRequest,
  DebitUserRequest,
  FetchBetRangeRequest,
  FetchDepositCountRequest,
  FetchDepositRangeRequest,
  FetchPawapayRequest,
  FetchLastApprovedRequest,
  FetchPlayerDepositRequest,
  FetchReportRequest,
  FetchSalesReportRequest,
  GetBalanceRequest,
  GetNetworkBalanceRequest,
  GetPaymentMethodRequest,
  HandleReportRequest,
  GetTransactionsRequest,
  IdRequest,
  InitiateDepositRequest,
  ListDepositRequests,
  ListWithdrawalRequests,
  OpayWebhookRequest,
  PawapayCountryRequest,
  PawapayPredCorrRequest,
  PawapayToolkitRequest,
  PaymentMethodRequest,
  ProcessRetailTransaction,
  UpdateWithdrawalRequest,
  UserTransactionRequest,
  ValidateTransactionRequest,
  VerifyBankAccountRequest,
  VerifyDepositRequest,
  WALLET_SERVICE_NAME,
  WalletTransferRequest,
  WithdrawRequest,
  Pitch90TransactionRequest,
  WayaBankRequest,
  Pitch90RegisterUrlRequest,
  FetchUsersWithdrawalRequest,
} from 'src/proto/wallet.pb';
import { GrpcMethod } from '@nestjs/microservices';
import { PaymentService } from './services/payments.service';
import { PaystackService } from './services/paystack.service';
import { OPayService } from './services/opay.service';
import { DepositService } from './services/deposit.service';
import { MonnifyService } from './services/monnify.service';
import { CashbookService } from './cashbook/cashbook.service';
import { WithdrawalService } from './services/withdrawal.service';
import { ReportingService } from './services/reporting.service';
import { FlutterwaveService } from './services/flutterwave.service';

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
    private withdrawalService: WithdrawalService,
    private reportingService: ReportingService,
    private flutterwaveService: FlutterwaveService
  ) {}

  @GrpcMethod(WALLET_SERVICE_NAME, 'FetchBetRange')
  FetchBetRange(payload: FetchBetRangeRequest) {
    return this.depositService.fetchBetRange(payload);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'flutterwave')
  CreatePayment(payload: InitiateDepositRequest) {
    return this.flutterwaveService.createPayment(payload)
  }


  @GrpcMethod(WALLET_SERVICE_NAME, 'FetchDepositCount')
  FetchDepositCount(payload: FetchDepositCountRequest) {
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

  @GrpcMethod(WALLET_SERVICE_NAME, 'DebitAgentBalance')
  DebitAgent(param: DebitUserRequest) {
    return this.appService.debitAgentBalance(param);
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
    return this.withdrawalService.requestWithdrawal(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'UpdateWithdrawal')
  UpdateWithdrawal(param: UpdateWithdrawalRequest) {
    return this.paymentService.updateWithdrawalStatus(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'ListWithdrawals')
  ListWithdrawals(param: ListWithdrawalRequests) {
    return this.withdrawalService.listWithdrawalRequest(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'ListDeposits')
  ListDeposits(param: ListDepositRequests) {
    return this.appService.listDeposits(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'ListBanks')
  ListBanks() {
    return this.appService.listBanks();
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
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookVerifyFinalTransaction')
  CashbookVerifyFinalTransaction(param: FetchLastApprovedRequest) {
    return this.cashbookService.verifyFinalTransaction(param);
  }
  // CASH IN
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookFetchLastApproved')
  CashbookFetchLastApproved(param: FetchLastApprovedRequest) {
    return this.cashbookService.fetchLastApproved(param);
  }
  // CASH IN
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookFetchSalesReport')
  CashbookFetchSalesReport(param: FetchSalesReportRequest) {
    return this.cashbookService.fetchSalesReport(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookFetchReport')
  CashbookFetchReport(param: FetchReportRequest) {
    return this.cashbookService.fetchBranchReport(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CurrentReport')
  CurrentReport(param: FetchReportRequest) {
    return this.cashbookService.currentReport(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookFetchMonthlyShopReport')
  CashbookFetchMonthlyShopReport(param: FetchReportRequest) {
    return this.cashbookService.fetchMonthlyShopReport(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookHandleReport')
  CashbookHandleReport(param: HandleReportRequest) {
    return this.cashbookService.handleReport(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookApproveCashIn')
  CashbookApproveCashIn(param: CashbookApproveCashInOutRequest) {
    return this.cashbookService.approveCashin(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookDeleteOneCashIn')
  CashbookDeleteOneCashIn(param: CashbookIdRequest) {
    return this.cashbookService.deleteOneCashin(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookFindOneCashIn')
  CashbookFindOneCashIn(param: CashbookIdRequest) {
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

  @GrpcMethod(WALLET_SERVICE_NAME, 'FindAllBranchPendingCashinWDate')
  FindAllBranchPendingCashinWDate(param: BranchRequest) {
    return this.cashbookService.findAllBranchPendingCashinWDate(param);
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
  CashbookDeleteOneCashOut(param: CashbookIdRequest) {
    return this.cashbookService.deleteOneCashout(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookFindOneCashOut')
  CashbookFindOneCashOut(param: CashbookIdRequest) {
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
  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookDeleteOneExpense')
  CashbookDeleteOneExpense(data: CashbookIdRequest) {
    return this.cashbookService.deleteOneExpenses(data);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'CashbookFindOneExpense')
  CashbookFindOneExpense(data: CashbookIdRequest) {
    return this.cashbookService.findOneExpenses(data);
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
  @GrpcMethod(WALLET_SERVICE_NAME, 'GetUserAccounts')
  GetUserAccounts(param: GetBalanceRequest) {
    return this.withdrawalService.getUserBankAccounts(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'GetNetworkBalance')
  GetNetworkBalance(param: GetNetworkBalanceRequest) {
    return this.appService.getNetworkBalance(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'WalletTransfer')
  walletTransfer(param: WalletTransferRequest) {
    return this.paymentService.walletTransfer(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'ValidateDepositCode')
  ValidateDepositCode(param: ValidateTransactionRequest) {
    return this.depositService.validateDepositCode(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'ValidateWithdrawalCode')
  ValidateWithdrawalCode(param: ValidateTransactionRequest) {
    return this.withdrawalService.validateWithdrawalCode(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'ProcessShopWithdrawal')
  ProcessShopWithdrawal(param: ProcessRetailTransaction) {
    return this.withdrawalService.processShopWithdrawal(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'ProcessShopDeposit')
  ProcessShopDeposit(param: ProcessRetailTransaction) {
    return this.depositService.processShopDeposit(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'DeletePlayerData')
  DeletePlayerData(param: IdRequest) {
    return this.appService.deletePlayerData(param.id);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'GetMoneyTransaction')
  GetMoneyTransaction(param: GetTransactionsRequest) {
    return this.reportingService.getMoneyTransaction(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'GetSystemTransaction')
  GetSystemTransaction(param: GetTransactionsRequest) {
    return this.reportingService.getSystemTransaction(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'HandleCreatePawaPay')
  HandleCreatePawaPay(param: CreatePawapayRequest) {
    return this.paymentService.createRequest(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'HandleCreateBulkPawaPay')
  HandleCreateBulkPawaPay(param: CreateBulkPawapayRequest) {
    return this.paymentService.createBulkPayout(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'HandleFetchPawaPay')
  HandleFetchPawaPay(param: FetchPawapayRequest) {
    return this.paymentService.getRequests(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'HandlePawaPayBalances')
  HandlePawaPayBalances(param: PawapayCountryRequest) {
    return this.paymentService.fetchWalletBalances(param.clientId);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'HandlePawaPayCountryBalances')
  HandlePawaPayCountryBalances(param: PawapayCountryRequest) {
    return this.paymentService.fetchCountryWalletBalances(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'HandlePawaPayPredCorr')
  HandlePawaPayPredCorr(param: PawapayPredCorrRequest) {
    return this.paymentService.predictCorrespondent(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'HandlePawaPayToolkit')
  HandlePawaPayToolkit(param: PawapayToolkitRequest) {
    return this.paymentService.fetchToolkit(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'HandlePawaPayActiveConf')
  HandlePawaPayActiveConf(param: PawapayCountryRequest) {
    return this.paymentService.fetchActiveConf(param.clientId);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'CreateVirtualAccount')
  CreateVirtualAccount(param: WayaBankRequest) {
    return this.paymentService.createVirtualAccount(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'WayabankAccountEnquiry')
  WayabankAccountEnquiry(param: WayaBankRequest) {
    return this.paymentService.wayabankAccountEnquiry(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'Pitch90Transaction')
  Pitch90Transaction(param: Pitch90TransactionRequest) {
    return this.paymentService.pitch90Transaction(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'Pitch90RegisterUrl')
  Pitch90RegisterUrl(param: Pitch90RegisterUrlRequest) {
    return this.paymentService.pitch90RegisterUrl(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'FetchUsersWithdrawal')
  FetchUsersWithdrawal(param: FetchUsersWithdrawalRequest) {
    return this.withdrawalService.fetchUsersWithdrawal(param);
  }
  @GrpcMethod(WALLET_SERVICE_NAME, 'AwardBonusWinning')
  AwardBonusWinning(param: CreditUserRequest) {
    return this.appService.awardBonusWinning(param);
  }
}
