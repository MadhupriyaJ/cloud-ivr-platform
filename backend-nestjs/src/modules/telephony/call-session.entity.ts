import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** One inbound/outbound phone call, linked to the conversation it produced. */
@Entity({ name: 'CallSessions' })
export class CallSessionEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'CallId' })
  callId!: string;

  /** Provider call identifier (Twilio CallSid). */
  @Column({ name: 'CallSid', type: 'nvarchar', length: 120, unique: true })
  callSid!: string;

  @Column({ name: 'ConversationId', type: 'uniqueidentifier', nullable: true })
  conversationId!: string | null;

  @Column({ name: 'DomainId', type: 'uniqueidentifier', nullable: true })
  domainId!: string | null;

  @Column({ name: 'FromNumber', type: 'nvarchar', length: 32, nullable: true })
  fromNumber!: string | null;

  @Column({ name: 'ToNumber', type: 'nvarchar', length: 32, nullable: true })
  toNumber!: string | null;

  @Column({ name: 'Direction', type: 'nvarchar', length: 20, default: 'inbound' })
  direction!: string;

  @Column({ name: 'CallStatus', type: 'nvarchar', length: 40, default: 'ringing' })
  callStatus!: string;

  @Column({ name: 'EscalationId', type: 'uniqueidentifier', nullable: true })
  escalationId!: string | null;

  @Column({ name: 'StartedAt', type: 'datetime2' })
  startedAt!: Date;

  @Column({ name: 'AnsweredAt', type: 'datetime2', nullable: true })
  answeredAt!: Date | null;

  @Column({ name: 'EndedAt', type: 'datetime2', nullable: true })
  endedAt!: Date | null;

  @Column({ name: 'DurationSeconds', type: 'int', nullable: true })
  durationSeconds!: number | null;

  @Column({ name: 'HangupCause', type: 'nvarchar', length: 80, nullable: true })
  hangupCause!: string | null;
}
