import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Lifecycle of a single escalation from IVR to a human agent. */
export type EscalationStatus =
  | 'pending'
  | 'queued'
  | 'assigned'
  | 'accepted'
  | 'resolved'
  | 'abandoned'
  | 'failed';

/** How the caller reaches the human. */
export type EscalationChannel = 'queue' | 'phone_transfer' | 'callback' | 'webhook';

export type EscalationPriority = 'low' | 'normal' | 'high' | 'urgent';

export const ESCALATION_OPEN_STATUSES: EscalationStatus[] = [
  'pending',
  'queued',
  'assigned',
  'accepted',
];

@Entity({ name: 'Escalations' })
export class EscalationEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'EscalationId' })
  escalationId!: string;

  @Index()
  @Column({ name: 'ConversationId', type: 'uniqueidentifier' })
  conversationId!: string;

  @Column({ name: 'DomainId', type: 'uniqueidentifier', nullable: true })
  domainId!: string | null;

  @Column({ name: 'EscalationReason', type: 'nvarchar', length: 255 })
  escalationReason!: string;

  @Column({ name: 'Status', type: 'nvarchar', length: 40, default: 'pending' })
  status!: EscalationStatus;

  @Column({ name: 'Priority', type: 'nvarchar', length: 20, default: 'normal' })
  priority!: EscalationPriority;

  @Column({ name: 'Channel', type: 'nvarchar', length: 30, default: 'queue' })
  channel!: EscalationChannel;

  @Column({ name: 'QueueName', type: 'nvarchar', length: 120, nullable: true })
  queueName!: string | null;

  @Column({ name: 'SkillGroup', type: 'nvarchar', length: 120, nullable: true })
  skillGroup!: string | null;

  /** Caller phone number or web client identifier. */
  @Column({ name: 'CallerIdentifier', type: 'nvarchar', length: 180, nullable: true })
  callerIdentifier!: string | null;

  /** Provider call id when the escalation came from a live phone call. */
  @Column({ name: 'CallSid', type: 'nvarchar', length: 120, nullable: true })
  callSid!: string | null;

  /** Number the live call was (or will be) transferred to. */
  @Column({ name: 'TransferTarget', type: 'nvarchar', length: 60, nullable: true })
  transferTarget!: string | null;

  /** Short transcript summary handed to the agent so they do not start cold. */
  @Column({ name: 'ContextSummary', type: 'nvarchar', nullable: true })
  contextSummary!: string | null;

  @Column({ name: 'ResolutionNotes', type: 'nvarchar', nullable: true })
  resolutionNotes!: string | null;

  @Column({ name: 'EscalatedAt', type: 'datetime2' })
  escalatedAt!: Date;

  @Column({ name: 'AssignedAgentId', type: 'uniqueidentifier', nullable: true })
  assignedAgentId!: string | null;

  @Column({ name: 'AssignedAt', type: 'datetime2', nullable: true })
  assignedAt!: Date | null;

  @Column({ name: 'AcceptedAt', type: 'datetime2', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'ClosedAt', type: 'datetime2', nullable: true })
  closedAt!: Date | null;

  @Column({ name: 'UpdatedAt', type: 'datetime2' })
  updatedAt!: Date;
}
