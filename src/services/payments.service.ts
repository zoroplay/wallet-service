/* eslint-disable prettier/prettier */
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { generateTrxNo } from 'src/common/helpers';
import { PaymentMethod } from 'src/entity/payment.method.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { Withdrawal } from 'src/entity/withdrawal.entity';
import { IdentityService } from 'src/identity/identity.service';
import {
  InitiateDepositResponse,
  InitiateDepositRequest,
  VerifyDepositRequest,
  VerifyBankAccountRequest,
  VerifyBankAccountResponse,
  CommonResponseObj,
  WalletTransferRequest,
  WayaQuickRequest,
  WayaBankRequest,
  SearhTransactionsRequest,
} from 'src/proto/wallet.pb';
import { HelperService } from 'src/services/helper.service';
import { PaystackService } from 'src/services/paystack.service';
import { LessThanOrEqual, Repository } from 'typeorm';
import { MonnifyService } from './monnify.service';
import * as dayjs from 'dayjs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Transaction } from 'src/entity/transaction.entity';
import { WayaQuickService } from './wayaquick.service';
import { WayaBankService } from './wayabank.service';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepository: Repository<Withdrawal>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private paystackService: PaystackService,
    private monnifyService: MonnifyService,
    private identityService: IdentityService,
    private wayaquickService: WayaQuickService,
    private wayabankService: WayaBankService,
    private helperService: HelperService,
  ) {}

  async inititateDeposit(
    param: InitiateDepositRequest,
  ): Promise<InitiateDepositResponse> {
    let transactionNo = generateTrxNo();
    let link = '',
      description;
    // console.log(param);
    // find user wallet
    // find wallet
    const wallet = await this.walletRepository
      .createQueryBuilder()
      .where('client_id = :clientId', { clientId: param.clientId })
      .andWhere('user_id = :user_id', { user_id: param.userId })
      .getOne();

    if (!wallet) return { success: false, message: 'Wallet not found' };

    // To-Do: Get user info
    const user = await this.identityService
      .getPaymentData({
        clientId: param.clientId,
        userId: param.userId,
        source: param.source,
      })
      .toPromise();

    // console.log(user);

    if (user.username === '')
      return { success: false, message: 'User does not exist' };

    try {
      switch (param.paymentMethod) {
        case 'paystack':
          const pRes: any = await this.paystackService.generatePaymentLink(
            {
              amount: param.amount * 100,
              email: user.email || `${user.username}@${user.siteUrl}`,
              reference: transactionNo,
              callback_url: user.callbackUrl + '/payment-verification/paystack',
            },
            param.clientId,
          );

          description = 'Online Deposit (Paystack)';
          if (!pRes.success) return pRes;

          link = pRes.data.authorization_url;

          break;
        case 'flutterwave':
          description = 'Online Deposit (Flutterwave)';
          break;
        case 'monnify':
          const mRes: any = await this.monnifyService.generatePaymentLink(
            {
              amount: param.amount,
              name: user.username,
              email: user.email || `${user.username}@${user.siteUrl}`,
              reference: transactionNo,
              callback_url: user.callbackUrl + '/payment-verification/monnify',
            },
            param.clientId,
          );

          description = 'Online Deposit (Monnify)';
          if (!mRes.success) return mRes;

          link = mRes.data;
          break;
        case 'mgurush':
          description = 'Online Deposit (mGurush)';
          break;
        case 'wayaquick':
          description = 'Online Deposit (Wayaquick)';
          const wRes: any = await this.wayaquickService.generatePaymentLink(
            {
              amount: param.amount,
              email: user.email || `${user.username}@${user.siteUrl}`,
              firstName: user.username,
              lastName: user.username,
              narration: description,
              phoneNumber: '0' + user.username,
            },
            param.clientId,
          );

          if (!wRes.success) return wRes;

          link = wRes.data.authorization_url;
          transactionNo = wRes.data.tranId;

          break;
        default:
          description = 'Shop Deposit';
          break;
      }

      await this.helperService.saveTransaction({
        amount: param.amount,
        channel: param.paymentMethod,
        clientId: param.clientId,
        toUserId: param.userId,
        toUsername: wallet.username,
        toUserBalance: wallet.available_balance,
        fromUserId: 0,
        fromUsername: 'System',
        fromUserbalance: 0,
        source: param.source,
        subject: 'Deposit',
        description,
        transactionNo,
      });

      return {
        success: true,
        message: 'Success',
        data: { transactionRef: transactionNo, link },
      };
    } catch (e) {
      // console.log(e.message);
      return { success: false, message: 'Unable to complete transaction' };
    }
  }

  async updateWithdrawalStatus({
    clientId,
    withdrawalId,
    action,
    comment,
    updatedBy,
  }): Promise<any> {
    try {
      const wRequest = await this.withdrawalRepository.findOne({
        where: { id: withdrawalId },
      });
      if (wRequest) {
        if (action === 'approve') {
          const paymentMethod = await this.paymentMethodRepository.findOne({
            where: { for_disbursement: 1 },
          });
          if (paymentMethod) {
            let resp: any = {
              success: false,
              message:
                'Unable to disburse funds with ' + paymentMethod.provider,
              status: HttpStatus.NOT_IMPLEMENTED,
            };
            switch (paymentMethod.provider) {
              case 'paystack':
                resp = await this.paystackService.disburseFunds(
                  wRequest,
                  clientId,
                );
                break;
              case 'mgurush':
                break;
              case 'monnify':
                break;
              case 'flutterwave':
                break;
              default:
                break;
            }
            // update withdrawal request
            if (resp.success)
              await this.withdrawalRepository.update(
                {
                  id: withdrawalId,
                },
                {
                  status: 1,
                  updated_by: updatedBy,
                },
              );

            // return response
            return resp;
          } else {
            return {
              success: false,
              message: 'No payment method has been setup for auto disbursement',
              status: HttpStatus.NOT_IMPLEMENTED,
            };
          }
        } else {
          // update withdrawal status
          await this.withdrawalRepository.update(
            {
              id: withdrawalId,
            },
            {
              status: 2,
              comment,
              updated_by: updatedBy,
            },
          );
          //return funds to user wallet
          const wallet = await this.walletRepository.findOne({
            where: {
              client_id: clientId,
              user_id: wRequest.user_id,
            },
          });

          const balance =
            parseFloat(wallet.available_balance.toString()) +
            parseFloat(wRequest.amount.toString());

          // update user balance
          await this.walletRepository.update(
            {
              id: wallet.id,
            },
            {
              available_balance: balance,
            },
          );

          await this.helperService.saveTransaction({
            amount: wRequest.amount,
            channel: 'internal',
            clientId,
            toUserId: wallet.user_id,
            toUsername: wallet.username,
            toUserBalance: balance,
            fromUserId: 0,
            fromUsername: 'System',
            fromUserbalance: 0,
            source: 'internal',
            subject: 'Rejected Request',
            description: comment || 'Withdrawal request was cancelled',
            transactionNo: generateTrxNo(),
            status: 1,
          });
          return {
            success: true,
            message: 'Withdrawal request updated',
            status: HttpStatus.CREATED,
          };
        }
      } else {
        return {
          success: false,
          message: 'Withdrawal request not found',
          status: HttpStatus.NOT_FOUND,
        };
      }
    } catch (e) {
      return {
        success: false,
        message: 'Unable to request status',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async wayaquickVerifyPayment(param: WayaQuickRequest) {
    try {
      const transaction = await this.transactionRepository.findOneBy({
        transaction_no: param.transactionId,
        user_id: param.userId,
        client_id: param.clientId,
        channel: 'wayaquick',
      });

      if (!transaction) {
        return {
          success: false,
          message: 'transaction id doesn`t exist',
          status: HttpStatus.BAD_REQUEST,
        };
      }
      const transact = await this.wayaquickService.verifyTransaction(param);

      if (!transact.success) {
        return {
          success: false,
          message: transact.message,
          status: HttpStatus.BAD_REQUEST,
        };
      }
      return {
        success: true,
        message: 'Success',
        data: transact.data,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error verifying account',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  /**
   * Function: verifyPayment
   * Description: function to verify user payment
   * @param Request $request
   * @return \Illuminate\Http\JsonResponse
   */
  async verifyDeposit(param: VerifyDepositRequest) {
    try {
      if (param.transactionRef !== 'undefined') {
        switch (param.paymentChannel) {
          case 'paystack':
            return this.paystackService.verifyTransaction(param);
          case 'monnify':
            return this.monnifyService.verifyTransaction(param);
          case 'flutterwave':
            break;
          default:
            break;
        }
      }
    } catch (e) {
      console.log('Error', e.message);
      return {
        success: false,
        message: 'Internal Server error',
        status: HttpStatus.BAD_REQUEST,
      };
    }
  }

  async verifyBankAccount(
    param: VerifyBankAccountRequest,
  ): Promise<VerifyBankAccountResponse> {
    try {
      // find payment method for withdrawal
      const paymentMethod = await this.paymentMethodRepository.findOne({
        where: {
          client_id: 1,
          for_disbursement: 1,
        },
      });
      if (!paymentMethod)
        return {
          success: false,
          status: HttpStatus.NOT_FOUND,
          message: 'No payment method is active for disbursement',
        };
      // To-Do: Get user info
      const user = await firstValueFrom(
        this.identityService.getUserDetails({
          clientId: param.clientId,
          userId: param.userId,
        }),
      );

      if (!user.data.firstName || user.data.firstName === '')
        return {
          success: false,
          message: 'Please update your profile details to proceed',
          status: HttpStatus.NOT_FOUND,
        };

      const firstname = user.data.firstName?.toLowerCase();
      const lastname = user.data.lastName?.toLowerCase();

      let resp, name, names;
      switch (paymentMethod.provider) {
        case 'paystack':
          resp = await this.paystackService.resolveAccountNumber(
            param.clientId,
            param.accountNumber,
            param.bankCode,
          );
          if (resp.success) {
            names = resp.data.account_name.toLowerCase().split(' ');
            name = resp.data.account_name;
          } else {
            return {
              success: false,
              status: HttpStatus.NOT_FOUND,
              message:
                'Could not resolve account name. Check parameters or try again',
            };
          }

        case 'flutterwave':
          break;
        case 'monnify':
          break;
        default:
          break;
      }

      if (
        name.toLowerCase().includes(firstname) ||
        name.toLowerCase().includes(lastname)
      ) {
        return {
          success: true,
          message: name,
          status: HttpStatus.OK,
        };
      } else {
        return {
          success: false,
          message: 'Your bank account names does not match your name on file',
          status: HttpStatus.NOT_FOUND,
        };
      }
    } catch (err) {
      console.log(err);
      return {
        success: false,
        message: 'Error verifying account',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async wayabankAccountEnquiry(param: WayaBankRequest) {
    try {
      const wallet = await this.walletRepository
        .createQueryBuilder()
        .where('client_id = :clientId', { clientId: param.clientId })
        .andWhere('user_id = :user_id', { user_id: param.userId })
        .getOne();
      if (!wallet) return { success: false, message: 'Wallet not found' };
      if (!wallet.virtual_accountNo)
        return {
          success: false,
          message: 'Virtual account not found, proceed to create',
        };

      const res = await this.wayabankService.accountEnquiry({
        accountNumber: wallet.virtual_accountNo,
      });
      if (!res.success) return res;
      if (res.success) {
        await this.walletRepository.update(wallet.id, {
          virtual_branchId: res.data.branchId,
          virtual_accountNo: res.data.accountNo,
          virtual_accountName: res.data.accountName,
          virtual_balance: res.data.balance,
          virtual_accountDefault: res.data.accountDefault,
          virtual_nubanAccountNo: res.data.nubanAccountNo,
          virtual_acctClosureFlag: res.data.acctClosureFlag,
          virtual_acctDeleteFlag: res.data.acctDeleteFlag,
        });
      }

      return {
        success: true,
        message: 'Virtual account found and wallet updated',
      };
    } catch (error) {
      return { success: false, message: 'Unable to complete transaction' };
    }
  }
  async createVirtualAccount(param: WayaBankRequest) {
    try {
      const wallet = await this.walletRepository
        .createQueryBuilder()
        .where('client_id = :clientId', { clientId: param.clientId })
        .andWhere('user_id = :user_id', { user_id: param.userId })
        .getOne();
      if (!wallet) return { success: false, message: 'Wallet not found' };
      const user = await firstValueFrom(
        this.identityService.getUserDetails({
          clientId: param.clientId,
          userId: param.userId,
        }),
      );

      const res = await this.wayabankService.createVirtualAccount({
        user: user.data,
      });
      if (!res.success) return res;
      if (res.success) {
        await this.walletRepository.update(wallet.id, {
          virtual_branchId: res.data.branchId,
          virtual_accountNo: res.data.accountNo,
          virtual_accountName: res.data.accountName,
          virtual_balance: res.data.balance,
          virtual_accountDefault: res.data.accountDefault,
          virtual_nubanAccountNo: res.data.nubanAccountNo,
          virtual_acctClosureFlag: res.data.acctClosureFlag,
          virtual_acctDeleteFlag: res.data.acctDeleteFlag,
        });
      }

      return {
        success: true,
        message: 'Virtual account created and wallet updated',
      };
    } catch (error) {
      return { success: false, message: 'Unable to complete transaction' };
    }
  }

  async walletTransfer(
    payload: WalletTransferRequest,
  ): Promise<CommonResponseObj> {
    try {
      const {
        clientId,
        fromUserId,
        fromUsername,
        toUserId,
        toUsername,
        action,
        amount,
        description,
      } = payload;
      // find initiator wallet
      let fromWallet = await this.walletRepository.findOne({
        where: { user_id: fromUserId, client_id: clientId },
      });
      // find receiver wallet
      let toWallet = await this.walletRepository.findOne({
        where: { user_id: toUserId, client_id: clientId },
      });

      if (!fromWallet) {
        return {
          success: false,
          message: 'Wallet not found',
          status: HttpStatus.NOT_FOUND,
        };
      }

      // check if user balance is sufficent
      if (fromWallet.available_balance < amount) {
        return {
          success: false,
          message: 'Insufficent balance',
          status: HttpStatus.BAD_REQUEST,
        };
      }
      // debit from user wallet
      const senderBalance = fromWallet.available_balance - amount;
      // credit receiver balance
      const receiverBalance =
        Number(toWallet.available_balance) + Number(amount);

      //update wallets
      await this.walletRepository.update(
        {
          user_id: fromUserId,
        },
        {
          available_balance: senderBalance,
        },
      );

      await this.walletRepository.update(
        {
          user_id: toUserId,
        },
        {
          available_balance: receiverBalance,
        },
      );

      await this.helperService.saveTransaction({
        amount,
        channel: 'retail',
        clientId,
        toUserId,
        toUsername,
        toUserBalance: receiverBalance,
        fromUserId,
        fromUsername,
        fromUserbalance: senderBalance,
        source: 'internal',
        subject: 'Funds Transfer',
        description: description || 'Inter account transfer',
        transactionNo: generateTrxNo(),
      });

      return {
        success: true,
        message: 'Transaction successful',
        status: HttpStatus.OK,
        data: {
          balance: action === 'deposit' ? senderBalance : receiverBalance,
        },
      };
    } catch (e) {
      console.log('error', e.message);
      return {
        success: false,
        message: 'Unable to process request',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async checkNoOfWithdrawals(userId) {
    const today = dayjs().format('YYYY-MM-DD');

    return await this.withdrawalRepository
      .createQueryBuilder('withdrawals')
      .where('user_id = :userId', { userId })
      .where('status = :status', { status: 1 })
      .andWhere('DATE(created_at) >= :today', { today })
      .getCount();
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async cancelPendingDepit() {
    const now = dayjs().subtract(7, 'minutes').format('YYYY-MM-DD HH:mm:ss');
    //delete pending transactions after 15mins
    await this.transactionRepository.update(
      {
        created_at: LessThanOrEqual(now),
        status: 0,
      },
      {
        status: 2,
      },
    );
    // console.log('transactions', transactions);
  }
}
