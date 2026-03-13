import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateEscalationDto {
  @IsString()
  @MinLength(2)
  conversationId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  escalationReason!: string;

  @IsOptional()
  @IsString()
  assignedAgentId?: string;
}
