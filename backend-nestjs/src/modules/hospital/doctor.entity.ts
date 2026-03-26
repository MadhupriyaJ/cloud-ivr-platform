import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'Doctors' })
export class DoctorEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'DoctorId' })
  doctorId!: string;

  @Column({ name: 'DomainId', type: 'uniqueidentifier' })
  domainId!: string;

  @Column({ name: 'DepartmentId', type: 'uniqueidentifier' })
  departmentId!: string;

  @Column({ name: 'DoctorCode', type: 'nvarchar', length: 50 })
  doctorCode!: string;

  @Column({ name: 'DoctorName', type: 'nvarchar', length: 120 })
  doctorName!: string;

  @Column({ name: 'Qualification', type: 'nvarchar', length: 200, nullable: true })
  qualification!: string | null;

  @Column({ name: 'Specialization', type: 'nvarchar', length: 120, nullable: true })
  specialization!: string | null;

  @Column({ name: 'AvailabilityStatus', type: 'nvarchar', length: 40 })
  availabilityStatus!: string;

  @Column({ name: 'ConsultationFee', type: 'decimal', precision: 12, scale: 2, nullable: true })
  consultationFee!: string | null;

  @Column({ name: 'IsActive', type: 'bit', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime2' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'UpdatedAt', type: 'datetime2' })
  updatedAt!: Date;
}
