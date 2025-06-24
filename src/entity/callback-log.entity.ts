import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'callback_logs' })
export class CallbackLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column()
  client_id: number;

  @Column({ type: 'longtext', nullable: true })
  request: string;

  @Column({ type: 'longtext', nullable: true })
  response: string;

  @Column({ type: 'tinyint', default: 0 })
  status: number;

  @Column({
    name: 'request_type',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  type: string;

  @Column({ name: 'transactionId', type: 'varchar', length: 255 })
  transaction_id: string;

  @Column({ type: 'varchar', length: 255 })
  paymentMethod: string;

  @Index()
  @CreateDateColumn()
  created_at: string;

  @Index()
  @UpdateDateColumn()
  updated_at: string;
}
