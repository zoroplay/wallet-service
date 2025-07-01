/* eslint-disable prettier/prettier */
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { get, post } from 'src/common/axios';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import { HelperService } from './helper.service';
import { generateTrxNo } from 'src/common/helpers';
import * as https from 'https';
import { IdentityService } from 'src/identity/identity.service';
import { CallbackLog } from 'src/entity/callback-log.entity';

@Injectable()
export class PaystackService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepository: Repository<Withdrawal>,
    @InjectRepository(CallbackLog)
    private callbacklogRepository: Repository<CallbackLog>,

    private helperService: HelperService,
    private identityService: IdentityService,
  ) {}

  async generatePaymentLink(data, client_id) {
    try {
      // console.log(data, client_id);
      const paymentSettings = await this.paystackSettings(client_id);
      // return false if paystack settings is not available
      if (!paymentSettings)
        return {
          success: false,
          message: 'Paystack has not been configured for client',
        };

      const resp = await post(
        `${paymentSettings.base_url}/transaction/initialize`,
        data,
        {
          Authorization: `Bearer ${paymentSettings.secret_key}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      );
      return { success: true, data: resp.data };
    } catch (e) {
      console.log('paystack error', e.message);
      return {
        success: false,
        message: 'Unable to initiate deposit with paystack',
      };
    }
  }

  async verifyTransaction(param) {
    try {
      const paymentSettings = await this.paystackSettings(param.clientId);

      const resp = await get(
        `${paymentSettings.base_url}/transaction/verify/${param.transactionRef}`,
        {
          Authorization: `Bearer ${paymentSettings.secret_key}`,
        },
      );

      const data = resp.data;
      const transaction = await this.transactionRepository.findOne({
        where: {
          client_id: param.clientId,
          transaction_no: param.transactionRef,
          tranasaction_type: 'credit',
        },
      });

      if (!transaction) {
        await this.callbacklogRepository.save({
          client_id: param.clientId,
          request: 'Transaction not found',
          response: JSON.stringify(param),
          status: 0,
          type: 'Callback',
          transaction_id: param.transactionRef,
          paymentMethod: 'Paystack',
        });

        return {
          success: false,
          message: 'Transaction not found',
          status: HttpStatus.NOT_FOUND,
        };
      }

      if (data.status === 'success') {
        if (transaction.status === 1) {
          await this.callbacklogRepository.save({
            client_id: param.clientId,
            request: 'Transaction already processed',
            response: JSON.stringify(param),
            status: 1,
            type: 'Callback',
            transaction_id: param.transactionRef,
            paymentMethod: 'Paystack',
          });

          return {
            success: true,
            message: 'Transaction already processed',
            status: HttpStatus.OK,
          };
        }

        if (transaction.status === 2) {
          await this.callbacklogRepository.save({
            client_id: param.clientId,
            request: 'Transaction not found',
            response: JSON.stringify(param),
            status: 0,
            type: 'Callback',
            transaction_id: param.transactionRef,
            paymentMethod: 'Paystack',
          });

          return {
            success: false,
            message: 'Transaction failed. Try again',
            status: HttpStatus.NOT_ACCEPTABLE,
          };
        }

        if (transaction.status === 0) {
          // find user wallet
          const wallet = await this.walletRepository.findOne({
            where: { user_id: transaction.user_id },
          });

          if (!wallet) {
            await this.callbacklogRepository.save({
              client_id: param.clientId,
              request: 'Wallet not found',
              response: JSON.stringify(param),
              status: 0,
              type: 'Callback',
              transaction_id: param.transactionRef,
              paymentMethod: 'Paystack',
            });

            return {
              success: false,
              message: 'Wallet not found',
              status: HttpStatus.NOT_FOUND,
            };
          }

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
            console.log('Trackier error: Paystack Line 98', e.message);
          }

          await this.callbacklogRepository.save({
            client_id: param.clientId,
            request: 'Completed',
            response: JSON.stringify(param),
            status: 1,
            type: 'Callback',
            transaction_id: param.transactionRef,
            paymentMethod: 'Paystack',
          });

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
      const paymentSettings = await this.paystackSettings(client_id);

      // console.log(paymentSettings);
      // return false if paystack settings is not available
      if (!paymentSettings)
        return {
          success: false,
          message: 'Paystack has not been configured for client',
          status: HttpStatus.NOT_IMPLEMENTED,
        };

      const initRes = await this.initiateTransfer(
        withdrawal.account_number,
        withdrawal.account_name,
        withdrawal.bank_code,
        paymentSettings.secret_key,
      );

      if (initRes.success) {
        const resp: any = await this.doTransfer(
          withdrawal.amount,
          withdrawal.withdrawal_code,
          initRes.data.recipient_code,
          paymentSettings.secret_key,
        );
        return {
          success: resp.success,
          data: resp.data,
          message: resp.message,
        };
      } else {
        return initRes;
      }
    } catch (e) {
      console.log(e.message);
      return {
        success: false,
        message: 'Paystack Error! unable to disburse funds',
        status: HttpStatus.BAD_REQUEST,
      };
    }
  }

  private async initiateTransfer(accountNo, accountName, bankCode, key) {
    const params = JSON.stringify({
      type: 'nuban',
      name: accountName,
      account_number: accountNo,
      bank_code: bankCode,
      currency: 'NGN',
    });

    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: '/transferrecipient',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
    };
    const resp: any = await new Promise((resolve, reject) => {
      const req = https
        .request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            resolve(JSON.parse(data));
          });
        })
        .on('error', (error) => {
          console.error(error);
          reject(error);
        });

      req.write(params);
      req.end();
    });

    return { success: resp.status, data: resp.data, message: resp.message };
  }

  private async doTransfer(amount, reference, recipient, key) {
    const params = JSON.stringify({
      source: 'balance',
      amount: parseFloat(amount) * 100,
      reference: reference + '_' + generateTrxNo(),
      recipient,
      reason: 'Payout request',
    });

    // console.log(params)

    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: '/transfer',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
    };

    const resp: any = await new Promise((resolve, reject) => {
      const req = https
        .request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            // console.log(JSON.parse(data))
            resolve(JSON.parse(data));
          });
        })
        .on('error', (error) => {
          console.error(error);
          reject(error);
        });

      req.write(params);
      req.end();
    });

    return { success: resp.status, data: resp.data, message: resp.message };
  }

  async resolveAccountNumber(client_id, accountNo, banckCode) {
    try {
      const paymentSettings = await this.paystackSettings(client_id);
      // return false if paystack settings is not available
      if (!paymentSettings)
        return {
          success: false,
          message: 'Paystack has not been configured for client',
        };
      const resp = await get(
        `${paymentSettings.base_url}/bank/resolve?account_number=${accountNo}&bank_code=${banckCode}`,
        {
          Authorization: `Bearer ${paymentSettings.secret_key}`,
        },
      );
      return { success: resp.status, data: resp.data, message: resp.message };
    } catch (e) {
      return { success: false, message: 'Something went wrong ' + e.message };
    }
  }

  private async paystackSettings(client_id: number) {
    return await this.paymentMethodRepository.findOne({
      where: {
        provider: 'paystack',
        client_id,
      },
    });
  }

  async handleWebhook(data) {
    try {
      const paymentSettings = await this.paystackSettings(data.clientId);

      // Validate request with paystack key
      const hash = crypto
        .createHmac('sha512', paymentSettings.secret_key)
        .update(data.body)
        .digest('hex');

      if (hash !== data.paystackKey) {
        await this.logWebhook(data, 'Invalid signature', 0);
        return { success: false, message: 'Invalid signature' };
      }

      const ref = data.reference.split('_');
      const baseLogData = {
        client_id: data.clientId,
        request: JSON.stringify(data.rawBody),
        type: 'Webhook',
        transaction_id: data.rawBody?.payload?.reference || ref[0],
        paymentMethod: 'Paystack',
      };

      switch (data.event) {
        case 'charge.success':
          return await this.handleChargeSuccess(data, ref[0]);
        case 'transfer.success':
          return await this.handleTransferSuccess(data, ref[0]);
        case 'transfer.failed':
          return await this.handleTransferFailed(data, ref[0]);
        case 'transfer.reversed':
          return await this.handleTransferReversed(data, ref[0]);
        default:
          await this.callbacklogRepository.save({
            ...baseLogData,
            response: `Unhandled event: ${data.event}`,
            status: 0,
          });
          return { success: false, message: 'Unhandled event type' };
      }
    } catch (e) {
      await this.callbacklogRepository.save({
        client_id: data.clientId,
        request: JSON.stringify(data.rawBody),
        response: `Error: ${e.message}`,
        status: 0,
        type: 'Webhook',
        transaction_id:
          data.rawBody?.payload?.reference || data.reference?.split('_')[0],
        paymentMethod: 'Paystack',
      });
      console.error('Paystack webhook error:', e.message);
      return { success: false, message: 'Error occurred' };
    }
  }

  private async logWebhook(baseLogData, response, status) {
    await this.callbacklogRepository.save({
      ...baseLogData,
      response,
      status,
    });
  }

  private async handleChargeSuccess(data, transactionRef) {
    const transaction = await this.transactionRepository.findOne({
      where: {
        client_id: data.clientId,
        transaction_no: transactionRef,
        tranasaction_type: 'credit',
      },
    });

    if (!transaction) {
      await this.logWebhook(data, 'Transaction not found', 0);
      return { success: false, message: 'Transaction not found' };
    }

    if (transaction.status === 1) {
      await this.logWebhook(data, 'Transaction already processed', 1);
      return {
        success: true,
        message: 'Transaction already processed',
        status: HttpStatus.OK,
      };
    }

    const wallet = await this.walletRepository.findOne({
      where: { user_id: transaction.user_id },
    });

    if (!wallet) {
      await this.logWebhook(
        data,
        `Wallet not found for user ${transaction.user_id}`,
        0,
      );
      return {
        success: false,
        message: 'Wallet not found for this user',
        status: HttpStatus.NOT_FOUND,
      };
    }

    const balance =
      parseFloat(wallet.available_balance.toString()) +
      parseFloat(transaction.amount.toString());

    // Update user wallet
    await this.helperService.updateWallet(balance, transaction.user_id);

    // Update transaction status
    await this.transactionRepository.update(
      { transaction_no: transaction.transaction_no },
      { status: 1, balance },
    );

    try {
      const keys = await this.identityService.getTrackierKeys({
        itemId: data.clientId,
      });

      if (keys.success) {
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
      console.error('Trackier error:', e.message);
      // Don't fail the whole process for Trackier errors
    }

    await this.logWebhook(data, 'Transaction processed successfully', 1);
    return {
      success: true,
      message: 'Transaction processed successfully',
      status: HttpStatus.OK,
    };
  }

  private async handleTransferSuccess(data, withdrawalRef) {
    const withdrawal = await this.withdrawalRepository.findOne({
      where: { client_id: data.clientId, withdrawal_code: withdrawalRef },
    });

    if (!withdrawal) {
      await this.logWebhook(data, `Withdrawal not found: ${withdrawalRef}`, 0);
      console.log('transfer.success: withdrawal not found', withdrawalRef);
      return { success: false, message: 'Withdrawal not found' };
    }

    if (withdrawal.status === 0) {
      await this.withdrawalRepository.update(
        { id: withdrawal.id },
        { status: 1 },
      );
      await this.logWebhook(data, 'Withdrawal processed successfully', 1);
    }

    return { success: true };
  }

  private async handleTransferFailed(data, withdrawalRef) {
    return this.handleFailedOrReversedTransfer(
      data,
      withdrawalRef,
      'failed',
      'Transfer failed',
    );
  }

  private async handleTransferReversed(data, withdrawalRef) {
    return this.handleFailedOrReversedTransfer(
      data,
      withdrawalRef,
      'reversed',
      'Transfer was reversed',
    );
  }

  private async handleFailedOrReversedTransfer(
    data,
    withdrawalRef,
    type,
    description,
  ) {
    const withdrawal = await this.withdrawalRepository.findOne({
      where: { client_id: data.clientId, withdrawal_code: withdrawalRef },
    });

    if (!withdrawal) {
      await this.logWebhook(data, `Withdrawal not found: ${withdrawalRef}`, 0);
      console.log(`transfer.${type}: withdrawal not found`, withdrawalRef);
      return { success: false, message: 'Withdrawal not found' };
    }

    // Update withdrawal status
    await this.withdrawalRepository.update(
      { id: withdrawal.id },
      { status: 2, comment: description },
    );

    // Refund to user wallet
    const wallet = await this.walletRepository.findOne({
      where: { user_id: withdrawal.user_id },
    });

    const balance =
      parseFloat(wallet.available_balance.toString()) +
      parseFloat(withdrawal.amount.toString());

    await this.helperService.updateWallet(balance, withdrawal.user_id);

    // Save transaction record
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
      subject: `${type === 'failed' ? 'Failed' : 'Reversed'} Withdrawal Request`,
      description,
      transactionNo: generateTrxNo(),
      status: 1,
    });

    await this.logWebhook(data, `Withdrawal ${type} processed`, 1);
    return { success: true };
  }
}
