import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { databaseConfig } from './config/database.config';
import { azureConfig } from './config/azure.config';
import { AgentsModule } from './modules/agents/agents.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { DomainModule } from './modules/domains/domain.module';
import { DomainIntentsModule } from './modules/domain-intents/domain-intents.module';
import { DomainRulesModule } from './modules/domain-rules/domain-rules.module';
import { EscalationsModule } from './modules/escalations/escalations.module';
import { PromptTemplatesModule } from './modules/prompt-templates/prompt-templates.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SpeechModule } from './modules/speech/speech.module';
import { ToolDefinitionsModule } from './modules/tool-definitions/tool-definitions.module';
import { HospitalModule } from './modules/hospital/hospital.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      load: [databaseConfig, azureConfig],
    }),
    TypeOrmModule.forRootAsync(databaseConfig.asTypeOrmFactory()),
    AgentsModule,
    ConversationsModule,
    DomainModule,
    DomainIntentsModule,
    DomainRulesModule,
    EscalationsModule,
    PromptTemplatesModule,
    RealtimeModule,
    SpeechModule,
    ToolDefinitionsModule,
    HospitalModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
