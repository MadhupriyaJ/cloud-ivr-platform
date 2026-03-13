import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @MinLength(2)
  domainId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  channelType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  customerIdentifier?: string;
}
