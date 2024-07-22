/* eslint-disable prettier/prettier */
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';
import { paginateResponse } from 'src/common/helpers';
import { Transaction } from 'src/entity/transaction.entity';
import { CommonResponseObj, MetaData } from 'src/proto/wallet.pb';
import { Repository } from 'typeorm';

@Injectable()
export class ReportingService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  // async getMoneyTransaction(data: GetMoneyTransactionRequest): Promise<CommonResponseObj> {
  //     try {
  //         const { clientId, from, to, transactionType, referenceNo, username, keyword, page } = data;
  //         const limit = data.limit || 100;
  //         // console.log(data)
  //         const start = dayjs(from, 'DD-MM-YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');
  //         const end = dayjs(to, 'DD-MM-YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');

  //         let query = this.transactionRepository.createQueryBuilder('t')
  //                     .where("client_id = :clientId", {clientId})
  //                     .andWhere('created_at >= :start', {start})
  //                     .andWhere("created_at <= :end", {end})
  //                     .andWhere("status = :status", {status: 1})
  //                     .andWhere("user_id != :empty", {empty: 0});

  //         if(transactionType && transactionType !== '') {
  //             switch (transactionType) {
  //                 case 'bet_deposits':
  //                     query.andWhere("subject IN (:...subject)", {subject: ['Bet Deposit (Sport)', 'Bet Deposit (Casino)', 'Bet Deposit (Virtual)']});
  //                     break;
  //                 case 'bet_winnnigs':
  //                     query.andWhere("subject IN (:...subject)", {subject: ['Sport Win', 'Bet Win (Casino)', 'Virtual Sport Win']});
  //                     break;
  //                 case 'deposits':
  //                     query.andWhere("subject = :subject", {subject: 'Deposit'});
  //                     break;
  //                 case 'withdrawals':
  //                     query.andWhere("subject = :subject", {subject: 'Withdrawal'});
  //                     break;
  //                 case 'd_w':
  //                     query.andWhere("subject IN (:...subject)", {subject: ['Deposit', 'Withdrawal']});
  //                     break;
  //                 case 'bonuses':
  //                     query.andWhere("wallet = :wallet", {subject: 'Sport Bonus'});
  //                     break;
  //                 case 'interaccount':
  //                     query.andWhere("subject = :subject", {subject: 'Sport Bonus'});
  //                     break;
  //                 default:
  //                     break;
  //             }
  //         }

  //         if(referenceNo !== '') {
  //             query.andWhere("transaction_no = :referenceNo", {referenceNo});
  //         }

  //         if (username !== '') {
  //             query.andWhere("username = :username", {username});
  //         }

  //         if (keyword !== '') {
  //             query.andWhere("subject LIKE :search", {search: `%${keyword}%`});
  //         }

  //         let offset = 0;

  //         if (page > 1) {
  //             offset = (page - 1) * limit;
  //             offset = offset + 1;
  //         }

  //         const total = await query.clone().getCount();

  //         const result = await query.orderBy('created_at', 'DESC').limit(limit).offset(offset).getMany();

  //         // console.log(result)

  //         const pager = paginateResponse([result, total], page, limit);

  //         const meta: MetaData = {
  //             page,
  //             perPage: limit,
  //             total,
  //             lastPage: pager.lastPage,
  //             nextPage: pager.nextPage,
  //             prevPage: pager.prevPage
  //         }

  //         return {
  //             success: true,
  //             status: HttpStatus.OK,
  //             message: 'Success',
  //             data: {result, meta}
  //         }

  //     } catch(e) {
  //         console.log(e.message)
  //         return {
  //             success: false,
  //             message: 'There was an error fetching transactions',
  //             status: HttpStatus.INTERNAL_SERVER_ERROR,
  //             data: []
  //         }
  //     }
  // }
}
