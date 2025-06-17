// transaction-archive.service.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { ArchivedTransaction } from 'src/entity/archivetransaction';
import { Repository, LessThan, Transaction } from 'typeorm';
import dayjs from 'dayjs';

@Injectable()
export class TransactionArchiveService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,

    @InjectRepository(ArchivedTransaction)
    private readonly archivedRepo: Repository<ArchivedTransaction>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async archiveTransactions() {
    console.log('Starting transaction archive process...');

    const threeMonthsAgo = dayjs()
      .subtract(3, 'month')
      .format('YYYY-MM-DD HH:mm:ss');

    const oldTransactions = await this.transactionRepo.find({
      where: {
        created_at: LessThan(threeMonthsAgo),
      } as any,
    });

    if (!oldTransactions.length) {
      console.log('No transactions to archive.');
      return;
    }

    const archivePayload = oldTransactions.map((tx: any) => ({
      client_id: tx.client_id,
      user_id: tx.user_id,
      username: tx.username,
      transaction_no: tx.transaction_no,
      amount: tx.amount,
      tranasaction_type: tx.tranasaction_type,
      status: tx.status,
      channel: tx.channel,
      subject: tx.subject,
      description: tx.description,
      source: tx.source,
      balance: tx.balance,
      wallet: tx.wallet,
      settlementId: tx.settlementId,
      created_at: tx.created_at,
      updated_at: tx.updated_at,
    }));

    await this.archivedRepo.save(archivePayload);

    // Now delete original records
    const ids = oldTransactions.map((tx: any) => tx.id);
    await this.transactionRepo.delete(ids);

    console.log(`Archived and removed ${oldTransactions.length} transactions.`);
  }
}
