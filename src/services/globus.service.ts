// import { Injectable } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { PaymentMethod } from 'src/entity/payment.method.entity';
// import { Transaction } from 'src/entity/transaction.entity';
// import { Wallet } from 'src/entity/wallet.entity';
// import { Repository } from 'typeorm';
// import * as crypto from 'crypto';
// import { Withdrawal } from 'src/entity/withdrawal.entity';
// import { HelperService } from './helper.service';
// import { v4 as uuidv4 } from 'uuid';
// import { IdentityService } from 'src/identity/identity.service';
// import axios from 'axios';

// @Injectable()
// export class GlobusService {
//   constructor(
//     @InjectRepository(PaymentMethod)
//     private readonly paymentMethodRepository: Repository<PaymentMethod>,
//     @InjectRepository(Transaction)
//     private readonly transactionRepository: Repository<Transaction>,
//     @InjectRepository(Wallet)
//     private readonly walletRepository: Repository<Wallet>,
//     @InjectRepository(Withdrawal)
//     private readonly withdrawalRepository: Repository<Withdrawal>,
//     private identityService: IdentityService,

//     private helperService: HelperService,
//   ) {}

//   private async globusSettings(client_id: number) {
//     return await this.paymentMethodRepository.findOne({
//       where: {
//         provider: 'globus',
//         client_id,
//       },
//     });
//   }

//   async auth() {
//     try {
//       const res = await axios.post(
//         'https://tppservice.globusbank.com:2020/AuthService/connect/token',
//         {
//           grant_type: 'password',
//           username: process.env.GLOBUS_USERNAME,
//           password: process.env.GLOBUS_PASSWORD,
//           client_id: process.env.GLOBUS_CLIENT_ID,
//         },
//       );

//       console.log(res);

//       return res.data.access_token;
//     } catch (error) {
//       console.error(
//         'Globus Error:',
//         error.response ? error.response.data : error.message,
//       );
//       return {
//         success: false,
//         message: error.response ? error.response.data : error.message,
//       };
//     }
//   }

//   async initiatePayment(data, client_id) {
//     //     try {
//     //       const settings = await this.globusSettings(client_id);

//     //       if (!settings)
//     //         return {
//     //           success: false,
//     //           message: 'PawaPay has not been configured for client',
//     //         };

//     const clientId = this.auth();
//     const url =
//       'https://tppservice.globusbank.com:2020/api/Account/generateVirtualAccountLite';

//     //  const headers = {
//     //    'Content-Type': 'application/json',
//     //    ClientID: clientId,
//     //  };

//     const body = {
//       AccountName: data.accountName,
//       VirtualAccountNumber: data.virtualAccountNumber,
//       NubanAccountNumber: data.linkedPartnerAccountNumber,
//       CanExpire: data.canExpire ?? false,
//       ExpiredTime: data.expiredTime ?? 60,
//       hasTransactionAmount: data.hasTransactionAmount ?? false,
//       TransactionAmount: data.transactionAmount ?? 0,
//     };

//     const response = await axios.post(url, body, {
//       headers: {
//         'Content-Type': 'application/json',
//         ClientID: clientId,
//       },
//     });
//     return response.data;
//   }
//   catch(error) {
//     console.error(
//       'Globus Error:',
//       error.response ? error.response.data : error.message,
//     );
//     return {
//       success: false,
//       message: error.response ? error.response.data : error.message,
//     };
//   }

//   //   handleGlobusWebhook = async (data: any) => {
//   //     const { reference } = data;

//   //     const token = await this.auth();

//   //     const res = await axios.get(
//   //       `https://globus-api.com/api/TransactionStatus?reference=${reference}`,
//   //       {
//   //         headers: { Authorization: `Bearer ${token}` },
//   //       },
//   //     );

//   //     if (res.status === 'successful') {
//   //       console.log('update wallet');
//   //     }
//   //     return { message: 'Wallet funded successfully' };
//   //   };
// }
