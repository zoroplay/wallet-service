/* eslint-disable prettier/prettier */
import { HttpStatus, Injectable } from '@nestjs/common';
import * as WayaQuickRestClient from 'wayaquick-payment';
@Injectable()
export class WayaQuickService {
  private wayaQuickClient: WayaQuickRestClient;

  constructor() {
    const merchantId = 'MER_48MCm1724778103954FaDbe';
    const publicKey = 'WAYAPUBK_TEST_0xcce6f814708a46b5baf6c02f4a76b8c4';
    const environment = 'PRODUCTION';

    this.wayaQuickClient = new WayaQuickRestClient(
      merchantId,
      publicKey,
      environment,
    );
  }

  async initializePayment({ data: user }, amount) {
    try {
      if (!user.firstName || !user.lastName || !user.email)
        return {
          success: false,
          message: 'Account information not complete',
        };
      console.log('user:-', user, 'amount:-', amount);
      const res = await this.wayaQuickClient.initializePayment({
        amount: amount,
        narration: 'Account Deposit',
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.username,
      });
      console.log('res:-', res, '______-----__:-');
      if (!res.status)
        return {
          success: false,
          message: res.message,
        };

      return { success: true, data: res.data, message: res.message };
    } catch (e) {
      return {
        success: false,
        message: 'Unable to initiate deposit with paystack',
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
        message: 'Unable to initiate deposit with paystack',
      };
    }
  }
}
