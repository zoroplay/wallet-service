import { Controller } from '@nestjs/common';
import { AppService } from './app.service';
import { CreateWalletRequest, CreditUserRequest, DebitUserRequest, GetBalanceRequest, GetPaymentMethodRequest, InitiateDepositRequest, ListWithdrawalRequests, OpayWebhookRequest, PaymentMethodRequest, UserTransactionRequest, VerifyBankAccountRequest, VerifyDepositRequest, WALLET_SERVICE_NAME, WithdrawRequest } from 'src/proto/wallet.pb';
import { GrpcMethod } from '@nestjs/microservices';
import { PaymentService } from './payments/payments.service';
import { PaystackService } from './services/paystack.service';
import { OPayService } from './services/opay.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private paymentService: PaymentService,
    private paystackService: PaystackService,
    private opayService: OPayService,
  ) {}

  @GrpcMethod(WALLET_SERVICE_NAME, 'CreateWallet')
  CreateWallet(param: CreateWalletRequest) {
    return this.appService.createWallet(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'GetBalance')
  GetBalance(param: GetBalanceRequest) {
    return this.appService.getBalance(param);
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

  @GrpcMethod(WALLET_SERVICE_NAME, 'ListWithdrawals')
  ListWithdrawals(param: ListWithdrawalRequests) {
    return this.appService.listWithdrawalRequest(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'UserTransactions')
  UserTransactions(param: UserTransactionRequest) {
    return this.appService.getUserTransactions(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'PaystackWebhook')
  PaystackWebhook(param: WithdrawRequest) {
    return this.paystackService.handleWebhook(param);
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
