/* eslint-disable prettier/prettier */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { generateTrxNo } from 'src/common/helpers';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import { WithdrawalAccount } from 'src/entity/withdrawal_account.entity';
import { HelperService } from 'src/services/helper.service';
import { PaymentService } from 'src/services/payments.service';
import { Repository } from 'typeorm';

@Processor('withdrawal')
export class WithdrawalConsumer extends WorkerHost {
  
  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepository: Repository<Withdrawal>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(WithdrawalAccount)
    private withdrawalAccountRepository: Repository<WithdrawalAccount>,

    private readonly helperService: HelperService,
    private readonly paymentService: PaymentService,
  ) {
    super();
  }

  async process(job: Job, token?: string): Promise<any> {
    if (job.name === 'withdrawal-request') {
      await this.processWithdrawal(job)
    } else if (job.name === 'shop-withdrawal') {
      await this.processShopWithdrawal(job)
    }
  }



  async processWithdrawal(job: Job<unknown>) {
    console.log(`Processing withdrawal job ${job.id} of type ${job.name}...`);
    try {
      const data: any = job.data;

      // console.log(data)
      const autoDisbursement = data.autoDisbursement;

      // save withdrawal request
      const withdrawal = new Withdrawal();
      withdrawal.account_name = data.accountName;
      withdrawal.bank_code = data.bankCode;
      withdrawal.bank_name = data.bankName;
      withdrawal.account_number = data.accountNumber || '';
      withdrawal.user_id = data.userId;
      withdrawal.username = data.username;
      withdrawal.client_id = data.clientId;
      withdrawal.amount = data.amount;
      withdrawal.withdrawal_code = data.withdrawalCode;

      await this.withdrawalRepository.save(withdrawal);

      const balance = parseFloat(data.balance) - parseFloat(data.amount);

      await this.walletRepository.update(
        {
          user_id: data.userId,
          client_id: data.clientId,
        },
        {
          // balance,
          available_balance: balance,
        },
      );
      // save bank account
      if (data.type === 'bank') this.saveUserBankAccount(data);

      //to-do save transaction log
      await this.helperService.saveTransaction({
        clientId: data.clientId,
        transactionNo: withdrawal.withdrawal_code,
        amount: data.amount,
        description: 'withdrawal request',
        subject: 'Withdrawal',
        channel: data.type,
        source: data.source,
        fromUserId: data.userId,
        fromUsername: data.username,
        fromUserBalance: balance,
        toUserId: 0,
        toUsername: 'System',
        toUserBalance: 0,
        status: 1,
      });

      // if auto disbursement is enabled and
      if (autoDisbursement.autoDisbursement === 1 && data.type !== 'cash') {
        // check if withdrawal request has exceeded limit
        const withdrawalCount = await this.paymentService.checkNoOfWithdrawals(
          data.userId,
        );

        if (
          withdrawalCount <= autoDisbursement.autoDisbursementCount &&
          data.amount >= autoDisbursement.autoDisbursementMin &&
          data.amount <= autoDisbursement.autoDisbursementMax
        ) {
          console.log('initiate transfer');
          const resp = await this.paymentService.updateWithdrawalStatus({
            clientId: data.clientId,
            action: 'approve',
            withdrawalId: withdrawal.id,
            comment: 'automated withdrawal',
            updatedBy: 'System',
          });
          console.log('transfer response', resp);
        }
      }
      // remove job
      // job.remove();
    } catch (e) {
      console.log(`Error processing Job: ${job.id}`, e.message);
    }
  }


  async processShopWithdrawal(job: Job<unknown>) {
    console.log(`Processing shop withdrawal job ${job.id}`);
    try {
      const data: any = job.data;
      console.log(data);
      //update request status
      await this.withdrawalRepository.update(
        {
          id: data.id,
        },
        {
          status: 1,
          updated_by: data.username,
        },
      );

      let balance = parseFloat(data.balance) - parseFloat(data.amount);

      console.log('cashier balance', balance)

      await this.walletRepository.update(
        {
          user_id: data.userId,
          client_id: data.clientId,
        },
        {
          // balance,
          available_balance: balance,
        },
      );
      // get withdrawal request
      const withdrawRequest = await this.withdrawalRepository.findOne({
        where: { id: data.id },
      });

      // update transaction log for receiver
      await this.transactionRepository.update(
        {
          transaction_no: withdrawRequest.withdrawal_code,
          tranasaction_type: 'credit',
        },
        {
          description: 'Withdrawal Payout',
          subject: 'Withdrawal',
          user_id: data.userId,
          username: data.username,
          balance,
        },
      );

      //check if withdrawal commission is available
      if (data.withdrawalCharge > 0) {
        // add commission to user balance
        balance = parseFloat(balance.toString()) + parseFloat(data.withdrawalCharge);

        await this.walletRepository.update(
          {
            user_id: data.userId,
            client_id: data.clientId,
          },
          {
            // balance,
            available_balance: balance,
          },
        );

        await this.helperService.saveTransaction({
          clientId: data.clientId,
          transactionNo: generateTrxNo(),
          amount: data.amount,
          description: 'Commission on withdrawal payout',
          subject: 'Withdrawal Comm.',
          channel: 'sbengine',
          source: 'shop',
          fromUserId: 0,
          fromUsername: 'System',
          fromUserBalance: 0,
          toUserId: data.userId,
          toUsername: data.username,
          toUserBalance: balance,
          status: 1,
        });
      }
    } catch (e) {
      console.log('error processing shop withdrawal', e.message)
    }
  }

  private async saveUserBankAccount(data) {
    try {
      const wAccount = await this.withdrawalAccountRepository.findOne({
        where: { user_id: data.userId, bank_code: data.bankCode },
      });

      if (!wAccount) {
        const bankAccount = new WithdrawalAccount();
        bankAccount.client_id = data.clientId;
        bankAccount.user_id = data.userId;
        bankAccount.bank_code = data.bankCode;
        bankAccount.account_name = data.accountName;
        bankAccount.account_number = data.accountNumber;

        await this.withdrawalAccountRepository.save(bankAccount);
      }
    } catch (e) {
      console.log('error saving bank account', e.message);
    }
  }
}
