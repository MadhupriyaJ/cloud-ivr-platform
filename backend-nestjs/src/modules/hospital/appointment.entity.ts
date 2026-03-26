import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'Appointments' })
export class AppointmentEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'AppointmentId' })
  appointmentId!: string;

  @Column({ name: 'AppointmentCode', type: 'nvarchar', length: 30 })
  appointmentCode!: string;

  @Column({ name: 'PatientId', type: 'uniqueidentifier' })
  patientId!: string;

  @Column({ name: 'DoctorId', type: 'uniqueidentifier' })
  doctorId!: string;

  @Column({ name: 'DepartmentId', type: 'uniqueidentifier' })
  departmentId!: string;

  @Column({ name: 'AppointmentDate', type: 'date' })
  appointmentDate!: string;

  @Column({ name: 'AppointmentTime', type: 'time' })
  appointmentTime!: string;

  @Column({ name: 'ReasonForVisit', type: 'nvarchar', length: 500, nullable: true })
  reasonForVisit!: string | null;

  @Column({ name: 'AppointmentStatus', type: 'nvarchar', length: 40 })
  appointmentStatus!: string;

  @Column({ name: 'BookedChannel', type: 'nvarchar', length: 40, default: 'ivr' })
  bookedChannel!: string;

  @Column({ name: 'ConversationId', type: 'uniqueidentifier', nullable: true })
  conversationId!: string | null;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime2' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'UpdatedAt', type: 'datetime2' })
  updatedAt!: Date;
}
