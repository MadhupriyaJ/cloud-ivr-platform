import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'Conversations' })
export class ConversationEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'ConversationId' })
  conversationId!: string;

  @Column({ name: 'DomainId', type: 'uniqueidentifier' })
  domainId!: string;

  @Column({ name: 'ChannelType', type: 'nvarchar', length: 40 })
  channelType!: string;

  @Column({ name: 'CustomerIdentifier', type: 'nvarchar', length: 180, nullable: true })
  customerIdentifier!: string | null;

  @Column({ name: 'SessionStatus', type: 'nvarchar', length: 40 })
  sessionStatus!: string;

  @Column({ name: 'CurrentIntent', type: 'nvarchar', length: 120, nullable: true })
  currentIntent!: string | null;

  @Column({ name: 'StartedAt', type: 'datetime2' })
  startedAt!: Date;

  @Column({ name: 'EndedAt', type: 'datetime2', nullable: true })
  endedAt!: Date | null;

  @Column({ name: 'EscalatedToAgent', type: 'bit', default: false })
  escalatedToAgent!: boolean;

  @Column({ name: 'AssignedAgentId', type: 'uniqueidentifier', nullable: true })
  assignedAgentId!: string | null;

  @Column({ name: 'SummaryText', type: 'nvarchar', nullable: true })
  summaryText!: string | null;
}
