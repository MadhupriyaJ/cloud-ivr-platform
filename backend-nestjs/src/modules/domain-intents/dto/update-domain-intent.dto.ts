import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateDomainIntentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  intentCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  intentLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
