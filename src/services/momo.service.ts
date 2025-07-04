import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Repository } from 'typeorm';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import { HelperService } from './helper.service';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { CallbackLog } from 'src/entity/callback-log.entity';

@Injectable()
export class MomoService {
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
    //private identityService: IdentityService,

    @InjectRepository(CallbackLog)
    private callbacklogRepository: Repository<CallbackLog>,

    private helperService: HelperService,
  ) {}

  private async mtnmomoSettings(client_id: number) {
    return await this.paymentMethodRepository.findOne({
      where: { provider: 'mtnmomo', client_id },
    });
  }

  async initiatePayment(data, client_id) {
    try {
      const referenceId = uuidv4();
      const callbackUrl =
        client_id === 4
          ? `https://api.staging.sportsbookengine.com/api/v2/webhook/4/mtnmomo/callback`
          : `https://api.prod.sportsbookengine.com/api/v2/webhook/${client_id}/mtnmomo/callback`;

      const paymentSettings = await this.mtnmomoSettings(client_id);
      if (!paymentSettings)
        return {
          success: false,
          message: 'Tigo has not been configured for client',
        };

      console.log('CHECK_1');
      // Step 1: Create API User
      await axios.post(
        `${paymentSettings.base_url}/v1_0/apiuser`,
        {
          providerCallbackHost: 'api.staging.sportsbookengine.com',
        },
        {
          headers: {
            'X-Reference-Id': referenceId,
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': paymentSettings.secret_key,
          },
        },
      );

      console.log('DATA:::', referenceId);

      console.log('CHECK_2');

      // Step 2: Generate API Key
      const apiKeyResponse = await axios.post(
        `${paymentSettings.base_url}/v1_0/apiuser/${referenceId}/apikey`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': paymentSettings.secret_key,
          },
        },
      );
      const apiKey = apiKeyResponse.data.apiKey;
      console.log('CHECK_3');

      // Step 3: Get Access Token
      const tokenResponse = await axios.post(
        `${paymentSettings.base_url}/collection/token/`,
        {
          providerCallbackHost: 'http://api.staging.sportsbookengine.com',
        },
        {
          auth: {
            username: referenceId,
            password: apiKey,
          },
          headers: {
            'Ocp-Apim-Subscription-Key': paymentSettings.secret_key,
            'Content-Type': 'application/json',
          },
        },
      );
      const token = tokenResponse.data.access_token;

      console.log('TOKEN:::::', token);
      console.log('CHECK_4');

      // Step 4: Prepare payment payload
      const payload = {
        ...data,

        payerMessage: 'Online Deposit (Mtn-momo)',
        payeeNote: 'Online Deposit (Mtn-momo)',
        payer: {
          partyIdType: 'MSISDN',
          partyId: data.payer.partyId.replace('+', ''),
        },
      };
      const paymentId = uuidv4();

      // Step 5: Send Payment Request
      console.log('CHECK_5');
      const response = await axios.post(
        `${paymentSettings.base_url}/collection/v1_0/requesttopay`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Reference-Id': paymentId,
            'X-Target-Environment': 'sandbox',
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': paymentSettings.secret_key,
            'X-Callback-Url':
              'http://api.staging.sportsbookengine.com/api/v2/webhook/4/mtnmomo/callback',
          },
        },
      );

      return {
        success: true,
        message: 'Payment request successfully submitted. Awaiting processing.',
        paymentId,
        externalId: payload.externalId,
        status: response.status,
      };
    } catch (error) {
      console.error(
        '❌ Error during MTN-MOMO payment initiation:',
        error.response?.data || error.message,
      );
      return {
        success: false,
        message: 'Payment request failed',
        error: error.response?.data || error.message,
      };
    }
  }

  async handleWebhook(data) {
    const status = data.status;

    const externalId = data.externalId;
    const clientId = data.clientId;

    try {
      const paymentSettings = await this.mtnmomoSettings(data.clientId);
      if (!paymentSettings)
        return {
          success: false,
          message: 'Mtn MOMO has not been configured for client',
        };
      console.log('TEST 2');
      const transaction = await this.transactionRepository.findOne({
        where: {
          client_id: clientId,
          transaction_no: externalId,
          tranasaction_type: 'credit',
        },
      });

      console.log('TRX', transaction);

      if (status === 'SUCCESSFUL') {
        if (!transaction) {
          await this.callbacklogRepository.save({
            client_id: data.clientId,
            request: 'Transaction not found',
            response: JSON.stringify(data.rawBody),
            status: 0,
            type: 'Webhook',
            transaction_id: data.externalId,
            paymentMethod: 'Mtnmomo',
          });

          return {
            success: false,
            message: 'Transaction not found',
            status: HttpStatus.NOT_FOUND,
          };
        }

        if (transaction.status === 1) {
          await this.callbacklogRepository.save({
            client_id: data.clientId,
            request: 'Transaction already successful',
            response: JSON.stringify(data.rawBody),
            status: 1,
            type: 'Webhook',
            transaction_id: data.externalId,
            paymentMethod: 'Mtnmomo',
          });
          return {
            success: true,
            message: 'Transaction already successful',
          };
        }

        const wallet = await this.walletRepository.findOne({
          where: { user_id: transaction.user_id },
        });

        console.log('🔍 Found Wallet:', JSON.stringify(wallet, null, 2));

        if (!wallet) {
          console.error(
            '❌ Wallet not found for user_id:',
            transaction.user_id,
          );
          await this.callbacklogRepository.save({
            client_id: data.clientId,
            request: 'Wallet not found',
            response: JSON.stringify(data.rawBody),
            status: 0,
            type: 'Webhook',
            transaction_id: data.externalId,
            paymentMethod: 'Mtnmomo',
          });
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

        await this.callbacklogRepository.save({
          client_id: data.clientId,
          request: 'Completed',
          response: JSON.stringify(data.rawBody),
          status: 1,
          type: 'Webhook',
          transaction_id: data.externalId,
          paymentMethod: 'Mtnmomo',
        });

        console.log('COMPLETED');

        return {
          success: true,
          message: 'Transaction successfully verified and processed',
        };
      }
    } catch (error) {
      console.log('Tigo error', error);
      return { success: false, message: 'error occurred' };
    }
  }
}
