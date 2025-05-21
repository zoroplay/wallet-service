import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Repository } from 'typeorm';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import { HelperService } from './helper.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { IdentityService } from 'src/identity/identity.service';
import * as crypto from 'crypto';

@Injectable()
export class CoralPayService {
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
    private identityService: IdentityService,

    private helperService: HelperService,
  ) {}

  private async coralPaySettings(client_id: number) {
    return await this.paymentMethodRepository.findOne({
      where: { provider: 'coralpay', client_id },
    });
  }

  private generateSignature(merchantId, traceId, timeStamp, key) {
    const raw = `${merchantId}${traceId}${timeStamp}${key}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  async initiatePayment(data, client_id) {
    try {
      const settings = await this.coralPaySettings(client_id);

      if (!settings) {
        return {
          success: false,
          message: 'Coralpay has not been configured for client',
        };
      }
      console.log('Initiating CoralPay payment...');

      const authResponse = await axios.post(
        `${settings.base_url}/Authentication`,
        {
          username: `${settings.public_key}`,
          password: `${settings.secret_key}`,
        },
      );

      const { token, key } = authResponse.data;

      const merchantId = settings.merchant_id;

      const timeStamp = Math.floor(Date.now() / 1000);

      const signature = await this.generateSignature(
        merchantId,
        data.traceId,
        timeStamp,
        key,
      );

      console.log('SIGNATURE', signature);

      const payload = {
        requestHeader: {
          merchantId: merchantId,
          timeStamp: timeStamp,
          signature: signature,
        },
        ...data,
      };

      const res = await axios.post(
        `${settings.base_url}/InvokePayment`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      console.log('Payment Link DATA:', res.data.payPageLink);

      return { success: true, data: res.data.payPageLink };
    } catch (error) {
      console.error(
        '❌ Error during CoralPay payment initiation:',
        error.res?.data || error.message,
      );
      return {
        success: false,
        message: 'Payment request failed',
        error: error.res?.data || error.message,
      };
    }
  }

  async handleWebhook(param) {
    try {
      const settings = await this.coralPaySettings(param.client_id);

      if (!settings) {
        return {
          success: false,
          message: 'Coralpay has not been configured for client',
        };
      }
      console.log(param);

      const authValid = this.verifyBasicAuth(
        param.authHeader,
        settings.public_key,
        settings.secret_key,
      );
      if (!authValid) {
        return {
          success: false,
          message: 'Invalid credentials',
        };
      }

      // 3. Validate payload structure
      const validationError = this.validateCallbackPayload(param.callbackData);
      if (validationError) {
        return {
          success: false,
          message: validationError,
        };
      }
      console.log(param.callbackData.ResponseMessage === 'Successful');
      console.log(param.callbackData.ResponseCode === '00');
      if (
        param.callbackData.ResponseMessage === 'Successful' &&
        param.callbackData.ResponseCode === '00'
      ) {
        console.log('I GOT BEFORE TRX ');

        const transaction = await this.transactionRepository.findOne({
          where: {
            client_id: param.clientId,
            transaction_no: param.callbackData.TraceId,
            tranasaction_type: 'credit',
          },
        });

        if (!transaction) {
          return {
            success: false,
            message: 'Transaction not found',
            statusCode: HttpStatus.NOT_FOUND,
          };
        }

        if (transaction.status === 1) {
          console.log('ℹ️ Transaction already marked successful.');
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
        return {
          statusCode: HttpStatus.OK,
          success: true,
          message: 'Transaction successfully verified and processed',
        };
      }
      // 4. Verify signature
    } catch (error) {
      console.error('❌ OPay webhook processing error:', error.message);
      return {
        success: false,
        message: 'Error occurred during processing',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  private verifyBasicAuth(
    authHeader: string,
    username: string,
    password: string,
  ): boolean {
    if (!authHeader) return false;

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString(
      'ascii',
    );
    const [authUsername, authPassword] = credentials.split(':');

    return authUsername === username && authPassword === password;
  }

  private validateCallbackPayload(data: any): string | null {
    const requiredFields = [
      'MerchantId',
      'TraceId',
      'TransactionId',
      'Amount',
      'ResponseCode',
      'Signature',
      'TimeStamp',
    ];

    for (const field of requiredFields) {
      if (!data[field]) {
        return `Missing required field: ${field}`;
      }
    }

    return null;
  }

  private async verifySignature(
    data: any,
    secretKey: string,
  ): Promise<boolean> {
    const signatureBase = `${data.MerchantId}${data.TraceId}${data.TimeStamp}`;
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(signatureBase)
      .digest('hex');

    const isValid = data.Signature === expectedSignature;

    if (!isValid) {
      console.error('❌ Invalid Signature', {
        expected: expectedSignature,
        received: data.Signature,
      });
    }

    return isValid;
  }

  async verifyTransaction(param) {
    try {
      // const paymentSettings = await this.pawapaySettings(param.client_id);
      // if (!paymentSettings)
      //   return {
      //     success: false,
      //     message: 'PawaPay has not been configured for client',
      //   };

      console.log(param);

      console.log(param.transactionRef);

      if (param.transactionRef !== '') {
        const transaction = await this.transactionRepository.findOne({
          where: {
            client_id: param.clientId,
            transaction_no: param.transactionRef,
            tranasaction_type: 'credit',
          },
        });
        console.log('TRX', transaction.transaction_no);
        console.log('TRX', transaction);

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

        console.log('🔍 Found Wallet:', JSON.stringify(wallet, null, 2));

        if (!wallet) {
          console.error(
            '❌ Wallet not found for user_id:',
            transaction.user_id,
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

        await this.helperService.updateWallet(balance, transaction.user_id);
        await this.transactionRepository.update(
          { transaction_no: transaction.transaction_no },
          { status: 1, balance },
        );

        return {
          success: true,
          message: 'Transaction successfully verified and processed',
        };
      }
    } catch (error) {
      console.log(error);
      return {
        success: false,
        message: `Unable to verify transaction: ${error.message}`,
      };
    }
  }
}
