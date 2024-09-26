/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { SearchTransactionsRequest } from 'src/proto/wallet.pb';
import { Repository } from 'typeorm';

@Injectable()
export class WayaBankService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
  ) {}
  private async getToken() {
    try {
      const username = process.env.WAYABANK_PUBLIC_KEY;
      const password = process.env.WAYABANK_SECRET_KEY;
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      const { data } = await axios.post(
        `${process.env.WAYABANK_AUTH_API}`,
        {},
        {
          headers: {
            accept: `*/*`,
            Authorization: `Basic ${auth}`,
          },
        },
      );
      return data.data;
    } catch (error) {
      console.log(error.message, 'error');
      return {
        success: false,
        message: 'Unable to get token',
      };
    }
  }

  async createVirtualAccount({ user }) {
    try {
      const tk = await this.getToken();
      const { data } = await axios.post(
        `${process.env.WAYABANK_API}/virtual-account`,
        {
          accountName: user.username,
          email: user.email || `${user.username}@${user.siteUrl}`,
          merchantAccountNumber: process.env.WAYABANK_MERCHANT_ACCOUNTNO,
          phoneNumber: '0' + user.username,
        },
        {
          headers: {
            accept: `*/*`,
            Authorization: `${tk.token}`,
            'Client-id': 'WAYABANK',
            'Client-type': 'DEFAULT',
          },
        },
      );
      return { success: true, data: data.data, message: data.message };
    } catch (error) {
      return {
        success: false,
        message: 'Unable to create virtual account',
      };
    }
  }

  async accountEnquiry({ accountNumber }) {
    try {
      const tk = await this.getToken();
      const { data } = await axios.post(
        `${process.env.WAYABANK_API}/virtual-account/enquiry`,
        {
          accountNumber,
        },
        {
          headers: {
            accept: `*/*`,
            Authorization: `${tk.token}`,
            'Client-id': 'WAYABANK',
            'Client-type': 'DEFAULT',
          },
        },
      );
      return { success: true, data: data.data, message: data.message };
    } catch (error) {
      console.log(error.message, 'error');
      return {
        success: false,
        message: 'Unable to create virtual account',
      };
    }
  }
}
