import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Maps a real inbound phone number to the IVR domain that should answer it.
 * One row per number you own at the telephony provider.
 */
@Entity({ name: 'PhoneNumbers' })
export class PhoneNumberEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'PhoneNumberId' })
  phoneNumberId!: string;

  /** E.164, e.g. +14155550123. Matched against Twilio's `To` parameter. */
  @Column({ name: 'PhoneNumber', type: 'nvarchar', length: 32, unique: true })
  phoneNumber!: string;

  @Column({ name: 'FriendlyName', type: 'nvarchar', length: 120, nullable: true })
  friendlyName!: string | null;

  @Column({ name: 'DomainId', type: 'uniqueidentifier' })
  domainId!: string;

  @Column({ name: 'Provider', type: 'nvarchar', length: 40, default: 'twilio' })
  provider!: string;

  /** Fallback human number when no agent has a direct dial. */
  @Column({ name: 'EscalationNumber', type: 'nvarchar', length: 32, nullable: true })
  escalationNumber!: string | null;

  @Column({ name: 'EscalationSkillGroup', type: 'nvarchar', length: 120, nullable: true })
  escalationSkillGroup!: string | null;

  @Column({ name: 'GreetingOverride', type: 'nvarchar', length: 500, nullable: true })
  greetingOverride!: string | null;

  @Column({ name: 'IsActive', type: 'bit', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime2' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'UpdatedAt', type: 'datetime2' })
  updatedAt!: Date;
}
