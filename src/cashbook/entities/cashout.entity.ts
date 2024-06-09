/* eslint-disable prettier/prettier */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'cash_out' })
export class CashOut {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ type: 'bigint' })
  user_id: number;

  @Index()
  @Column({ type: 'bigint' })
  branch_id: number;

  @Index()
  @Column({ type: 'bigint' })
  verified_by: number;

  @Index()
  @Column({ type: 'bigint' })
  amount: number;

  @Index()
  @Column({ type: 'bigint', default: 0 })
  status: number;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: false })
  verified_at: Date;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: false })
  comment: string;

  @Index()
  @CreateDateColumn()
  created_at: string;

  @Index()
  @UpdateDateColumn()
  updated_at: string;
}
