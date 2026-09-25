import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import type { EscalationEntity } from './escalation.entity';

export type EscalationEventName =
  | 'escalation.created'
  | 'escalation.assigned'
  | 'escalation.accepted'
  | 'escalation.closed'
  | 'escalation.requeued'
  | 'agent.presence';

export type EscalationEvent = {
  type: EscalationEventName;
  at: string;
  escalation?: EscalationEntity;
  agent?: { agentId: string; name: string; availabilityStatus: string };
  message?: string;
};

type Subscriber = (event: EscalationEvent) => void;

/**
 * In-process pub/sub for escalation lifecycle events.
 *
 * Two kinds of consumer:
 *  - backend services (telephony transfer, analytics) subscribe with `on`
 *  - agent-desk websocket clients register with `subscribe` and receive the
 *    JSON payload directly
 *
 * Kept deliberately in-memory: a single Node process owns the live calls, so
 * there is no cross-instance fan-out to coordinate. Swap `emitter` for Redis
 * pub/sub if the backend is ever scaled horizontally.
 */
@Injectable()
export class EscalationEventsService {
  private readonly logger = new Logger(EscalationEventsService.name);
  private readonly emitter = new EventEmitter();
  private readonly subscribers = new Map<string, Subscriber>();

  constructor() {
    // Lifecycle listeners are long-lived; the default cap of 10 is too low.
    this.emitter.setMaxListeners(50);
  }

  /** Register a websocket (or any push consumer). Returns an unsubscribe fn. */
  subscribe(id: string, handler: Subscriber): () => void {
    this.subscribers.set(id, handler);
    this.logger.log(`Agent desk subscriber connected: ${id} (${this.subscribers.size} total)`);
    return () => {
      this.subscribers.delete(id);
      this.logger.log(`Agent desk subscriber disconnected: ${id}`);
    };
  }

  /** Subscribe a backend service to one event type. */
  on(type: EscalationEventName, handler: Subscriber): void {
    this.emitter.on(type, handler);
  }

  publish(event: Omit<EscalationEvent, 'at'>): void {
    const payload: EscalationEvent = { ...event, at: new Date().toISOString() };
    this.emitter.emit(payload.type, payload);

    for (const [id, handler] of this.subscribers) {
      try {
        handler(payload);
      } catch (error) {
        this.logger.warn(`Subscriber ${id} failed to handle ${payload.type}: ${String(error)}`);
      }
    }
  }

  get subscriberCount(): number {
    return this.subscribers.size;
  }
}
