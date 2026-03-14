import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateDomainRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  ruleType?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  ruleText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
