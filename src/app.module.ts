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
import "dotenv/config";

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
    TypeOrmModule.forFeature([Bank,PaymentMethod,Transaction,Wallet,WithdrawalAccount,Withdrawal])
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
