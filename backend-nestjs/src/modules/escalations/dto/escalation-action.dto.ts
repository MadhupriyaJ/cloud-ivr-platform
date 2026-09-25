import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AssignEscalationDto {
  @IsUUID()
  agentId!: string;
}

export class AcceptEscalationDto {
  /** Optional when the escalation is already assigned to the accepting agent. */
  @IsOptional()
  @IsUUID()
  agentId?: string;
}

export class CloseEscalationDto {
  @IsOptional()
  @IsIn(['resolved', 'abandoned', 'failed'])
  outcome?: 'resolved' | 'abandoned' | 'failed';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionNotes?: string;
}

export class RequeueEscalationDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
