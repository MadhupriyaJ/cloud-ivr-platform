import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'DoctorSchedules' })
export class DoctorScheduleEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'ScheduleId' })
  scheduleId!: string;

  @Column({ name: 'DoctorId', type: 'uniqueidentifier' })
  doctorId!: string;

  @Column({ name: 'ScheduleDate', type: 'date' })
  scheduleDate!: string;

  @Column({ name: 'StartTime', type: 'time' })
  startTime!: string;

  @Column({ name: 'EndTime', type: 'time' })
  endTime!: string;

  @Column({ name: 'MaxSlots', type: 'int' })
  maxSlots!: number;

  @Column({ name: 'AvailableSlots', type: 'int' })
  availableSlots!: number;

  @Column({ name: 'Status', type: 'nvarchar', length: 40 })
  status!: string;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime2' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'UpdatedAt', type: 'datetime2' })
  updatedAt!: Date;
}
