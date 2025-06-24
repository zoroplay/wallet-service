import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Repository } from 'typeorm';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import axios from 'axios';
import { generateTrxNo } from 'src/common/helpers';
import { HelperService } from './helper.service';
import crypto from 'crypto';
import { IdentityService } from 'src/identity/identity.service';
import { CallbackLog } from 'src/entity/callback-log.entity';

@Injectable()
export class KorapayService {
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

  private async korapaySettings(client_id: number) {
    return await this.paymentMethodRepository.findOne({
      where: { provider: 'korapay', client_id },
    });
  }

  async createPayment(data, client_id) {
    try {
      console.log('CHECK ONE');
      const paymentSettings = await this.korapaySettings(client_id);
      if (!paymentSettings) {
        return {
          success: false,
          message: 'Korapay has not been configured for client',
        };
      }

      console.log('Payment Settings:', paymentSettings);
      console.log('CHECK TWO: Request Data:', data);

      // Send payment request
      const response = await axios.post(
        `${paymentSettings.base_url}/charges/initialize`,
        data,
        {
          headers: {
            Authorization: `Bearer ${paymentSettings.secret_key}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );

      console.log('API Response:', response.data);

      if (!response.data || !response.data.status) {
        return {
          success: false,
          message: 'Payment initiation failed',
          data: response.data?.data || {},
        };
      }

      return {
        success: true,
        message: 'Success',
        data: {
          link: response.data.data.checkout_url,
          transactionRef: response.data.data.reference,
        },
      };
    } catch (error) {
      console.error(
        'Error in createPayment:',
        error.response?.data || error.message,
        error.config,
      );
      throw new BadRequestException('Error in payment process', error);
    }
  }

  async verifyTransaction(param) {
    try {
      const paymentSettings = await this.korapaySettings(param.client_id);
      if (!paymentSettings)
        return {
          success: false,
          message: 'Korapay has not been configured for client',
        };

      const apiUrl = `${paymentSettings.base_url}/charges/${param.transactionRef}`;
      console.log(apiUrl);

      const resp = await axios.get(apiUrl, {
        headers: {
          Authorization: `Bearer ${paymentSettings.secret_key}`,
        },
      });

      const data = resp.data.data;

      if (data.status === 'success') {
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
            paymentMethod: 'Korapay',
          });
          return {
            success: false,
            message: 'Transaction not found',
            status: HttpStatus.NOT_FOUND,
          };
        }

        if (transaction.status === 1) {
          await this.callbacklogRepository.save({
            client_id: param.clientId,
            request: 'Transaction already processed',
            response: JSON.stringify(param),
            status: 1,
            type: 'Callback',
            transaction_id: param.transactionRef,
            paymentMethod: 'Korapay',
          });
          return {
            success: true,
            message: 'Transaction already successful',
          };
        }

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

        await this.callbacklogRepository.save({
          client_id: param.clientId,
          request: 'Completed',
          response: JSON.stringify(param),
          status: 1,
          type: 'Callback',
          transaction_id: param.transactionRef,
          paymentMethod: 'Korapay',
        });

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
      console.log(e);
      return {
        success: false,
        message: `Unable to verify transaction: ${e.message}`,
      };
    }
  }

  async initiateKoraPayout(payoutDto) {
    try {
      const apiKey = process.env.KORAPAY_SECRET_KEY as string;
      const apiUrl = `${process.env.KORAPAY_API_URL}/merchant/api/v1/transactions/disburse`;

      if (!apiKey || !apiUrl) {
        throw new Error(
          'Korapay API URL or Secret Key is missing in the environment variables',
        );
      }

      const reference = generateTrxNo(); // Assuming `generateTrxNo` generates a unique reference

      // Constructing the payout payload
      const paymentPayload = {
        reference, // Reference generated by `generateTrxNo`
        ...payoutDto, // Including other fields from `payoutDto`
      };

      // Making the API request
      const response = await axios.post(apiUrl, paymentPayload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      // Check response status
      if (response.data.status === 'success') {
        const { status } = response.data.data;
        if (status === 'successful') {
          return {
            success: true,
            message: 'Payment successful',
          };
        } else {
          return {
            success: false,
            message: 'Payment not successful',
          };
        }
      } else {
        return {
          success: false,
          message: 'Unable to process payout transaction',
        };
      }
    } catch (error) {
      console.error('Error initiating payout:', error);
      throw new BadRequestException(
        `Unable to Payout transaction: ${error.message}`,
      );
    }
  }

  // async processWebhook(data) {
  //   try {
  //     console.log('KORAPAY WEBHOOK:', JSON.stringify(data));
  //     const isValid = await this.verifySignature(data);

  //     if (!isValid) {
  //       return {
  //         success: false,
  //         message: 'Invalid webhook signature',
  //       };
  //     }

  //     switch (data.event) {
  //       case 'charge.success':
  //         await this.handleChargeCompleted(data);
  //         break;
  //       case 'transfer.success':
  //         await this.handleTransferSuccess(data);
  //         break;
  //       case 'transfer.failed':
  //         await this.handleTransferFailed(data);
  //         break;
  //       case 'transfer.reversed':
  //         await this.handleTransferReversed(data);
  //         break;
  //       default:
  //         console.log(`Unhandled event type: ${event}`);
  //     }

  //     return { success: true, message: 'Webhook processed successfully' };
  //   } catch (error) {
  //     console.error('Webhook processing error:', error.message);
  //     throw new BadRequestException(
  //       `Webhook handling failed: ${error.message}`,
  //     );
  //   }
  // }

  async processWebhook(data) {
    try {
      console.log('korapay BODY', data.body);

      console.log('korapay BODY', data.body.reference);

      const paymentSettings = await this.korapaySettings(data.clientId);

      if (!paymentSettings)
        return {
          success: false,
          message: 'Flutterwave has not been configured for client',
        };

      const hash = crypto
        .createHmac('sha256', paymentSettings.secret_key)
        .update(data.body) // make sure data.body is a raw JSON string
        .digest('hex');

      const isValid = hash === data.flutterwaveKey;

      // if (!isValid) {
      //   return {
      //     success: false,
      //     message: 'Invalid webhook signature',
      //     statusCode: HttpStatus.UNAUTHORIZED,
      //   };
      // }

      if (data.event === 'charge.completed') {
        console.log('FIRE');
        console.log('I GOT TO TRX');

        const transaction = await this.transactionRepository.findOne({
          where: {
            client_id: data.clientId,
            transaction_no: data.reference,
            tranasaction_type: 'credit',
          },
        });

        if (!transaction) {
          await this.callbacklogRepository.save({
            client_id: data.clientId,
            request: 'Transaction not found',
            response: JSON.stringify(data.rawBody),
            status: 0,
            type: 'Webhook',
            transaction_id: data.rawBody.payload.reference,
            paymentMethod: 'Korapay',
          });
          return {
            success: false,
            message: 'Transaction not found',
            statusCode: HttpStatus.NOT_FOUND,
          };
        }

        if (transaction.status === 1) {
          console.log('ℹ️ Transaction already marked successful.');
          await this.callbacklogRepository.save({
            client_id: data.clientId,
            request: 'Transaction already processed',
            response: JSON.stringify(data.rawBody),
            status: 1,
            type: 'Callback',
            transaction_id: data.rawBody.payload.reference,
            paymentMethod: 'Korapay',
          });
          return {
            success: true,
            message: 'Transaction already successful',
            statusCode: HttpStatus.OK,
          };
        }

        const wallet = await this.walletRepository.findOne({
          where: { user_id: transaction.user_id },
        });

        if (!wallet) {
          console.error(
            '❌ Wallet not found for user_id:',
            transaction.user_id,
          );
          return {
            success: false,
            message: 'Wallet not found for this user',
            statusCode: HttpStatus.NOT_FOUND,
          };
        }

        const balance =
          parseFloat(wallet.available_balance.toString()) +
          parseFloat(transaction.amount.toString());

        await this.helperService.updateWallet(balance, transaction.user_id);

        await this.transactionRepository.update(
          { transaction_no: transaction.transaction_no },
          { status: 1, balance },
        );

        console.log('FINALLY');

        await this.callbacklogRepository.save({
          client_id: data.clientId,
          request: 'Completed',
          response: JSON.stringify(data.rawBody),
          status: 1,
          type: 'Webhook',
          transaction_id: data.rawBody.payload.reference,
          paymentMethod: 'Korapay',
        });
        return {
          statusCode: HttpStatus.OK,
          success: true,
          message: 'Transaction successfully verified and processed',
        };
      }

      return {
        success: false,
        message: 'Transaction not successful',
        statusCode: HttpStatus.BAD_REQUEST,
      };
    } catch (error) {
      console.error('Webhook processing error:', error);

      return {
        success: false,
        message: `Webhook handling failed: ${error.message}`,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }
  private async verifySignature(data): Promise<boolean> {
    const paymentSettings = await this.korapaySettings(data.clientId);

    const hash = crypto
      .createHmac('sha256', paymentSettings.secret_key)
      .update(data.body)
      .digest('hex');

    return hash === data.korapayKey;
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
