import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { AgentAvailability } from '../agent.entity';

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
  @IsIn(['available', 'busy', 'break', 'offline'])
  availabilityStatus?: AgentAvailability = 'offline';

  /** Direct dial for live phone transfers (E.164, e.g. +14155550123). */
  @IsOptional()
  @Matches(/^\+?[0-9]{6,20}$/, { message: 'phoneNumber must be a valid E.164 number' })
  phoneNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxConcurrent?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
