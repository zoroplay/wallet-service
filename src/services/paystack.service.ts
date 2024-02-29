
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { get, post } from 'src/common/axios';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import { HelperService } from './helper.service';
import { generateTrxNo } from 'src/common/helpers';
import * as https from 'https';

@Injectable()
export class PaystackService {

    constructor(
        @InjectRepository(PaymentMethod)
        private readonly paymentMethodRepository: Repository<PaymentMethod>,
        @InjectRepository(Transaction)
        private readonly transactionRepository: Repository<Transaction>,
        @InjectRepository(Wallet)
        private readonly walletRepository: Repository<Wallet>,
        @InjectRepository(Withdrawal)
        private readonly withdrawalRepository: Repository<Withdrawal>,

        private helperService: HelperService
    ) {}
    
    async generatePaymentLink(data, client_id) {
        try {
            const paymentSettings = await this.paystackSettings(client_id);
            // return false if paystack settings is not available
            if (!paymentSettings) return {success: false, message: 'Paystack has not been configured for client'};

            const resp = await post(`${paymentSettings.base_url}/transaction/initialize`, data, {
                'Authorization': `Bearer ${paymentSettings.secret_key}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            })
            return {success: true, data: resp.data };
        } catch(e) {
            return {success: false, message: 'Unable to initiate deposit with paystack'};
        }
    }

    async verifyTransaction(param) {
        try {
            const paymentSettings = await this.paystackSettings(param.clientId);

            const resp = await get(`${paymentSettings.base_url}/transaction/verify/${param.transactionRef}`, {
                'Authorization': `Bearer ${paymentSettings.secret_key}`,
            });

            const data = resp.data;
            const transaction = await this.transactionRepository.findOne({
                where: {
                    client_id: param.clientId,
                    transaction_no: param.transactionRef,
                    tranasaction_type: 'credit'
                }
            });
            // if tranaction not found.
            if (!transaction) return {success: false, message: 'Transaction not found', status: HttpStatus.NOT_FOUND};

            if (data.status === 'success') {
                if (transaction.status === 1) // if transaction is already successful, return success message
                    return {success: true, message: 'Transaction was successful', status: HttpStatus.OK};
                if (transaction.status === 2)
                    return {success: false, message: 'Transaction failed. Try again', status: HttpStatus.NOT_ACCEPTABLE};

                if (transaction.status === 0) {
                    // find user wallet
                    const wallet = await this.walletRepository.findOne({where: {user_id: transaction.user_id}});

                    const balance = parseFloat(wallet.available_balance.toString()) + parseFloat(transaction.amount.toString())
                    // fund user wallet
                    await this.fundWallet(balance, transaction.user_id);

                    // update transaction status to completed - 1
                    await this.transactionRepository.update({
                        transaction_no: transaction.transaction_no,
                    }, {
                        status: 1
                    });
                    
                    return {success: true, message: 'Transaction was successful', status: HttpStatus.OK};
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
            
        } catch (e) {
            return {success: false, message: 'Unable to verify transaction: ' + e.message, status: HttpStatus.BAD_REQUEST};
        }
    }

    async disburseFunds(withdrawal: Withdrawal, client_id) {
        try {
            const paymentSettings = await this.paystackSettings(client_id);
            // return false if paystack settings is not available
            if (!paymentSettings) return {success: false, message: 'Paystack has not been configured for client', status: HttpStatus.NOT_IMPLEMENTED};
    
            const initRes = await this.initiateTransfer(withdrawal.account_number, withdrawal.account_name, withdrawal.bank_code, paymentSettings.secret_key);
            if (initRes.success) {
                // do transfer with paystack transfer api
                const resp: any = await this.doTransfer(withdrawal.amount, withdrawal.withdrawal_code, initRes.data.recipient_code, paymentSettings.secret_key)
                // console.log(resp);
                return {success: resp.success, data: resp.data, message: resp.message};

            } else {
                return initRes;
            }

        } catch (e) {
            console.log(e.message);
            return {success: false, message: 'Paystack Error! unable to disburse funds', status: HttpStatus.BAD_REQUEST};
        }
    }

    private async initiateTransfer(accountNo, accountName, bankCode, key) {
        const params = JSON.stringify({
            "type": "nuban",
            "name": accountName,
            "account_number": accountNo,
            "bank_code": bankCode,
            "currency": "NGN"
        })

        const options = {
            hostname: 'api.paystack.co',
            port: 443,
            path: '/transferrecipient',
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + key,
                'Content-Type': 'application/json'
            }
        }

        const resp: any = await new Promise((resolve, reject) => {
            const req = https.request(options, res => {
                let data = ''

                res.on('data', (chunk) => {
                    data += chunk
                });
    
                res.on('end', () => {
                    // console.log(JSON.parse(data))
                    resolve(JSON.parse(data))
                })
            }).on('error', error => {
                console.error(error)
                reject(error)
            })
    
            req.write(params)
            req.end()
        })
    
        return {success: resp.status, data: resp.data, message: resp.message};
    }

    private async doTransfer(amount, reference, recipient, key) {
        const params = JSON.stringify({
            source: 'balance',
            amount: parseFloat(amount) * 100,
            reference,
            recipient,
            reason:  'Payout request'
        })

        // console.log(params)

        const options = {
            hostname: 'api.paystack.co',
            port: 443,
            path: '/transfer',
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + key,
                'Content-Type': 'application/json'
            }
        }

        const resp: any = await new Promise((resolve, reject) => {
            const req = https.request(options, res => {
                let data = ''

                res.on('data', (chunk) => {
                    data += chunk
                });
    
                res.on('end', () => {
                    // console.log(JSON.parse(data))
                    resolve(JSON.parse(data))
                })
            }).on('error', error => {
                console.error(error)
                reject(error)
            })
    
            req.write(params)
            req.end()
        })
    
        return {success: resp.status, data: resp.data, message: resp.message};
    }

    async resolveAccountNumber(client_id, accountNo, banckCode) {
        try {
            const paymentSettings = await this.paystackSettings(client_id);
            // return false if paystack settings is not available
            if (!paymentSettings) return {success: false, message: 'Paystack has not been configured for client'};
            const resp = await get(`${paymentSettings.base_url}/bank/resolve?account_number=${accountNo}&bank_code=${banckCode}`, {
                'Authorization': `Bearer ${paymentSettings.secret_key}`,
            })
            return {success: resp.status, data: resp.data, message: resp.message};
        } catch(e) {
            return {success: false, message: "Something went wrong " + e.message};
        }
    }

    private async paystackSettings(client_id: number) {
        return await this.paymentMethodRepository.findOne({
            where: {
                provider: 'paystack',  
                client_id
            }
        });
    }

    async handleWebhook(data) {
        try {
            console.log(data)
            const paymentSettings = await this.paystackSettings(data.clientId);
            // validate request with paystack key
            const hash = crypto.createHmac('sha512', paymentSettings.secret_key).update(data.body).digest('hex');
            console.log(hash)
            console.log(data.paystackKey)
            if (hash == data.paystackKey) {
                switch (data.event) {
                    case 'charge.success':
                        const transaction = await this.transactionRepository.findOne({
                            where: {
                                client_id: data.clientId, 
                                transaction_no: data.reference,
                                tranasaction_type: 'credit'
                            }
                        });
                        if (transaction && transaction.status === 0) {
                            // find user wallet
                            const wallet = await this.walletRepository.findOne(
                                {where: {user_id: transaction.user_id}
                            });
                            const balance = parseFloat(wallet.available_balance.toString()) + parseFloat(transaction.amount.toString())
                            // update user wallet
                            await this.fundWallet(balance, transaction.user_id);

                            // update transaction status
                            await this.transactionRepository.update({
                                transaction_no: transaction.transaction_no,
                            }, {
                                status: 1
                            })
                        }
                        
                        break;
                    case 'transfer.success': 
                        const withdrawalSuccess = await this.withdrawalRepository.findOne({
                            where: {client_id: data.clientId, withdrawal_code: data.reference}
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
                    case 'transfer.failed':
                        const withdrawalFailed = await this.withdrawalRepository.findOne({
                            where: {client_id: data.clientId, withdrawal_code: data.reference}
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
                            await this.fundWallet(balance, withdrawalFailed.user_id);

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
                    case 'transfer.reversed':
                        const reversed = await this.withdrawalRepository.findOne({
                            where: {client_id: data.clientId, withdrawal_code: data.reference}
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
                            await this.fundWallet(balance, reversed.user_id);

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
            } else {
                return {success: false, message: 'Invalid signature'}
            }
        } catch(e) {
            console.log('Paystack error', e.message);
            return {success: false, message: "error occured"};
        }
    }

    private async fundWallet(amount, user_id) {
        // update user wallet
        await this.walletRepository.update({
            user_id,
        }, {
            available_balance: amount
        });
    }
}
