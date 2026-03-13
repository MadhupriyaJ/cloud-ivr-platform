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
const domain_service_1 = require("../domains/domain.service");
let RealtimeService = RealtimeService_1 = class RealtimeService {
    domainService;
    conversationsService;
    logger = new common_1.Logger(RealtimeService_1.name);
    clients = new Map();
    sessions = new Map();
    constructor(domainService, conversationsService) {
        this.domainService = domainService;
        this.conversationsService = conversationsService;
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
            welcomeMessage: domain.welcomeMessage,
            voice: domain.defaultVoice,
            organizationName: domain.organizationName,
            fallbackMessage: domain.fallbackMessage,
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
        conversations_service_1.ConversationsService])
], RealtimeService);
//# sourceMappingURL=realtime.service.js.map