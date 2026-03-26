import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'Billing' })
export class BillingEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'BillingId' })
  billingId!: string;

  @Column({ name: 'PatientId', type: 'uniqueidentifier' })
  patientId!: string;

  @Column({ name: 'AppointmentId', type: 'uniqueidentifier', nullable: true })
  appointmentId!: string | null;

  @Column({ name: 'InvoiceNumber', type: 'nvarchar', length: 40 })
  invoiceNumber!: string;

  @Column({ name: 'TotalAmount', type: 'decimal', precision: 12, scale: 2 })
  totalAmount!: string;

  @Column({ name: 'PaidAmount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  paidAmount!: string;

  @Column({ name: 'BillingStatus', type: 'nvarchar', length: 40 })
  billingStatus!: string;

  @Column({ name: 'DueDate', type: 'date', nullable: true })
  dueDate!: string | null;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime2' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'UpdatedAt', type: 'datetime2' })
  updatedAt!: Date;
}
