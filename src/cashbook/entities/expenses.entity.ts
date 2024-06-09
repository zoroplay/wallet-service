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
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ type: 'bigint' })
  branch_id: number;

  @ManyToOne(() => ExpenseTypes, { eager: true })
  @JoinColumn({ name: 'expense_types_id' })
  expense_type_id: number;

  @Index()
  @Column({ type: 'bigint' })
  verified_by: number;

  @Index()
  @Column({ type: 'bigint' })
  requested_amount: number;
  @Index()
  @Column({ type: 'bigint' })
  approved_amount: number;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: false })
  branch_comment: string;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: false })
  admin_comment: string;

  @Index()
  @Column({ type: 'bigint' })
  status: number;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: false })
  verified_at: Date;

  @Index()
  @CreateDateColumn()
  created_at: string;

  @Index()
  @UpdateDateColumn()
  updated_at: string;
}
