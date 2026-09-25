import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** available = ready for work, busy = handling calls, offline = not reachable. */
export type AgentAvailability = 'available' | 'busy' | 'break' | 'offline';

@Entity({ name: 'Agents' })
export class AgentEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'AgentId' })
  agentId!: string;

  @Column({ name: 'Name', type: 'nvarchar', length: 120 })
  name!: string;

  @Column({ name: 'Email', type: 'nvarchar', length: 180, unique: true })
  email!: string;

  @Column({ name: 'SkillGroup', type: 'nvarchar', length: 120, nullable: true })
  skillGroup!: string | null;

  @Column({ name: 'AvailabilityStatus', type: 'nvarchar', length: 40, default: 'offline' })
  availabilityStatus!: AgentAvailability;

  /** Direct dial used for live phone transfers (E.164). */
  @Column({ name: 'PhoneNumber', type: 'nvarchar', length: 32, nullable: true })
  phoneNumber!: string | null;

  /** Escalations currently held by this agent (assigned or accepted). */
  @Column({ name: 'ActiveEscalations', type: 'int', default: 0 })
  activeEscalations!: number;

  /** How many escalations this agent may hold at once. */
  @Column({ name: 'MaxConcurrent', type: 'int', default: 1 })
  maxConcurrent!: number;

  @Column({ name: 'LastSeenAt', type: 'datetime2', nullable: true })
  lastSeenAt!: Date | null;

  @Column({ name: 'IsActive', type: 'bit', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime2' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'UpdatedAt', type: 'datetime2' })
  updatedAt!: Date;
}
