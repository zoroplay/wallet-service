import { Process, Processor } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bull';
import { Wallet } from 'src/entity/wallet.entity';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import { WithdrawalAccount } from 'src/entity/withdrawal_account.entity';
import { HelperService } from 'src/services/helper.service';
import { PaymentService } from 'src/services/payments.service';
import { Repository } from 'typeorm';

@Processor('withdrawal')
export class ConsumersService {

    constructor(
        @InjectRepository(Wallet)
        private walletRepository: Repository<Wallet>,
        private readonly helperService: HelperService,
        private readonly paymentService: PaymentService,
        @InjectRepository(Withdrawal)
        private readonly withdrawalRepository: Repository<Withdrawal>,
        @InjectRepository(WithdrawalAccount)
        private withdrawalAccountRepository: Repository<WithdrawalAccount>,
    ) {}

    @Process()
    async processWithdrawal(job: Job<unknown>) {
        // console.log(
        //     `Processing job ${job.id} of type ${job.name}...`,
        //   );

        try {
            const data: any = job.data;
            const autoDisbursement = data.autoDisbursement;

            // save withdrawal request
            const withdrawal = new Withdrawal();
            withdrawal.account_name = data.accountName;
            withdrawal.bank_code = data.bankCode;
            withdrawal.bank_name = data.bankName;
            withdrawal.account_number = data.accountNumber;
            withdrawal.user_id = data.userId;
            withdrawal.username = data.username;
            withdrawal.client_id = data.clientId;
            withdrawal.amount = data.amount;
            withdrawal.withdrawal_code = data.withdrawalCode;

            await this.withdrawalRepository.save(withdrawal);
        
            const balance = data.balance - data.amount;
        
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
            this.saveUserBankAccount(data);      
        
            //to-do save transaction log
            await this.helperService.saveTransaction({
                clientId: data.clientId,
                transactionNo: withdrawal.withdrawal_code,
                amount: data.amount,
                description: 'withdrawal request',
                subject: 'Withdrawal',
                channel: 'internal',
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
            if (autoDisbursement.autoDisbursement === 1 ) {
                // check if withdrawal request has exceeded limit
                const withdrawalCount = await this.paymentService.checkNoOfWithdrawals(data.userId);
        
                if (
                (withdrawalCount) <= autoDisbursement.autoDisbursementCount && 
                data.amount >= autoDisbursement.autoDisbursementMin && 
                data.amount <= autoDisbursement.autoDisbursementMax
                ) {
                    console.log('initiate transfer')
                    const resp = await this.paymentService.updateWithdrawalStatus({
                        clientId: data.clientId,
                        action: 'approve',
                        withdrawalId: withdrawal.id,
                        comment: 'automated withdrawal',
                        updatedBy: 'System'
                    })
                    console.log('transfer response', resp);
                }
            }
            // remove job
            // job.remove();

        } catch (e) {
            console.log(`Error processing Job: ${job.id}`, e.message);
        }
    }

    private async saveUserBankAccount(data) {
        try{
            const wAccount = await this.withdrawalAccountRepository.findOne({
                where: {user_id: data.userId, bank_code: data.bankCode}
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

        } catch(e) {
            console.log('error saving bank account', e.message);
        }
    }
}
