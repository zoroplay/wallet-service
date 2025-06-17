// archived-transaction.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'archived_transactions' })
export class ArchivedTransaction {
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

  @Index()
  @Column({ type: 'varchar', length: 150, nullable: false })
  transaction_no: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  amount: number;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: false })
  tranasaction_type: string;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  subject: string;

  @Column({ type: 'varchar', length: 200 })
  description: string;

  @Index()
  @Column({ type: 'varchar', length: 150, nullable: true })
  source: string;

  @Index()
  @Column({ type: 'varchar', length: 150, nullable: true })
  channel: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  balance: number;

  @Column({ type: 'varchar', default: 'main' })
  wallet: string;

  @Column({ type: 'tinyint', default: 0 })
  status: number;

  @Column({ type: 'varchar', nullable: true })
  settlementId: string;

  @Index()
  @CreateDateColumn()
  created_at: string;

  @Index()
  @UpdateDateColumn()
  updated_at: string;
}
