import { Repository } from 'typeorm';
import { DomainEntity } from '../domains/domain.entity';
import { ConversationEntity } from '../conversations/conversation.entity';
import { AgentEntity } from '../agents/agent.entity';
import { EscalationEntity } from '../escalations/escalation.entity';
export declare class AnalyticsService {
    private readonly domainRepo;
    private readonly conversationRepo;
    private readonly agentRepo;
    private readonly escalationRepo;
    constructor(domainRepo: Repository<DomainEntity>, conversationRepo: Repository<ConversationEntity>, agentRepo: Repository<AgentEntity>, escalationRepo: Repository<EscalationEntity>);
    getOverview(): unknown;
    getConversationTrends(): unknown;
    getDomainDistribution(): unknown;
    getHealth(): unknown;
}
