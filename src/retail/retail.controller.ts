import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { WALLET_SERVICE_NAME } from 'src/proto/wallet.pb';
import { RetailService } from './retail.service';

@Controller('retail')
export class RetailController {

    constructor(private readonly retailService: RetailService) {}

    @GrpcMethod(WALLET_SERVICE_NAME, 'FundsTransfer')
    FundsTransfer(payload) {
        // return this.retailService.fundUser(payload);
    }

    @GrpcMethod(WALLET_SERVICE_NAME, 'Last10Transaction')
    GetLast10Transaction(payload) {
        return this.retailService.listLast10Transactions(payload);
    }

    @GrpcMethod(WALLET_SERVICE_NAME, 'SalesReport')
    SalesReport(payload) {
        // return this.retailService.salesReport(payload);
    }

    @GrpcMethod(WALLET_SERVICE_NAME, 'BalanceOverview')
    BalanceOverview(payload) {
        // return this.retailService.balanceOverview(payload);
    }
}
