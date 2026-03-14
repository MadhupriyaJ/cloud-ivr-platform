import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class UpdatePromptTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  promptType?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  templateText?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  versionNo?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
