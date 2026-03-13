import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'DomainIntents' })
export class DomainIntentEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'IntentId' })
  intentId!: string;

  @Column({ name: 'DomainId', type: 'uniqueidentifier' })
  domainId!: string;

  @Column({ name: 'IntentCode', type: 'nvarchar', length: 100 })
  intentCode!: string;

  @Column({ name: 'IntentLabel', type: 'nvarchar', length: 120 })
  intentLabel!: string;

  @Column({ name: 'Description', type: 'nvarchar', length: 255, nullable: true })
  description!: string | null;

  @Column({ name: 'Priority', type: 'int', default: 100 })
  priority!: number;

  @Column({ name: 'IsActive', type: 'bit', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime2' })
  createdAt!: Date;
}
