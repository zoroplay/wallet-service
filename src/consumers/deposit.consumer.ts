import { Process, Processor } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bull';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { IdentityService } from 'src/identity/identity.service';
import { Repository } from 'typeorm';

@Processor('deposit')
export class DepositConsumer {
  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

    private readonly identityService: IdentityService,
  ) {}

  @Process('shop-deposit')
  async processShopWithdrawal(job: Job<unknown>) {
    try {
      console.log(`Processing deposit job ${job.id} of type ${job.name}...`);

      const data: any = job.data;
      // find initiator wallet
      let fromWallet = await this.walletRepository.findOne({
        where: { user_id: data.fromUserId, client_id: data.clientId },
      });
      // find receiver wallet
      let toWallet = await this.walletRepository.findOne({
        where: { user_id: data.toUserId, client_id: data.clientId },
      });

      //update request status
      const senderBalance = fromWallet.available_balance - data.amount;
      // credit receiver balance
      const receiverBalance =
        Number(toWallet.available_balance) + Number(data.amount);

      //update wallets
      await this.walletRepository.update(
        {
          user_id: data.fromUserId,
        },
        {
          available_balance: senderBalance,
        },
      );

      await this.walletRepository.update(
        {
          user_id: data.toUserId,
        },
        {
          available_balance: receiverBalance,
        },
      );

      // update transaction status as completed
      await this.transactionRepository.update(
        { transaction_no: data.transactionCode },
        { status: 1 },
      );
      //update transaction debit record
      await this.transactionRepository.update(
        {
          transaction_no: data.transactionCode,
          tranasaction_type: 'debit',
        },
        {
          user_id: data.fromUserId,
          username: data.fromUsername,
          balance: senderBalance,
        },
      );

      if (data.userRole === 'Sales Agent') {
        // const settings = await this.identityService.getWithdrawalSettings({clientId: data.clientId, userId: data.userId})
        // if (settings.allowWithdrawalComm) {
        //   const withdrawalCharge = data.amount * settings.withdrawalComm / 100;
        //   const withdrawalFinalAmount = data.amount - withdrawalCharge;
        // }
      }
    } catch (e) {
      console.log(`Error while running deposit job: ${e.mssage}`);
    }
  }
}
