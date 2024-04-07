import { Controller } from '@nestjs/common';
import { AppService } from './app.service';
import {
  CreateWalletRequest,
  CreditUserRequest,
  DebitUserRequest,
  FetchBetRangeRequest,
  FetchDepositCountRequest,
  FetchDepositRangeRequest,
  FetchPlayerDepositRequest,
  GetBalanceRequest,
  GetPaymentMethodRequest,
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

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private paymentService: PaymentService,
    private paystackService: PaystackService,
    private monnifyService: MonnifyService,
    private opayService: OPayService,
    private depositService: DepositService,
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
}
