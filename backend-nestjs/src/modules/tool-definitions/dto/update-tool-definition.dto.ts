import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateToolDefinitionDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  toolName?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  schemaJson?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  handlerName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
