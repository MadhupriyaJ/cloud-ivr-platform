import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PhoneNumberEntity } from './phone-number.entity';
import { CallSessionEntity } from './call-session.entity';
import { CreatePhoneNumberDto, UpdatePhoneNumberDto } from './dto/phone-number.dto';
import { TwilioService } from './twilio.service';
import { DomainService } from '../domains/domain.service';
import { AgentsService } from '../agents/agents.service';
import { EscalationEventsService } from '../escalations/escalation-events.service';
import type { EscalationEntity } from '../escalations/escalation.entity';

export type ResolvedInboundNumber = {
  phoneNumber: PhoneNumberEntity | null;
  domainCode: string;
  domainId: string | null;
  /** Optional pre-stream announcement; the assistant does the real welcome. */
  greeting: string | null;
  escalationNumber: string | null;
  escalationSkillGroup: string | null;
};

/**
 * Owns the phone side of the platform: which number belongs to which IVR
 * domain, the per-call log, and the live transfer that fires when an
 * escalation is raised on a phone call.
 */
@Injectable()
export class TelephonyService implements OnModuleInit {
  private readonly logger = new Logger(TelephonyService.name);

  /** Base URL captured from the first inbound webhook, used by later transfers. */
  private lastKnownBaseUrl = '';

  constructor(
    @InjectRepository(PhoneNumberEntity)
    private readonly phoneNumbers: Repository<PhoneNumberEntity>,
    @InjectRepository(CallSessionEntity)
    private readonly callSessions: Repository<CallSessionEntity>,
    private readonly twilio: TwilioService,
    private readonly domainService: DomainService,
    private readonly agentsService: AgentsService,
    private readonly events: EscalationEventsService,
  ) {}

  onModuleInit(): void {
    // A phone escalation is only real once the caller is actually moved to a
    // human, so the transfer is driven off the escalation lifecycle events.
    this.events.on('escalation.assigned', (event) => {
      if (event.escalation?.callSid) {
        void this.transferCallForEscalation(event.escalation).catch((error) =>
          this.logger.error(`Live transfer failed: ${String(error)}`),
        );
      }
    });
  }

  /* ─────────────── Phone number administration ─────────────── */

  async listNumbers(): Promise<PhoneNumberEntity[]> {
    return this.phoneNumbers.find({ order: { createdAt: 'DESC' } });
  }

  async createNumber(payload: CreatePhoneNumberDto): Promise<PhoneNumberEntity> {
    const entity = this.phoneNumbers.create({
      ...payload,
      phoneNumber: normalizeNumber(payload.phoneNumber),
      provider: payload.provider ?? 'twilio',
      isActive: payload.isActive ?? true,
    });
    return this.phoneNumbers.save(entity);
  }

  async updateNumber(phoneNumberId: string, payload: UpdatePhoneNumberDto): Promise<PhoneNumberEntity> {
    const entity = await this.phoneNumbers.findOne({ where: { phoneNumberId } });
    if (!entity) {
      throw new NotFoundException(`Phone number ${phoneNumberId} not found`);
    }
    Object.assign(entity, payload);
    if (payload.phoneNumber) {
      entity.phoneNumber = normalizeNumber(payload.phoneNumber);
    }
    return this.phoneNumbers.save(entity);
  }

  async deleteNumber(phoneNumberId: string): Promise<void> {
    await this.phoneNumbers.delete({ phoneNumberId });
  }

  /**
   * Work out which IVR domain answers a given inbound number.
   *
   * Falls back to TELEPHONY_DEFAULT_DOMAIN so a freshly provisioned number
   * still reaches a working IVR before it has been mapped in the UI.
   */
  async resolveInboundNumber(toNumber: string): Promise<ResolvedInboundNumber> {
    const normalized = normalizeNumber(toNumber);
    const mapping = normalized
      ? await this.phoneNumbers.findOne({ where: { phoneNumber: normalized, isActive: true } })
      : null;

    const fallbackCode = (process.env.TELEPHONY_DEFAULT_DOMAIN || 'hospital').trim();

    if (!mapping) {
      const domain = await this.domainService.getByCode(fallbackCode).catch(() => null);
      this.logger.warn(
        `No phone number mapping for ${normalized || '(unknown)'}; falling back to domain "${fallbackCode}"`,
      );
      return {
        phoneNumber: null,
        domainCode: domain?.domainCode ?? fallbackCode,
        domainId: domain?.domainId ?? null,
        // The realtime assistant speaks the welcome itself, in the caller's
        // language(s); a TwiML <Say> here would greet twice, in English only.
        greeting: null,
        escalationNumber: (process.env.TELEPHONY_FALLBACK_AGENT_NUMBER || '').trim() || null,
        escalationSkillGroup: null,
      };
    }

    const domain = await this.domainService.getById(mapping.domainId).catch(() => null);

    return {
      phoneNumber: mapping,
      domainCode: domain?.domainCode ?? fallbackCode,
      domainId: mapping.domainId,
      // Only an explicit per-number announcement (e.g. a recording notice) is
      // played by Twilio before the assistant takes over.
      greeting: mapping.greetingOverride || null,
      escalationNumber:
        mapping.escalationNumber || (process.env.TELEPHONY_FALLBACK_AGENT_NUMBER || '').trim() || null,
      escalationSkillGroup: mapping.escalationSkillGroup,
    };
  }

  /* ─────────────── Call log ─────────────── */

  async startCall(input: {
    callSid: string;
    from?: string;
    to?: string;
    domainId?: string | null;
    direction?: string;
  }): Promise<CallSessionEntity> {
    const existing = await this.callSessions.findOne({ where: { callSid: input.callSid } });
    if (existing) {
      return existing;
    }

    const entity = this.callSessions.create({
      callSid: input.callSid,
      fromNumber: input.from ?? null,
      toNumber: input.to ?? null,
      domainId: input.domainId ?? null,
      direction: input.direction ?? 'inbound',
      callStatus: 'in-progress',
      startedAt: new Date(),
      answeredAt: new Date(),
      conversationId: null,
      escalationId: null,
      endedAt: null,
      durationSeconds: null,
      hangupCause: null,
    });
    return this.callSessions.save(entity);
  }

  async attachConversation(callSid: string, conversationId: string): Promise<void> {
    await this.callSessions.update({ callSid }, { conversationId });
  }

  async attachEscalation(callSid: string, escalationId: string): Promise<void> {
    await this.callSessions.update({ callSid }, { escalationId });
  }

  async updateCallStatus(input: {
    callSid: string;
    status: string;
    durationSeconds?: number;
    hangupCause?: string;
  }): Promise<void> {
    const call = await this.callSessions.findOne({ where: { callSid: input.callSid } });
    if (!call) {
      return;
    }

    call.callStatus = input.status;
    if (['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(input.status)) {
      call.endedAt = call.endedAt ?? new Date();
      call.durationSeconds =
        input.durationSeconds ??
        Math.max(0, Math.round((call.endedAt.getTime() - call.startedAt.getTime()) / 1000));
      call.hangupCause = input.hangupCause ?? input.status;
    }
    await this.callSessions.save(call);
  }

  async listCalls(limit = 100): Promise<CallSessionEntity[]> {
    return this.callSessions.find({
      order: { startedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }

  async getCallBySid(callSid: string): Promise<CallSessionEntity | null> {
    return this.callSessions.findOne({ where: { callSid } });
  }

  /* ─────────────── Live transfer ─────────────── */

  rememberBaseUrl(baseUrl: string): void {
    if (baseUrl) {
      this.lastKnownBaseUrl = baseUrl.replace(/\/+$/, '');
    }
  }

  baseUrl(): string {
    return this.twilio.publicBaseUrl() || this.lastKnownBaseUrl;
  }

  /**
   * Decide which number a caller should be transferred to: the assigned agent's
   * direct dial first, then the number-level fallback, then the global one.
   */
  async resolveTransferTarget(escalation: EscalationEntity): Promise<string | null> {
    if (escalation.assignedAgentId) {
      const agent = await this.agentsService.getById(escalation.assignedAgentId).catch(() => null);
      if (agent?.phoneNumber) {
        return normalizeNumber(agent.phoneNumber);
      }
    }

    const call = escalation.callSid ? await this.getCallBySid(escalation.callSid) : null;
    if (call?.toNumber) {
      const mapping = await this.phoneNumbers.findOne({
        where: { phoneNumber: normalizeNumber(call.toNumber) },
      });
      if (mapping?.escalationNumber) {
        return normalizeNumber(mapping.escalationNumber);
      }
    }

    const globalFallback = (process.env.TELEPHONY_FALLBACK_AGENT_NUMBER || '').trim();
    return globalFallback ? normalizeNumber(globalFallback) : null;
  }

  /**
   * Move a live call off the AI stream and onto a human.
   *
   * Twilio is told to fetch fresh TwiML for the call; that TwiML (served by
   * `GET/POST /api/telephony/voice/transfer/:escalationId`) performs the
   * `<Dial>`. Doing it this way means the transfer works even though the call
   * is currently parked inside a `<Connect><Stream>`.
   */
  async transferCallForEscalation(escalation: EscalationEntity): Promise<boolean> {
    if (!escalation.callSid) {
      return false;
    }

    const base = this.baseUrl();
    if (!base) {
      this.logger.error(
        'Cannot transfer call: PUBLIC_BASE_URL is not set and no inbound webhook has been seen yet.',
      );
      return false;
    }

    await this.attachEscalation(escalation.callSid, escalation.escalationId).catch(() => undefined);

    const twimlUrl = `${base}/api/telephony/voice/transfer/${escalation.escalationId}`;
    return this.twilio.redirectCall(escalation.callSid, twimlUrl);
  }
}

/** Normalize to E.164-ish: keep a leading +, strip spaces and separators. */
export function normalizeNumber(value?: string | null): string {
  if (!value) return '';
  const trimmed = String(value).trim();
  const digits = trimmed.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    return `+${digits.slice(1).replace(/\D/g, '')}`;
  }
  return digits.replace(/\D/g, '');
}
