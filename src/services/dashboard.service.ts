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

      //const data = await this.identityService.getUser({ clientId })

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
}
