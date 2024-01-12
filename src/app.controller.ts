import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { CreateWalletRequest, CreditUserRequest, DebitUserRequest, WALLET_SERVICE_NAME } from './proto/wallet.pb';
import { GrpcMethod } from '@nestjs/microservices';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @GrpcMethod(WALLET_SERVICE_NAME, 'CreateWallet')
  CreateWallet(param: CreateWalletRequest) {
    return this.appService.createWallet(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'CreditUser')
  CreditUser(param: CreditUserRequest) {
    return this.appService.creditUser(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'DebitUser')
  DebitUser(param: DebitUserRequest) {
    return this.appService.debitUser(param);
  }

  @GrpcMethod(WALLET_SERVICE_NAME, 'SavePaymentMethod')
  SavePaymentMethod(param: CreateWalletRequest) {
    return this.appService.savePaymentMethod(param);
  }
}
