/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bank } from './entity/bank.entity';
import { PaymentMethod } from './entity/payment.method.entity';
import { Transaction } from './entity/transaction.entity';
import { Wallet } from './entity/wallet.entity';
import { WithdrawalAccount } from './entity/withdrawal_account.entity';
import { Withdrawal } from './entity/withdrawal.entity';
import { PaymentService } from './services/payments.service';
import 'dotenv/config';
import { PaystackService } from './services/paystack.service';
import { FlutterwaveService } from './services/flutterwave.service';
import { MomoService } from './services/momo.service';
import { MgurushService } from './services/mgurush.service';
import { MonnifyService } from './services/monnify.service';
import { IdentityModule } from './identity/identity.module';
import { HelperService } from './services/helper.service';
import { OPayService } from './services/opay.service';
import { ScheduleModule } from '@nestjs/schedule';
import { DepositService } from './services/deposit.service';
import { CashbookService } from './cashbook/cashbook.service';
import { CashInService } from './cashbook/services/cashin.service';
import { Expenses } from './cashbook/entities/expenses.entity';
import { CashIn } from './cashbook/entities/cashin.entity';
import { CashOut } from './cashbook/entities/cashout.entity';
import { CashOutService } from './cashbook/services/cashout.service';
import { ExpensesService } from './cashbook/services/expenses.service';
import { ExpenseTypesService } from './cashbook/services/expense_type.service';
import { ExpenseTypes } from './cashbook/entities/expense_type.entity';
import { RetailModule } from './retail/retail.module';
import { WithdrawalService } from './services/withdrawal.service';
import { BullModule } from '@nestjs/bullmq';
import { WithdrawalConsumer } from './consumers/withdrawal.consumer';
import { DepositConsumer } from './consumers/deposit.consumer';
import { ReportingService } from './services/reporting.service';
import { PawapayService } from './services/pawapay.service';
import { SalesReportService } from './cashbook/services/sales_report.service';
import { SalesReport } from './cashbook/entities/sales_report.entity';
import { WayaQuickService } from './services/wayaquick.service';
import { WayaBankService } from './services/wayabank.service';
import { Pitch90SMSService } from './services/pitch90sms.service';
import { ConfigModule } from '@nestjs/config';
import { KorapayService } from './services/kora.service';
import { CallbackLog } from './entity/callback-log.entity';
import { TigoService } from './services/tigo.service';
import { ProvidusService } from './services/providus.service';
import { SummeryService } from './services/summery.service';
import { CoralPayService } from './services/coralpay.service';
import { FidelityService } from './services/fidelity.service';
import { GlobusService } from './services/globus.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
      },
      prefix: 'wallet',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }),
    BullModule.registerQueue(
      {
        name: 'withdrawal',
      },
      {
        name: 'deposit',
      },
    ),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: process.env.DB_TYPE as any,
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: ['dist/**/*.entity.js'],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([
      Bank,
      PaymentMethod,
      Transaction,
      Wallet,
      WithdrawalAccount,
      Withdrawal,
      Expenses,
      ExpenseTypes,
      CashIn,
      CashOut,
      SalesReport,
      CallbackLog,
    ]),
    IdentityModule,
    RetailModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    FlutterwaveService,
    KorapayService,
    TigoService,
    MonnifyService,
    MomoService,
    MgurushService,
    OPayService,
    PaymentService,
    PaystackService,
    PawapayService,
    HelperService,
    DepositService,
    CashbookService,
    CashInService,
    CashOutService,
    ExpensesService,
    Pitch90SMSService,
    ExpenseTypesService,
    SalesReportService,
    WayaQuickService,
    DepositConsumer,
    WithdrawalService,
    WayaBankService,
    WithdrawalConsumer,
    ReportingService,
    ProvidusService,
    SummeryService,
    CoralPayService,
    FidelityService,
    GlobusService,
  ],
})
export class AppModule {}
