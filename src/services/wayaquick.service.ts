/* eslint-disable prettier/prettier */
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { IdentityService } from 'src/identity/identity.service';
import { VerifyDepositRequest } from 'src/proto/wallet.pb';
import { Repository } from 'typeorm';
import * as WayaQuickRestClient from 'wayaquick-payment';
import { HelperService } from './helper.service';
@Injectable()
export class WayaQuickService {
  private wayaQuickClient: WayaQuickRestClient;

  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,

    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,

    private helperService: HelperService,
    private identityService: IdentityService,
  ) {}

  async generatePaymentLink(paymentData, client_id) {
    const paymentSettings = await this.getSettings(client_id);
    try {
      this.wayaQuickClient = await new WayaQuickRestClient(
        paymentSettings.merchant_id,
        paymentSettings.public_key,
        'PRODUCTION',
      );

      const res = await this.wayaQuickClient.initializePayment(paymentData);
      if (!res.status)
        return {
          success: false,
          message: res.message,
        };

      return { success: true, data: res.data, message: res.message };
    } catch (e) {
      return {
        success: false,
        message: 'Unable to initiate deposit with wayaquick',
      };
    }
  }

  async verifyTransaction(param: VerifyDepositRequest) {
    try {
      // get wayaquick payment settings
      const paymentSettings = await this.getSettings(param.clientId);

      // initialize wayaquck client
      this.wayaQuickClient = await new WayaQuickRestClient(
        paymentSettings.merchant_id,
        paymentSettings.public_key,
        'PRODUCTION',
      );

      // verify transaction with wayaquick
      const res = await this.wayaQuickClient.verifyPayment(
        param.transactionRef,
      );
      // if transaction is valid with wayaquick, proceed
      if (res.status && res.data.Status === 'SUCCESSFUL') {
        // fetch transaction internally
        const transaction = await this.transactionRepository.findOne({
          where: {
            client_id: param.clientId,
            transaction_no: param.transactionRef,
            tranasaction_type: 'credit',
          },
        });

        // console.log('transaction, res:', transaction, res);

        if (!transaction) // if not transaction, return error
          return {
            success: false,
            message: 'Transaction not found',
            status: HttpStatus.NOT_FOUND,
          };

      
          // if transaction is already successful, return success message
        if (transaction.status === 1)
          return {
            success: true,
            message: 'Transaction was successful',
            status: HttpStatus.OK,
          };
        // if transaction has been settled, return message
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
            },
          );

          try {
            const keys = await this.identityService.getTrackierKeys({
              itemId: param.clientId,
            });
            if (keys.success) {
              // send deposit to trackier
              await this.helperService.sendActivity(
                {
                  subject: 'Deposit',
                  username: transaction.username,
                  amount: transaction.amount,
                  transactionId: transaction.transaction_no,
                  clientId: param.clientId,
                },
                keys.data,
              );
            }
          } catch (e) {
            console.log('Trackier error: Wayaquick Line 110', e.message);
          }

          return {
            success: true,
            message: 'Transaction was successful',
            status: HttpStatus.OK,
          };
        }
      } else {
        await this.transactionRepository.update(
          {
            transaction_no: param.transactionRef,
          },
          {
            status: 2,
          },
        );
        return {
          success: false,
          message: `Transaction was not successful`,
          status: HttpStatus.BAD_REQUEST,
        };
      }
    } catch (e) {
      console.log(e.message);
      return {
        success: false,
        message: 'Error occured while verifying transaction',
      };
    }
  }

  private async getSettings(client_id: number) {
    return await this.paymentMethodRepository.findOne({
      where: {
        provider: 'wayaquick',
        client_id,
      },
    });
  }
}
