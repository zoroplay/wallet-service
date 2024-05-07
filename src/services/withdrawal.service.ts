import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';
import { generateTrxNo } from 'src/common/helpers';
import { Wallet } from 'src/entity/wallet.entity';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import { GetUserAccountsResponse, ListWithdrawalRequestResponse, ListWithdrawalRequests, WithdrawRequest, WithdrawResponse } from 'src/proto/wallet.pb';
import { Between, Repository } from 'typeorm';
import { HelperService } from './helper.service';
import { IdentityService } from 'src/identity/identity.service';
import { PaymentService } from './payments.service';
import { WithdrawalAccount } from 'src/entity/withdrawal_account.entity';
import { Bank } from 'src/entity/bank.entity';

@Injectable()
export class WithdrawalService {
    constructor(
        @InjectRepository(Wallet)
        private walletRepository: Repository<Wallet>,
        @InjectRepository(Withdrawal)
        private withdrawalRepository: Repository<Withdrawal>,
        @InjectRepository(WithdrawalAccount)
        private withdrawalAccountRepository: Repository<WithdrawalAccount>,

        private readonly helperService: HelperService,
        private readonly identityService: IdentityService,
        private readonly paymentService: PaymentService,
    ) {}

    async requestWithdrawal(data: WithdrawRequest): Promise<WithdrawResponse> {
        try {
          const wallet = await this.walletRepository.findOne({
            where: {
              user_id: data.userId,
              client_id: data.clientId,
            },
          });
    
          if (!wallet)
            return {
              success: false,
              status: HttpStatus.NOT_FOUND,
              message: 'Wallet not found',
              data: null,
            };
    
          if (wallet.available_balance < data.amount)
            return {
              success: false,
              status: HttpStatus.BAD_REQUEST,
              message:
                'You have insufficient funds to cover the withdrawal request.',
              data: null,
            };
    
          //To-Do: other validation minimum and max withdrawal
    
          const withdrawal = new Withdrawal();
          withdrawal.account_name = data.accountName;
          withdrawal.bank_code = data.bankCode;
          withdrawal.bank_name = data.bankName;
          withdrawal.account_number = data.accountNumber;
          withdrawal.user_id = data.userId;
          withdrawal.username = data.username;
          withdrawal.client_id = data.clientId;
          withdrawal.amount = data.amount;
          withdrawal.withdrawal_code = generateTrxNo();
    
          await this.withdrawalRepository.save(withdrawal);
    
          const balance = wallet.available_balance - data.amount;
    
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
    
          // get auto disbursement settings
          const autoDisbursement = await this.identityService.getWithdrawalSettings({clientId: data.clientId, userId: data.userId});
    
          if (autoDisbursement.minimumWithdrawal > withdrawal.amount) 
            return {
                success: false,
                status: HttpStatus.BAD_REQUEST,
                message:
                  'Minimum withdrawable amount is ' + autoDisbursement.minimumWithdrawal,
                data: null,
              };

        if (autoDisbursement.maximumWithdrawal < withdrawal.amount) 
            return {
                success: false,
                status: HttpStatus.BAD_REQUEST,
                message:
                    'Maximum withdrawable amount is ' + autoDisbursement.maximumWithdrawal,
                data: null,
            };
          // if auto disbursement is enabled and 
          if (autoDisbursement.autoDisbursement === 1 ) {
            // check if withdrawal request has exceeded limit
            const withdrawalCount = await this.paymentService.checkNoOfWithdrawals(data.userId);
    
            if (
              (withdrawalCount) <= autoDisbursement.autoDisbursementCount && 
              withdrawal.amount >= autoDisbursement.autoDisbursementMin && 
              withdrawal.amount <= autoDisbursement.autoDisbursementMax
            ) {
              // console.log('initiate transfer')
                await this.paymentService.updateWithdrawalStatus({
                  clientId: data.clientId,
                  action: 'approve',
                  withdrawalId: withdrawal.id,
                  comment: 'automated withdrawal',
                  updatedBy: 'System'
                })
              }
          }
    
          return {
            success: true,
            status: HttpStatus.OK,
            message: 'Successful',
            data: {
              balance,
              code: withdrawal.withdrawal_code,
            },
          };
        } catch (e) {
          console.log(e.message);
          return {
            success: false,
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Unable to process request',
            data: null,
          };
        }
    }
    
    async listWithdrawalRequest(
        data: ListWithdrawalRequests,
      ): Promise<ListWithdrawalRequestResponse> {
        try {
          const { clientId, from, to, userId, status } = data;
    
          const start = dayjs(from, 'DD-MM-YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss')
          const end = dayjs(to, 'DD-MM-YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');
    
          // console.log(start, end);
    
          let requests = [];
          const res = await this.withdrawalRepository.find({
            where: { 
              client_id: clientId,
              created_at: Between(start, end),
            },
            take: 100,
            order: { created_at: 'DESC' },
          });
          if (res.length) {
            for (const request of res) {
              requests.push({
                id: request.id,
                username: request.username,
                userId: request.user_id,
                amount: request.amount,
                accountNumber: request.account_number,
                accountName: request.account_name,
                bankName: request.bank_name,
                updatedBy: request.updated_by,
                status: request.status,
                created: request.created_at,
              });
            }
          }
          return {
            success: true,
            status: HttpStatus.OK,
            message: 'Success',
            data: requests,
          };
        } catch (e) {
            console.log(e)
          return {
            success: false,
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Something went wrong',
            data: null,
          };
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

    async getUserBankAccounts (data): Promise<GetUserAccountsResponse> {
        try {
            const accounts = await this.withdrawalAccountRepository.createQueryBuilder('account')
                .leftJoinAndSelect(Bank, "bank", "bank.code = account.bank_code")
                .where("account.user_id = :userId", {userId: data.userId})
                .getMany();

            console.log(accounts);

            let response = [];
            if (accounts.length) {
                for (const account of accounts) {
                    response.push({
                        bankCode: account.bank_code,
                        accountName: account.account_name,
                        accountNumber: account.account_number,
                        bankName: ''
                    })
                }
            }
            return {data: response};
        } catch (e) {
            console.log('something went wrong', e.message);
            return {data: []}
        }
    }
}

