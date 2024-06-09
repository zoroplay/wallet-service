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
import { ExpenseCategory } from './cashbook/entities/expense_category.entity';
import { Expenses } from './cashbook/entities/expenses.entity';
import { CashIn } from './cashbook/entities/cashin.entity';
import { CashOut } from './cashbook/entities/cashout.entity';
import { CashOutService } from './cashbook/services/cashout.service';
import { ExpensesService } from './cashbook/services/expenses.service';
import { ExpenseCategoryService } from './cashbook/services/expense_category.service';
import { ExpenseTypesService } from './cashbook/services/expense_type.service';
import { ExpenseTypes } from './cashbook/entities/expense_type.entity';

@Module({
  imports: [
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
      ExpenseCategory,
      Expenses,
      ExpenseTypes,
      CashIn,
      CashOut,
    ]),
    IdentityModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    FlutterwaveService,
    MonnifyService,
    MomoService,
    MgurushService,
    OPayService,
    PaymentService,
    PaystackService,
    HelperService,
    DepositService,
    CashbookService,
    CashInService,
    CashOutService,
    ExpensesService,
    ExpenseTypesService,
    ExpenseCategoryService,
  ],
})
export class AppModule {}
