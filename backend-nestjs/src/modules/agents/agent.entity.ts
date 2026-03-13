import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

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
  availabilityStatus!: string;

  @Column({ name: 'IsActive', type: 'bit', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime2' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'UpdatedAt', type: 'datetime2' })
  updatedAt!: Date;
}
