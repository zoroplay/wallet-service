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
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Index()
  @Column({ type: 'int' })
  user_id: number;

  @Index()
  @Column({ type: 'int' })
  branch_id: number;

  @Index()
  @Column({ type: 'int' })
  verified_by: number;

  @Index()
  @Column({ type: 'bigint' })
  amount: number;

  @Index()
  @Column({ type: 'int', default: 0 })
  status: number;

  @Index()
  @Column({ type: 'datetime' })
  verified_at: Date;

  @Index()
  @Column({ type: 'varchar', length: 225, nullable: false })
  comment: string;

  @Index()
  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @Index()
  @UpdateDateColumn({ type: 'datetime' })
  updated_at: string;
}
