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
import { PaymentService } from './payments/payments.service';
import "dotenv/config";
import { PaystackService } from './services/paystack.service';
import { FlutterwaveService } from './services/flutterwave.service';
import { MomoService } from './services/momo.service';
import { MgurushService } from './services/mgurush.service';
import { MonnifyService } from './services/monnify.service';
import { IdentityModule } from './identity/identity.module';
import { HelperService } from './services/helper.service';
import { OPayService } from './services/opay.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: process.env.DB_TYPE as any,
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: ["dist/**/*.entity.js"],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Bank,PaymentMethod,Transaction,Wallet,WithdrawalAccount,Withdrawal]),
    IdentityModule
  ],
  controllers: [AppController],
  providers: [AppService, FlutterwaveService, MonnifyService, MomoService, MgurushService, OPayService, PaymentService, PaystackService, HelperService],
})
export class AppModule {}
