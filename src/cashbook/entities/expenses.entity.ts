/* eslint-disable prettier/prettier */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { ExpenseTypes } from './expense_type.entity';

@Entity({ name: 'expenses' })
export class Expenses {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Index()
  @Column({ type: 'int' })
  client_id: number;

  @Index()
  @Column({ type: 'int' })
  branch_id: number;

  @ManyToOne(() => ExpenseTypes, { eager: true })
  @JoinColumn({ name: 'expense_types_id' })
  expense_type_id: number;

  @Index()
  @Column({ type: 'int' })
  verified_by: number;

  @Column({ type: 'bigint' })
  requested_amount: number;

  @Column({ type: 'bigint' })
  amount: number;

  @Column({ type: 'varchar', length: 225, nullable: false })
  branch_comment: string;

  @Column({ type: 'varchar', length: 225, nullable: false })
  admin_comment: string;

  @Index()
  @Column({ type: 'int' })
  status: number;

  @Index()
  @Column({ type: 'datetime', nullable: true })
  verified_at: Date;

  @Index()
  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @Index()
  @UpdateDateColumn({ type: 'datetime' })
  updated_at: string;
}
