"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const domain_entity_1 = require("../domains/domain.entity");
const conversation_entity_1 = require("../conversations/conversation.entity");
const agent_entity_1 = require("../agents/agent.entity");
const escalation_entity_1 = require("../escalations/escalation.entity");
let AnalyticsService = class AnalyticsService {
    domainRepo;
    conversationRepo;
    agentRepo;
    escalationRepo;
    constructor(domainRepo, conversationRepo, agentRepo, escalationRepo) {
        this.domainRepo = domainRepo;
        this.conversationRepo = conversationRepo;
        this.agentRepo = agentRepo;
        this.escalationRepo = escalationRepo;
    }
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
        const busyAgents = agents.filter((a) => a.availabilityStatus === 'busy' || a.availabilityStatus === 'on_call').length;
        const channelMap = new Map();
        conversations.forEach((c) => {
            const ch = c.channelType || 'unknown';
            channelMap.set(ch, (channelMap.get(ch) || 0) + 1);
        });
        const conversationsByChannel = Array.from(channelMap.entries()).map(([channel, count]) => ({
            channel,
            count,
        }));
        const statusMap = new Map();
        conversations.forEach((c) => {
            const s = c.sessionStatus || 'unknown';
            statusMap.set(s, (statusMap.get(s) || 0) + 1);
        });
        const conversationsByStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
            status,
            count,
        }));
        const endedConversations = conversations.filter((c) => c.endedAt);
        let avgDurationSec = 0;
        if (endedConversations.length > 0) {
            const totalSec = endedConversations.reduce((sum, c) => {
                const start = new Date(c.startedAt).getTime();
                const end = new Date(c.endedAt).getTime();
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
        const dayMap = new Map();
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
        const domainMap = new Map();
        domains.forEach((d) => domainMap.set(d.domainCode, d.displayName));
        const uuidToInfo = new Map();
        domains.forEach((d) => uuidToInfo.set(d.domainId.toUpperCase(), {
            domainCode: d.domainCode,
            displayName: d.displayName,
        }));
        const countMap = new Map();
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
        }
        catch {
            dbStatus = 'disconnected';
        }
        return {
            status: dbStatus === 'connected' ? 'healthy' : 'degraded',
            database: dbStatus,
            timestamp: new Date().toISOString(),
        };
    }
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(domain_entity_1.DomainEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(conversation_entity_1.ConversationEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(agent_entity_1.AgentEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(escalation_entity_1.EscalationEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AnalyticsService);
//# sourceMappingURL=analytics.service.js.map