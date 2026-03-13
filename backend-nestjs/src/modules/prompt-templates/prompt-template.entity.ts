import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'PromptTemplates' })
export class PromptTemplateEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'PromptTemplateId' })
  promptTemplateId!: string;

  @Column({ name: 'DomainId' })
  domainId!: string;

  @Column({ name: 'PromptType', length: 60 })
  promptType!: string;

  @Column({ name: 'TemplateText', type: 'nvarchar' })
  templateText!: string;

  @Column({ name: 'VersionNo', type: 'int', default: 1 })
  versionNo!: number;

  @Column({ name: 'IsActive', type: 'bit', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime2' })
  createdAt!: Date;
}
