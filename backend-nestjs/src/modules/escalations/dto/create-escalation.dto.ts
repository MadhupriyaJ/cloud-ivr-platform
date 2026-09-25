import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { EscalationChannel, EscalationPriority } from '../escalation.entity';

export class CreateEscalationDto {
  @IsString()
  @MinLength(2)
  conversationId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  escalationReason!: string;

  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;

  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: EscalationPriority;

  @IsOptional()
  @IsIn(['queue', 'phone_transfer', 'callback', 'webhook'])
  channel?: EscalationChannel;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  skillGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  queueName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  callerIdentifier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  callSid?: string;

  @IsOptional()
  @IsString()
  contextSummary?: string;
}
