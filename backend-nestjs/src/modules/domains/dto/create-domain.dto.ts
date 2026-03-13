import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDomainDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  domainCode!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  organizationName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  industryType!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  defaultLanguage!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  defaultVoice!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  welcomeMessage!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  fallbackMessage!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  escalationMessage!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
