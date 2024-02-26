import { HttpStatus, Injectable } from '@nestjs/common';
import { CreateWalletRequest, CreditUserRequest, DebitUserRequest, GetBalanceRequest, GetPaymentMethodRequest, GetPaymentMethodResponse, ListWithdrawalRequestResponse, ListWithdrawalRequests, PaymentMethodRequest, PaymentMethodResponse, UserTransactionResponse, WalletResponse, WithdrawRequest, WithdrawResponse } from './proto/wallet.pb';
import { generateTrxNo, handleError, handleResponse } from './common/helpers';
import { InjectRepository } from '@nestjs/typeorm';
import { Wallet } from './entity/wallet.entity';
import { LessThanOrEqual, MoreThan, MoreThanOrEqual, Repository } from 'typeorm';
import { PaymentMethod } from './entity/payment.method.entity';
import { Withdrawal } from './entity/withdrawal.entity';
import { HelperService } from './services/helper.service';
import { Transaction } from './entity/transaction.entity';
import dayjs from 'dayjs';

@Injectable()
export class AppService {

  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(PaymentMethod)
    private pMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(Withdrawal)
    private withdrawalRepository: Repository<Withdrawal>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private helperService: HelperService
  ) {}

  async createWallet(data: CreateWalletRequest): Promise<WalletResponse> {
    try {
      const {userId, username, clientId, amount, bonus } = data;
      const wallet = new Wallet();
      wallet.user_id = userId;
      wallet.username = username;
      wallet.client_id = clientId;
      wallet.balance = amount || 0;
      wallet.available_balance = amount || 0;
      wallet.sport_bonus_balance = bonus || 0;

      await this.walletRepository.save(wallet);

      // create transaction
      if (amount > 0 || bonus  > 0) {
        await this.helperService.saveTransaction({
          clientId,
          transactionNo: generateTrxNo(),
          amount: data.amount,
          description: 'Inital Balance',
          subject: 'Deposit',
          channel: 'Internal Transfer',
          source: '',
          fromUserId: 0,
          fromUsername: 'System',
          fromUserBalance: 0,
          toUserId: userId,
          toUsername: username,
          toUserBalance: 0,
          status: 1
        });

      }

      return handleResponse({
        userId: wallet.user_id,
        balance: wallet.balance,
        availableBalance: wallet.available_balance,
        trustBalance: wallet.trust_balance,
        sportBonusBalance: wallet.sport_bonus_balance,
        virtualBonusBalance: wallet.virtual_bonus_balance,
        casinoBonusBalance: wallet.casino_bonus_balance
      }, 'Wallet created')
    } catch (e) {
      return handleError(e.message, null, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getBalance(data: GetBalanceRequest): Promise<WalletResponse> {
    try {
      const wallet = await this.walletRepository.findOne({where: {
        user_id: data.userId,
        client_id: data.clientId
      }});

      return handleResponse({
        userId: wallet.user_id,
        balance: wallet.balance,
        availableBalance: wallet.available_balance,
        trustBalance: wallet.trust_balance,
        sportBonusBalance: wallet.sport_bonus_balance,
        virtualBonusBalance: wallet.virtual_bonus_balance,
        casinoBonusBalance: wallet.casino_bonus_balance
      }, 'Wallet fetched')

    } catch (e) {
      return handleError(e.message, null, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getPaymentMethods(data: GetPaymentMethodRequest): Promise<GetPaymentMethodResponse> {
    try {
      const {clientId, status} = data;
      let where: any = {client_id: clientId};
      if (status) 
        where.status = status;

      const pMethods = await this.pMethodRepository.find({where});

      return handleResponse(pMethods, 'Payment methods retrieved successfully');
    } catch (e) {
      return handleError(e.message, {}, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async savePaymentMethod(data: PaymentMethodRequest): Promise<PaymentMethodResponse> {
    try {
      let paymentMethod;
      
      if (data.id) {
        paymentMethod = await this.pMethodRepository.findOne({where: {id: data.id}});
      } else {
        paymentMethod = new PaymentMethod();
      } 

      paymentMethod.client_id = data.clientId;
      paymentMethod.display_name = data.title;
      paymentMethod.provider = data.provider;
      paymentMethod.base_url = data.baseUrl;
      paymentMethod.secret_key = data.secretKey;
      paymentMethod.public_key = data.publicKey;
      paymentMethod.merchant_id = data.merchantId;
      paymentMethod.status = data.status;
      paymentMethod.for_disbursement = data.forDisbursement;
      paymentMethod.id = data.id;

      await this.pMethodRepository.save(paymentMethod);
      
      return handleResponse({
        title: paymentMethod.display_name,
        provider: paymentMethod.provider,
        secretKey: paymentMethod.secret_key,
        publicKey: paymentMethod.public_key,
        merchantId: paymentMethod.merchant_id,
        baseUrl: paymentMethod.base_url,
        status: paymentMethod.status,
        forDisbursemnt: paymentMethod.for_disbursement,
        id: paymentMethod.id
      }, 'Saved');
    } catch (e) {
      return handleError(e.message, null, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async creditUser(data: CreditUserRequest): Promise<WalletResponse> {
    try {
      const wallet = await this.walletRepository.findOne({where: {user_id: data.userId}});

      let balance = 0; 
      if (wallet) {
        let walletBalance = 'available_balance' 
        switch(data.wallet) {
          case 'sport-bonus':
            walletBalance = 'sport_bonus_balance'
            balance = parseFloat(wallet.sport_bonus_balance.toString()) + parseFloat(data.amount.toString());
            break;
          case 'virtual':
            walletBalance = 'virtual_bonus_balance';
            balance = parseFloat(wallet.virtual_bonus_balance.toString()) + parseFloat(data.amount.toString())
            break;
          case 'casino':
            walletBalance = 'casino_bonus_balance';
            balance = parseFloat(wallet.casino_bonus_balance.toString()) + parseFloat(data.amount.toString())
            break;
          default:
            balance = parseFloat(wallet.available_balance.toString()) + parseFloat(data.amount.toString())
            break
        }
        await this.walletRepository.update({
          user_id: data.userId,
          client_id: data.clientId
        }, {
          // balance,
          [walletBalance]: balance
        });

      } else { // create new wallet
        const wallet = new Wallet();
        wallet.user_id = data.userId;
        wallet.client_id = data.clientId;
        wallet.balance = data.amount || 0;
        wallet.available_balance = data.amount || 0;
  
        await this.walletRepository.save(wallet);
      }
      //to-do save transaction log
      await this.helperService.saveTransaction({
        clientId: data.clientId,
        transactionNo: generateTrxNo(),
        amount: data.amount,
        description: data.description,
        subject: data.subject,
        channel: data.channel,
        source: data.source,
        fromUserId: 0,
        fromUsername: 'System',
        fromUserBalance: 0,
        toUserId: data.userId,
        toUsername: data.username,
        toUserBalance: balance,
        status: 1
      });


      return handleResponse(wallet, 'Wallet credited')
    } catch (e) {
      return handleError(e.message, null, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async debitUser(data: DebitUserRequest): Promise<WalletResponse> {
    try {
      const wallet = await this.walletRepository.findOne({where: {user_id: data.userId}});
      
      let balance = 0; 
      let walletBalance = 'available_balance' 
      switch(data.wallet) {
        case 'sport-bonus':
          walletBalance = 'sport_bonus_balance'
          balance = wallet.sport_bonus_balance - data.amount;
          break;
        case 'virtual':
          walletBalance = 'virtual_bonus_balance';
          balance = wallet.virtual_bonus_balance - data.amount;
          break;
        case 'casino':
          walletBalance = 'casino_bonus_balance';
          balance = wallet.casino_bonus_balance - data.amount;
          break;
        default:
          balance = wallet.available_balance - data.amount;
          break
      }
      await this.walletRepository.update({
        user_id: data.userId,
        client_id: data.clientId
      }, {
        // balance,
        [walletBalance]: balance
      });

      // to-do save transaction log
      await this.helperService.saveTransaction({
        clientId: data.clientId,
        transactionNo: generateTrxNo(),
        amount: data.amount,
        description: data.description,
        subject: data.subject,
        channel: data.channel,
        source: data.source,
        fromUserId: data.userId,
        fromUsername: data.username,
        fromUserBalance: balance,
        toUserId: 0,
        toUsername: 'System',
        toUserBalance: 0,
        status: 1
      });

      return handleResponse(wallet, 'Wallet debited');
    } catch (e) {
      return handleError(e.message, null, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async requestWithdrawal(data: WithdrawRequest): Promise<WithdrawResponse> {
    try {

      const wallet = await this.walletRepository.findOne({where: {
        user_id: data.userId,
        client_id: data.clientId
      }});

      if (!wallet)
        return {success: false, status: HttpStatus.NOT_FOUND, message: "Wallet not found", data: null}

      if (wallet.available_balance < data.amount)
        return {success: false, status: HttpStatus.BAD_REQUEST, message: "You have insufficient funds to cover the withdrawal request.", data: null}

        //To-Do: other validation minimum and max withdrawal

        const withdrawal = new Withdrawal();
        withdrawal.account_name = data.accountName;
        withdrawal.bank_code = data.bankCode;
        withdrawal.bank_name = data.bankName;
        withdrawal.account_number = parseInt(data.accountNumber);
        withdrawal.user_id = data.userId;
        withdrawal.username = data.username;
        withdrawal.client_id = data.clientId;
        withdrawal.amount = data.amount;
        withdrawal.withdrawal_code = generateTrxNo();

        await this.withdrawalRepository.save(withdrawal);

      const balance = wallet.available_balance - data.amount;

      await this.walletRepository.update({
        user_id: data.userId,
        client_id: data.clientId
      }, {
        // balance,
        available_balance: balance
      });

      //to-do save transaction log
      await this.helperService.saveTransaction({
        clientId: data.clientId,
        transactionNo: withdrawal.withdrawal_code,
        amount: data.amount,
        description: "withdrawal request",
        subject: "Withdrawal",
        channel: "internal",
        source: data.source,
        fromUserId: data.userId,
        fromUsername: data.username,
        fromUserBalance: balance,
        toUserId: 0,
        toUsername: 'System',
        toUserBalance: 0,
        status: 1
      });
      
      return {success: true, status: HttpStatus.OK, message: "Successful", data: {
        balance, code: withdrawal.withdrawal_code
      }}
    }catch (e) {
      console.log(e.message)
      return {success: false, status: HttpStatus.INTERNAL_SERVER_ERROR, message: "Unable to process request", data: null}
    }
  }

  async listWithdrawalRequest(data: ListWithdrawalRequests): Promise<ListWithdrawalRequestResponse> {
    try {
      const {clientId, from, to, userId, status} = data;

      let requests = [];
      const res = await this.withdrawalRepository.find({
        where:{client_id: data.clientId},
        take: 100
      })
      if (res.length) {
        for (const request of res) {
          requests.push({
            id: request.id,
            username: request.username,
            userId: request.user_id,
            amount: request.amount,
            accountNumber: request.account_number,
            accountName: request.account_name,
            bankName: request.bank_name,
            updatedBy: request.updated_by,
            status: request.status,
            created: request.created_at
          })
        }
      }
      return {success: true, status: HttpStatus.OK, message: 'Success', data: requests}
    } catch (e) {
      return {success: false, status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Something went wrong', data: null}
    }
  }

  async getUserTransactions({clientId, userId, startDate, endDate}): Promise<UserTransactionResponse> {
    try {
      let results = [];
      const transactions = await this.transactionRepository.createQueryBuilder('transaction')
          .where("transaction.client_id = :clientId", {clientId})
          .andWhere("transaction.user_id = :userId", {userId})
          .andWhere("DATE(created_at) > :startDate AND DATE(created_at) < :endDate", {startDate, endDate})
          .orderBy('transaction.created_at', 'DESC')
          .limit(20)
          .getRawMany();

      if (transactions.length > 0) {
        for (const transaction of transactions) {
          results.push({
            id: transaction.transaction_id, 
            referenceNo: transaction.transaction_transaction_no,
            amount: transaction.transaction_amount,
            balance: transaction.transaction_balance,
            subject: transaction.transaction_subject,
            type: transaction.transaction_tranasaction_type,
            description: transaction.transaction_description,
            transactionDate: transaction.transaction_created_at,
            channel: transaction.transaction_channel,
            status: transaction.transaction_status
          })
        }
      }

      return {success: true, message: "Successful", data: results};
    } catch (e) {
      console.log(e.message)
      return {success: false, message: 'Unable to fetch transactions', data: null}
    }
  }
}
