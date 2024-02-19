import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { generateTrxNo } from 'src/common/helpers';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { IdentityService } from 'src/identity/identity.service';
import { InitiateDepositResponse, InitiateDepositRequest, VerifyDepositRequest } from 'src/proto/wallet.pb';
import { PaystackService } from 'src/services/paystack.service';
import { Repository } from 'typeorm';

@Injectable()
export class PaymentService {
    constructor(
        @InjectRepository(Transaction)
        private readonly transactionRepository: Repository<Transaction>,
        @InjectRepository(Wallet)
        private readonly walletRepository: Repository<Wallet>,
        private paystackService: PaystackService,
        private identityService: IdentityService,
    ){}

    async inititateDeposit(param: InitiateDepositRequest): Promise<InitiateDepositResponse> {
        const transactionNo = generateTrxNo()
        let link = '', description;
        // find user wallet
        const wallet = await this.walletRepository.findOne({
            where: {
                user_id: param.userId, 
                client_id: param.clientId
            }
        });
        if (!wallet)
            return {success: false, message: 'Wallet not found'};
        
        // To-Do: Get user info
        const user = await this.identityService.getUserData({
            clientId: param.clientId,
            userId: param.userId,
            source: param.source
        }).toPromise();

        if (user.username === '') return {success: false, message: 'User does not exist'}

        try {
            switch (param.paymentMethod) {
                case 'paystack':
                    const resp: any = await this.paystackService.generatePaymentLink({
                        amount: param.amount * 100,
                        email: user.email || 'info@sportsbookengine.com',
                        reference: transactionNo,
                        callback_url: user.callbackUrl + '/payment-verification/paystack'
                    }, param.clientId);

                    description = 'Online Deposit (Paystack)'; 
                    if (!resp.success) return resp;
                    
                    link = resp.data.authorization_url;

                    break;
                case 'flutterwave':
                    description = 'Online Deposit (Flutterwave)';
                    break;
                case 'monnify':
                    description = 'Online Deposit (Monnify)';
                    break;
                case 'mgurush':
                    description = 'Online Deposit (mGurush)';
                    break;
                default:
                    description = 'Shop Deposit';
                    break;
            }

            await this.saveTransaction({
                amount: param.amount,
                channel: param.paymentMethod,
                clientId: param.clientId,
                toUserId: param.userId,
                toUsername: wallet.username,
                toUserBalance: wallet.balance,
                fromUserId: 0,
                fromUsername: 'System',
                fromUserbalance: 0,
                source: param.source,
                subject: 'Deposit',
                description,
                transactionNo,
            })

            return {success: true, message: 'Success', data: {transactionRef: transactionNo, link}};
        } catch (e) {
            // console.log(e.message);
            return {success: false, message: 'Unable to complete transaction'}
        }
    }

    /**
     * Function: verifyPayment
     * Description: function to verify user payment
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    async verifyDeposit(param: VerifyDepositRequest) {
        try {

            switch (param.paymentChannel) {
                case 'paystack':
                    return this.paystackService.verifyTransaction(param)
                case 'monnify': 
                    break;
                case 'flutterwave':
                    break;
                default:
                    break;
            }
        } catch (e) {
            console.log('Error', e.message);
            return {success: false, message: 'Internal Server error', status: HttpStatus.BAD_REQUEST};
        }
    }

    async handleWebhook() {}

    async saveTransaction (data) {
        // construct data
        const model = [];
        
        const transaction1          = new Transaction();
        transaction1.client_id      = data.clientId;
        transaction1.user_id        = data.fromUserId;
        transaction1.username       = data.fromUsername;
        transaction1.transaction_no = data.transactionNo;
        transaction1.amount         = data.amount;
        transaction1.tranasaction_type = 'debit'
        transaction1.subject        = data.subject;
        transaction1.description    = data.description;
        transaction1.source         = data.source;
        transaction1.channel        = data.channel;
        transaction1.balance        = data.fromUserBalance;
        transaction1.status         = data.status || 0;
      
        model.push(transaction1);
      
        const transaction2          = new Transaction();
        transaction2.client_id      = data.clientId;
        transaction2.user_id        = data.toUserId;
        transaction2.username       = data.toUsername;
        transaction2.transaction_no = data.transactionNo;
        transaction2.amount         = data.amount;
        transaction2.tranasaction_type = 'credit'
        transaction2.subject        = data.subject;
        transaction2.description    = data.description;
        transaction2.source         = data.source;
        transaction2.channel        = data.channel;
        transaction2.balance        = data.toUserBalance;
        transaction2.status         = data.status || 0;
      
        model.push(transaction2);
      
        for (const item of model) {
          await this.transactionRepository.save(item);
        }
    }

}
