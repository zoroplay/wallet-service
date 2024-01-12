import {Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,} from "typeorm";

@Entity({name: 'payment_methods'})
export class PaymentMethod {
    @PrimaryGeneratedColumn({ type: "bigint"})
    id: number;

    @Index()
    @Column()
    client_id: number;

    @Column({ type: "varchar", length: 200, nullable: false })
    display_name: string;

    @Column({ type: "varchar", length: 150, nullable: false })
    provider: string;

    @Column({ type: "varchar", length: 150, nullable: true })
    base_url: string;

    @Column({ type: "varchar", length: 150, nullable: true })
    secret_key: string;

    @Column({ type: "varchar", length: 150, nullable: true })
    public_key: string;

    @Column({ type: "varchar", length: 150, nullable: true })
    merchant_id: string;

    @Column({ type: "varchar", length: 150, nullable: true })
    logo_path: string;

    @Column({ type: "tinyint", default: 0 })
    status: number;

    @Column({ type: "tinyint", default: 0 })
    for_disbursement: number;

    @Index()
    @CreateDateColumn()
    created_at: string;

    @Index()
    @UpdateDateColumn()
    updated_at: string;

}