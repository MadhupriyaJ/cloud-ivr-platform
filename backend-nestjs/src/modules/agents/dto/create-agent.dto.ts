import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAgentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(180)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  skillGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  availabilityStatus?: string = 'offline';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
