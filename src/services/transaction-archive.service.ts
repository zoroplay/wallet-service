import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { subMonths } from 'date-fns';
import { Transaction } from 'src/entity/transaction.entity';
import { ArchivedTransaction } from 'src/entity/archivetransaction.entity';

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

    try {
      const threeMonthsAgo = subMonths(new Date(), 4);

      const query = this.transactionRepo
        .createQueryBuilder('tx')
        .where('tx.created_at < :date', { date: threeMonthsAgo });

      console.log('Query SQL:', query.getSql());
      console.log('Query Parameters:', query.getParameters());

      const oldTransactions = await query.getMany();
      if (!oldTransactions.length) {
        console.log('No transactions to archive.');
        return;
      }
      console.log('4');
      console.log('Three months ago date:', threeMonthsAgo);

      console.log('Found transactions count:', oldTransactions.length);

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

      // Transaction for atomic operation
      // await this.transactionRepo.manager.transaction(
      //   async (transactionalEntityManager) => {
      //     await transactionalEntityManager
      //       .getRepository(ArchivedTransaction)
      //       .save(archivePayload);
      //     await transactionalEntityManager
      //       .getRepository(Transaction)
      //       .delete(oldTransactions.map((tx: any) => tx.id));
      //   },
      // );

      console.log(
        `Archived and removed ${oldTransactions.length} transactions.`,
      );
    } catch (error) {
      console.error('Error during transaction archiving:', error);
    }
  }
}
