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
    getOverview(): Promise<{
        domains: {
            total: number;
            active: number;
        };
        conversations: {
            total: number;
            live: number;
            escalated: number;
            avgDurationSec: number;
        };
        agents: {
            total: number;
            available: number;
            busy: number;
        };
        escalations: {
            total: number;
            open: number;
            closed: number;
        };
        conversationsByChannel: {
            channel: string;
            count: number;
        }[];
        conversationsByStatus: {
            status: string;
            count: number;
        }[];
    }>;
    getConversationTrends(): Promise<{
        date: string;
        count: number;
    }[]>;
    getDomainDistribution(): Promise<{
        domainCode: string;
        displayName: string;
        count: number;
    }[]>;
    getHealth(): Promise<{
        status: string;
        database: string;
        timestamp: string;
    }>;
}
