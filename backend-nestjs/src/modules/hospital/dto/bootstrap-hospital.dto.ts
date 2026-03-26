import { IsOptional, IsString, MaxLength } from 'class-validator';

export class BootstrapHospitalDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  domainCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  organizationName?: string;
}
