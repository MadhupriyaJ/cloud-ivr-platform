import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'Domains' })
export class DomainEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'DomainId' })
  domainId!: string;

  @Column({ name: 'DomainCode', unique: true, length: 80 })
  domainCode!: string;

  @Column({ name: 'DisplayName', length: 120 })
  displayName!: string;

  @Column({ name: 'OrganizationName', length: 160 })
  organizationName!: string;

  @Column({ name: 'IndustryType', length: 80 })
  industryType!: string;

  @Column({ name: 'DefaultLanguage', length: 40 })
  defaultLanguage!: string;

  /**
   * Comma-separated languages callers may use, e.g. "English, Tamil".
   * Null/empty = any language. Added by database/mssql/005_multilingual.sql.
   */
  @Column({ name: 'SupportedLanguages', type: 'nvarchar', length: 200, nullable: true })
  supportedLanguages!: string | null;

  @Column({ name: 'DefaultVoice', length: 60 })
  defaultVoice!: string;

  @Column({ name: 'WelcomeMessage', length: 500 })
  welcomeMessage!: string;

  @Column({ name: 'FallbackMessage', length: 500 })
  fallbackMessage!: string;

  @Column({ name: 'EscalationMessage', length: 500 })
  escalationMessage!: string;

  @Column({ name: 'IsActive', type: 'bit', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime2' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'UpdatedAt', type: 'datetime2' })
  updatedAt!: Date;
}
