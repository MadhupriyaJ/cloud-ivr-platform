import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { DomainEntity } from '../domains/domain.entity';
import { ConversationEntity } from '../conversations/conversation.entity';
import { AgentEntity } from '../agents/agent.entity';
import { EscalationEntity } from '../escalations/escalation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DomainEntity, ConversationEntity, AgentEntity, EscalationEntity]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
