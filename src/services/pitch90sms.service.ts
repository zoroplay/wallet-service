/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Repository } from 'typeorm';
import { Wallet } from 'src/entity/wallet.entity';
import { HelperService } from './helper.service';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { StkTransactionRequest } from 'src/proto/wallet.pb';


@Injectable()
export class Pitch90SMSService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,

    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

    private helperService: HelperService
  ) {}

  async deposit({ amount, user, clientId }) {
    const settings = await this.getSettings(clientId);

    try {
      const payload = {
        amount: `${amount}`,
        salt: settings.secret_key,
        username: user.username,
        msisdn: '254' + user.username,
        account: '254' + user.username,
      }
      const url = `${settings.base_url}/wallet/stkpush`;

      const { data } = await axios.post(
        url,
        payload,
      );

      console.log(data)

      if (data.status === 'Fail') {
        return { success: false, message: data.error_desc };
      } else {
        // find user wallet
        // const wallet = await this.walletRepository.findOne({where: {username: user.username}});
        // // update user wallet
        // wallet.available_balance = parseFloat(wallet.available_balance.toString()) + parseFloat(amount);
        // wallet.balance = parseFloat(wallet.available_balance.toString()) + parseFloat(amount);
        // this.walletRepository.save(wallet);

        return { success: true, data, message: data.message };
      }

    } catch (error) {
      console.log(1234, error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async stkDepositNotification(data: StkTransactionRequest) {
    console.log('stk deposit data:', data);
    const username = data.msisdn.substring(3);
    try {
      // find user wallet
      const wallet = await this.walletRepository.findOne({where: {username}});
      // return error if not foumd
      if (!wallet) {
        console.log('wallet not found');
        return {status: 'Fail', ref_id: data.refId, error_desc: "User not found"};
      }

      const balance =
        parseFloat(wallet.available_balance.toString()) +
        parseFloat(data.amount.toString());
      // fund user wallet
      await this.helperService.updateWallet(balance, wallet.user_id);

      // update transaction status to completed - 1
      await this.transactionRepository.update(
        {
          transaction_no: data.refId,
        },
        {
          status: 1,
          balance,
        },
      );


      return {status: 'Success', ref_id: data.refId};

    } catch (e) {
      console.log('Error in deposit', e.message);
      return {status: 'Fail', ref_id: data.refId, error_desc: `Error processing request: ${e.message}`}
    }
  }

  async withdraw(withdrawal: Withdrawal, clientId: number) {

    const settings = await this.getSettings(clientId);

    try {
      const { data } = await axios.post(
        `${settings.base_url}/wallet/withdrawal`,
        {
          amount: `${withdrawal.amount}`,
          salt: settings.secret_key,
          username: withdrawal.username,
          msisdn: '254' + withdrawal.username,
        },
      );

      if (data.status === 'Fail') {
        return { success: false, message: data.error_desc };
      } else {

        return {
          success: true,
          data,
          message: 'Withdrawal processed.',
        };
      }

    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async stkWithdrawalNotification (data) {
    console.log('stk withdraw data:', data);
    const username = data.msisdn.substring(3);
    try {
        // find user wallet
        const wallet = await this.walletRepository.findOne({where: {username}});
        // return error if not foumd
        if (!wallet) {
          console.log('wallet not found');
          return {status: 'Fail', ref_id: data.ref_id, error_desc: "User not found"};
        }

        if (wallet.available_balance < parseFloat(data.amount))
          return {
            status: 'Fail', 
            ref_id: data.ref_id, 
            error_no: 5003,
            error_desc: "User not found"
          };

        const balance = wallet.available_balance;
        // update user wallet
        wallet.available_balance = parseFloat(wallet.available_balance.toString()) - parseFloat(data.amount);
        wallet.balance = balance - parseFloat(data.amount);
        this.walletRepository.save(wallet);
        // save transaction details
        await this.helperService.saveTransaction({
          amount: data.amount,
          channel: 'ussd',
          clientId: data.clientId,
          fromUserId: wallet.user_id,
          fromUsername: wallet.username,
          fromUserBalance: wallet.available_balance,
          toUserId: 0,
          toUsername: 'System',
          toUserbalance: 0,
          status: 1,
          source: 'stkpush',
          subject: 'Withdrawal',
          description: 'Ussd Withdrawal',
          transactionNo: data.ref_id,
        });


        return {status: 'Success', ref_id: data.ref_id};


    } catch (e) {
      return {status: 'Fail', ref_id: data.ref_id, error_desc: `Error processing request: ${e.message}`}
    }
  }

  async stkStatusNotification(data) {
    console.log('stk status', data)
    return {status: 'Success', ref_id: data.ref_id};
  }

  async registerUrl({ action, url, clientId }) {
    try {
      const settings = await this.getSettings(clientId);
      let response;
      switch (action) {
        case 'payment':
          response = await axios.post(
            `${settings.base_url}/wallet/registerIpnUrl`,
            {
              url: `${url}`,
              salt: settings.secret_key,
            },
          );
          break;
        case 'withdrawal':
          response = await axios.post(
            `${settings.base_url}/wallet/registerWithdrawalUrl`,
            {
              url: `${url}`,
              salt: settings.secret_key,
            },
          );
          break;
        case 'stkstatus':
          response = await axios.post(
            `${settings.base_url}/wallet/registerStkStatusUrl`,
            {
              url: `${url}`,
              salt: settings.secret_key,
            },
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

  private async getSettings(client_id: number) {
    return await this.paymentMethodRepository.findOne({
      where: {
        provider: 'stkpush',
        client_id,
      },
    });
  }

}
