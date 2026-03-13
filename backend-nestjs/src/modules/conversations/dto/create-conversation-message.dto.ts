import { IsInt, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateConversationMessageDto {
  @IsString()
  @MinLength(2)
  conversationId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  speakerType!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  messageType!: string;

  @IsString()
  @MinLength(1)
  messageText!: string;

  @IsInt()
  sequenceNo!: number;
}
