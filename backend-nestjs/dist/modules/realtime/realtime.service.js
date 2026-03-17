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
var RealtimeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeService = void 0;
const common_1 = require("@nestjs/common");
const conversations_service_1 = require("../conversations/conversations.service");
const domain_intents_service_1 = require("../domain-intents/domain-intents.service");
const domain_rules_service_1 = require("../domain-rules/domain-rules.service");
const domain_service_1 = require("../domains/domain.service");
const prompt_templates_service_1 = require("../prompt-templates/prompt-templates.service");
let RealtimeService = RealtimeService_1 = class RealtimeService {
    domainService;
    domainIntentsService;
    domainRulesService;
    promptTemplatesService;
    conversationsService;
    logger = new common_1.Logger(RealtimeService_1.name);
    clients = new Map();
    sessions = new Map();
    constructor(domainService, domainIntentsService, domainRulesService, promptTemplatesService, conversationsService) {
        this.domainService = domainService;
        this.domainIntentsService = domainIntentsService;
        this.domainRulesService = domainRulesService;
        this.promptTemplatesService = promptTemplatesService;
        this.conversationsService = conversationsService;
    }
    buildInstructions(input) {
        const intentsLine = input.intents.length
            ? `Allowed business intents: ${input.intents.join(', ')}.`
            : 'No business intents were configured.';
        const rulesLine = input.rules.length
            ? `Business rules: ${input.rules.join(' ')}`
            : '';
        const complianceLine = input.compliance.length
            ? `Compliance requirements: ${input.compliance.join(' ')}`
            : '';
        return [
            `You are the voice IVR assistant for ${input.organizationName}.`,
            input.systemPrompt,
            'Speak clearly, politely, and briefly.',
            'Keep most replies within one or two short sentences.',
            'Ask one question at a time.',
            intentsLine,
            rulesLine,
            complianceLine,
            `If the caller asks anything outside the allowed business intents, do not answer the question. Instead say exactly this fallback message: ${input.fallbackMessage}`,
            `If the caller asks for a human, is frustrated, repeats an unsupported request, or the request should not be handled by the IVR, say exactly this escalation message: ${input.escalationMessage}`,
            'Do not provide general knowledge, medical advice, educational explanations, or unrelated answers unless that is explicitly part of the allowed business intents.',
            'When in doubt, treat the request as out of scope and use the fallback message.',
        ]
            .filter(Boolean)
            .join(' ');
    }
    async loadDomainRealtimeConfig(domainId, organizationName, welcomeMessage, fallbackMessage, escalationMessage) {
        const [intents, rules, activePrompts] = await Promise.all([
            this.domainIntentsService.listByDomain(domainId),
            this.domainRulesService.listByDomain(domainId),
            this.promptTemplatesService.listActiveByDomain(domainId),
        ]);
        const activeIntents = intents
            .filter((item) => item.isActive)
            .map((item) => item.intentLabel || item.intentCode);
        const activeRules = rules
            .filter((item) => item.isActive && item.ruleType.toLowerCase() !== 'compliance')
            .map((item) => item.ruleText);
        const activeCompliance = rules
            .filter((item) => item.isActive && item.ruleType.toLowerCase() === 'compliance')
            .map((item) => item.ruleText);
        const promptMap = new Map();
        activePrompts.forEach((item) => {
            const key = item.promptType.trim().toLowerCase();
            if (!promptMap.has(key)) {
                promptMap.set(key, item.templateText.trim());
            }
        });
        const resolvedWelcomeMessage = promptMap.get('welcome') || welcomeMessage;
        const resolvedFallbackMessage = promptMap.get('fallback') || fallbackMessage;
        const resolvedEscalationMessage = promptMap.get('escalation') || escalationMessage;
        const resolvedSystemPrompt = promptMap.get('system') ||
            'Handle only the configured business intents and follow the active domain rules.';
        return {
            intents: activeIntents,
            rules: activeRules,
            compliance: activeCompliance,
            welcomeMessage: resolvedWelcomeMessage,
            fallbackMessage: resolvedFallbackMessage,
            escalationMessage: resolvedEscalationMessage,
            systemPrompt: resolvedSystemPrompt,
            instructions: this.buildInstructions({
                organizationName,
                intents: activeIntents,
                rules: activeRules,
                compliance: activeCompliance,
                systemPrompt: resolvedSystemPrompt,
                fallbackMessage: resolvedFallbackMessage,
                escalationMessage: resolvedEscalationMessage,
            }),
        };
    }
    async registerClient(client) {
        this.clients.set(client.id, client);
        this.logger.log(`Client connected: ${client.id}`);
    }
    async unregisterClient(clientId) {
        this.clients.delete(clientId);
        this.sessions.delete(clientId);
        this.logger.log(`Client disconnected: ${clientId}`);
    }
    async startSession(clientId, payload) {
        const domain = await this.domainService.getByCode(payload.domainCode);
        const config = await this.loadDomainRealtimeConfig(domain.domainId, domain.organizationName, domain.welcomeMessage, domain.fallbackMessage, domain.escalationMessage);
        const conversation = await this.conversationsService.create({
            domainId: domain.domainId,
            channelType: 'websocket',
            customerIdentifier: payload.customerIdentifier,
        });
        const session = {
            clientId,
            domainCode: payload.domainCode,
            domainId: domain.domainId,
            conversationId: conversation.conversationId,
            customerIdentifier: payload.customerIdentifier,
            nextSequenceNo: 1,
        };
        this.sessions.set(clientId, session);
        return {
            ok: true,
            session,
            welcomeMessage: config.welcomeMessage,
            voice: domain.defaultVoice,
            organizationName: domain.organizationName,
            fallbackMessage: config.fallbackMessage,
            escalationMessage: config.escalationMessage,
            intents: config.intents,
            rules: config.rules,
            compliance: config.compliance,
            instructions: config.instructions,
        };
    }
    async handleAudioChunk(clientId, audioBase64) {
        const session = this.sessions.get(clientId);
        if (!session) {
            return { accepted: false };
        }
        await this.conversationsService.addMessage({
            conversationId: session.conversationId,
            speakerType: 'customer',
            messageType: 'audio_chunk',
            messageText: `[audio_chunk:${audioBase64.length}]`,
            sequenceNo: session.nextSequenceNo++,
        });
        void audioBase64;
        return { accepted: true };
    }
    async recordAssistantText(clientId, text) {
        const session = this.sessions.get(clientId);
        if (!session || !text.trim()) {
            return;
        }
        await this.conversationsService.addMessage({
            conversationId: session.conversationId,
            speakerType: 'assistant',
            messageType: 'text',
            messageText: text.trim(),
            sequenceNo: session.nextSequenceNo++,
        });
    }
};
exports.RealtimeService = RealtimeService;
exports.RealtimeService = RealtimeService = RealtimeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [domain_service_1.DomainService,
        domain_intents_service_1.DomainIntentsService,
        domain_rules_service_1.DomainRulesService,
        prompt_templates_service_1.PromptTemplatesService,
        conversations_service_1.ConversationsService])
], RealtimeService);
//# sourceMappingURL=realtime.service.js.map