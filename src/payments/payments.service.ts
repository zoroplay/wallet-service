import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { generateTrxNo } from 'src/common/helpers';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import { IdentityService } from 'src/identity/identity.service';
import { InitiateDepositResponse, InitiateDepositRequest, VerifyDepositRequest, VerifyBankAccountRequest, VerifyBankAccountResponse, UpdateWithdrawalResponse } from 'src/proto/wallet.pb';
import { HelperService } from 'src/services/helper.service';
import { PaystackService } from 'src/services/paystack.service';
import { Repository } from 'typeorm';

@Injectable()
export class PaymentService {
    constructor(
        @InjectRepository(Withdrawal)
        private readonly withdrawalRepository: Repository<Withdrawal>,
        @InjectRepository(Wallet)
        private readonly walletRepository: Repository<Wallet>,
        @InjectRepository(PaymentMethod)
        private readonly paymentMethodRepository: Repository<PaymentMethod>,
        private paystackService: PaystackService,
        private identityService: IdentityService,
        private helperService: HelperService,
    ){}

    async inititateDeposit(param: InitiateDepositRequest): Promise<InitiateDepositResponse> {
        const transactionNo = generateTrxNo()
        let link = '', description;
        // find user wallet
        // find wallet
        const wallet = await this.walletRepository.createQueryBuilder()
            .where("client_id = :clientId", {clientId: param.clientId})
            .andWhere("username = :username", {username: param.username})
            .getOne();

        if (!wallet)
            return {success: false, message: 'Wallet not found'};
        
        // To-Do: Get user info
        const user = await this.identityService.getPaymentData({
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

            await this.helperService.saveTransaction({
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

    async updateWithdrawalStatus({clientId, withdrawalId, action, comment, updatedBy}): Promise<UpdateWithdrawalResponse> {
        try {
            const wRequest = await this.withdrawalRepository.findOne({where: {id: withdrawalId}});
            if (wRequest) {
                if (action === 'approve') {
                    const paymentMethod = await this.paymentMethodRepository.findOne({
                        where: {for_disbursement: 1}
                    })
                    if (paymentMethod) {
                        let resp: any = {
                            success: false,
                            message: 'Unable to disburse funds with '+ paymentMethod.provider,
                            status: HttpStatus.NOT_IMPLEMENTED
                        }
                        switch (paymentMethod.provider) {
                            case 'paystack':
                                resp = await this.paystackService.disburseFunds(wRequest, clientId);
                                break;
                            case 'mgurush':
                                break;
                            case 'monnify':
                                break;
                            case 'flutterwave':
                                break;
                            default:
                                break;
                        }
                        // update withdrawal request
                        if (resp.success)
                            await this.withdrawalRepository.update({
                                id: withdrawalId
                            }, {
                                status: 1,
                                updated_by: updatedBy
                            })
                        // return response
                        return resp;
                    } else {
                        return {
                            success: false,
                            message: 'No payment method has been setup for auto disbursement', 
                            status: HttpStatus.NOT_IMPLEMENTED
                        };
                    }
                } else {
                    // update withdrawal status
                    await this.withdrawalRepository.update({
                        id: withdrawalId
                    }, {
                        status: 2,
                        comment,
                        updated_by: updatedBy
                    })
                    //return funds to user wallet
                    const wallet = await this.walletRepository.findOne({where: {
                        client_id: clientId,
                        user_id: wRequest.user_id
                    }});

                    const balance = parseFloat(wallet.available_balance.toString()) + parseFloat(wRequest.amount.toString());

                    // update user balance
                    await this.walletRepository.update({
                        id: wallet.id
                    }, {
                        available_balance: balance
                    });

                    await this.helperService.saveTransaction({
                        amount: wRequest.amount,
                        channel: 'internal',
                        clientId,
                        toUserId: wallet.user_id,
                        toUsername: wallet.username,
                        toUserBalance: balance,
                        fromUserId: 0,
                        fromUsername: 'System',
                        fromUserbalance: 0,
                        source: 'internal',
                        subject: 'Rejected Request',
                        description: comment || 'Withdrawal request was cancelled',
                        transactionNo: generateTrxNo(),
                        status: 1
                    })
                    return {success: true, message: 'Withdrawal request updated', status: HttpStatus.CREATED};
                }
            } else {
                return {success: false, message: 'Withdrawal request not found', status: HttpStatus.NOT_FOUND};
            }

        } catch(e) {
            return {success: false, message: 'Unable to request status', status: HttpStatus.INTERNAL_SERVER_ERROR};
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

    async verifyBankAccount(param: VerifyBankAccountRequest): Promise<VerifyBankAccountResponse> {
        try {
            // find payment method for withdrawal
            const paymentMethod = await this.paymentMethodRepository.findOne({
                where: {
                    client_id: 1,
                    for_disbursement: 1
                }
            })
            if (!paymentMethod) return {
                success: false, 
                status: HttpStatus.NOT_FOUND, 
                message: 'No payment method is active for disbursement'
            }
            // To-Do: Get user info
            const user =  await firstValueFrom(this.identityService.getUserDetails({
                clientId: param.clientId,
                userId: param.userId,
            }))

            if (user.data.firstName === '') return {success: false, message: 'Please update your profile details to proceed', status: HttpStatus.NOT_FOUND}

            const firstname = user.data.firstName.toLocaleLowerCase();
            const lastname = user.data.lastName.toLocaleLowerCase();

            let resp, name, names;
            switch (paymentMethod.provider) {
                case 'paystack':
                    resp = await this.paystackService.resolveAccountNumber(param.clientId, param.accountNumber, param.bankCode);
                    if (resp.success) {
                        names = resp.data.account_name.toLowerCase().split(" ")
                        name = resp.data.account_name;
                    }else{
                        return {
                            success: false, 
                            status: HttpStatus.NOT_FOUND, 
                            message: 'Could not resolve account name. Check parameters or try again'
                        }
                    }
                    
                case 'flutterwave':
                    break;
                case 'monnify':
                    break;
                default:
                    break;
            }
            if (names.includes(firstname) || names.includes(lastname)) {
                return {
                    success: true,
                    message: name, 
                    status: HttpStatus.OK
                }   
            } else {
                return {
                    success: false,
                    message: "Your bank account names does not match your name on file", 
                    status: HttpStatus.NOT_FOUND
                }   
            }
        } catch (err) {
            console.log(err)
            return {
                success: false,
                message: 'Error verifying account', 
                status: HttpStatus.INTERNAL_SERVER_ERROR
            }
        }
    }
}
