import {Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,} from "typeorm";

@Entity({name: 'withdrawal'})
export class Withdrawal {
    @PrimaryGeneratedColumn({ type: "bigint"})
    id: number;

    @Index()
    @Column()
    client_id: number;

    @Index()
    @Column({ type: "bigint"})
    user_id: number;

    @Index()
    @Column({ type: "varchar", length: 50 })
    username: string;

    @Column({ type: "decimal", precision: 20, scale: 2, default: 0 })
    amount: number;

    @Column({ type: "varchar", length: 20, nullable: true})
    withdrawal_code: string;

    @Column({ type: "int" })
    account_number: number;

    @Column({ type: "varchar", length: 150, nullable: true})
    account_name: string;

    @Column({ type: "text", nullable: true})
    comment: string;

    @Column({ type: "varchar", length: 150, nullable: true})
    updated_by: string;

    @Column({ type: "tinyint", default: 0 })
    status: number;

    @Index()
    @CreateDateColumn()
    created_at: string;

    @Index()
    @UpdateDateColumn()
    updated_at: string;

}