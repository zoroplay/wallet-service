/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-var */
/* eslint-disable prettier/prettier */
import { HttpStatus, Injectable } from "@nestjs/common";
import {
  CommonResponseArray,
  CreateWalletRequest,
  CreditUserRequest,
  DebitUserRequest,
  GetBalanceRequest,
  GetNetworkBalanceRequest,
  GetNetworkBalanceResponse,
  GetPaymentMethodRequest,
  MetaData,
  PaginationResponse,
  PaymentMethodRequest,
  PaymentMethodResponse,
  PlayerWalletData,
  UserTransactionResponse,
  WalletResponse,
} from "./proto/wallet.pb";
import {
  generateTrxNo,
  handleError,
  handleResponse,
  paginateResponse,
} from "./common/helpers";
import { InjectRepository } from "@nestjs/typeorm";
import { Wallet } from "./entity/wallet.entity";
import { Repository } from "typeorm";
import { PaymentMethod } from "./entity/payment.method.entity";
import { Withdrawal } from "./entity/withdrawal.entity";
import { HelperService } from "./services/helper.service";
import { Transaction } from "./entity/transaction.entity";
import * as dayjs from "dayjs";

import { Bank } from "./entity/bank.entity";
import { IdentityService } from "./identity/identity.service";
var customParseFormat = require("dayjs/plugin/customParseFormat");

dayjs.extend(customParseFormat);

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
    @InjectRepository(Bank)
    private bankRepository: Repository<Bank>,
    private helperService: HelperService,
    private identityService: IdentityService,
  ) {}

  async createWallet(data: CreateWalletRequest): Promise<WalletResponse> {
    try {
      const { userId, username, clientId, amount, bonus } = data;
      const wallet = new Wallet();
      wallet.user_id = userId;
      wallet.username = username;
      wallet.client_id = clientId;
      wallet.balance = amount || 0;
      wallet.available_balance = amount || 0;
      wallet.sport_bonus_balance = bonus || 0;

      await this.walletRepository.save(wallet);
      let amt = amount;
      let desc = "Initial Balance";
      let subject = "Deposit";
      if (bonus > 0) {
        amt = bonus;
        desc = "Registration bonus";
        subject = "Bonus";
      }
      // create transaction
      if (amount > 0 || bonus > 0) {
        await this.helperService.saveTransaction({
          clientId,
          transactionNo: generateTrxNo(),
          amount: data.amount,
          description: desc,
          subject,
          channel: "Internal Transfer",
          source: "",
          fromUserId: 0,
          fromUsername: "System",
          fromUserBalance: 0,
          toUserId: userId,
          toUsername: username,
          toUserBalance: 0,
          status: 1,
        });
      }

      return handleResponse(
        {
          userId: wallet.user_id,
          balance: wallet.balance,
          availableBalance: wallet.available_balance,
          trustBalance: wallet.trust_balance,
          sportBonusBalance: wallet.sport_bonus_balance,
          virtualBonusBalance: wallet.virtual_bonus_balance,
          casinoBonusBalance: wallet.casino_bonus_balance,
        },
        "Wallet created"
      );
    } catch (e) {
      return handleError(e.message, null, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getBalance(data: GetBalanceRequest): Promise<WalletResponse> {
    try {

      const wallet = await this.walletRepository.findOne({
        where: {
          user_id: data.userId,
          client_id: data.clientId,
        },
      });

      return handleResponse(
        {
          userId: wallet.user_id,
          balance: wallet.balance,
          availableBalance: wallet.available_balance,
          trustBalance: wallet.trust_balance,
          sportBonusBalance: wallet.sport_bonus_balance,
          virtualBonusBalance: wallet.virtual_bonus_balance,
          casinoBonusBalance: wallet.casino_bonus_balance,
        },
        "Wallet fetched"
      );
    } catch (e) {
      return handleError(e.message, null, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getPaymentMethods(data: GetPaymentMethodRequest) {
    try {
      const { clientId, status } = data;
      const where: any = { client_id: clientId };
      if (status) where.status = status;

      let results = [];
      // console.log(where)
      const pMethods = await this.pMethodRepository.find({ where });

      if (status) {
        results = pMethods.map((p) => ({
          provider: p.provider,
          title: p.display_name,
        }));
      } else {
        results = pMethods;
      }
      return handleResponse(results, "Payment methods retrieved successfully");
    } catch (e) {
      return handleError(e.message, {}, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async savePaymentMethod(
    data: PaymentMethodRequest
  ): Promise<PaymentMethodResponse> {
    try {
      let paymentMethod;

      if (data.id) {
        paymentMethod = await this.pMethodRepository.findOne({
          where: { id: data.id },
        });
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

      return handleResponse(
        {
          title: paymentMethod.display_name,
          provider: paymentMethod.provider,
          secretKey: paymentMethod.secret_key,
          publicKey: paymentMethod.public_key,
          merchantId: paymentMethod.merchant_id,
          baseUrl: paymentMethod.base_url,
          status: paymentMethod.status,
          forDisbursemnt: paymentMethod.for_disbursement,
          id: paymentMethod.id,
        },
        "Saved"
      );
    } catch (e) {
      return handleError(e.message, null, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async creditUser(data: CreditUserRequest): Promise<WalletResponse> {
    // console.log('credit data', data);
    try {
      const wallet = await this.walletRepository.findOne({
        where: { user_id: data.userId },
      });
      let walletType = "Main";
      let balance = 0;

      if (wallet) {
        let walletBalance = "available_balance";
        switch (data.wallet) {
          case "sport-bonus":
            walletBalance = "sport_bonus_balance";
            walletType = "Sport Bonus";
            balance =
              parseFloat(wallet.sport_bonus_balance.toString()) +
              parseFloat(data.amount);
            break;
          case "virtual":
            walletBalance = "virtual_bonus_balance";
            walletType = "Virtual Bonus";
            balance =
              parseFloat(wallet.virtual_bonus_balance.toString()) +
              parseFloat(data.amount);
            break;
          case "casino":
            walletBalance = "casino_bonus_balance";
            walletType = "Casino Bonus";
            balance =
              parseFloat(wallet.casino_bonus_balance.toString()) +
              parseFloat(data.amount);
            break;
          case "trust":
            walletBalance = "trust_balance";
            walletType = "Trust";
            balance =
              parseFloat(wallet.trust_balance.toString()) +
              parseFloat(data.amount);
            break;
          default:
            balance =
              parseFloat(wallet.available_balance.toString()) +
              parseFloat(data.amount);
            break;
        }
        // console.log(walletBalance, data.wallet)
        
        await this.walletRepository.update(
          {
            user_id: data.userId,
            client_id: data.clientId,
          },
          {
            // balance,
            [walletBalance]: balance,
          }
        );
      } else {
        // create new wallet
        const wallet: any = new Wallet();
        wallet.user_id = data.userId;
        wallet.client_id = data.clientId;
        wallet.username = data.username;
        wallet.balance = parseFloat(data.amount) || 0;
        wallet.available_balance = parseFloat(data.amount) || 0;

        await this.walletRepository.save(wallet);
      }
      const transactionNo = generateTrxNo();
      //to-do save transaction log
      await this.helperService.saveTransaction({
        clientId: data.clientId,
        transactionNo,
        amount: parseFloat(data.amount),
        description: data.description,
        subject: data.subject,
        channel: data.channel,
        source: data.source,
        fromUserId: 0,
        fromUsername: "System",
        fromUserBalance: 0,
        toUserId: data.userId,
        toUsername: data.username,
        toUserBalance: balance,
        status: 1,
        walletType,
      });

      // send deposit to trackier
      try {
        const keys = await this.identityService.getTrackierKeys({itemId: data.clientId});

        if (keys.success){
          await this.helperService.sendActivity({
            subject: data.subject,
            username: data.username,
            amount: data.amount,
            transactionId: transactionNo,
            clientId: data.clientId,
          },  keys.data);
        }

      } catch (e) {
        console.log('Trackier error: Credit User', e.message)
      }
      wallet.balance = balance;
      return handleResponse(wallet, "Wallet credited");
    } catch (e) {
      // console.log('credit error', e.message);
      return handleError(e.message, null, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async debitUser(data: any): Promise<WalletResponse> {
    try {
      // console.log(data);
      const wallet = await this.walletRepository.findOne({
        where: { user_id: data.userId },
      });

      const amount = parseFloat(data.amount);

      let balance = 0;
      let walletBalance = "available_balance";
      let walletType = "Main";
      switch (data.wallet) {
        case "sport-bonus":
          walletBalance = "sport_bonus_balance";
          walletType = "Sport Bonus";
          balance = wallet.sport_bonus_balance - amount;
          break;
        case "virtual":
          walletBalance = "virtual_bonus_balance";
          walletType = "Virtual Bonus";
          balance = wallet.virtual_bonus_balance - amount;
          break;
        case "casino":
          walletBalance = "casino_bonus_balance";
          walletType = "Casino Bonus";
          balance = wallet.casino_bonus_balance - amount;
          break;
        case "trust":
          walletBalance = "trust_balance";
          walletType = "Trust";
          balance = wallet.trust_balance - amount;
          break;
        default:
          balance = wallet.available_balance - amount;
          break;
      }
      await this.walletRepository.update(
        {
          user_id: data.userId,
          client_id: data.clientId,
        },
        {
          // balance,
          [walletBalance]: balance,
        }
      );

      const transactionNo = generateTrxNo();

      // to-do save transaction log
      await this.helperService.saveTransaction({
        clientId: data.clientId,
        transactionNo: generateTrxNo(),
        amount: parseFloat(data.amount),
        description: data.description,
        subject: data.subject,
        channel: data.channel,
        source: data.source,
        fromUserId: data.userId,
        fromUsername: data.username,
        fromUserBalance: balance,
        toUserId: 0,
        toUsername: "System",
        toUserBalance: 0,
        status: 1,
        walletType,
      });

      // send deposit to trackier
      try {
        const keys = await this.identityService.getTrackierKeys({itemId: data.clientId});

        if (keys.success){
          await this.helperService.sendActivity({
            subject: data.subject,
            username: data.username,
            amount: parseFloat(data.amount),
            transactionId: transactionNo,
            clientId: data.clientId
          }, keys.data);
        }
      } catch (e) {
        console.log('trackier error: Debit User', e.message)
      }

      wallet.balance = balance;
      return handleResponse(wallet, "Wallet debited");
    } catch (e) {
      // console.log(e.message);
      return handleError(e.message, null, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async awardBonusWinning(data: CreditUserRequest) {
    // console.log('awarding bonus', data);

    try {
      let walletType: string;
      switch (data.wallet) {
        case 'casino':
          walletType = 'casino_bonus_balance'
          break;
        case 'virtual':
          walletType = 'virtual_bonus_balance'
          break;
        default:
          walletType = 'sport_bonus_balance'
          break;
      }

      const wallet = await this.walletRepository.findOne({where: {user_id: data.userId}});

      await this.walletRepository.update(
        {
          user_id: data.userId,
          client_id: data.clientId,
        },
        {
          balance: wallet.balance + parseFloat(data.amount),
          available_balance: wallet.available_balance + parseFloat(data.amount),
          [walletType]: 0,
        }
      );

      const transactionNo = generateTrxNo();
      //to-do save transaction log
      await this.helperService.saveTransaction({
        clientId: data.clientId,
        transactionNo,
        amount: 0,
        description: 'Bonus has been completed',
        subject: 'Bonus Winnings',
        channel: 'Internal',
        source: 'internal',
        fromUserId: 0,
        fromUsername: "System",
        fromUserBalance: 0,
        toUserId: data.userId,
        toUsername: data.username,
        toUserBalance: 0,
        status: 1,
        walletType: 'Main',
      });
      
    } catch (e) {
      console.log('Error awarding bonus', e.message);
      return {
        success: false,
        message: "Unable to complete transactions",
        data: null,
      };
    }
  }

  async debitAgentBalance(data: DebitUserRequest) {
    const { userId, clientId } = data;
    try {
      const wallet = await this.walletRepository.findOne({
        where: { user_id: data.userId },
      });

      const amount = parseFloat(data.amount);

      await this.walletRepository.update(
        {
          user_id: data.userId,
          client_id: data.clientId,
        },
        {
          // balance,
          balance: wallet.balance - amount,
        }
      );

      return handleResponse(wallet, "Wallet debited");
    } catch (e) {
      return handleError(e.message, null, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async listDeposits(data): Promise<any> {
    // console.log('fetch deposits', data)
    try {
      // console.log(data);
      const {
        clientId,
        startDate,
        endDate,
        paymentMethod,
        status,
        username,
        transactionId,
        page,
      } = data;
      const limit = 100;
      const skip = (page - 1) * limit;

      let query = this.transactionRepository
        .createQueryBuilder("transaction")
        .where("client_id = :clientId", { clientId })
        .andWhere("user_id != 0")
        .andWhere("subject = :type", { type: "Deposit" })
        .andWhere("created_at >= :startDate", { startDate })
        .andWhere("created_at <= :endDate", { endDate });

      if (paymentMethod !== "")
        query = query.andWhere("channel = :paymentMethod", { paymentMethod });

      if (username !== "")
        query = query.andWhere("username = :username", { username });

      // if (status !== '')
      //   query = query.andWhere("status = :status", {status});

      if (transactionId !== "")
        query = query.andWhere("transaction_no = :transactionId", {
          transactionId,
        });

      // console.log(skip, limit)

      const result = await query
        .orderBy("created_at", "DESC")
        .take(limit)
        .skip(skip)
        .getMany();

      const total = await query.getCount();

      const results = result.map((item) => ({
        ...item,
        created_at: dayjs(item.created_at).format("YYYY-MM-DD HH:mm:ss"),
      }));

      return paginateResponse([results, total], page, limit);
    } catch (e) {
      console.log(e.message);
      return paginateResponse([[], 0], 1, 100, "failed");
    }
  }

  async listBanks(): Promise<CommonResponseArray> {
    const banks = await this.bankRepository.find();

    return {
      success: true,
      status: HttpStatus.OK,
      message: "Banks retrieved",
      data: banks,
    };
  }

  async getUserTransactions({
    clientId,
    userId,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  }): Promise<UserTransactionResponse> {
    // console.log(startDate, endDate, userId, clientId)
    try {
      let results = [];
      let query = this.transactionRepository
        .createQueryBuilder("transaction")
        .where("transaction.client_id = :clientId", { clientId })
        .andWhere("transaction.user_id = :userId", { userId });

      if (startDate && startDate != "")
        query.andWhere("DATE(created_at) >= :startDate", { startDate });

      if (endDate && endDate != "")
        query.andWhere("DATE(created_at) <= :endDate", { endDate });

      const total = await query.clone().getCount();

      let offset = 0;

      if (page > 1) {
        offset = (page - 1) * limit;
        offset = offset + 1;
      }

      // console.log(`offset ${offset}`, `page ${page}`, `limit ${limit}`);

      const transactions = await query
        .orderBy("transaction.created_at", "DESC")
        .limit(limit)
        .offset(offset)
        .getRawMany();

      const pager = paginateResponse([transactions, total], page, limit);

      const meta: MetaData = {
        page,
        perPage: limit,
        total,
        lastPage: pager.lastPage,
        nextPage: pager.nextPage,
        prevPage: pager.prevPage,
      };

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
            status: transaction.transaction_status,
            wallet: transaction.transaction_wallet,
          });
        }
      }

      return { success: true, message: "Successful", data: results, meta };
    } catch (e) {
      return {
        success: false,
        message: "Unable to fetch transactions",
        data: null,
      };
    }
  }

  async getWalletSummary({ clientId, userId }): Promise<PlayerWalletData> {
    try {
      const wallet = await this.walletRepository.findOne({
        where: {
          user_id: userId,
          client_id: clientId,
        },
      });

      // sum deposit transactions
      const deposits = await this.transactionRepository.sum("amount", {
        subject: "Deposit",
        user_id: userId,
        status: 1,
      });

      // sum withdrawals transactions
      const withdrawals = await this.withdrawalRepository.sum("amount", {
        user_id: userId,
        status: 1,
      });

      // sum pending withdrawals transactions
      const pendingWithdrawals = await this.withdrawalRepository.sum("amount", {
        user_id: userId,
        status: 0,
      });
      // get last deposit
      const lastDeposit = await this.transactionRepository.findOne({
        where: {
          user_id: userId,
          client_id: clientId,
          subject: "Deposit",
          status: 1,
        },
        order: { created_at: "DESC" },
      });

      // get last withdrawal
      const lastWithdrawal = await this.withdrawalRepository.findOne({
        where: {
          user_id: userId,
          client_id: clientId,
          status: 1,
        },
        order: { created_at: "DESC" },
      });

      // get first activity
      const firstActivity = await this.transactionRepository.findOne({
        where: {
          user_id: userId,
          client_id: clientId,
          status: 1,
        },
      });

      // get last activity
      const lastActivity = await this.transactionRepository.findOne({
        where: {
          user_id: userId,
          client_id: clientId,
          status: 1,
        },
        order: { created_at: "DESC" },
      });

      const averageWithdrawals = await this.transactionRepository.average(
        "amount",
        {
          user_id: userId,
          client_id: clientId,
          status: 1,
        }
      );

      const noOfDeposits = await this.transactionRepository.count({
        where: {
          user_id: userId,
          client_id: clientId,
          status: 1,
          subject: "Deposit",
        },
      });

      const noOfWithdrawals = await this.withdrawalRepository.count({
        where: {
          user_id: userId,
          client_id: clientId,
          status: 1,
        },
      });

      const data = {
        noOfDeposits,
        noOfWithdrawals,
        totalDeposits: deposits || 0,
        totalWithdrawals: withdrawals || 0,
        pendingWithdrawals: pendingWithdrawals || 0,
        avgWithdrawals: averageWithdrawals || 0,
        sportBalance: wallet.available_balance || 0,
        sportBonusBalance: wallet.sport_bonus_balance || 0,
        lastDepositDate: lastDeposit
          ? dayjs(lastDeposit.created_at).format("YYYY-MM-DD HH:mm:ss")
          : "-",
        lastDepositAmount: lastDeposit ? lastDeposit.amount : 0,
        lastWithdrawalDate: lastWithdrawal
          ? dayjs(lastWithdrawal.created_at).format("YYYY-MM-DD HH:mm:ss")
          : "-",
        lastWithdrawalAmount: lastWithdrawal ? lastWithdrawal.amount : 0,
        firstActivityDate: firstActivity
          ? dayjs(firstActivity.created_at).format("YYYY-MM-DD HH:mm:ss")
          : "-",
        lastActivityDate: lastActivity
          ? dayjs(lastActivity.created_at).format("YYYY-MM-DD HH:mm:ss")
          : "-",
      };

      return data;
    } catch (e) {
      // console.log(e);
      return null;
    }
  }

  async getNetworkBalance(
    payload: GetNetworkBalanceRequest
  ): Promise<GetNetworkBalanceResponse> {
    const agentWallet = await this.walletRepository.findOne({
      where: { user_id: payload.agentId },
    });
    try {
      // console.log(payload);
      // get agent wallet
      // get network sum
      const networkSum = await this.walletRepository
        .createQueryBuilder("w")
        .select("SUM(available_balance)", "network_balance")
        .addSelect("SUM(trust_balance)", "network_trust_balance")
        .where("user_id IN(:...ids)", { ids: payload.userIds.split(",") })
        .getRawOne();

      // console.log(networkSum);

      return {
        success: true,
        message: "Success",
        networkBalance:
          parseFloat(networkSum.network_balance) +
          parseFloat(agentWallet.available_balance.toString()),
        networkTrustBalance:
          parseFloat(networkSum.network_trust_balance) +
          parseFloat(agentWallet.trust_balance.toString()),
        trustBalance: agentWallet.trust_balance,
        availableBalance: agentWallet.available_balance,
        balance: agentWallet.balance,
      };
    } catch (e) {
      return {
        success: true,
        message: "Success",
        networkBalance: 0,
        networkTrustBalance: 0,
        trustBalance: agentWallet.trust_balance,
        availableBalance: agentWallet.available_balance,
        balance: agentWallet.balance,
      };
    }
  }

  async deletePlayerData(user_id) {
    await this.transactionRepository.delete({ user_id });

    await this.walletRepository.delete({ user_id });

    await this.withdrawalRepository.delete({ user_id });

    return { success: true, message: "Successful" };
  }
}
