/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Repository } from 'typeorm';
import * as https from 'https';

const agent = new https.Agent({
  rejectUnauthorized: false,
});

@Injectable()
export class Pitch90SMSService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
  ) {}

  async stkPush({ amount, user }) {
    const url = `${process.env.PITCH_90_API}/wallet/stkpush`;
    const salt = process.env.PITCH_90_SMS_SALT;
    
    console.log(url, salt);
    try {
      const payload = {
        amount: `${amount}`,
        salt,
        username: user.username,
        msisdn: '0' + user.username,
        account: '0' + user.username,
      }
       console.log(payload)
      const { data } = await axios.post(
        url,
        payload,
      );

      console.log(data);

      if (data.status === 'Fail') {
        return { success: false, message: data.error_desc };
      }
      return { success: true, data, message: data.message };
    } catch (error) {
      console.log(1234, error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async withdraw({ amount, user }) {
    try {
      const { data } = await axios.post(
        `${process.env.PITCH_90_API}/wallet/withdrawal`,
        {
          amount: `${amount}`,
          salt: process.env.PITCH_90_SMS_SALT,
          username: user.username,
          msisdn: '0' + user.username,
        },
        { httpsAgent: agent },
      );
      if (data.status === 'Fail') {
        return { success: false, message: data.error_desc };
      }
      return { success: true, data, message: data.message };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async registerUrl({ action, url }) {
    try {
      let response;
      switch (action) {
        case 'payment':
          response = await axios.post(
            `${process.env.PITCH_90_API}/wallet/registerIpnUrl`,
            {
              url: `${url}`,
              salt: process.env.PITCH_90_SMS_SALT,
            },
            { httpsAgent: agent },
          );
          break;
        case 'withdrawal':
          response = await axios.post(
            `${process.env.PITCH_90_API}/wallet/registerWithdrawalUrl`,
            {
              url: `${url}`,
              salt: process.env.PITCH_90_SMS_SALT,
            },
            { httpsAgent: agent },
          );
          break;
        case 'stkstatus':
          console.log(1);
          response = await axios.post(
            `${process.env.PITCH_90_API}/wallet/registerStkStatusUrl`,
            {
              url: `${url}`,
              salt: process.env.PITCH_90_SMS_SALT,
            },
            { httpsAgent: agent },
          );
          break;

        default:
          return { success: false, message: 'WRONG ACTION!!!' };
      }
      console.log(response.data, 24324);
      if (response.data.status === 'Fail') {
        return { success: false, message: response.data.error_desc };
      }
      return {
        success: true,
        data: response.data,
        message: response.data.status,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

}
