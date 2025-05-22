import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Repository } from 'typeorm';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import * as crypto from 'crypto';
import { HelperService } from './helper.service';
import { generateTrxNo } from 'src/common/helpers';
import axios from 'axios';
import { IdentityService } from 'src/identity/identity.service';

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
    private identityService: IdentityService,

    private helperService: HelperService,
  ) {}

  private async flutterwaveSettings(client_id: number) {
    return await this.paymentMethodRepository.findOne({
      where: { provider: 'flutterwave', client_id },
    });
  }

  async createPayment(data, client_id) {
    try {
      const paymentSettings = await this.flutterwaveSettings(client_id);
      if (!paymentSettings)
        return {
          success: false,
          message: 'Flutterwave has not been configured for client',
        };

      try {
        const response = await axios.post(
          `${paymentSettings.base_url}/payments`,
          data,
          {
            headers: {
              Authorization: `Bearer ${paymentSettings.secret_key}`,
              'Content-Type': 'application/json',
            },
          },
        );

        console.log(response);

        console.log(response.data);

        if (!response.data) {
          return {
            success: false,
            message: 'Payment initiation failed',
          };
        }

        if (!response.data || !response.data.data) {
          return {
            success: false,
            message: 'Payment initiation failed',
          };
        }

        const { link } = response.data.data;
        if (!link) {
          return {
            success: false,
            message: 'Payment link not found in the response',
            data: response.data.data,
          };
        }

        return {
          success: true,
          message: 'Payment initiated successfully',
          data: { link },
        };
      } catch (error) {
        console.error('Error creating payment:', error);
        throw new BadRequestException(
          'Failed to create payment',
          error.message,
        );
      }
    } catch (error) {
      console.error('Error in createPayment method:', error);
      throw new BadRequestException('Error in payment process', error.message);
    }
  }

  async verifyTransaction(param) {
    try {
      const paymentSettings = await this.flutterwaveSettings(param.client_id);
      if (!paymentSettings)
        return {
          success: false,
          message: 'Flutterwave has not been configured for client',
        };

      const verifyUrl = `${paymentSettings.base_url}/transactions/verify_by_reference?tx_ref=${param.transactionRef}`;

      const resp = await axios.get(verifyUrl, {
        headers: {
          Authorization: `Bearer ${paymentSettings.secret_key}`,
        },
      });

      const data = resp.data;
      const transaction = await this.transactionRepository.findOne({
        where: {
          client_id: param.clientId,
          transaction_no: param.transactionRef,
          tranasaction_type: 'credit',
        },
      });

      if (!transaction)
        return {
          success: false,
          message: 'Transaction not found',
          status: HttpStatus.NOT_FOUND,
        };

      if (data.status === 'success') {
        if (transaction.status === 1)
          // if transaction is already successful, return success message
          return {
            success: true,
            message: 'Transaction was successful',
            status: HttpStatus.OK,
          };
        console.log(transaction);
        if (transaction.status === 2)
          return {
            success: false,
            message: 'Transaction failed. Try again',
            status: HttpStatus.NOT_ACCEPTABLE,
          };

        if (transaction.status === 0) {
          // find user wallet
          const wallet = await this.walletRepository.findOne({
            where: { user_id: transaction.user_id },
          });

          const balance =
            parseFloat(wallet.available_balance.toString()) +
            parseFloat(transaction.amount.toString());

          // fund user wallet
          await this.helperService.updateWallet(balance, transaction.user_id);

          // update transaction status to completed - 1
          await this.transactionRepository.update(
            {
              transaction_no: transaction.transaction_no,
            },
            {
              status: 1,
              balance,
            },
          );

          try {
            const keys = await this.identityService.getTrackierKeys({
              itemId: data.clientId,
            });
            if (keys.success) {
              // send deposit to trackier
              await this.helperService.sendActivity(
                {
                  subject: 'Deposit',
                  username: transaction.username,
                  amount: transaction.amount,
                  transactionId: transaction.transaction_no,
                  clientId: data.clientId,
                },
                keys.data,
              );
            }
          } catch (e) {
            console.log(e.message);
          }

          return {
            success: true,
            message: 'Transaction was successful',
            status: HttpStatus.OK,
          };
        }
      } else {
        // update transaction status to failed - 2
        await this.transactionRepository.update(
          {
            transaction_no: transaction.transaction_no,
          },
          {
            status: 2,
          },
        );
        return {
          success: false,
          message: `Transaction was not successful: Last gateway response was:  ${data.gateway_response}`,
          status: HttpStatus.BAD_REQUEST,
        };
      }
    } catch (e) {
      return {
        success: false,
        message: 'Unable to verify transaction: ' + e.message,
        status: HttpStatus.BAD_REQUEST,
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

      const resp = await axios.post(
        `${paymentSettings.base_url}/v3/transfers`,
        {
          payload,
          headers: {
            Authorization: `Bearer ${paymentSettings.secret_key}`,
            'Content-Type': 'application/json',
          },
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
      console.log('FLUTRWAVE', JSON.stringify(data));
      console.log('FLUTRWAVE', data.body);
      const isValid = await this.verifySignature(data);

      if (!isValid) {
        return {
          success: false,
          message: 'Invalid webhook signature',
        };
      }

      console.log('FIRE');

      switch (data.event) {
        case 'charge.completed':
          await this.handleChargeCompleted(data);
          break;
        case 'transfer.success':
          await this.handleTransferSuccess(data);
          break;
        case 'transfer.failed':
          await this.handleTransferFailed(data);
          break;
        case 'transfer.reversed':
          await this.handleTransferReversed(data);
          break;
        default:
          console.log(`Unhandled event type: ${event}`);
      }

      return { success: true, message: 'Webhook processed successfully' };
    } catch (error) {
      console.error('Webhook processing error:', error);

      return {
        success: false,
        message: `Webhook handling failed: ${error.message}`,
      };
    }
  }

  private async verifySignature(data): Promise<boolean> {
    const paymentSettings = await this.flutterwaveSettings(data.clientId);
    const hash = crypto
      .createHmac('sha256', paymentSettings.secret_key)
      .update(data.body)
      .digest('hex');

    return hash === data.flutterwaveKey;
  }

  // Handlers for different webhook events
  private async handleChargeCompleted(data: any) {
    console.log('I GOT TO TRX');
    const transaction = await this.transactionRepository.findOne({
      where: { transaction_no: data.tx_ref },
    });

    if (transaction.status === 1) {
      console.log('ℹ️ Transaction already marked successful.');
      return {
        success: true,
        message: 'Transaction already successful',
        statusCode: HttpStatus.OK,
      };
    }

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

      console.log('I GOT TO TRX AND EXIT');

      await this.notifyTrackier(transaction, data.clientId);
    }
  }

  private async handleTransferSuccess(data: any): Promise<void> {
    const withdrawal = await this.withdrawalRepository.findOne({
      where: { client_id: data.clientId, withdrawal_code: data.reference },
    });

    if (withdrawal && withdrawal.status === 0) {
      await this.withdrawalRepository.update(
        { id: withdrawal.id },
        { status: 1 },
      );
    }
  }

  private async handleTransferFailed(data: any): Promise<void> {
    const withdrawal = await this.withdrawalRepository.findOne({
      where: { client_id: data.clientId, withdrawal_code: data.reference },
    });

    if (withdrawal) {
      const wallet = await this.walletRepository.findOne({
        where: { user_id: withdrawal.user_id },
      });

      const balance =
        parseFloat(wallet.available_balance.toString()) +
        parseFloat(withdrawal.amount.toString());

      await this.helperService.updateWallet(balance, withdrawal.user_id);
      await this.withdrawalRepository.update(
        { id: withdrawal.id },
        { status: 2, comment: 'Transfer failed' },
      );

      await this.helperService.saveTransaction({
        amount: withdrawal.amount,
        channel: 'internal',
        clientId: data.clientId,
        toUserId: withdrawal.user_id,
        toUsername: wallet.username,
        toUserBalance: balance,
        fromUserId: 0,
        fromUsername: 'System',
        fromUserbalance: 0,
        source: 'system',
        subject: 'Failed Withdrawal Request',
        description: 'Transfer failed',
        transactionNo: generateTrxNo(),
        status: 1,
      });
    }
  }

  private async handleTransferReversed(data: any): Promise<void> {
    const withdrawal = await this.withdrawalRepository.findOne({
      where: { client_id: data.clientId, withdrawal_code: data.reference },
    });

    if (withdrawal) {
      const wallet = await this.walletRepository.findOne({
        where: { user_id: withdrawal.user_id },
      });

      const balance =
        parseFloat(wallet.available_balance.toString()) +
        parseFloat(withdrawal.amount.toString());

      await this.helperService.updateWallet(balance, withdrawal.user_id);
      await this.withdrawalRepository.update(
        { id: withdrawal.id },
        { status: 2, comment: 'Transfer reversed' },
      );

      await this.helperService.saveTransaction({
        amount: withdrawal.amount,
        channel: 'internal',
        clientId: data.clientId,
        toUserId: withdrawal.user_id,
        toUsername: wallet.username,
        toUserBalance: balance,
        fromUserId: 0,
        fromUsername: 'System',
        fromUserbalance: 0,
        source: 'system',
        subject: 'Reversed Withdrawal Request',
        description: 'Transfer was reversed',
        transactionNo: generateTrxNo(),
        status: 1,
      });
    }
  }

  private async notifyTrackier(
    transaction: any,
    clientId: number,
  ): Promise<void> {
    try {
      const keys = await this.identityService.getTrackierKeys({
        itemId: clientId,
      });
      if (keys.success) {
        await this.helperService.sendActivity(
          {
            subject: 'Deposit',
            username: transaction.username,
            amount: transaction.amount,
            transactionId: transaction.transaction_no,
            clientId: clientId,
          },
          keys.data,
        );
      }
    } catch (e) {
      console.error('Trackier error:', e.message);
    }
  }
}
