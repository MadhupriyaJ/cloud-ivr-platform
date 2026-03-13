import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePromptTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  promptType!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  templateText!: string;

  @IsOptional()
  versionNo?: number = 1;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
