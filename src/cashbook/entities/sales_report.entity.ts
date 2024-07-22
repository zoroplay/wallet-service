/* eslint-disable prettier/prettier */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'sales_reports' })
export class SalesReport {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Index()
  @Column({ type: 'int' })
  branchId: number;

  @Index()
  @Column({ type: 'int' })
  clientId: number;

  @Column({ type: 'bigint' })
  openingBalance: number;

  @Column({ type: 'bigint' })
  closingBalance: number;

  @Column({ type: 'bigint' })
  onlinePayouts: number;

  @Column({ type: 'bigint' })
  onlineSales: number;

  @Column({ type: 'bigint' })
  normalSales: number;

  @Column({ type: 'bigint' })
  normalPayouts: number;

  @Column({ type: 'bigint' })
  otherSales: number;

  @Column({ type: 'bigint' })
  otherPayouts: number;

  @Column({ type: 'bigint' })
  cashin: number;

  @Column({ type: 'bigint' })
  cashout: number;

  @Column({ type: 'bigint' })
  expenses: number;

  @Index()
  @Column({ type: 'int' })
  verifiedBy: number;

  @Index()
  @Column({ type: 'int', default: 0, nullable: true })
  status: number;

  @Index()
  @Column({ type: 'datetime', nullable: true })
  verifiedAt: Date;

  @Index()
  @Column({ type: 'datetime', nullable: true })
  date: Date;

  @Index()
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @Index()
  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
