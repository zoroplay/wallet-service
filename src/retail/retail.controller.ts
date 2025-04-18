import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { SummaryRequest, WALLET_SERVICE_NAME } from 'src/proto/wallet.pb';
import { RetailService } from './retail.service';
type RangeType = 'day' | 'week' | 'month' | 'year';
const allowedRanges: RangeType[] = ['day', 'week', 'month', 'year'];

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

  @GrpcMethod(WALLET_SERVICE_NAME, 'GetTransactionSummary')
  GetSummary(payload: SummaryRequest) {
    const { clientId, range, from, to } = payload;

    // Validate the range input
    const isValidRange = (value: string): value is RangeType => {
      return allowedRanges.includes(value as RangeType);
    };

    const safeRange: RangeType | undefined = isValidRange(range)
      ? (range as RangeType)
      : undefined;

    // Convert from/to ISO strings to Date objects if present
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    return this.retailService.getSummary(clientId, {
      rangeZ: safeRange,
      from: fromDate,
      to: toDate,
    });
  }
}
