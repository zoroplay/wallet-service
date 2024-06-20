/* eslint-disable prettier/prettier */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'expense_types' })
export class ExpenseTypes {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ type: 'bigint' })
  amount: number;

  @Index()
  @Column({ type: 'int' })
  fixed: number;

  @Index()
  @Column({ type: 'int' })
  status: number;

  @Index()
  @Column({ type: 'varchar', length: 225, nullable: false })
  title: string;

  @Index()
  @CreateDateColumn({ type: 'datetime' })
  created_at: string;

  @Index()
  @UpdateDateColumn({ type: 'datetime' })
  updated_at: string;
}
