import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { DomainIntentsModule } from '../domain-intents/domain-intents.module';
import { DomainRulesModule } from '../domain-rules/domain-rules.module';
import { DomainModule } from '../domains/domain.module';
import { PromptTemplatesModule } from '../prompt-templates/prompt-templates.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

@Module({
  imports: [
    ConversationsModule,
    DomainModule,
    DomainIntentsModule,
    DomainRulesModule,
    PromptTemplatesModule,
  ],
  providers: [RealtimeGateway, RealtimeService],
})
export class RealtimeModule {}
