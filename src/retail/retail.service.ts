import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from 'src/entity/transaction.entity';
import { Wallet } from 'src/entity/wallet.entity';
import { IdentityService } from 'src/identity/identity.service';
import { Repository } from 'typeorm';

@Injectable()
export class RetailService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

    @InjectRepository(Wallet)
    private readonly walletRepsoitory: Repository<Wallet>,

    private readonly identityService: IdentityService,
  ) {}

  async fundUser() {}

  async listLast10Transactions({ userId }) {
    try {
      const result = await this.transactionRepository.find({
        where: {
          user_id: userId,
        },
        order: { created_at: 'DESC' },
        take: 10,
      });

      return {
        success: true,
        message: 'Transaction retrieved',
        status: HttpStatus.OK,
        data: JSON.stringify(result),
      };
    } catch (e) {
      return {
        success: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Something went wrong: ${e.message}`,
      };
    }
  }

  async salesReport() {}

  async balanceOverview({ userId }) {
    try {
      // get cashier balance
      const network = await this.getNetworkBalance(userId);
      // get online user balance
      const players = await this.getOnlinePlayerBalance(userId);

      const data = { network, players };
      return {
        success: true,
        message: 'Transaction retrieved',
        status: HttpStatus.OK,
        data: JSON.stringify(data),
      };
    } catch (e) {
      return {
        success: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Something went wrong: ${e.message}`,
      };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getNetworkBalance(userId) {
    return await this.walletRepsoitory.createQueryBuilder('w');
    // .leftJoin('');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getOnlinePlayerBalance(userId) {}
}
