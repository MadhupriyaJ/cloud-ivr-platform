import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAppointmentDto {
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  patientCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @IsUUID()
  doctorId!: string;

  @IsUUID()
  departmentId!: string;

  @IsDateString()
  appointmentDate!: string;

  @IsString()
  appointmentTime!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reasonForVisit?: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  patientName?: string;
}
