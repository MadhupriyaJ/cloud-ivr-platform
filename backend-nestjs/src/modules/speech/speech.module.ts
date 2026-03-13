import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SpeechController } from './speech.controller';

@Module({
  imports: [ConfigModule],
  controllers: [SpeechController],
})
export class SpeechModule {}
