import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDomainIntentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  intentCode!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  intentLabel!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  priority?: number = 100;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
