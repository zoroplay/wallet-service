import {Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,} from "typeorm";

@Entity({name: 'banks'})
export class Bank {
    @PrimaryGeneratedColumn({ type: "bigint"})
    id: number;

    @Index()
    @Column({ type: "bigint"})
    bank_id: number;

    @Column({ type: "varchar", length: 150 })
    name: string;

    @Column({ type: "varchar", length: 150 })
    slug: string;

    @Column({ type: "varchar", length: 20 })
    code: string;

    @Column({ type: "varchar", length: 20, nullable: true })
    long_code: string;

    @Column({ type: "varchar", length: 50, default: 'Nigeria' })
    country: string;

    @Column({ type: "varchar", length: 20, default: 'NGN' })
    currency: string;

    @Column({ type: "tinyint", default: 0 })
    status: number;

    @Index()
    @CreateDateColumn()
    created_at: string;

    @Index()
    @UpdateDateColumn()
    updated_at: string;

}