import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { IdentityService } from 'src/identity/identity.service';
import { HelperService } from 'src/services/helper.service';
import { Repository } from 'typeorm';

@Processor('deposit')
export class DepositConsumer extends WorkerHost {
  protected logger = new Logger(DepositConsumer.name);

  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

    private readonly identityService: IdentityService,
    private readonly helperService: HelperService,
  ) {
    super();
  }

  async process(job: Job, token?: string): Promise<any> {
    if (job.name === 'shop-deposit') {
      await this.processShopDeposit(job);
    } else {
      await this.processCredit(job);
    }
  }

  async processShopDeposit(job: Job<unknown>) {
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
        parseFloat(toWallet.available_balance.toString()) +
        parseFloat(data.amount.toString());

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
      //update transaction credit record
      await this.transactionRepository.update(
        {
          transaction_no: data.transactionCode,
          tranasaction_type: 'credit',
        },
        {
          balance: receiverBalance,
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

  async processCredit(job: Job<unknown>) {
    try {
      console.log(`Processing credit job ${job.id} of type ${job.name}...`);

      const data: any = job.data;

      //to-do save transaction log
      await this.helperService.saveTransaction({
        clientId: data.clientId,
        transactionNo: data.transactionNo,
        amount: parseFloat(data.amount),
        description: data.description,
        subject: data.subject,
        channel: data.channel,
        source: data.source,
        fromUserId: 0,
        fromUsername: 'System',
        fromUserBalance: 0,
        toUserId: data.userId,
        toUsername: data.username,
        toUserBalance: data.balance,
        status: 1,
        walletType: data.walletType,
      });

      await this.walletRepository.update(
        {
          user_id: data.userId,
          client_id: data.clientId,
        },
        {
          // balance,
          [data.wallet]: data.balance,
        },
      );

      // send deposit to trackier
      // try {
      //   const keys = await this.identityService.getTrackierKeys({itemId: data.clientId});

      //   if (keys.success){
      //     await this.helperService.sendActivity({
      //       subject: data.subject,
      //       username: data.username,
      //       amount: data.amount,
      //       transactionId: data.transactionNo,
      //       clientId: data.clientId,
      //     },  keys.data);
      //   }

      // } catch (e) {
      //   console.log('Trackier error: Credit User', e.message)
      // }
    } catch (e) {
      this.logger.error(`Error processing credit request: `, e.message);
    }
  }
}
