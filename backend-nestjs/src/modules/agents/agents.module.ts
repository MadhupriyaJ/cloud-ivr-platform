import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from './agent.entity';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { EscalationEventsModule } from '../escalations/escalation-events.module';

@Module({
  imports: [TypeOrmModule.forFeature([AgentEntity]), forwardRef(() => EscalationEventsModule)],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
