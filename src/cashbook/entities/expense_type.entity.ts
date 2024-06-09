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
  @Column({ type: 'bigint' })
  fixed: number;

  @Index()
  @Column({ type: 'bigint' })
  status: number;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: false })
  title: string;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: false })
  approved_at: Date;

  @Index()
  @CreateDateColumn()
  created_at: string;

  @Index()
  @UpdateDateColumn()
  updated_at: string;
}
