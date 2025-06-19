import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { IdentityService } from 'src/identity/identity.service';
import { Repository } from 'typeorm';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,

    private readonly identityService: IdentityService,
  ) {}

  async financialPerformance(clientId: number) {
    try {
      const [depositSum, withdrawalSum] = await Promise.all([
        this.transactionRepository
          .createQueryBuilder('t')
          .select('SUM(t.amount)', 'sum')
          .where('t.client_id = :clientId', { clientId })
          .andWhere('t.tranasaction_type = :type', { type: 'credit' }) // 'credit' = deposit
          .andWhere('t.subject = :subject', { subject: 'Deposit' })
          .andWhere('t.status = 1')
          // .andWhere('t.created_at BETWEEN :start AND :end', { start, end })
          .getRawOne(),

        this.transactionRepository
          .createQueryBuilder('t')
          .select('SUM(t.amount)', 'sum')
          .where('t.client_id = :clientId', { clientId })
          .andWhere('t.tranasaction_type = :type', { type: 'debit' }) // 'debit' = withdrawal
          .andWhere('t.subject = :subject', { subject: 'Withdrawal' })
          .andWhere('t.status = 1')
          // .andWhere('t.created_at BETWEEN :start AND :end', { start, end })
          .getRawOne(),
      ]);

      const totalDeposit = parseFloat(depositSum?.sum || '0');
      const totalWithdrawal = parseFloat(withdrawalSum?.sum || '0');

      return {
        success: true,
        status: 200,
        message: 'Wallet summary fetched successfully',
        totalDeposit,
        totalWithdrawal,
      };
    } catch (error) {
      return {
        success: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error fetching wallet summary: ${error.message}`,
        data: [],
      };
    }
  }

  async balances(clientId: number) {
    try {
      const players = await this.identityService.getClientUsers({ clientId });

      console.log('Raw response:', JSON.stringify(players, null, 2));

      const playerUsers = players.userInfos.filter(
        (user) => user.role === 'Player' || user.role === null,
      );
      const playerUserIds = playerUsers.map((user) => user.id);

      // Player balance
      let playerBalancesSum = { sum: '0' };
      if (playerUserIds.length > 0) {
        playerBalancesSum = await this.walletRepository
          .createQueryBuilder('w')
          .select('SUM(w.available_balance)', 'sum')
          .where('w.user_id IN (:...playerUserIds)', { playerUserIds })
          .getRawOne();
      }

      // Player bonus
      let playerBonusSum = { sum: '0' };
      if (playerUserIds.length > 0) {
        playerBonusSum = await this.walletRepository
          .createQueryBuilder('w')
          .select(
            `SUM(w.sport_bonus_balance + w.virtual_bonus_balance + w.casino_bonus_balance)`,
            'sum',
          )
          .where('w.user_id IN (:...playerUserIds)', { playerUserIds })
          .getRawOne();
      }

      const retailRoles = [
        'Cashier',
        'Shop',
        'Agent',
        'Master Agent',
        'Super Agent',
      ];

      // Filter only 'Shop' roles
      const retailUsers = players.userInfos.filter((user) =>
        retailRoles.includes(user.role),
      );
      const retailUserIds = retailUsers.map((user) => user.id);

      // Retail balance
      let retailBalanceSum = { sum: '0' };
      if (retailUserIds.length > 0) {
        retailBalanceSum = await this.walletRepository
          .createQueryBuilder('w')
          .select('SUM(w.balance)', 'sum')
          .where('w.user_id IN (:...retailUserIds)', { retailUserIds })
          .getRawOne();
      }

      // Retail trust balance
      let retailTrustBalance = { sum: '0' };
      if (retailUserIds.length > 0) {
        retailTrustBalance = await this.walletRepository
          .createQueryBuilder('w')
          .select('SUM(w.trust_balance)', 'sum')
          .where('w.user_id IN (:...retailUserIds)', { retailUserIds })
          .getRawOne();
      }

      const totalOnlinePlayerBalance = parseFloat(
        playerBalancesSum?.sum || '0',
      );
      const totalOnlinePlayerBonus = parseFloat(playerBonusSum?.sum || '0');
      const totalRetailBalance = parseFloat(retailBalanceSum?.sum || '0');
      const totalRetailTrustBalance = parseFloat(
        retailTrustBalance?.sum || '0',
      );

      return {
        success: true,
        status: 200,
        message: 'Data fetched successfully',
        totalOnlinePlayerBalance,
        totalOnlinePlayerBonus,
        totalRetailBalance,
        totalRetailTrustBalance,
      };
    } catch (error) {
      return {
        success: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error fetching wallet summary: ${error.message}`,
        totalOnlinePlayerBalance: '',
        totalOnlinePlayerBonus: '',
        totalRetailBalance: '',
        totalRetailTrustBalance: '',
      };
    }
  }

  private getDateRange(
    range: 'day' | 'week' | 'month' | 'year' | 'yesterday',
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

      case 'yesterday':
        // Set start to the beginning of yesterday
        start.setUTCDate(start.getUTCDate() - 1);
        start.setUTCHours(0, 0, 0, 0);

        // Set end to the end of yesterday
        end.setUTCDate(end.getUTCDate() - 1);
        end.setUTCHours(23, 59, 59, 999);
        break;
    }

    return { start, end };
  }

  async getGamingSummary(
    clientId: number,
    options: {
      rangeZ?: 'day' | 'week' | 'month' | 'year';
      from?: Date;
      to?: Date;
    } = {},
  ) {
    try {
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

      const products = [
        {
          name: 'Sport',
          stakeSubject: 'Bet Deposit (Sport)',
          winningSubject: 'Bonus Bet (Sport)', //:TODO: check  Sport Win
          walletField: 'sport_bonus_balance', // from wallet bonus
        },
        {
          name: 'Casino',
          stakeSubject: 'Bet Deposit (Casino)',
          winningSubject: 'Bonus Bet (Casino)',
          walletField: 'casino_bonus_balance', // from wallet
        },
        {
          name: 'Virtual Sport',
          stakeSubject: 'Bet Deposit (Virtual)', // Intentionally matching your spelling
          winningSubject: 'Bonus Bet (Virtual)',
          walletField: 'virtual_bonus_balance', // from wallet bonus
        },
      ];

      const summary = [];

      for (const product of products) {
        // Total Stake
        const stake = await this.transactionRepository
          .createQueryBuilder('tx')
          .select('SUM(tx.amount)', 'total')
          .where('tx.client_id = :clientId', { clientId })
          .andWhere('tx.subject = :subject', { subject: product.stakeSubject })
          .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
          .getRawOne();
        console.log('CHECK-1');
        const totalStake = parseFloat(stake?.total || 0);

        // Winnings
        const winnings = await this.transactionRepository
          .createQueryBuilder('tx')
          .select('SUM(tx.amount)', 'total')
          .where('tx.client_id = :clientId', { clientId })
          .andWhere('tx.subject = :subject', {
            subject: product.winningSubject,
          })
          .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
          .getRawOne();
        console.log('CHECK-2');

        const totalWinnings = parseFloat(winnings?.total || 0);

        // GGR
        const ggr = totalStake - totalWinnings;

        // Margin
        const margin =
          totalStake > 0 ? ((ggr / totalStake) * 100).toFixed(2) + '%' : '0%';

        // Bonus Played (same as winningSubject)
        const bonusPlayed = await this.transactionRepository
          .createQueryBuilder('tx')
          .select('SUM(tx.amount)', 'total')
          .where('tx.client_id = :clientId', { clientId })
          .andWhere('tx.subject = :subject', {
            subject: product.winningSubject,
          })
          .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
          .getRawOne();
        console.log('CHECK-3');

        const totalBonusPlayed = parseFloat(bonusPlayed?.total || 0);

        // Bonus Given (from wallet)
        const bonusGiven = await this.walletRepository
          .createQueryBuilder('wallet')
          .select(`SUM(wallet.${product.walletField})`, 'total')
          .where('wallet.client_id = :clientId', { clientId })
          .getRawOne();
        console.log('CHECK-3');
        const totalBonusGiven = parseFloat(bonusGiven?.total || 0);

        summary.push({
          product: product.name,
          turnover: totalStake,
          margin,
          ggr,
          bonusGiven: totalBonusGiven,
          bonusSpent: totalBonusPlayed,
          ngr: ggr,
        });
      }

      return {
        startDate: start,
        endDate: end,
        data: summary,
      };
    } catch (error) {
      console.error('Error in getGamingSummary:', error);
      throw new Error('Could not generate gaming summary');
    }
  }

  async GamingSummaryForOnline(
    clientId: number,
    options: {
      rangeZ?: 'day' | 'week' | 'month' | 'year';
      from?: Date;
      to?: Date;
    } = {},
  ) {
    try {
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

      const players = await this.identityService.getClientUsers({ clientId });

      const playerUsers = players.userInfos.filter(
        (user) => user.role === 'Player' || user.role === null,
      );
      const playerUserIds = playerUsers.map((user) => user.id);

      const products = [
        {
          name: 'Sport',
          stakeSubject: 'Bet Deposit (Sport)',
          winningSubject: 'Bonus Bet (Sport)', // TODO: consider renaming
          walletField: 'sport_bonus_balance',
        },
        {
          name: 'Casino',
          stakeSubject: 'Bet Deposit (Casino)',
          winningSubject: 'Bonus Bet (Casino)',
          walletField: 'casino_bonus_balance',
        },
        {
          name: 'Virtual Sport',
          stakeSubject: 'Bet Deposit (Virtual)',
          winningSubject: 'Bonus Bet (Virtual)',
          walletField: 'virtual_bonus_balance',
        },
      ];

      const summary = [];

      for (const product of products) {
        // Total Stake
        const stake = await this.transactionRepository
          .createQueryBuilder('tx')
          .select('SUM(tx.amount)', 'total')
          .where('tx.client_id = :clientId', { clientId })
          .andWhere('tx.subject = :subject', { subject: product.stakeSubject })
          .andWhere('tx.user_id IN (:...userIds)', { userIds: playerUserIds })
          .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
          .getRawOne();

        const totalStake = parseFloat(stake?.total || 0);

        // Winnings
        const winnings = await this.transactionRepository
          .createQueryBuilder('tx')
          .select('SUM(tx.amount)', 'total')
          .where('tx.client_id = :clientId', { clientId })
          .andWhere('tx.subject = :subject', {
            subject: product.winningSubject,
          })
          .andWhere('tx.user_id IN (:...userIds)', { userIds: playerUserIds })
          .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
          .getRawOne();

        const totalWinnings = parseFloat(winnings?.total || 0);

        // GGR
        const ggr = totalStake - totalWinnings;

        // Margin
        const margin =
          totalStake > 0 ? ((ggr / totalStake) * 100).toFixed(2) + '%' : '0%';

        // Bonus Played
        const bonusPlayed = await this.transactionRepository
          .createQueryBuilder('tx')
          .select('SUM(tx.amount)', 'total')
          .where('tx.client_id = :clientId', { clientId })
          .andWhere('tx.subject = :subject', {
            subject: product.winningSubject,
          })
          .andWhere('tx.user_id IN (:...userIds)', { userIds: playerUserIds })
          .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
          .getRawOne();

        const totalBonusPlayed = parseFloat(bonusPlayed?.total || 0);

        // Bonus Given (wallet)
        const bonusGiven = await this.walletRepository
          .createQueryBuilder('wallet')
          .select(`SUM(wallet.${product.walletField})`, 'total')
          .where('wallet.user_id IN (:...userIds)', { userIds: playerUserIds })
          .getRawOne();

        const totalBonusGiven = parseFloat(bonusGiven?.total || 0);

        summary.push({
          product: product.name,
          turnover: totalStake,
          margin,
          ggr,
          bonusGiven: totalBonusGiven,
          bonusSpent: totalBonusPlayed,
          ngr: ggr,
        });
      }

      return {
        startDate: start,
        endDate: end,
        data: summary,
      };
    } catch (error) {
      throw new Error('Error generating gaming summary: ' + error.message);
    }
  }

  async GamingSummaryForRetail(
    clientId: number,
    options: {
      rangeZ?: 'day' | 'week' | 'month' | 'year';
      from?: Date;
      to?: Date;
    } = {},
  ) {
    try {
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

      const players = await this.identityService.getClientUsers({ clientId });

      const retailRoles = [
        'Cashier',
        'Shop',
        'Agent',
        'Master Agent',
        'Super Agent',
      ];

      // Filter only 'Shop' roles
      const retailUsers = players.userInfos.filter((user) =>
        retailRoles.includes(user.role),
      );
      const retailUserIds = retailUsers.map((user) => user.id);

      const products = [
        {
          name: 'Sport',
          stakeSubject: 'Bet Deposit (Sport)',
          winningSubject: 'Bonus Bet (Sport)', // TODO: consider renaming
          walletField: 'sport_bonus_balance',
        },
        {
          name: 'Casino',
          stakeSubject: 'Bet Deposit (Casino)',
          winningSubject: 'Bonus Bet (Casino)',
          walletField: 'casino_bonus_balance',
        },
        {
          name: 'Virtual Sport',
          stakeSubject: 'Bet Deposit (Virtual)',
          winningSubject: 'Bonus Bet (Virtual)',
          walletField: 'virtual_bonus_balance',
        },
      ];

      const summary = [];

      for (const product of products) {
        // Total Stake
        const stake = await this.transactionRepository
          .createQueryBuilder('tx')
          .select('SUM(tx.amount)', 'total')
          .where('tx.client_id = :clientId', { clientId })
          .andWhere('tx.subject = :subject', { subject: product.stakeSubject })
          .andWhere('tx.user_id IN (:...userIds)', { userIds: retailUserIds })
          .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
          .getRawOne();

        const totalStake = parseFloat(stake?.total || 0);

        // Winnings
        const winnings = await this.transactionRepository
          .createQueryBuilder('tx')
          .select('SUM(tx.amount)', 'total')
          .where('tx.client_id = :clientId', { clientId })
          .andWhere('tx.subject = :subject', {
            subject: product.winningSubject,
          })
          .andWhere('tx.user_id IN (:...userIds)', { userIds: retailUserIds })
          .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
          .getRawOne();

        const totalWinnings = parseFloat(winnings?.total || 0);

        // GGR
        const ggr = totalStake - totalWinnings;

        // Margin
        const margin =
          totalStake > 0 ? ((ggr / totalStake) * 100).toFixed(2) + '%' : '0%';

        // Bonus Played
        const bonusPlayed = await this.transactionRepository
          .createQueryBuilder('tx')
          .select('SUM(tx.amount)', 'total')
          .where('tx.client_id = :clientId', { clientId })
          .andWhere('tx.subject = :subject', {
            subject: product.winningSubject,
          })
          .andWhere('tx.user_id IN (:...userIds)', { userIds: retailUserIds })
          .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
          .getRawOne();

        const totalBonusPlayed = parseFloat(bonusPlayed?.total || 0);

        // Bonus Given (wallet)
        const bonusGiven = await this.walletRepository
          .createQueryBuilder('wallet')
          .select(`SUM(wallet.${product.walletField})`, 'total')
          .where('wallet.user_id IN (:...userIds)', { userIds: retailUserIds })
          .getRawOne();

        const totalBonusGiven = parseFloat(bonusGiven?.total || 0);

        summary.push({
          product: product.name,
          turnover: totalStake,
          margin,
          ggr,
          bonusGiven: totalBonusGiven,
          bonusSpent: totalBonusPlayed,
          ngr: ggr,
        });
      }

      return {
        startDate: start,
        endDate: end,
        data: summary,
      };
    } catch (error) {
      console.error('Error in getGamingSummary:', error);
      throw new Error('Could not generate gaming summary');
    }
  }
}
