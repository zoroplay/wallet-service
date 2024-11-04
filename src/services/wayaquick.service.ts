/* eslint-disable prettier/prettier */
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Repository } from 'typeorm';
import * as WayaQuickRestClient from 'wayaquick-payment';
@Injectable()
export class WayaQuickService {
  private wayaQuickClient: WayaQuickRestClient;

  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
  ) {}

  async generatePaymentLink(paymentData, client_id) {
    const paymentSettings = await this.getSettings(client_id);
    try {
      console.log(paymentData, 5665766, client_id);
      this.wayaQuickClient = await new WayaQuickRestClient(
        paymentSettings.merchant_id,
        paymentSettings.public_key,
        'PRODUCTION',
      );

      const res = await this.wayaQuickClient.initializePayment(paymentData);

      if (!res.status)
        return {
          success: false,
          message: res.message,
        };

      return { success: true, data: res.data, message: res.message };
    } catch (e) {
      return {
        success: false,
        message: 'Unable to initiate deposit with wayaquick',
      };
    }
  }

  async verifyTransaction(param) {
    try {
      const res = await this.wayaQuickClient.verifyPayment(param.transactionId);
      if (!res.status)
        return {
          success: false,
          message: res.message,
        };

      return { success: true, data: res.data };
    } catch (e) {
      return {
        success: false,
        message: 'Unable to initiate deposit with wayaquick',
      };
    }
  }

  private async getSettings(client_id: number) {
    return await this.paymentMethodRepository.findOne({
      where: {
        provider: 'wayaquick',
        client_id,
      },
    });
  }
}
