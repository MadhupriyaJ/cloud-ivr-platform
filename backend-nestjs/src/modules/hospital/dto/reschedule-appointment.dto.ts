import { IsDateString, IsString, MaxLength } from 'class-validator';

export class RescheduleAppointmentDto {
  @IsDateString()
  appointmentDate!: string;

  @IsString()
  @MaxLength(20)
  appointmentTime!: string;
}
