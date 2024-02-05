import { HttpStatus, Injectable } from '@nestjs/common';
import { CreateWalletRequest, CreditUserRequest, DebitUserRequest, GetBalanceRequest, GetPaymentMethodRequest, GetPaymentMethodResponse, PaymentMethodRequest, PaymentMethodResponse, WalletResponse } from './proto/wallet.pb';
import { handleError, handleResponse } from './common/helpers';
import { InjectRepository } from '@nestjs/typeorm';
import { Wallet } from './entity/wallet.entity';
import { Repository } from 'typeorm';
import { PaymentMethod } from './entity/payment.method.entity';
import { PaymentService } from './payments/payments.service';

@Injectable()
export class AppService {

  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(PaymentMethod)
    private pMethodRepository: Repository<PaymentMethod>,
    private paymentService: PaymentService
  ) {}


  async createWallet(data: CreateWalletRequest): Promise<WalletResponse> {
    try {
      const {userId, clientId, amount } = data;
      const wallet = new Wallet();
      wallet.user_id = userId;
      wallet.client_id = clientId;
      wallet.balance = amount || 0;
      wallet.available_balance = amount || 0;

      await this.walletRepository.save(wallet);

      return handleResponse({
        userId: wallet.user_id,
        balance: wallet.balance,
        availableBalance: wallet.available_balance,
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
      }, 'Wallet created')

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
      return handleError(e.message, null, HttpStatus.INTERNAL_SERVER_ERROR);
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

      if (wallet) {
        let balance = wallet.available_balance + data.amount;
        
        await this.walletRepository.update({
          user_id: data.userId,
          client_id: data.clientId
        }, {
          balance,
          available_balance: balance
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
      await this.paymentService.saveTransaction(data);

      return handleResponse(wallet, 'Wallet credited')
    } catch (e) {
      return handleError(e.message, null, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async debitUser(data: DebitUserRequest): Promise<WalletResponse> {
    try {
      const wallet = await this.walletRepository.findOne({where: {user_id: data.userId}});
      
      let balance = wallet.available_balance - data.amount;

      await this.walletRepository.update({
        user_id: data.userId,
        client_id: data.clientId
      }, {
        balance,
        available_balance: balance
      });

      // to-do save transaction log

      return handleResponse(wallet, 'Wallet debited');
    } catch (e) {
      return handleError(e.message, null, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  
}
