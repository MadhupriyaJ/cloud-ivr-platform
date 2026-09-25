import { IsBoolean, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

/** Dialable number: E.164 preferred, common separators tolerated. */
const DIALABLE = /^\+?[0-9][0-9\s\-().]{5,24}$/;

export class CreatePhoneNumberDto {
  @Matches(DIALABLE, {
    message: 'phoneNumber must be a dialable number, ideally E.164 (e.g. +14155550123)',
  })
  phoneNumber!: string;

  @IsUUID()
  domainId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  friendlyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  provider?: string;

  @IsOptional()
  @Matches(DIALABLE, { message: 'escalationNumber must be a dialable number' })
  escalationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  escalationSkillGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  greetingOverride?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Every field optional — the console patches one attribute at a time. */
export class UpdatePhoneNumberDto {
  @IsOptional()
  @Matches(DIALABLE, {
    message: 'phoneNumber must be a dialable number, ideally E.164 (e.g. +14155550123)',
  })
  phoneNumber?: string;

  @IsOptional()
  @IsUUID()
  domainId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  friendlyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  provider?: string;

  @IsOptional()
  @Matches(DIALABLE, { message: 'escalationNumber must be a dialable number' })
  escalationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  escalationSkillGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  greetingOverride?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
