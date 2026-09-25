import {
  IsBoolean,
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

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  skillGroup?: string;

  @IsOptional()
  @IsIn(['available', 'busy', 'break', 'offline'])
  availabilityStatus?: AgentAvailability;

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

export class UpdateAgentAvailabilityDto {
  @IsIn(['available', 'busy', 'break', 'offline'])
  availabilityStatus!: AgentAvailability;
}
