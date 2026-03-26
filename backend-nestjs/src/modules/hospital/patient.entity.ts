import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'Patients' })
export class PatientEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'PatientId' })
  patientId!: string;

  @Column({ name: 'PatientCode', type: 'nvarchar', length: 30 })
  patientCode!: string;

  @Column({ name: 'FullName', type: 'nvarchar', length: 120 })
  fullName!: string;

  @Column({ name: 'PhoneNumber', type: 'nvarchar', length: 30 })
  phoneNumber!: string;

  @Column({ name: 'Email', type: 'nvarchar', length: 180, nullable: true })
  email!: string | null;

  @Column({ name: 'DateOfBirth', type: 'date', nullable: true })
  dateOfBirth!: string | null;

  @Column({ name: 'Gender', type: 'nvarchar', length: 20, nullable: true })
  gender!: string | null;

  @Column({ name: 'AddressLine', type: 'nvarchar', length: 255, nullable: true })
  addressLine!: string | null;

  @Column({ name: 'EmergencyContact', type: 'nvarchar', length: 120, nullable: true })
  emergencyContact!: string | null;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime2' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'UpdatedAt', type: 'datetime2' })
  updatedAt!: Date;
}
