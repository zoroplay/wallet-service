import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'wallets' })
export class Wallet {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column()
  client_id: number;

  @Index()
  @Column({ type: 'bigint' })
  user_id: number;

  @Index()
  @Column({ type: 'varchar', length: 150 })
  username: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  balance: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  available_balance: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  trust_balance: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  sport_bonus_balance: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  virtual_bonus_balance: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  casino_bonus_balance: number;

  @Column({ type: 'tinyint', default: 0 })
  status: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  virtual_branchId: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  virtual_accountNo: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  virtual_accountName: string;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 2,
    default: 0,
    nullable: true,
  })
  virtual_balance: number;

  @Column({ type: 'boolean', default: false })
  virtual_accountDefault: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  virtual_nubanAccountNo: string;

  @Column({ type: 'boolean', default: false })
  virtual_acctClosureFlag: boolean;

  @Column({ type: 'boolean', default: false })
  virtual_acctDeleteFlag: boolean;
  @Index()
  @CreateDateColumn()
  created_at: string;

  @Index()
  @UpdateDateColumn()
  updated_at: string;
}
