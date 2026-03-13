import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'ToolDefinitions' })
export class ToolDefinitionEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'ToolId' })
  toolId!: string;

  @Column({ name: 'DomainId' })
  domainId!: string;

  @Column({ name: 'ToolName', length: 120 })
  toolName!: string;

  @Column({ name: 'Description', length: 255 })
  description!: string;

  @Column({ name: 'SchemaJson', type: 'nvarchar' })
  schemaJson!: string;

  @Column({ name: 'HandlerName', length: 180 })
  handlerName!: string;

  @Column({ name: 'IsActive', type: 'bit', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime2' })
  createdAt!: Date;
}
