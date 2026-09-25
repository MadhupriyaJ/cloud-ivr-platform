import { Global, Module } from '@nestjs/common';
import { EscalationEventsService } from './escalation-events.service';

/**
 * The event bus is shared by escalations, agents, telephony and the agent-desk
 * websocket in main.ts, so it is registered globally to keep those modules from
 * having to import each other.
 */
@Global()
@Module({
  providers: [EscalationEventsService],
  exports: [EscalationEventsService],
})
export class EscalationEventsModule {}
