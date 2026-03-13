import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'DomainRules' })
export class DomainRuleEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'RuleId' })
  ruleId!: string;

  @Column({ name: 'DomainId' })
  domainId!: string;

  @Column({ name: 'RuleType', length: 60 })
  ruleType!: string;

  @Column({ name: 'RuleText', length: 1000 })
  ruleText!: string;

  @Column({ name: 'Priority', type: 'int', default: 100 })
  priority!: number;

  @Column({ name: 'IsActive', type: 'bit', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime2' })
  createdAt!: Date;
}
