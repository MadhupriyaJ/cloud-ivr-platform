import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'Escalations' })
export class EscalationEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'EscalationId' })
  escalationId!: string;

  @Column({ name: 'ConversationId', type: 'uniqueidentifier' })
  conversationId!: string;

  @Column({ name: 'EscalationReason', type: 'nvarchar', length: 255 })
  escalationReason!: string;

  @Column({ name: 'EscalatedAt', type: 'datetime2' })
  escalatedAt!: Date;

  @Column({ name: 'AssignedAgentId', type: 'uniqueidentifier', nullable: true })
  assignedAgentId!: string | null;

  @Column({ name: 'AcceptedAt', type: 'datetime2', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'ClosedAt', type: 'datetime2', nullable: true })
  closedAt!: Date | null;
}
