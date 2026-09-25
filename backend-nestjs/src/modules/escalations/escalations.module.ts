import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EscalationEntity } from './escalation.entity';
import { EscalationsController } from './escalations.controller';
import { EscalationsService } from './escalations.service';
import { EscalationDetectorService } from './escalation-detector.service';
import { AgentsModule } from '../agents/agents.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EscalationEntity]),
    AgentsModule,
    ConversationsModule,
  ],
  controllers: [EscalationsController],
  providers: [EscalationsService, EscalationDetectorService],
  exports: [EscalationsService, EscalationDetectorService],
})
export class EscalationsModule {}
