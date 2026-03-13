import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDomainRuleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  ruleType!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  ruleText!: string;

  @IsOptional()
  priority?: number = 100;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
