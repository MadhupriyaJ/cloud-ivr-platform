import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ESCALATION_OPEN_STATUSES,
  EscalationEntity,
  EscalationPriority,
  EscalationStatus,
} from './escalation.entity';
import { CreateEscalationDto } from './dto/create-escalation.dto';
import { CloseEscalationDto } from './dto/escalation-action.dto';
import { EscalationEventsService } from './escalation-events.service';
import { AgentsService } from '../agents/agents.service';
import { ConversationsService } from '../conversations/conversations.service';

const PRIORITY_RANK: Record<EscalationPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export type EscalationListFilter = {
  status?: EscalationStatus | 'open' | 'all';
  agentId?: string;
  conversationId?: string;
  limit?: number;
};

@Injectable()
export class EscalationsService implements OnModuleInit {
  private readonly logger = new Logger(EscalationsService.name);

  constructor(
    @InjectRepository(EscalationEntity)
    private readonly repository: Repository<EscalationEntity>,
    private readonly agentsService: AgentsService,
    private readonly conversationsService: ConversationsService,
    private readonly events: EscalationEventsService,
  ) {}

  onModuleInit(): void {
    // When an agent comes back on shift, hand them whatever is waiting.
    this.events.on('agent.presence', (event) => {
      if (event.agent?.availabilityStatus === 'available') {
        void this.dispatchQueued().catch((error) =>
          this.logger.error(`Queue dispatch failed: ${String(error)}`),
        );
      }
    });
  }

  async list(filter: EscalationListFilter = {}): Promise<EscalationEntity[]> {
    const where: Record<string, unknown> = {};

    if (filter.status && filter.status !== 'all') {
      where.status = filter.status === 'open' ? In(ESCALATION_OPEN_STATUSES) : filter.status;
    }
    if (filter.agentId) {
      where.assignedAgentId = filter.agentId;
    }
    if (filter.conversationId) {
      where.conversationId = filter.conversationId;
    }

    const items = await this.repository.find({
      where,
      order: { escalatedAt: 'DESC' },
      take: Math.min(Math.max(filter.limit ?? 100, 1), 500),
    });

    // Open work is sorted by urgency so the console shows what matters first;
    // closed rows stay newest-first.
    if (filter.status === 'open') {
      return items.sort(
        (a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          a.escalatedAt.getTime() - b.escalatedAt.getTime(),
      );
    }
    return items;
  }

  async getById(escalationId: string): Promise<EscalationEntity> {
    const escalation = await this.repository.findOne({ where: { escalationId } });
    if (!escalation) {
      throw new NotFoundException(`Escalation ${escalationId} not found`);
    }
    return escalation;
  }

  async findOpenByConversation(conversationId: string): Promise<EscalationEntity | null> {
    return this.repository.findOne({
      where: { conversationId, status: In(ESCALATION_OPEN_STATUSES) },
      order: { escalatedAt: 'DESC' },
    });
  }

  /**
   * Raise an escalation and immediately try to place it with an agent.
   *
   * A conversation can only hold one open escalation: a second trigger on the
   * same call returns the existing row instead of queueing a duplicate.
   */
  async create(payload: CreateEscalationDto): Promise<EscalationEntity> {
    const existing = await this.findOpenByConversation(payload.conversationId);
    if (existing) {
      this.logger.log(
        `Conversation ${payload.conversationId} already has open escalation ${existing.escalationId}`,
      );
      return existing;
    }

    const conversation = await this.conversationsService
      .findById(payload.conversationId)
      .catch(() => null);

    const now = new Date();
    const entity = this.repository.create({
      conversationId: payload.conversationId,
      domainId: conversation?.domainId ?? null,
      escalationReason: payload.escalationReason,
      status: 'pending',
      priority: payload.priority ?? 'normal',
      channel: payload.channel ?? 'queue',
      queueName: payload.queueName ?? payload.skillGroup ?? 'default',
      skillGroup: payload.skillGroup ?? null,
      callerIdentifier: payload.callerIdentifier ?? conversation?.customerIdentifier ?? null,
      callSid: payload.callSid ?? null,
      contextSummary:
        payload.contextSummary ?? (await this.buildContextSummary(payload.conversationId)),
      transferTarget: null,
      resolutionNotes: null,
      assignedAgentId: null,
      assignedAt: null,
      acceptedAt: null,
      closedAt: null,
      escalatedAt: now,
      updatedAt: now,
    });

    let saved = await this.repository.save(entity);

    await this.conversationsService
      .markEscalated(payload.conversationId)
      .catch((error) => this.logger.warn(`Could not flag conversation escalated: ${String(error)}`));

    this.events.publish({ type: 'escalation.created', escalation: saved });

    // Explicit agent wins; otherwise route by skill group.
    const targetAgentId =
      payload.assignedAgentId ?? (await this.pickAgent(saved.skillGroup ?? undefined));

    if (targetAgentId) {
      saved = await this.assign(saved.escalationId, targetAgentId);
    } else {
      saved = await this.transition(saved, { status: 'queued' });
      this.logger.warn(
        `No agent available for escalation ${saved.escalationId}; queued on "${saved.queueName}"`,
      );
    }

    return saved;
  }

  async assign(escalationId: string, agentId: string): Promise<EscalationEntity> {
    const escalation = await this.getById(escalationId);
    if (escalation.closedAt) {
      throw new BadRequestException('Escalation is already closed');
    }

    const agent = await this.agentsService.getById(agentId);

    // Moving an escalation between agents must not leak the previous claim.
    if (escalation.assignedAgentId && escalation.assignedAgentId !== agentId) {
      await this.agentsService.releaseLoad(escalation.assignedAgentId).catch(() => undefined);
    }
    if (escalation.assignedAgentId !== agentId) {
      await this.agentsService.addLoad(agentId);
    }

    const updated = await this.transition(escalation, {
      status: 'assigned',
      assignedAgentId: agentId,
      assignedAt: new Date(),
      transferTarget: agent.phoneNumber ?? escalation.transferTarget,
    });

    await this.conversationsService
      .assignAgent(escalation.conversationId, agentId)
      .catch((error) =>
        this.logger.warn(`Could not assign agent on conversation: ${String(error)}`),
      );

    this.events.publish({
      type: 'escalation.assigned',
      escalation: updated,
      agent: {
        agentId: agent.agentId,
        name: agent.name,
        availabilityStatus: agent.availabilityStatus,
      },
      message: `Assigned to ${agent.name}`,
    });

    return updated;
  }

  /** Agent picks up the call. Accepting an unassigned escalation claims it. */
  async accept(escalationId: string, agentId?: string): Promise<EscalationEntity> {
    const escalation = await this.getById(escalationId);
    if (escalation.closedAt) {
      throw new BadRequestException('Escalation is already closed');
    }

    const resolvedAgentId = agentId ?? escalation.assignedAgentId;
    if (!resolvedAgentId) {
      throw new BadRequestException('An agentId is required to accept an unassigned escalation');
    }

    const claimed =
      escalation.assignedAgentId === resolvedAgentId
        ? escalation
        : await this.assign(escalationId, resolvedAgentId);

    const agent = await this.agentsService.getById(resolvedAgentId);
    const updated = await this.transition(claimed, {
      status: 'accepted',
      acceptedAt: new Date(),
    });

    this.events.publish({
      type: 'escalation.accepted',
      escalation: updated,
      agent: {
        agentId: agent.agentId,
        name: agent.name,
        availabilityStatus: agent.availabilityStatus,
      },
      message: `${agent.name} accepted the call`,
    });

    return updated;
  }

  async close(escalationId: string, payload: CloseEscalationDto = {}): Promise<EscalationEntity> {
    const escalation = await this.getById(escalationId);
    if (escalation.closedAt) {
      return escalation;
    }

    const updated = await this.transition(escalation, {
      status: payload.outcome ?? 'resolved',
      closedAt: new Date(),
      resolutionNotes: payload.resolutionNotes ?? escalation.resolutionNotes,
    });

    if (escalation.assignedAgentId) {
      await this.agentsService.releaseLoad(escalation.assignedAgentId).catch(() => undefined);
    }

    await this.conversationsService
      .closeConversation(escalation.conversationId, payload.resolutionNotes)
      .catch((error) => this.logger.warn(`Could not close conversation: ${String(error)}`));

    this.events.publish({
      type: 'escalation.closed',
      escalation: updated,
      message: payload.resolutionNotes ?? 'Escalation closed',
    });

    // Freed capacity may unblock whatever is waiting.
    void this.dispatchQueued().catch(() => undefined);

    return updated;
  }

  /** Put an escalation back on the queue (agent could not take it). */
  async requeue(escalationId: string, reason?: string): Promise<EscalationEntity> {
    const escalation = await this.getById(escalationId);
    if (escalation.closedAt) {
      throw new BadRequestException('Escalation is already closed');
    }

    if (escalation.assignedAgentId) {
      await this.agentsService.releaseLoad(escalation.assignedAgentId).catch(() => undefined);
    }

    const updated = await this.transition(escalation, {
      status: 'queued',
      assignedAgentId: null,
      assignedAt: null,
      acceptedAt: null,
      escalationReason: reason
        ? `${escalation.escalationReason} (requeued: ${reason})`.slice(0, 255)
        : escalation.escalationReason,
    });

    this.events.publish({ type: 'escalation.requeued', escalation: updated, message: reason });
    void this.dispatchQueued().catch(() => undefined);
    return updated;
  }

  /** Record the number a live call was transferred to. */
  async recordTransfer(escalationId: string, transferTarget: string): Promise<EscalationEntity> {
    const escalation = await this.getById(escalationId);
    return this.transition(escalation, { transferTarget, channel: 'phone_transfer' });
  }

  async markFailed(escalationId: string, reason: string): Promise<EscalationEntity> {
    const escalation = await this.getById(escalationId);
    const updated = await this.transition(escalation, {
      status: 'failed',
      closedAt: new Date(),
      resolutionNotes: reason,
    });
    if (escalation.assignedAgentId) {
      await this.agentsService.releaseLoad(escalation.assignedAgentId).catch(() => undefined);
    }
    this.events.publish({ type: 'escalation.closed', escalation: updated, message: reason });
    return updated;
  }

  async stats(): Promise<{
    open: number;
    queued: number;
    assigned: number;
    accepted: number;
    resolvedToday: number;
    avgWaitSeconds: number;
    avgHandleSeconds: number;
  }> {
    const recent = await this.repository.find({
      order: { escalatedAt: 'DESC' },
      take: 500,
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const waits: number[] = [];
    const handles: number[] = [];
    let queued = 0;
    let assigned = 0;
    let accepted = 0;
    let resolvedToday = 0;

    for (const item of recent) {
      if (item.status === 'queued' || item.status === 'pending') queued += 1;
      if (item.status === 'assigned') assigned += 1;
      if (item.status === 'accepted') accepted += 1;
      if (item.closedAt && item.closedAt >= startOfToday) resolvedToday += 1;

      if (item.acceptedAt) {
        waits.push((item.acceptedAt.getTime() - item.escalatedAt.getTime()) / 1000);
      }
      if (item.acceptedAt && item.closedAt) {
        handles.push((item.closedAt.getTime() - item.acceptedAt.getTime()) / 1000);
      }
    }

    const mean = (values: number[]) =>
      values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;

    return {
      open: queued + assigned + accepted,
      queued,
      assigned,
      accepted,
      resolvedToday,
      avgWaitSeconds: mean(waits),
      avgHandleSeconds: mean(handles),
    };
  }

  /** Hand queued escalations to whoever is free, highest priority first. */
  async dispatchQueued(): Promise<number> {
    const waiting = await this.repository.find({
      where: { status: In(['pending', 'queued'] as EscalationStatus[]) },
      order: { escalatedAt: 'ASC' },
      take: 50,
    });

    const ordered = waiting.sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        a.escalatedAt.getTime() - b.escalatedAt.getTime(),
    );

    let dispatched = 0;
    for (const escalation of ordered) {
      const agentId = await this.pickAgent(escalation.skillGroup ?? undefined);
      if (!agentId) {
        break; // Nobody free; the rest of the queue waits too.
      }
      await this.assign(escalation.escalationId, agentId);
      dispatched += 1;
    }

    if (dispatched) {
      this.logger.log(`Dispatched ${dispatched} queued escalation(s)`);
    }
    return dispatched;
  }

  private async pickAgent(skillGroup?: string): Promise<string | null> {
    const candidates = await this.agentsService.listAvailable(skillGroup);
    return candidates[0]?.agentId ?? null;
  }

  /** Persist a state change, always stamping UpdatedAt. */
  private async transition(
    escalation: EscalationEntity,
    changes: Partial<EscalationEntity>,
  ): Promise<EscalationEntity> {
    Object.assign(escalation, changes, { updatedAt: new Date() });
    return this.repository.save(escalation);
  }

  /**
   * Last few turns of the conversation, so the agent sees why the caller is
   * being handed over without opening the full transcript.
   */
  private async buildContextSummary(conversationId: string): Promise<string | null> {
    try {
      const messages = await this.conversationsService.listMessages(conversationId);
      const transcript = messages
        .filter((message) => message.messageType !== 'audio_chunk')
        .slice(-8)
        .map((message) => `${message.speakerType}: ${message.messageText}`)
        .join('\n');
      return transcript ? transcript.slice(0, 4000) : null;
    } catch {
      return null;
    }
  }
}
