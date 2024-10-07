
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import { Repository } from 'typeorm';
import { HelperService } from './helper.service';
import { post, get } from 'src/common/axios';
import { generateTrxNo } from 'src/common/helpers';
import { IdentityService } from 'src/identity/identity.service';

@Injectable()
export class MonnifyService {
    constructor(
        @InjectRepository(PaymentMethod)
        private readonly paymentMethodRepository: Repository<PaymentMethod>,
        @InjectRepository(Transaction)
        private readonly transactionRepository: Repository<Transaction>,
        @InjectRepository(Wallet)
        private readonly walletRepository: Repository<Wallet>,
        @InjectRepository(Withdrawal)
        private readonly withdrawalRepository: Repository<Withdrawal>,

        private helperService: HelperService,
        private identityService: IdentityService
    ) {
        // const paymentMethod = await this
    }

    async verifyTransaction(param) {
        try {
            // console.log(param)
            const paymentSettings = await this.monnifySettings(param.clientId);

            const authRes = await this.authenticate(paymentSettings);

            if(authRes.requestSuccessful) {

                const data = await get(`${paymentSettings.base_url}/api/v1/merchant/transactions/query?paymentReference=${param.transactionRef}`, {
                    'Authorization': `Bearer ${authRes.responseBody.accessToken}`,
                });

                const transaction = await this.transactionRepository.findOne({
                    where: {
                        client_id: param.clientId,
                        transaction_no: param.transactionRef,
                        tranasaction_type: 'credit'
                    }
                });
                // if tranaction not found.
                if (!transaction) return {success: false, message: 'Transaction not found', status: HttpStatus.NOT_FOUND};

                if (data.requestSuccessful === true && data.responseMessage === 'success') {
                    let status = 0;
                    const paymentStatus = data.responseBody.paymentStatus;
                    switch (paymentStatus) {
                        case 'PAID':
                            status = 1
                            break;
                        case 'FAILED':
                            status = 2;
                            break;
                        case 'OVERPAID':
                            status = 1
                            break;
                        case 'PARTIALLY_PAID':
                            status = 1
                            break;
                        case 'ABANDONED':
                            status = 2
                        
                            break;
                        case 'CANCELLED':
                            status = 2
                            break;
                        case 'REVERSED': 
                            status = 2
                            break;
                        case 'EXPIRED':
                            status = 2
                            break;
                        default: 
                            break;
                    }
                    // update transaction status to completed - 1
                    await this.transactionRepository.update({
                        transaction_no: transaction.transaction_no,
                    }, {
                        status
                    });

                    if (status === 1 && transaction.status === 1) // if transaction is already successful, return success message
                        return {success: true, message: 'Transaction was successful', status: HttpStatus.OK};
                    if (status === 2)
                        return {success: false, message: 'Transaction ' + paymentStatus, status: HttpStatus.NOT_ACCEPTABLE};

                    if (transaction.status === 0 && status === 1) {
                        // find user wallet
                        const wallet = await this.walletRepository.findOne({where: {user_id: transaction.user_id}});

                        const balance = parseFloat(wallet.available_balance.toString()) + parseFloat(transaction.amount.toString())
                        // fund user wallet
                        await this.helperService.updateWallet(balance, transaction.user_id);
                        // send deposit to trackier
                        try {
                            const keys = await this.identityService.getTrackierKeys({itemId: data.clientId});
                            if (keys.success) {
                                await this.helperService.sendActivity({
                                    subject: 'Deposit',
                                    username: transaction.username,
                                    amount: transaction.amount,
                                    transactionId: transaction.transaction_no,
                                    clientId: data.clientId
                                }, keys.data);
                            }
                        }  catch (e) {
                            console.log('trackier error: Monnify', e.message)
                        }
                        
                        return {success: true, message: 'Transaction was successful', status: HttpStatus.OK};

                    } else if (paymentStatus === "REVERSED" && transaction.status === 1) {
                        // find user wallet
                        const wallet = await this.walletRepository.findOne({where: {user_id: transaction.user_id}});

                        const balance = parseFloat(wallet.available_balance.toString()) - parseFloat(transaction.amount.toString())
                        // fund user wallet
                        await this.helperService.updateWallet(balance, transaction.user_id);
                        // send reversal request to trackier
                        try {
                            const keys = await this.identityService.getTrackierKeys({itemId: data.clientId});
                            if (keys.success) {
                                await this.helperService.sendActivity({
                                    subject: 'Withdrawal Request',
                                    username: transaction.username,
                                    amount: transaction.amount,
                                    transactionId: transaction.transaction_no,
                                    clientId: data.clientId
                                }, keys.data)
                            }
                        } catch (e) {
                            console.log('Trackier error: Monnify Line 136', e.message)
                        }

                        return {success: true, message: 'Transaction was reversed', status: HttpStatus.OK};
                    }
                } else {
                    // update transaction status to failed - 2
                    await this.transactionRepository.update({
                        transaction_no: transaction.transaction_no,
                    }, {
                        status: 2
                    })
                    return {
                        success: false, 
                        message: `Transaction was not successful: Last gateway response was:  ${data.gateway_response}`, 
                        status: HttpStatus.BAD_REQUEST
                    };
                }
            } else {
                return {
                    success: false, 
                    message: `Monnify authentication failed`, 
                    status: HttpStatus.BAD_REQUEST
                };
            }
            
        } catch (e) {
            return {success: false, message: 'Unable to verify transaction: ' + e.message, status: HttpStatus.BAD_REQUEST};
        }
    }

    async disburseFunds(withdrawal: Withdrawal, client_id) {
        try {
            const paymentSettings = await this.monnifySettings(client_id);
            // return false if paystack settings is not available
            if (!paymentSettings) return {success: false, message: 'Monnify has not been configured for client', status: HttpStatus.NOT_IMPLEMENTED};
    
            const authRes = await this.authenticate(paymentSettings);

            if(authRes.requestSuccessful) {
                // do transfer with paystack transfer api
                const resp = await post(`${paymentSettings.base_url}/api/v2/disbursements/single`, {
                    amount: withdrawal.amount,
                    reference: withdrawal.withdrawal_code,
                    currency: 'NGN',
                    narration:  'Payout request',
                    destinationBankCode: withdrawal.bank_code,
                    destinationAccountNumber: withdrawal.account_number,
                    sourceAccountNumber: paymentSettings.merchant_id,
                }, {
                    'Authorization': `Bearer ${authRes.responseBody.accessToken}`,
                    'Content-Type': 'application/json',
                });

                // console.log('transfer', resp)


                return {success: resp.requestSuccessful, data: resp.data, message: resp.message};

            } else {
                return authRes;
            }

        } catch (e) {
            // console.log(e.message);
            return {success: false, message: 'Monnify Error! unable to disburse funds', status: HttpStatus.BAD_REQUEST};
        }
    }

    async resolveAccountNumber(client_id, accountNo, banckCode) {
        try {
            const paymentSettings = await this.monnifySettings(client_id);
            // return false if paystack settings is not available
            if (!paymentSettings) return {success: false, message: 'Paystack has not been configured for client'};
            // const resp = await get(`${paymentSettings.base_url}/bank/resolve?account_number=${accountNo}&bank_code=${banckCode}`, {
            //     'Authorization': `Bearer ${paymentSettings.secret_key}`,
            // })
            // return {success: resp.status, data: resp.data, message: resp.message};
        } catch(e) {
            return {success: false, message: "Something went wrong " + e.message};
        }
    }

    private async authenticate(paymentSettings: PaymentMethod) {
        const key = btoa(`${paymentSettings.public_key}:${paymentSettings.secret_key}`);
        
        return await post(`${paymentSettings.base_url}/api/v1/auth/login`, {}, {
            'Authorization': 'Basic ' + key
        })
    }

    async generatePaymentLink(data, client_id) {
        try {
            const paymentSettings = await this.monnifySettings(client_id);
            // return false if paystack settings is not available
            if (!paymentSettings) return {success: false, message: 'Monnify has not been configured for client'};

            const authRes = await this.authenticate(paymentSettings);

            if(authRes.requestSuccessful) {
                const resp = await post(`${paymentSettings.base_url}/api/v1/merchant/transactions/init-transaction`, {
                    amount: data.amount,
                    customerName: data.name,
                    customerEmail: data.email,
                    contractCode: paymentSettings.merchant_id,
                    currencyCode: 'NGN',
                    paymentDescription: 'wallet funds',
                    paymentReference: data.reference,
                    redirectUrl: data.callback_url,
                    paymentMethods: ['CARD', 'ACCOUNT_TRANSFER']
                }, {
                    'Authorization': `Bearer ${authRes.responseBody.accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                })
                return {success: true, data: resp.responseBody.checkoutUrl };
            } else {
                return {success: false, data: null };
            }
        } catch(e) {
            return {success: false, message: 'Unable to initiate deposit with monnify'};
        }
    }

    async handleWebhook(data) {
        try {
            const body = JSON.parse(data.body);

            switch (data.event) {
                case 'SUCCESSFUL_TRANSACTION':
                    // console.log('complete transaction')
                    let status = 0;
                    const paymentStatus = data.eventData.paymentStatus;
                    switch (paymentStatus) {
                        case 'PAID':
                            status = 1
                            break;
                        case 'FAILED':
                            status = 2;
                            break;
                        case 'OVERPAID':
                            status = 1
                            break;
                        case 'PARTIALLY_PAID':
                            status = 1
                            break;
                        case 'ABANDONED':
                            status = 2
                        
                            break;
                        case 'CANCELLED':
                            status = 2
                            break;
                        case 'REVERSED': 
                            status = 2
                            break;
                        case 'EXPIRED':
                            status = 2
                            break;
                        default: 
                            break;
                    }

                    const transaction = await this.transactionRepository.findOne({
                        where: {
                            client_id: data.clientId, 
                            transaction_no: data.reference,
                            tranasaction_type: 'credit'
                        }
                    });

                    // update transaction status
                    await this.transactionRepository.update({
                        transaction_no: transaction.transaction_no,
                    }, {
                        status
                    });

                    if (status === 1 && transaction && transaction.status === 0) {
                        // find user wallet
                        const wallet = await this.walletRepository.findOne(
                            {where: {user_id: transaction.user_id}
                        });
                        const balance = parseFloat(wallet.available_balance.toString()) + parseFloat(transaction.amount.toString())
                        // update user wallet
                        await this.helperService.updateWallet(balance, transaction.user_id);

                        // send deposit to trackier
                        try {
                            const keys = await this.identityService.getTrackierKeys({itemId: data.clientId});
                            if (keys.success) {
                                await this.helperService.sendActivity({
                                    subject: 'Deposit',
                                    username: transaction.username,
                                    amount: transaction.amount,
                                    transactionId: transaction.transaction_no,
                                    clientId: data.clientId
                                }, keys.data)
                            }
                        } catch (e) {
                            console.log('Trackier error: Monnify Line 333', e.message)
                        }
                    } else if (paymentStatus === "REVERSED" && transaction.status === 1) {
                        // find user wallet
                        const wallet = await this.walletRepository.findOne({where: {user_id: transaction.user_id}});

                        const balance = parseFloat(wallet.available_balance.toString()) - parseFloat(transaction.amount.toString())
                        // fund user wallet
                        await this.helperService.updateWallet(balance, transaction.user_id);
                        // send reversal request to trackier
                        try {
                            const keys = await this.identityService.getTrackierKeys({itemId: data.clientId});
                            if (keys.success) {
                                await this.helperService.sendActivity({
                                    subject: 'Withdrawal Request',
                                    username: transaction.username,
                                    amount: transaction.amount,
                                    transactionId: transaction.transaction_no,
                                    clientId: data.clientId
                                }, keys.data)
                            }
                        } catch (e) {
                            console.log('Trackier error: Monnify Line 352', e.message)
                        }

                        return {success: true, message: 'Transaction was reversed', status: HttpStatus.OK};
                    }
                    
                    break;
                case 'SUCCESSFUL_DISBURSEMENT': 
                    const withdrawalSuccess = await this.withdrawalRepository.findOne({
                        where: {
                            client_id: data.clientId, 
                            withdrawal_code: data.reference
                        }
                    });
                    if (withdrawalSuccess && withdrawalSuccess.status === 0) {
                        // update withdrawal status
                        await this.withdrawalRepository.update({
                            id: withdrawalSuccess.id
                        }, {
                            status: 1
                        })
                    } else {
                        console.log('transfer.success: withdrawal not found', data.reference)
                    }
                    break;
                case 'FAILED_DISBURSEMENT':
                    const withdrawalFailed = await this.withdrawalRepository.findOne({
                        where: {
                            client_id: data.clientId,
                            withdrawal_code: data.reference
                        }
                    });
                    if (withdrawalFailed) {
                            // update withdrawal status
                        await this.withdrawalRepository.update({
                            id: withdrawalSuccess.id
                        }, {
                            status: 2,
                            comment: 'Transfer failed'
                        });
                        // find user wallet
                        const wallet = await this.walletRepository.findOne(
                            {where: {user_id: withdrawalFailed.user_id}
                        });

                        const balance = parseFloat(wallet.available_balance.toString()) + parseFloat(withdrawalFailed.amount.toString())
                        // update user wallet
                        await this.helperService.updateWallet(balance, withdrawalFailed.user_id);

                        // save transaction
                        await this.helperService.saveTransaction({
                            amount: withdrawalFailed.amount,
                            channel: 'internal',
                            clientId: data.clientId,
                            toUserId: withdrawalFailed.user_id,
                            toUsername: wallet.username,
                            toUserBalance: balance,
                            fromUserId: 0,
                            fromUsername: 'System',
                            fromUserbalance: 0,
                            source: 'system',
                            subject: 'Failed Withdrawal Request',
                            description: "Transfer failed",
                            transactionNo: generateTrxNo(),
                            status: 1
                        })

                    } else {
                        console.log('transfer.failed: withdrawal not found', data.reference)
                    }
                    break;
                case 'REVERSED_DISBURSEMENT':
                    const reversed = await this.withdrawalRepository.findOne({
                        where: {
                            client_id: data.clientId, 
                            withdrawal_code: data.reference
                        }
                    });
                    if (reversed) {
                            // update withdrawal status
                        await this.withdrawalRepository.update({
                            id: withdrawalSuccess.id
                        }, {
                            status: 2,
                            comment: 'Transfer failed'
                        });
                        // find user wallet
                        const wallet = await this.walletRepository.findOne(
                            {where: {user_id: reversed.user_id}
                        });

                        const balance = parseFloat(wallet.available_balance.toString()) + parseFloat(reversed.amount.toString())
                        // update user wallet
                        await this.helperService.updateWallet(balance, reversed.user_id);

                        // save transaction
                        await this.helperService.saveTransaction({
                            amount: reversed.amount,
                            channel: 'internal',
                            clientId: data.clientId,
                            toUserId: reversed.user_id,
                            toUsername: wallet.username,
                            toUserBalance: balance,
                            fromUserId: 0,
                            fromUsername: 'System',
                            fromUserbalance: 0,
                            source: 'system',
                            subject: 'Reversed Withdrawal Request',
                            description: "Transfer was reversed",
                            transactionNo: generateTrxNo(),
                            status: 1
                        })
            
                    } else {
                        console.log('transfer.reversed: withdrawal not found', data.reference)
                    }
                    break;
            }
            return {success: true}
        
        } catch(e) {
            // console.log('Paystack error', e.message);
            return {success: false, message: "error occured"};
        }
    }

    private async monnifySettings(client_id: number) {
        return await this.paymentMethodRepository.findOne({
            where: {
                provider: 'monnify',  
                client_id
            }
        });
    }
}
