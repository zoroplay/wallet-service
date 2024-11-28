import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'withdrawal_accounts' })
export class WithdrawalAccount {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column()
  client_id: number;

  @Index()
  @Column({ type: 'bigint' })
  user_id: number;

  @Column({ type: 'bigint', nullable: true })
  bank_id: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  bank_code: string;

  @Column({ type: 'varchar', length: 150 })
  account_number: number;

  @Column({ type: 'varchar', length: 250, nullable: true })
  account_name: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  recipient_code: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  authorization_code: string;

  @Column({ type: 'tinyint', default: 1 })
  status: number;

  @Index()
  @CreateDateColumn()
  created_at: string;

  @Index()
  @UpdateDateColumn()
  updated_at: string;
}
