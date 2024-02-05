
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { post } from 'src/common/axios';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PaystackService {

    constructor(
        @InjectRepository(PaymentMethod)
        private readonly paymentMethodRepository: Repository<PaymentMethod>
    ) {}
    
    async generatePaymentLink(data, client_id) {
        const paymentSettings = await this.paystackSettings(client_id);
        // return false if paystack settings is not available
        if (!paymentSettings) return {success: false, message: 'Paystack has not been configured for client'};

        const resp = await post(`${paymentSettings.base_url}/transaction/initialize`, data, {
            'Authorization': `Bearer ${paymentSettings.secret_key}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        console.log(resp)
        return resp;
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
