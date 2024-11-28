import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { get, post } from 'src/common/axios'; // Replace with your axios wrapper
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Repository } from 'typeorm';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import * as crypto from 'crypto';
import { HelperService } from './helper.service';
import { generateTrxNo } from 'src/common/helpers';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FlutterwaveService {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepository: Repository<Withdrawal>,
    private readonly configService: ConfigService,

    private helperService: HelperService,
  ) {
    this.apiKey = this.configService.get<string>('FLUTTERWAVE_PUB_KEY');
    this.apiUrl = this.configService.get<string>('FLUTTERWAVE_URL');
  }

  private async flutterwaveSettings(client_id: number) {
    return await this.paymentMethodRepository.findOne({
      where: { provider: 'flutterwave', client_id },
    });
  }

  async createPayment(data) {
    try {
      const paymentSettings = await this.flutterwaveSettings(data);
      if (!paymentSettings)
        return {
          success: false,
          message: 'Flutterwave has not been configured for client',
        };

      const payload = {
        tx_ref: generateTrxNo(),
        ...data,
      };

      const response = await post(this.apiUrl, payload, {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      });

      if (response.status !== 'success') {
        return {
          success: false,
          message: 'Payment initiation failed',
        };
      }

      return {
        success: true,
        message: 'Payment initiated successfully',
        data: response.data,
      };
    } catch (error) {
      console.error('Error creating payment:', error);
      throw new BadRequestException('Failed to create payment', error.message);
    }
  }

  async verifyTransaction(transactionRef: string, client_id: number) {
    try {
      const paymentSettings = await this.flutterwaveSettings(client_id);
      if (!paymentSettings)
        return {
          success: false,
          message: 'Flutterwave has not been configured for client',
        };

      const resp = await get(
        `${paymentSettings.base_url}/v3/transactions/${transactionRef}/verify`,
        {
          Authorization: `Bearer ${paymentSettings.secret_key}`,
        },
      );

      const data = resp.data;

      if (data.status === 'success') {
        const transaction = await this.transactionRepository.findOne({
          where: {
            client_id,
            transaction_no: transactionRef,
            tranasaction_type: 'credit',
          },
        });

        if (!transaction)
          return {
            success: false,
            message: 'Transaction not found',
            status: HttpStatus.NOT_FOUND,
          };

        if (transaction.status === 1)
          return {
            success: true,
            message: 'Transaction already successful',
          };

        const wallet = await this.walletRepository.findOne({
          where: { user_id: transaction.user_id },
        });

        const balance =
          parseFloat(wallet.available_balance.toString()) +
          parseFloat(transaction.amount.toString());

        await this.helperService.updateWallet(balance, transaction.user_id);
        await this.transactionRepository.update(
          { transaction_no: transaction.transaction_no },
          { status: 1, balance },
        );

        return {
          success: true,
          message: 'Transaction successfully verified and processed',
        };
      } else {
        return {
          success: false,
          message: `Transaction failed: ${data.message}`,
        };
      }
    } catch (e) {
      return {
        success: false,
        message: `Unable to verify transaction: ${e.message}`,
      };
    }
  }

  async disburseFunds(withdrawal: Withdrawal, client_id) {
    try {
      const paymentSettings = await this.flutterwaveSettings(client_id);
      if (!paymentSettings)
        return {
          success: false,
          message: 'Flutterwave has not been configured for client',
        };

      const payload = {
        account_bank: withdrawal.bank_code,
        account_number: withdrawal.account_number,
        amount: withdrawal.amount,
        narration: 'Withdrawal Payout',
        currency: 'NGN',
        reference: withdrawal.withdrawal_code,
      };

      const resp = await post(
        `${paymentSettings.base_url}/v3/transfers`,
        payload,
        {
          Authorization: `Bearer ${paymentSettings.secret_key}`,
          'Content-Type': 'application/json',
        },
      );

      if (resp.data.status === 'success') {
        await this.withdrawalRepository.update(
          { id: withdrawal.id },
          { status: 1 },
        );
        return { success: true, message: 'Funds disbursed successfully' };
      } else {
        return { success: false, message: resp.data.message };
      }
    } catch (e) {
      return {
        success: false,
        message: `Unable to disburse funds: ${e.message}`,
      };
    }
  }

  async handleWebhook(data) {
    try {
      const paymentSettings = await this.flutterwaveSettings(data.client_id);
      const hash = crypto
        .createHmac('sha256', paymentSettings.secret_key)
        .update(JSON.stringify(data.body))
        .digest('hex');

      if (hash !== data.signature) {
        return { success: false, message: 'Invalid webhook signature' };
      }

      const { event, data: eventData } = data.body;

      if (event === 'charge.completed' && eventData.status === 'successful') {
        const transaction = await this.transactionRepository.findOne({
          where: { transaction_no: eventData.tx_ref },
        });

        if (transaction && transaction.status === 0) {
          const wallet = await this.walletRepository.findOne({
            where: { user_id: transaction.user_id },
          });

          const balance =
            parseFloat(wallet.available_balance.toString()) +
            parseFloat(transaction.amount.toString());

          await this.helperService.updateWallet(balance, transaction.user_id);
          await this.transactionRepository.update(
            { transaction_no: transaction.transaction_no },
            { status: 1, balance },
          );
        }
      }

      return { success: true, message: 'Webhook handled successfully' };
    } catch (e) {
      return {
        success: false,
        message: `Webhook handling failed: ${e.message}`,
      };
    }
  }
}
