import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
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
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { IvrEngineModule } from './modules/ivr-engine/ivr-engine.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      load: [databaseConfig, azureConfig],
    }),
    TypeOrmModule.forRootAsync(databaseConfig.asTypeOrmFactory()),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api{*path}', '/ws{*path}', '/health'],
    }),
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
    AnalyticsModule,
    IvrEngineModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
