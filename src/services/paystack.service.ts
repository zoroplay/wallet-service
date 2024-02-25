
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { get, post } from 'src/common/axios';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PaystackService {

    constructor(
        @InjectRepository(PaymentMethod)
        private readonly paymentMethodRepository: Repository<PaymentMethod>,
        @InjectRepository(Transaction)
        private readonly transactionRepository: Repository<Transaction>,
        @InjectRepository(Wallet)
        private readonly walletRepository: Repository<Wallet>
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
            const paymentSettings = await this.paystackSettings(param.client_id);

            const resp = await get(`${paymentSettings.base_url}/transaction/verify/${param.transactionRef}`, {
                'Authorization': `Bearer ${paymentSettings.secret_key}`,
            });


            const data = resp.data;
            const transaction = await this.transactionRepository.findOne({
                where: {
                    client_id: param.client_id,
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

                    // fund user wallet
                    await this.walletRepository.update({
                        user_id: transaction.user_id,
                        client_id: param.clientId
                    }, {
                        // balance,
                        available_balance: parseFloat(wallet.available_balance.toString()) + parseFloat(transaction.amount.toString())
                    });

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

    async paystackSettings(client_id: number) {
        return await this.paymentMethodRepository.findOne({
            where: {
                provider: 'paystack',  
                client_id
            }
        });
    }
}
