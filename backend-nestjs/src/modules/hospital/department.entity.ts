import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'Departments' })
export class DepartmentEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'DepartmentId' })
  departmentId!: string;

  @Column({ name: 'DomainId', type: 'uniqueidentifier' })
  domainId!: string;

  @Column({ name: 'DepartmentCode', type: 'nvarchar', length: 50 })
  departmentCode!: string;

  @Column({ name: 'DepartmentName', type: 'nvarchar', length: 120 })
  departmentName!: string;

  @Column({ name: 'IsActive', type: 'bit', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime2' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'UpdatedAt', type: 'datetime2' })
  updatedAt!: Date;
}
