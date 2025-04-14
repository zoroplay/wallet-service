/* eslint-disable prettier/prettier */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unused-vars */
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
  PawapayCountryRequest,
  WayaBankRequest,
  PawapayToolkitRequest,
  FetchPawapayRequest,
} from 'src/proto/wallet.pb';
import { HelperService } from 'src/services/helper.service';
import { PaystackService } from 'src/services/paystack.service';
import { LessThanOrEqual, Not, Repository } from 'typeorm';
import { MonnifyService } from './monnify.service';
import * as dayjs from 'dayjs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Transaction } from 'src/entity/transaction.entity';
import { PawapayService } from './pawapay.service';
import { v4 as uuidv4 } from 'uuid';
import { WayaQuickService } from './wayaquick.service';
import { WayaBankService } from './wayabank.service';
import { Pitch90SMSService } from './pitch90sms.service';
import { FlutterwaveService } from './flutterwave.service';
import { KorapayService } from './kora.service';
import { TigoService } from './tigo.service';

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
    private pawapayService: PawapayService,
    private monnifyService: MonnifyService,
    private identityService: IdentityService,
    private wayaquickService: WayaQuickService,
    private wayabankService: WayaBankService,
    private helperService: HelperService,
    private pitch90smsService: Pitch90SMSService,
    private flutterwaveService: FlutterwaveService,
    private korapayService: KorapayService,
    private tigoService: TigoService,
  ) {}

  async inititateDeposit(
    param: InitiateDepositRequest,
  ): Promise<InitiateDepositResponse> {
    // let transactionNo = generateTrxNo();
    let transactionNo: string;
    let link = '',
      description,
      status = 0;
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
    console.log('CHECK');

    try {
      switch (param.paymentMethod) {
        case 'paystack':
          transactionNo = generateTrxNo();
          const pRes: any = await this.paystackService.generatePaymentLink(
            {
              amount: param.amount * 100,
              email: user.email,
              reference: transactionNo,
              callback_url: user.callbackUrl + '/payment-verification/paystack',
            },
            param.clientId,
          );

          description = 'Online Deposit (Paystack)';
          if (!pRes.success) return pRes;

          link = pRes.data.authorization_url;

          break;
        case 'pawapay':
          console.log(user.callbackUrl);
          console.log(user.siteUrl);
          console.log(user.currency);
          const depositId = uuidv4(); // Use UUID for pawaPay
          transactionNo = depositId;
          const res = await this.pawapayService.generatePaymentLink(
            {
              depositId: depositId,
              amount: param.amount.toString(),
              returnUrl: user.callbackUrl + '/payment-verification/pawapay',
              reason: 'Pawapay Deposit',
            },
            param.clientId,
          );

          description = 'Online Deposit (Pawapay)';

          if (!res.success) return res as any;

          link = res.data;

          break;

        case 'flutterwave':
          transactionNo = generateTrxNo();
          const result = await this.flutterwaveService.createPayment(
            {
              amount: param.amount,
              tx_ref: transactionNo,
              currency: user.currency || 'NGN',
              redirect_url:
                user.callbackUrl + '/payment-verification/flutterwave',
              customer: {
                email: user.email,
                phone_number: '+234' + user.username,
              },
            },
            param.clientId,
          );
          description = 'Online Deposit (Flutterwave)';
          if (!result.success) return result as any;
          console.log(result);

          link = result.data.link;

          break;

        case 'korapay':
          console.log('KORAPAY');
          transactionNo = generateTrxNo();
          const koraRes = await this.korapayService.createPayment(
            {
              amount: param.amount,
              reference: transactionNo,
              currency: user.currency || 'NGN',
              redirect_url: user.callbackUrl + '/payment-verification/korapay',

              channels: ['card', 'bank_transfer'],
              default_channel: 'card',
              metadata: {
                clientId: param.clientId,
              },
              narration: 'Online Deposit (Korapay)',
              customer: {
                email: user.email,
              },
              merchant_bears_cost: false,
            },
            param.clientId,
          );

          description = 'Online Deposit (Korapay)';
          if (!koraRes.success) return koraRes as any;

          link = koraRes.data.link;
          console.log(link);
          console.log(koraRes);

          break;

        case 'tigo':
          console.log('TIGO_PAYMENT');
          description = 'Online Deposit (Tigo )';
          transactionNo = generateTrxNo();
          const tigoRes = await this.tigoService.initiatePayment(
            {
              CustomerMSISDN: user.username, // '255713123892',
              Amount: param.amount,
              Remarks: description,
              ReferenceID: `${'KML'}${transactionNo}`,
            },
            param.clientId,
          );

          if (!tigoRes.ResponseStatus) {
            return {
              success: false,
              message: tigoRes.ResponseDescription || 'Tigo payment failed',
            };
          }

          link = tigoRes;
          console.log(tigoRes.ReferenceID);
          console.log('THE_LINK', JSON.stringify(link, null, 2));
          console.log('THE_RES', JSON.stringify(tigoRes, null, 2));
          break;

        case 'monnify':
          transactionNo = generateTrxNo();
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
              amount: `${param.amount.toFixed(2)}`,
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
        case 'stkpush':
          transactionNo = generateTrxNo();
          const stkRes = await this.pitch90smsService.deposit({
            amount: param.amount,
            user,
            clientId: param.clientId,
          });

          if (!stkRes.success) return stkRes;

          transactionNo = stkRes.data.ref_id;

          description = 'Online Deposit (StkPush)';

          break;
        default:
          transactionNo = generateTrxNo();
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
        status,
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
      console.log(e.message);

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
        switch (action) {
          case 'approve':
            const paymentMethod = await this.paymentMethodRepository.findOne({
              where: { for_disbursement: 1, client_id: clientId },
            });
            console.log(paymentMethod);
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
                case 'stkpush':
                  resp = await this.pitch90smsService.withdraw(
                    wRequest,
                    clientId,
                  );
                  break;
                case 'monnify':
                  break;
                case 'flutterwave':
                  break;
                default:
                  break;
              }
              // update withdrawal request status
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
                message:
                  'No payment method has been setup for auto disbursement',
                status: HttpStatus.NOT_IMPLEMENTED,
              };
            }
          case 'cancel':
            await this.withdrawalRepository.update(
              {
                id: withdrawalId,
              },
              {
                status: 3,
                comment,
                updated_by: updatedBy,
              },
            );
            //return funds to user wallet
            const _wallet = await this.walletRepository.findOne({
              where: {
                client_id: clientId,
                user_id: wRequest.user_id,
              },
            });

            const _balance =
              parseFloat(_wallet.available_balance.toString()) +
              parseFloat(wRequest.amount.toString());

            // update user balance
            await this.walletRepository.update(
              {
                id: _wallet.id,
              },
              {
                available_balance: _balance,
              },
            );

            await this.helperService.saveTransaction({
              amount: wRequest.amount,
              channel: 'internal',
              clientId,
              toUserId: _wallet.user_id,
              toUsername: _wallet.username,
              toUserBalance: _balance,
              fromUserId: 0,
              fromUsername: 'System',
              fromUserbalance: 0,
              source: 'internal',
              subject: 'Cancelled Request',
              description: comment || 'Withdrawal request was cancelled',
              transactionNo: generateTrxNo(),
              status: 1,
            });
            return {
              success: true,
              message: 'Withdrawal request caancelled',
              status: HttpStatus.CREATED,
            };

          default:
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

  // async pitch90RegisterUrl(param: Pitch90RegisterUrlRequest) {
  //   try {
  //     const res = await this.pitch90smsService.registerUrl(param);
  //     if (!res) return res;
  //     return {
  //       success: true,
  //       data: res.data,
  //       message: res.message,
  //     };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: 'Error verifying account',
  //       status: HttpStatus.INTERNAL_SERVER_ERROR,
  //     };
  //   }
  // }

  // async pitch90Transaction(param: Pitch90TransactionRequest) {
  //   try {
  //     const wallet = await this.walletRepository
  //       .createQueryBuilder()
  //       .where('client_id = :clientId', { clientId: param.clientId })
  //       .andWhere('user_id = :user_id', { user_id: param.userId })
  //       .getOne();

  //     if (!wallet) return { success: false, message: 'Wallet not found' };

  //     const user = await this.identityService
  //       .getPaymentData({
  //         clientId: param.clientId,
  //         userId: param.userId,
  //         source: param.source,
  //       })
  //       .toPromise();

  //     let subject, transactionNo, res;
  //     switch (param.action) {
  //       case 'deposit':
  //         res = await this.pitch90smsService.stkPush({
  //           amount: param.amount,
  //           user,
  //         });
  //         if (!res.success) return res;
  //         transactionNo = res.data.ref_id;
  //         subject = 'Pitch90 Deposit';
  //         break;
  //       case 'withdrawal':
  //         res = await this.pitch90smsService.withdraw({
  //           amount: param.amount,
  //           user,
  //         });
  //         if (!res.success) return res;
  //         transactionNo = res.data.ref_id;
  //         subject = 'Pitch90 Withdrawal';
  //         break;

  //       default:
  //         break;
  //     }
  //     await this.helperService.saveTransaction({
  //       amount: param.amount,
  //       channel: 'pawapay',
  //       clientId: param.clientId,
  //       toUserId: param.userId,
  //       toUsername: wallet.username,
  //       toUserBalance: wallet.available_balance,
  //       fromUserId: 0,
  //       fromUsername: 'System',
  //       fromUserbalance: 0,
  //       source: param.source,
  //       subject,
  //       description: res.data.status,
  //       transactionNo,
  //     });
  //     return {
  //       success: true,
  //       message: 'Success',
  //       data: { transactionRef: transactionNo },
  //     };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: 'Error verifying account',
  //       status: HttpStatus.INTERNAL_SERVER_ERROR,
  //     };
  //   }
  // }

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
          case 'wayaquick':
            return this.wayaquickService.verifyTransaction(param);
          case 'flutterwave':
            return this.flutterwaveService.verifyTransaction(param);
          case 'korapay':
            return this.korapayService.verifyTransaction(param);
          case 'pawapay':
            return this.pawapayService.verifyTransaction(param);
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
        parseFloat(toWallet.available_balance.toString()) +
        parseFloat(amount.toFixed());

      //update send balance
      await this.walletRepository.update(
        {
          user_id: fromUserId,
        },
        {
          available_balance: senderBalance,
        },
      );
      // update receiver balance
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
        status: 1,
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
        channel: Not('sbengine'),
      },
      {
        status: 2,
      },
    );
    // console.log('transactions', transactions);
  }

  async createBulkPayout(param) {
    try {
      const wallet = await this.walletRepository
        .createQueryBuilder()
        .where('client_id = :clientId', { clientId: param.clientId })
        .andWhere('user_id = :user_id', { user_id: param.userId })
        .getOne();

      if (!wallet) return { success: false, message: 'Wallet not found' };

      const user = await this.identityService
        .getPaymentData({
          clientId: param.clientId,
          userId: param.userId,
          source: param.source,
        })
        .toPromise();
      const res = await this.pawapayService.createBulkPayout({
        user,
        amounts: param.amount,
        operator: param.operator,
        clientId: param.clientId,
      });

      if (!res.success) return res;
      await Promise.all(
        res.transactionRefs.map(async (_data) => {
          return await this.helperService.saveTransaction({
            amount: Number(_data.amount),
            channel: 'pawapay',
            clientId: param.clientId,
            toUserId: param.userId,
            toUsername: wallet.username,
            toUserBalance: wallet.available_balance,
            fromUserId: 0,
            fromUsername: 'System',
            fromUserbalance: 0,
            source: param.source,
            subject: 'bulk payouts',
            description: _data.status,
            transactionNo: _data.transactionRef,
          });
        }),
      );

      return {
        success: true,
        message: 'Success',
        data: res.transactionRefs,
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async createRequest(param) {
    try {
      const wallet = await this.walletRepository
        .createQueryBuilder()
        .where('client_id = :clientId', { clientId: param.clientId })
        .andWhere('user_id = :user_id', { user_id: param.userId })
        .getOne();

      if (!wallet) return { success: false, message: 'Wallet not found' };

      const user = await this.identityService
        .getPaymentData({
          clientId: param.clientId,
          userId: param.userId,
          source: param.source,
        })
        .toPromise();

      let subject, transactionNo, res;

      const actionId = uuidv4();
      switch (param.action) {
        case 'deposit':
          res = await this.pawapayService.createDeposit({
            user,
            amount: param.amount,
            depositId: actionId,
            operator: param.operator,
            clientId: param.clientId,
          });
          if (!res.success) return res;
          subject = 'deposit';
          transactionNo = res.transactionNo;

          break;
        case 'payouts':
          res = await this.pawapayService.createPayout({
            user,
            amount: param.amount,
            operator: param.operator,
            payoutId: actionId,
            clientId: param.clientId,
          });

          if (!res.success) return res;
          subject = 'payouts';
          transactionNo = res.transactionNo;

          break;
        case 'cancel-payouts':
          res = await this.pawapayService.cancelPayout(
            actionId,
            param.clientId,
          );
          if (!res.success) return res;
          transactionNo = res.transactionNo;
          await this.transactionRepository.update(
            {
              transaction_no: transactionNo,
            },
            {
              status: 2,
            },
          );
          return {
            success: true,
            message: 'Payout cancelled successfully',
            data: { transactionRef: transactionNo },
          };
          break;
        case 'refunds':
          res = await this.pawapayService.createRefund(
            user,
            param.amount,
            actionId,
            param.depositId,
            param.clientId,
          );
          if (!res.success) return res;
          subject = 'refunds';
          transactionNo = res.transactionNo;
          break;
        default:
          return { success: false, message: 'Invalid action' };
      }

      await this.helperService.saveTransaction({
        amount: param.amount,
        channel: 'pawapay',
        clientId: param.clientId,
        toUserId: param.userId,
        toUsername: wallet.username,
        toUserBalance: wallet.available_balance,
        fromUserId: 0,
        fromUsername: 'System',
        fromUserbalance: 0,
        source: param.source,
        subject,
        description: res.data.status,
        transactionNo,
      });

      return {
        success: true,
        message: 'Success',
        data: { transactionRef: transactionNo },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getRequests({ action, actionId, clientId }: FetchPawapayRequest) {
    try {
      let data;
      switch (action) {
        case 'deposit':
          data = await this.pawapayService.fetchDeposits(actionId, clientId);
          if (!data.success) return data;
          break;
        case 'payouts':
          data = await this.pawapayService.fetchPayouts(actionId, clientId);
          if (!data.success) return data;

          break;
        case 'refunds':
          data = await this.pawapayService.fetchRefunds(actionId, clientId);
          if (!data.success) return data;

          break;
        default:
          return { success: false, message: 'Invalid action' };
      }

      return {
        success: true,
        message: 'Success',
        data,
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async resendCallback({ action, actionId, clientId }: FetchPawapayRequest) {
    try {
      let data;
      switch (action) {
        case 'deposit':
          data = await this.pawapayService.depositResendCallback(
            actionId,
            clientId,
          );
          break;
        case 'payouts':
          data = await this.pawapayService.payoutResendCallback(
            actionId,
            clientId,
          );
          break;
        case 'refunds':
          data = await this.pawapayService.payoutResendCallback(
            actionId,
            clientId,
          );
          break;
        default:
          return { success: false, message: 'Invalid action' };
      }
      return {
        success: true,
        message: 'Success',
        data,
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async fetchToolkit({ action, clientId }: PawapayToolkitRequest) {
    try {
      let res;
      switch (action) {
        case 'availability':
          res = await this.pawapayService.fetchAvailability(clientId);
          break;
        case 'public-key':
          res = await this.pawapayService.fetchPublicKey(clientId);
          break;
        default:
          return {
            success: false,
            message:
              'Invalid action, the permitted actions are availability | public-key',
          };
      }

      return {
        success: true,
        message: 'Success',
        data: res.data,
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async predictCorrespondent(param) {
    return this.pawapayService.predictCorrespondent(
      param.phoneNumber,
      param.clientId,
    );
  }
  async fetchActiveConf(clientId) {
    return this.pawapayService.fetchActiveConf(clientId);
  }

  async fetchWalletBalances(clientId) {
    return this.pawapayService.fetchWalletBalances(clientId);
  }

  async fetchCountryWalletBalances(param: PawapayCountryRequest) {
    return this.pawapayService.fetchCountryWalletBalances(
      param.country,
      param.clientId,
    );
  }
}
