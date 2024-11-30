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
  ) {}

  private async korapaySettings(client_id: number) {
    return await this.paymentMethodRepository.findOne({
      where: { provider: 'flutterwave', client_id },
    });
  }

  async createPayment(data) {
    try {
      const apiUrl = `${process.env.KORAPAY_API_URL}/charges/initialize`;
      const secretKey = process.env.KORAPAY_SECRET_KEY;

      if (!apiUrl || !secretKey) {
        throw new Error('Korapay API URL or Secret Key is missing');
      }

      const paymentSettings = await this.korapaySettings(data.client_id);
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

  async verifyTransaction(reference: string, client_id: number) {
    try {
      const apiKey = process.env.KORAPAY_SECRET_KEY as string;
      const baseUrl = process.env.KORAPAY_API_URL as string;

      const paymentSettings = await this.korapaySettings(client_id);
      if (!paymentSettings)
        return {
          success: false,
          message: 'Korapay has not been configured for client',
        };

      const apiUrl = `${baseUrl}/charges/${reference}`;

      const resp = await axios.get(apiUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      const data = resp.data;

      if (data.status === 'success') {
        const transaction = await this.transactionRepository.findOne({
          where: {
            client_id,
            transaction_no: reference,
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
}
