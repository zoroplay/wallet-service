import { Module } from '@nestjs/common';
import { RetailController } from './retail.controller';
import { RetailService } from './retail.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { IdentityModule } from 'src/identity/identity.module';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Wallet]), IdentityModule],
  controllers: [RetailController],
  providers: [RetailService],
})
export class RetailModule {}
