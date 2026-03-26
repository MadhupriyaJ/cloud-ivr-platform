import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'LabReports' })
export class LabReportEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'LabReportId' })
  labReportId!: string;

  @Column({ name: 'PatientId', type: 'uniqueidentifier' })
  patientId!: string;

  @Column({ name: 'AppointmentId', type: 'uniqueidentifier', nullable: true })
  appointmentId!: string | null;

  @Column({ name: 'ReportNumber', type: 'nvarchar', length: 40 })
  reportNumber!: string;

  @Column({ name: 'TestName', type: 'nvarchar', length: 120 })
  testName!: string;

  @Column({ name: 'ReportStatus', type: 'nvarchar', length: 40 })
  reportStatus!: string;

  @Column({ name: 'ResultSummary', type: 'nvarchar', length: 500, nullable: true })
  resultSummary!: string | null;

  @Column({ name: 'ReportDate', type: 'datetime2', nullable: true })
  reportDate!: Date | null;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime2' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'UpdatedAt', type: 'datetime2' })
  updatedAt!: Date;
}
