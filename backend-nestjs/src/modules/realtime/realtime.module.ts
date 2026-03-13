import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { DomainModule } from '../domains/domain.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

@Module({
  imports: [ConversationsModule, DomainModule],
  providers: [RealtimeGateway, RealtimeService],
})
export class RealtimeModule {}
