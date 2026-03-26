import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainEntity } from '../domains/domain.entity';
import { ConversationEntity } from '../conversations/conversation.entity';
import { AgentEntity } from '../agents/agent.entity';
import { EscalationEntity } from '../escalations/escalation.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(DomainEntity)
    private readonly domainRepo: Repository<DomainEntity>,
    @InjectRepository(ConversationEntity)
    private readonly conversationRepo: Repository<ConversationEntity>,
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    @InjectRepository(EscalationEntity)
    private readonly escalationRepo: Repository<EscalationEntity>,
  ) {}

  async getOverview() {
    const [domains, conversations, agents, escalations] = await Promise.all([
      this.domainRepo.find(),
      this.conversationRepo.find(),
      this.agentRepo.find(),
      this.escalationRepo.find(),
    ]);

    const activeDomains = domains.filter((d) => d.isActive).length;
    const liveConversations = conversations.filter((c) => c.sessionStatus === 'started').length;
    const escalatedConversations = conversations.filter((c) => c.escalatedToAgent).length;
    const openEscalations = escalations.filter((e) => !e.closedAt).length;
    const closedEscalations = escalations.filter((e) => e.closedAt).length;
    const availableAgents = agents.filter((a) => a.isActive).length;
    const busyAgents = agents.filter(
      (a) => a.availabilityStatus === 'busy' || a.availabilityStatus === 'on_call',
    ).length;

    // Conversation by channel
    const channelMap = new Map<string, number>();
    conversations.forEach((c) => {
      const ch = c.channelType || 'unknown';
      channelMap.set(ch, (channelMap.get(ch) || 0) + 1);
    });
    const conversationsByChannel = Array.from(channelMap.entries()).map(([channel, count]) => ({
      channel,
      count,
    }));

    // Conversation by status
    const statusMap = new Map<string, number>();
    conversations.forEach((c) => {
      const s = c.sessionStatus || 'unknown';
      statusMap.set(s, (statusMap.get(s) || 0) + 1);
    });
    const conversationsByStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
    }));

    // Avg duration (only for ended conversations)
    const endedConversations = conversations.filter((c) => c.endedAt);
    let avgDurationSec = 0;
    if (endedConversations.length > 0) {
      const totalSec = endedConversations.reduce((sum, c) => {
        const start = new Date(c.startedAt).getTime();
        const end = new Date(c.endedAt!).getTime();
        return sum + (end - start) / 1000;
      }, 0);
      avgDurationSec = Math.round(totalSec / endedConversations.length);
    }

    return {
      domains: { total: domains.length, active: activeDomains },
      conversations: {
        total: conversations.length,
        live: liveConversations,
        escalated: escalatedConversations,
        avgDurationSec,
      },
      agents: { total: agents.length, available: availableAgents, busy: busyAgents },
      escalations: { total: escalations.length, open: openEscalations, closed: closedEscalations },
      conversationsByChannel,
      conversationsByStatus,
    };
  }

  async getConversationTrends() {
    const conversations = await this.conversationRepo.find({ order: { startedAt: 'ASC' } });
    const dayMap = new Map<string, number>();
    conversations.forEach((c) => {
      const d = new Date(c.startedAt);
      if (!Number.isNaN(d.getTime())) {
        const key = d.toISOString().slice(0, 10);
        dayMap.set(key, (dayMap.get(key) || 0) + 1);
      }
    });
    return Array.from(dayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getDomainDistribution() {
    const conversations = await this.conversationRepo.find();
    const domains = await this.domainRepo.find();
    const domainMap = new Map<string, string>();
    domains.forEach((d) => domainMap.set(d.domainCode, d.displayName));

    // domainId in conversations is a UUID referencing domain.domainId
    // Build a map from domainId (UUID) to domainCode and displayName
    const uuidToInfo = new Map<string, { domainCode: string; displayName: string }>();
    domains.forEach((d) =>
      uuidToInfo.set(d.domainId.toUpperCase(), {
        domainCode: d.domainCode,
        displayName: d.displayName,
      }),
    );

    const countMap = new Map<string, number>();
    conversations.forEach((c) => {
      const id = (c.domainId || 'unknown').toUpperCase();
      countMap.set(id, (countMap.get(id) || 0) + 1);
    });

    return Array.from(countMap.entries())
      .map(([domainUuid, count]) => {
        const info = uuidToInfo.get(domainUuid);
        return {
          domainCode: info?.domainCode || domainUuid,
          displayName: info?.displayName || domainUuid,
          count,
        };
      })
      .sort((a, b) => b.count - a.count);
  }

  async getHealth() {
    let dbStatus = 'connected';
    try {
      await this.domainRepo.query('SELECT 1 AS ok');
    } catch {
      dbStatus = 'disconnected';
    }
    return {
      status: dbStatus === 'connected' ? 'healthy' : 'degraded',
      database: dbStatus,
      timestamp: new Date().toISOString(),
    };
  }
}
