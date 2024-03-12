import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'transactions' })
export class Transaction {
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
  @Column({ type: 'varchar', length: 20, nullable: false })
  transaction_no: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'varchar', length: 20, nullable: false })
  transaction_type: string;

  @Column({ type: 'varchar', length: 50 })
  subject: string;

  @Column({ type: 'varchar', length: 200 })
  description: string;

  @Column({ type: 'varchar', length: 20 })
  source: string;

  @Column({ type: 'varchar', length: 20 })
  channel: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  balance: number;

  @Column({ type: 'tinyint', default: 0 })
  status: number;

  @Index()
  @CreateDateColumn()
  created_at: string;

  @Index()
  @UpdateDateColumn()
  updated_at: string;
}
