import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class HospitalIvrRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  step?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utterance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  intent?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  patientCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  patientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  appointmentDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  appointmentTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reasonForVisit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  unsupportedCount?: number;
}
