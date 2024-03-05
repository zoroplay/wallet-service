
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import { Repository } from 'typeorm';
import { HelperService } from './helper.service';
import { post } from 'src/common/axios';
import { get } from 'http';

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

        private helperService: HelperService
    ) {
        // const paymentMethod = await this
    }


    async disburseFunds(withdrawal: Withdrawal, client_id) {
        try {
            const paymentSettings = await this.monnifySettings(client_id);
            // return false if paystack settings is not available
            if (!paymentSettings) return {success: false, message: 'Monnify has not been configured for client', status: HttpStatus.NOT_IMPLEMENTED};
    
            const initRes = await this.initiateTransfer(withdrawal.account_number, withdrawal.account_name, withdrawal.bank_code, paymentSettings);
            if (initRes.success) {
                // do transfer with paystack transfer api
                const resp = await post(`${paymentSettings.base_url}/transfer`, {
                    source: 'balance',
                    amount: withdrawal.amount,
                    reference: withdrawal.withdrawal_code,
                    recipient: initRes.data.recipient_code,
                    reason:  'Payout request'
                }, {
                    'Authorization': `Bearer ${paymentSettings.secret_key}`,
                    'Content-Type': 'application/json',
                });

                console.log('transfer', resp)


                return {success: resp.status, data: resp.data, message: resp.message};

            } else {
                return initRes;
            }

        } catch (e) {
            console.log(e.message);
            return {success: false, message: 'Paystack Error! unable to disburse funds', status: HttpStatus.BAD_REQUEST};
        }
    }

    private async initiateTransfer(accountNo, accountName, bankCode, paymentSettings) {
        const url = `${paymentSettings.base_url}/transferrecipient`;
        const data = {
            type: 'nuban',
            name: accountName,
            account_number: accountNo.toString(),
            bank_code: bankCode,
            currency: 'NGN'
        }

        const resp = await post(url, data , {
            'Authorization': `Bearer ${paymentSettings.secret_key}`,
            'Content-Type': 'application/json',
        })
        
        console.log('initiate', resp)
        return {success: resp.status, data: resp.data, message: resp.message};
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

    private async authenticate(paymentSettings) {
        // const key
        // const res = await post(`${paymentSettings.base_url}/api/v1/auth/login`, {}, {
        //     'Authorization': 'Basic ' + key
        // })

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
