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
      const apiUrl = `${process.env.KORAPAY_API_URL}/charges/initialize`;
      const secretKey = process.env.KORAPAY_SECRET_KEY;

      if (!apiUrl || !secretKey) {
        throw new Error('Korapay API URL or Secret Key is missing');
      }

      const paymentSettings = await this.korapaySettings(client_id);
      if (!paymentSettings) {
        return {
          success: false,
          message: 'Korapay has not been configured for client',
        };
      }

      const payload = {
        reference: generateTrxNo(),
        ...data,
      };

      try {
        const response = await axios.post(apiUrl, payload, {
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.data) {
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
      const apiKey = process.env.KORAPAY_SECRET_KEY as string;
      const baseUrl = process.env.KORAPAY_API_URL as string;

      const paymentSettings = await this.korapaySettings(param.client_id);
      if (!paymentSettings)
        return {
          success: false,
          message: 'Korapay has not been configured for client',
        };

      const apiUrl = `${baseUrl}/charges/${param.reference}`;

      const resp = await axios.get(apiUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      const data = resp.data;

      if (data.status === 'success') {
        const transaction = await this.transactionRepository.findOne({
          where: {
            client_id: param.client_id,
            transaction_no: param.reference,
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

  async processWebhook(data) {
    try {
      const isValid = this.verifySignature(data);

      if (!isValid) {
        throw new BadRequestException('Invalid webhook signature');
      }

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
      console.error('Webhook processing error:', error.message);
      throw new BadRequestException(
        `Webhook handling failed: ${error.message}`,
      );
    }
  }
  private async verifySignature(data): Promise<boolean> {
    const paymentSettings = await this.korapaySettings(data.clientId);

    const hash = crypto
      .createHmac('sha256', paymentSettings.secret_key)
      .update(JSON.stringify(data.body))
      .digest('hex');

    return hash === data.korapayKey;
  }

  // Handlers for different webhook events
  private async handleChargeCompleted(data: any): Promise<void> {
    const transaction = await this.transactionRepository.findOne({
      where: { transaction_no: data.tx_ref },
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
