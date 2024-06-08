import { Process, Processor } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bull';
import { generateTrxNo } from 'src/common/helpers';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { HelperService } from 'src/services/helper.service';
import { Repository } from 'typeorm';

@Processor('deposit')
export class DepositConsumer {

    constructor(
        @InjectRepository(Wallet)
        private walletRepository: Repository<Wallet>,
        @InjectRepository(Transaction)
        private readonly transactionRepository: Repository<Transaction>,
    ) {}

    

    @Process('shop-deposit')
    async processShopWithdrawal(job: Job<unknown>) {
        try {
            const data: any = job.data;
            //update request status
            

        } catch (e) {

        }
    }
}
