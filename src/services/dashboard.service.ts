import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ArchivedTransaction } from 'src/entity/archivetransaction.entity';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { IdentityService } from 'src/identity/identity.service';
import { StatisticsResponse, ProductStatistics } from 'src/proto/wallet.pb';
import { Repository } from 'typeorm';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

    @InjectRepository(Transaction)
    private archivedTransactionsRepository: Repository<ArchivedTransaction>,

    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,

    private readonly identityService: IdentityService,
  ) {}

  async financialPerformance(clientId: number) {
    try {
      const [
        depositSum,
        withdrawalSum,
        archivedDepositSum,
        archivedWithdrawalSum,
      ] = await Promise.all([
        this.transactionRepository
          .createQueryBuilder('t')
          .select('SUM(t.amount)', 'sum')
          .where('t.client_id = :clientId', { clientId })
          .andWhere('t.tranasaction_type = :type', { type: 'credit' }) // 'credit' = deposit
          .andWhere('t.subject = :subject', { subject: 'Deposit' })
          .andWhere('t.status = 1')
          .getRawOne(),

        this.transactionRepository
          .createQueryBuilder('t')
          .select('SUM(t.amount)', 'sum')
          .where('t.client_id = :clientId', { clientId })
          .andWhere('t.tranasaction_type = :type', { type: 'debit' }) // 'debit' = withdrawal
          .andWhere('t.subject = :subject', { subject: 'Withdrawal' })
          .andWhere('t.status = 1')
          .getRawOne(),

        this.archivedTransactionsRepository
          .createQueryBuilder('t')
          .select('SUM(t.amount)', 'sum')
          .where('t.client_id = :clientId', { clientId })
          .andWhere('t.tranasaction_type = :type', { type: 'credit' })
          .andWhere('t.subject = :subject', { subject: 'Deposit' })
          .andWhere('t.status = 1')
          .getRawOne(),

        this.archivedTransactionsRepository
          .createQueryBuilder('t')
          .select('SUM(t.amount)', 'sum')
          .where('t.client_id = :clientId', { clientId })
          .andWhere('t.tranasaction_type = :type', { type: 'debit' })
          .andWhere('t.subject = :subject', { subject: 'Withdrawal' })
          .andWhere('t.status = 1')
          .getRawOne(),
      ]);

      const totalDeposit =
        parseFloat(depositSum?.sum || '0') +
        parseFloat(archivedDepositSum?.sum || '0');
      const totalWithdrawal =
        parseFloat(withdrawalSum?.sum || '0') +
        parseFloat(archivedWithdrawalSum?.sum || '0');

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

      const userInfos = players.data || [];

      if (!Array.isArray(userInfos)) {
        return {
          success: false,
          status: 500,
          message: 'Invalid user response format',
          totalOnlinePlayerBalance: '',
          totalOnlinePlayerBonus: '',
          totalRetailBalance: '',
          totalRetailTrustBalance: '',
        };
      }

      const playerUsers = userInfos.filter(
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

      const retailInfos = players.data || [];

      const retailUsers = retailInfos.filter((user) =>
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
      console.log(error);
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
          winningSubject: 'Bonus Bet (Sport)',
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

      const summary = await Promise.all(
        products.map(async (product) => {
          const [
            stake,
            winnings,
            bonusPlayed,
            archivedStake,
            archivedWinnings,
            archivedBonusPlayed,
            bonusGiven,
          ] = await Promise.all([
            this.transactionRepository
              .createQueryBuilder('tx')
              .select('SUM(tx.amount)', 'total')
              .where('tx.client_id = :clientId', { clientId })
              .andWhere('tx.subject = :subject', {
                subject: product.stakeSubject,
              })
              .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
              .getRawOne(),

            this.transactionRepository
              .createQueryBuilder('tx')
              .select('SUM(tx.amount)', 'total')
              .where('tx.client_id = :clientId', { clientId })
              .andWhere('tx.subject = :subject', {
                subject: product.winningSubject,
              })
              .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
              .getRawOne(),

            this.transactionRepository
              .createQueryBuilder('tx')
              .select('SUM(tx.amount)', 'total')
              .where('tx.client_id = :clientId', { clientId })
              .andWhere('tx.subject = :subject', {
                subject: product.winningSubject,
              })
              .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
              .getRawOne(),

            this.archivedTransactionsRepository
              .createQueryBuilder('tx')
              .select('SUM(tx.amount)', 'total')
              .where('tx.client_id = :clientId', { clientId })
              .andWhere('tx.subject = :subject', {
                subject: product.stakeSubject,
              })
              .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
              .getRawOne(),

            this.archivedTransactionsRepository
              .createQueryBuilder('tx')
              .select('SUM(tx.amount)', 'total')
              .where('tx.client_id = :clientId', { clientId })
              .andWhere('tx.subject = :subject', {
                subject: product.winningSubject,
              })
              .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
              .getRawOne(),

            this.archivedTransactionsRepository
              .createQueryBuilder('tx')
              .select('SUM(tx.amount)', 'total')
              .where('tx.client_id = :clientId', { clientId })
              .andWhere('tx.subject = :subject', {
                subject: product.winningSubject,
              })
              .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
              .getRawOne(),

            this.walletRepository
              .createQueryBuilder('wallet')
              .select(`SUM(wallet.${product.walletField})`, 'total')
              .where('wallet.client_id = :clientId', { clientId })
              .getRawOne(),
          ]);

          const totalStake =
            parseFloat(stake?.total || '0') +
            parseFloat(archivedStake?.total || '0');
          const totalWinnings =
            parseFloat(winnings?.total || '0') +
            parseFloat(archivedWinnings?.total || '0');
          const totalBonusPlayed =
            parseFloat(bonusPlayed?.total || '0') +
            parseFloat(archivedBonusPlayed?.total || '0');
          const totalBonusGiven = parseFloat(bonusGiven?.total || '0');

          const ggr = totalStake - totalWinnings;
          const margin =
            totalStake > 0 ? ((ggr / totalStake) * 100).toFixed(2) + '%' : '0%';

          return {
            product: product.name,
            turnover: totalStake,
            margin,
            ggr,
            bonusGiven: totalBonusGiven,
            bonusSpent: totalBonusPlayed,
            ngr: ggr, // Assuming NGR = GGR here
          };
        }),
      );

      return {
        startDate: start,
        endDate: end,
        data: summary,
      };
    } catch (error) {
      console.error('Error in getGamingSummary:', error);
      return {
        success: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error fetching wallet summary: ${error.message}`,
        data: [],
      };
    }
  }

  async GamingSummaryForOnline(
    clientId: number,
    options: {
      rangeZ?: 'day' | 'week' | 'month' | 'year';
      from?: Date;
      to?: Date;
    } = {},
  ): Promise<any> {
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

      // Get player users
      const players = await this.identityService.getClientUsers({ clientId });

      const userInfos = players.data || [];

      if (!Array.isArray(userInfos)) {
        return {
          success: false,
          status: 500,
          message: 'Invalid user response format',
          totalOnlinePlayerBalance: '',
          totalOnlinePlayerBonus: '',
          totalRetailBalance: '',
          totalRetailTrustBalance: '',
        };
      }

      const playerUsers = userInfos.filter(
        (user) => user.role === 'Player' || user.role === null,
      );
      const playerUserIds = playerUsers.map((user) => user.id);

      if (!playerUserIds.length) {
        return {
          startDate: start,
          endDate: end,
          data: [],
        };
      }

      // Fetch all wallet bonus balances in one query
      const walletBonusData = await this.walletRepository
        .createQueryBuilder('wallet')
        .select([
          'SUM(wallet.sport_bonus_balance) AS sport_bonus_balance',
          'SUM(wallet.casino_bonus_balance) AS casino_bonus_balance',
          'SUM(wallet.virtual_bonus_balance) AS virtual_bonus_balance',
        ])
        .where('wallet.user_id IN (:...userIds)', { userIds: playerUserIds })
        .getRawOne();

      const products = [
        {
          name: 'Sport',
          stakeSubject: 'Bet Deposit (Sport)',
          winningSubject: 'Bonus Bet (Sport)',
          walletKey: 'sport_bonus_balance',
        },
        {
          name: 'Casino',
          stakeSubject: 'Bet Deposit (Casino)',
          winningSubject: 'Bonus Bet (Casino)',
          walletKey: 'casino_bonus_balance',
        },
        {
          name: 'Virtual Sport',
          stakeSubject: 'Bet Deposit (Virtual)',
          winningSubject: 'Bonus Bet (Virtual)',
          walletKey: 'virtual_bonus_balance',
        },
      ];

      // Process each product in parallel
      const summary = await Promise.all(
        products.map(async (product) => {
          // Run transaction queries in parallel
          const [
            { totalStake: stakeLive },
            { totalWinnings: winningsLive },
            { totalBonusPlayed: bonusPlayedLive },
            { totalStake: stakeArchived },
            { totalWinnings: winningsArchived },
            { totalBonusPlayed: bonusPlayedArchived },
          ] = await Promise.all([
            // Live - Stake
            this.transactionRepository
              .createQueryBuilder('tx')
              .select('SUM(tx.amount)', 'total')
              .where('tx.client_id = :clientId', { clientId })
              .andWhere('tx.subject = :subject', {
                subject: product.stakeSubject,
              })
              .andWhere('tx.user_id IN (:...userIds)', {
                userIds: playerUserIds,
              })
              .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
              .getRawOne()
              .then((res) => ({ totalStake: parseFloat(res?.total || '0') })),

            // Live - Winnings
            this.transactionRepository
              .createQueryBuilder('tx')
              .select('SUM(tx.amount)', 'total')
              .where('tx.client_id = :clientId', { clientId })
              .andWhere('tx.subject = :subject', {
                subject: product.winningSubject,
              })
              .andWhere('tx.user_id IN (:...userIds)', {
                userIds: playerUserIds,
              })
              .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
              .getRawOne()
              .then((res) => ({
                totalWinnings: parseFloat(res?.total || '0'),
              })),

            // Live - Bonus Played
            this.transactionRepository
              .createQueryBuilder('tx')
              .select('SUM(tx.amount)', 'total')
              .where('tx.client_id = :clientId', { clientId })
              .andWhere('tx.subject = :subject', {
                subject: product.winningSubject,
              })
              .andWhere('tx.user_id IN (:...userIds)', {
                userIds: playerUserIds,
              })
              .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
              .getRawOne()
              .then((res) => ({
                totalBonusPlayed: parseFloat(res?.total || '0'),
              })),

            // Archived - Stake
            this.archivedTransactionsRepository
              .createQueryBuilder('tx')
              .select('SUM(tx.amount)', 'total')
              .where('tx.client_id = :clientId', { clientId })
              .andWhere('tx.subject = :subject', {
                subject: product.stakeSubject,
              })
              .andWhere('tx.user_id IN (:...userIds)', {
                userIds: playerUserIds,
              })
              .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
              .getRawOne()
              .then((res) => ({ totalStake: parseFloat(res?.total || '0') })),

            // Archived - Winnings
            this.archivedTransactionsRepository
              .createQueryBuilder('tx')
              .select('SUM(tx.amount)', 'total')
              .where('tx.client_id = :clientId', { clientId })
              .andWhere('tx.subject = :subject', {
                subject: product.winningSubject,
              })
              .andWhere('tx.user_id IN (:...userIds)', {
                userIds: playerUserIds,
              })
              .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
              .getRawOne()
              .then((res) => ({
                totalWinnings: parseFloat(res?.total || '0'),
              })),

            // Archived - Bonus Played
            this.archivedTransactionsRepository
              .createQueryBuilder('tx')
              .select('SUM(tx.amount)', 'total')
              .where('tx.client_id = :clientId', { clientId })
              .andWhere('tx.subject = :subject', {
                subject: product.winningSubject,
              })
              .andWhere('tx.user_id IN (:...userIds)', {
                userIds: playerUserIds,
              })
              .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
              .getRawOne()
              .then((res) => ({
                totalBonusPlayed: parseFloat(res?.total || '0'),
              })),
          ]);

          const totalStake = stakeLive + stakeArchived;
          const totalWinnings = winningsLive + winningsArchived;
          const totalBonusPlayed = bonusPlayedLive + bonusPlayedArchived;

          // Get bonus given from pre-fetched wallet data
          let totalBonusGiven = 0;
          if (product.name === 'Sport') {
            totalBonusGiven = parseFloat(
              walletBonusData?.sport_bonus_balance || '0',
            );
          } else if (product.name === 'Casino') {
            totalBonusGiven = parseFloat(
              walletBonusData?.casino_bonus_balance || '0',
            );
          } else if (product.name === 'Virtual Sport') {
            totalBonusGiven = parseFloat(
              walletBonusData?.virtual_bonus_balance || '0',
            );
          }

          const ggr = totalStake - totalWinnings;
          const margin =
            totalStake > 0 ? ((ggr / totalStake) * 100).toFixed(2) + '%' : '0%';

          return {
            product: product.name,
            turnover: totalStake,
            margin,
            ggr,
            bonusGiven: totalBonusGiven,
            bonusSpent: totalBonusPlayed,
            ngr: ggr,
          };
        }),
      );

      return {
        startDate: start,
        endDate: end,
        data: summary,
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

  async GamingSummaryForRetail(
    clientId: number,
    options: {
      rangeZ?: 'day' | 'week' | 'month' | 'year';
      from?: Date;
      to?: Date;
    } = {},
  ): Promise<any> {
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

      // Get retail users
      const players = await this.identityService.getClientUsers({ clientId });

      const retailRoles = [
        'Cashier',
        'Shop',
        'Agent',
        'Master Agent',
        'Super Agent',
      ];
      const retailInfos = players.data || [];

      const retailUsers = retailInfos.filter((user) =>
        retailRoles.includes(user.role),
      );

      const retailUserIds = retailUsers.map((user) => user.id);

      if (!retailUserIds.length) {
        return {
          startDate: start,
          endDate: end,
          data: [],
        };
      }

      // Batch fetch all wallet bonus balances in one query
      const walletBonusData = await this.walletRepository
        .createQueryBuilder('wallet')
        .select([
          'SUM(wallet.sport_bonus_balance) AS sport_bonus_balance',
          'SUM(wallet.casino_bonus_balance) AS casino_bonus_balance',
          'SUM(wallet.virtual_bonus_balance) AS virtual_bonus_balance',
        ])
        .where('wallet.user_id IN (:...userIds)', { userIds: retailUserIds })
        .getRawOne();

      const products = [
        {
          name: 'Sport',
          stakeSubject: 'Bet Deposit (Sport)',
          winningSubject: 'Bonus Bet (Sport)',
          walletKey: 'sport_bonus_balance',
        },
        {
          name: 'Casino',
          stakeSubject: 'Bet Deposit (Casino)',
          winningSubject: 'Bonus Bet (Casino)',
          walletKey: 'casino_bonus_balance',
        },
        {
          name: 'Virtual Sport',
          stakeSubject: 'Bet Deposit (Virtual)',
          winningSubject: 'Bonus Bet (Virtual)',
          walletKey: 'virtual_bonus_balance',
        },
      ];

      // Process each product in parallel
      const summary = await Promise.all(
        products.map(async (product) => {
          const [
            { totalStake: liveStake },
            { totalWinnings: liveWinnings },
            { totalBonusPlayed: liveBonus },
            { totalStake: archivedStake },
            { totalWinnings: archivedWinnings },
            { totalBonusPlayed: archivedBonus },
          ] = await Promise.all([
            // Live stake
            this.transactionRepository
              .createQueryBuilder('tx')
              .select('SUM(tx.amount)', 'total')
              .where('tx.client_id = :clientId', { clientId })
              .andWhere('tx.subject = :subject', {
                subject: product.stakeSubject,
              })
              .andWhere('tx.user_id IN (:...userIds)', {
                userIds: retailUserIds,
              })
              .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
              .getRawOne()
              .then((res) => ({ totalStake: parseFloat(res?.total || '0') })),

            // Live winnings
            this.transactionRepository
              .createQueryBuilder('tx')
              .select('SUM(tx.amount)', 'total')
              .where('tx.client_id = :clientId', { clientId })
              .andWhere('tx.subject = :subject', {
                subject: product.winningSubject,
              })
              .andWhere('tx.user_id IN (:...userIds)', {
                userIds: retailUserIds,
              })
              .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
              .getRawOne()
              .then((res) => ({
                totalWinnings: parseFloat(res?.total || '0'),
              })),

            // Live bonus played
            this.transactionRepository
              .createQueryBuilder('tx')
              .select('SUM(tx.amount)', 'total')
              .where('tx.client_id = :clientId', { clientId })
              .andWhere('tx.subject = :subject', {
                subject: product.winningSubject,
              })
              .andWhere('tx.user_id IN (:...userIds)', {
                userIds: retailUserIds,
              })
              .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
              .getRawOne()
              .then((res) => ({
                totalBonusPlayed: parseFloat(res?.total || '0'),
              })),

            // Archived stake
            this.archivedTransactionsRepository
              .createQueryBuilder('tx')
              .select('SUM(tx.amount)', 'total')
              .where('tx.client_id = :clientId', { clientId })
              .andWhere('tx.subject = :subject', {
                subject: product.stakeSubject,
              })
              .andWhere('tx.user_id IN (:...userIds)', {
                userIds: retailUserIds,
              })
              .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
              .getRawOne()
              .then((res) => ({ totalStake: parseFloat(res?.total || '0') })),

            // Archived winnings
            this.archivedTransactionsRepository
              .createQueryBuilder('tx')
              .select('SUM(tx.amount)', 'total')
              .where('tx.client_id = :clientId', { clientId })
              .andWhere('tx.subject = :subject', {
                subject: product.winningSubject,
              })
              .andWhere('tx.user_id IN (:...userIds)', {
                userIds: retailUserIds,
              })
              .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
              .getRawOne()
              .then((res) => ({
                totalWinnings: parseFloat(res?.total || '0'),
              })),

            // Archived bonus played
            this.archivedTransactionsRepository
              .createQueryBuilder('tx')
              .select('SUM(tx.amount)', 'total')
              .where('tx.client_id = :clientId', { clientId })
              .andWhere('tx.subject = :subject', {
                subject: product.winningSubject,
              })
              .andWhere('tx.user_id IN (:...userIds)', {
                userIds: retailUserIds,
              })
              .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
              .getRawOne()
              .then((res) => ({
                totalBonusPlayed: parseFloat(res?.total || '0'),
              })),
          ]);

          const totalStake = liveStake + archivedStake;
          const totalWinnings = liveWinnings + archivedWinnings;
          const totalBonusPlayed = liveBonus + archivedBonus;

          // Get bonus given from pre-fetched wallet data
          const totalBonusGiven = parseFloat(
            walletBonusData?.[product.walletKey] || '0',
          );

          const ggr = totalStake - totalWinnings;
          const margin =
            totalStake > 0 ? ((ggr / totalStake) * 100).toFixed(2) + '%' : '0%';

          return {
            product: product.name,
            turnover: totalStake,
            margin,
            ggr,
            bonusGiven: totalBonusGiven,
            bonusSpent: totalBonusPlayed,
            ngr: ggr,
          };
        }),
      );

      return {
        startDate: start,
        endDate: end,
        data: summary,
      };
    } catch (error) {
      console.error('Error in GamingSummaryForRetail:', error);
      return {
        success: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error fetching wallet summary: ${error.message}`,
        data: [],
      };
    }
  }

  async getSportSummary(
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

    const sportProduct = {
      name: 'Sport',
      stakeSubject: 'Bet Deposit (Sport)',
      winningSubject: 'Bonus Bet (Sport)',
      walletField: 'sport_bonus_balance',
    };

    const [
      { totalStake: liveStake },
      { totalWinnings: liveWinnings },
      { totalBonusPlayed: liveBonus },
      { totalStake: archivedStake },
      { totalWinnings: archivedWinnings },
      { totalBonusPlayed: archivedBonus },
      bonusGiven,
    ] = await Promise.all([
      // Live Stake
      this.transactionRepository
        .createQueryBuilder('tx')
        .select('SUM(tx.amount)', 'total')
        .where('tx.client_id = :clientId', { clientId })
        .andWhere('tx.subject = :subject', {
          subject: sportProduct.stakeSubject,
        })
        .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
        .getRawOne()
        .then((res) => ({ totalStake: parseFloat(res?.total || '0') })),

      // Live Winnings
      this.transactionRepository
        .createQueryBuilder('tx')
        .select('SUM(tx.amount)', 'total')
        .where('tx.client_id = :clientId', { clientId })
        .andWhere('tx.subject = :subject', {
          subject: sportProduct.winningSubject,
        })
        .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
        .getRawOne()
        .then((res) => ({ totalWinnings: parseFloat(res?.total || '0') })),

      // Live Bonus Played
      this.transactionRepository
        .createQueryBuilder('tx')
        .select('SUM(tx.amount)', 'total')
        .where('tx.client_id = :clientId', { clientId })
        .andWhere('tx.subject = :subject', {
          subject: sportProduct.winningSubject,
        })
        .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
        .getRawOne()
        .then((res) => ({ totalBonusPlayed: parseFloat(res?.total || '0') })),

      // Archived Stake
      this.archivedTransactionsRepository
        .createQueryBuilder('tx')
        .select('SUM(tx.amount)', 'total')
        .where('tx.client_id = :clientId', { clientId })
        .andWhere('tx.subject = :subject', {
          subject: sportProduct.stakeSubject,
        })
        .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
        .getRawOne()
        .then((res) => ({ totalStake: parseFloat(res?.total || '0') })),

      // Archived Winnings
      this.archivedTransactionsRepository
        .createQueryBuilder('tx')
        .select('SUM(tx.amount)', 'total')
        .where('tx.client_id = :clientId', { clientId })
        .andWhere('tx.subject = :subject', {
          subject: sportProduct.winningSubject,
        })
        .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
        .getRawOne()
        .then((res) => ({ totalWinnings: parseFloat(res?.total || '0') })),

      // Archived Bonus Played
      this.archivedTransactionsRepository
        .createQueryBuilder('tx')
        .select('SUM(tx.amount)', 'total')
        .where('tx.client_id = :clientId', { clientId })
        .andWhere('tx.subject = :subject', {
          subject: sportProduct.winningSubject,
        })
        .andWhere('tx.created_at BETWEEN :start AND :end', { start, end })
        .getRawOne()
        .then((res) => ({ totalBonusPlayed: parseFloat(res?.total || '0') })),

      // Bonus Given (wallet)
      this.walletRepository
        .createQueryBuilder('wallet')
        .select(`SUM(wallet.${sportProduct.walletField})`, 'total')
        .where('wallet.client_id = :clientId', { clientId })
        .getRawOne(),
    ]);

    const totalStake = liveStake + archivedStake;
    const totalWinnings = liveWinnings + archivedWinnings;
    const totalBonusPlayed = liveBonus + archivedBonus;
    const totalBonusGiven = parseFloat(bonusGiven?.total || '0');

    const ggr = totalStake - totalWinnings;
    const margin =
      totalStake > 0 ? ((ggr / totalStake) * 100).toFixed(2) + '%' : '0%';

    return {
      startDate: start,
      endDate: end,
      data: [
        {
          product: 'Sport',
          turnover: totalStake,
          margin,
          ggr,
          bonusGiven: totalBonusGiven,
          bonusSpent: totalBonusPlayed,
          ngr: ggr,
        },
      ],
    };
  }

  async getMonthlyGamingTurnover(
    clientId: number,
    year: string,
  ): Promise<StatisticsResponse> {
    const products = [
      { key: 'Games', subject: 'Bet Deposit (Games)' },
      { key: 'Casino', subject: 'Bet Deposit (Casino)' },
      { key: 'Sport', subject: 'Bet Deposit (Sport)' },
      { key: 'Virtual', subject: 'Bet Deposit (Virtual)' },
    ];

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    const monthlyMap = new Map<string, number[]>();

    for (const product of products) {
      const monthlyTotals = Array(12).fill(0); // ✅ Moved inside loop

      const result = await this.transactionRepository
        .createQueryBuilder('tx')
        .select(['MONTH(tx.created_at) as month', 'SUM(tx.amount) as total'])
        .where('tx.client_id = :clientId', { clientId })
        .andWhere('tx.subject = :subject', { subject: product.subject })
        .andWhere('YEAR(tx.created_at) = :year', { year })
        .groupBy('MONTH(tx.created_at)')
        .getRawMany();

      const archivedResult = await this.archivedTransactionsRepository
        .createQueryBuilder('tx')
        .select(['MONTH(tx.created_at) as month', 'SUM(tx.amount) as total'])
        .where('tx.client_id = :clientId', { clientId })
        .andWhere('tx.subject = :subject', { subject: product.subject })
        .andWhere('YEAR(tx.created_at) = :year', { year })
        .groupBy('MONTH(tx.created_at)')
        .getRawMany();

      result.forEach((row) => {
        const monthIndex = parseInt(row.month, 10) - 1;
        monthlyTotals[monthIndex] += parseFloat(row.total);
      });

      archivedResult.forEach((row) => {
        const monthIndex = parseInt(row.month, 10) - 1;
        monthlyTotals[monthIndex] += parseFloat(row.total);
      });

      monthlyMap.set(product.key, monthlyTotals);
    }

    const data: ProductStatistics[] = [];

    for (const product of products) {
      const monthlyTurnover = monthlyMap.get(product.key) || Array(12).fill(0);

      const monthlyData = monthlyTurnover.map((turnover, index) => ({
        month: monthNames[index],
        turnover,
      }));

      data.push({
        product: product.key,
        monthlyData,
      });
    }

    return {
      year,
      data,
    };
  }
}
