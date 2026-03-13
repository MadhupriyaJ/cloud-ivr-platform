import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateToolDefinitionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  toolName!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  description!: string;

  @IsString()
  @MinLength(2)
  schemaJson!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  handlerName!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
