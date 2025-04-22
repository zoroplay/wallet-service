import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from 'src/entity/transaction.entity';
import { Repository } from 'typeorm';

@Injectable()
export class SummeryService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  private getDateRange(
    range: 'day' | 'week' | 'month' | 'year',
    date = new Date(),
  ) {
    const start = new Date(date);
    const end = new Date(date);

    switch (range) {
      case 'day':
        start.setUTCHours(0, 0, 0, 0);
        end.setUTCHours(23, 59, 59, 999);
        break;
      case 'week': {
        const day = start.getUTCDay();
        const diffToMonday = (day + 6) % 7;
        start.setUTCDate(start.getUTCDate() - diffToMonday);
        start.setUTCHours(0, 0, 0, 0);
        end.setUTCDate(start.getUTCDate() + 6);
        end.setUTCHours(23, 59, 59, 999);
        break;
      }
      case 'month':
        start.setUTCDate(1);
        start.setUTCHours(0, 0, 0, 0);
        end.setUTCMonth(start.getUTCMonth() + 1, 0);
        end.setUTCHours(23, 59, 59, 999);
        break;
      case 'year':
        start.setUTCMonth(0, 1);
        start.setUTCHours(0, 0, 0, 0);
        end.setUTCMonth(11, 31);
        end.setUTCHours(23, 59, 59, 999);
        break;
    }

    return { start, end };
  }

  async getSummary(
    clientId: number,
    options: {
      rangeZ?: 'day' | 'week' | 'month' | 'year';
      from?: Date;
      to?: Date;
    } = {},
  ) {
    let start: Date, end: Date;

    if (options.from && options.to) {
      start = new Date(options.from);
      start.setUTCHours(0, 0, 0, 0);
      end = new Date(options.to);
      end.setUTCHours(23, 59, 59, 999);
    } else {
      const { start: defaultStart, end: defaultEnd } = this.getDateRange(
        options.rangeZ || 'day',
      );
      start = defaultStart;
      end = defaultEnd;
    }

    const [depositSum, withdrawalSum, playerBalance] = await Promise.all([
      this.transactionRepository
        .createQueryBuilder('t')
        .select('SUM(t.amount)', 'sum')
        .where('t.client_id = :clientId', { clientId })
        .andWhere('t.tranasaction_type = :type', { type: 'deposit' })
        .andWhere('t.created_at BETWEEN :start AND :end', { start, end })
        .getRawOne(),

      this.transactionRepository
        .createQueryBuilder('t')
        .select('SUM(t.amount)', 'sum')
        .where('t.client_id = :clientId', { clientId })
        .andWhere('t.tranasaction_type = :type', { type: 'withdrawal' })
        .andWhere('t.created_at BETWEEN :start AND :end', { start, end })
        .getRawOne(),

      this.transactionRepository
        .createQueryBuilder('t')
        .select('SUM(t.balance)', 'totalBalance')
        .where('t.client_id = :clientId', { clientId })
        .andWhere('t.created_at BETWEEN :start AND :end', { start, end })
        .getRawOne(),
    ]);

    const deposit = parseFloat(depositSum?.sum || '0');
    const withdrawal = parseFloat(withdrawalSum?.sum || '0');
    const creditBalance = deposit - withdrawal;

    return {
      from: start,
      to: end,
      deposit,
      withdrawal,
      creditBalance,
      playerBalance: parseFloat(playerBalance?.totalBalance || '0'),
    };
  }
}
