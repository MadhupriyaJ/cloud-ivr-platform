import { Socket } from 'socket.io';
import { ConversationsService } from '../conversations/conversations.service';
import { DomainIntentsService } from '../domain-intents/domain-intents.service';
import { DomainRulesService } from '../domain-rules/domain-rules.service';
import { DomainService } from '../domains/domain.service';
import { PromptTemplatesService } from '../prompt-templates/prompt-templates.service';
type ActiveSession = {
    clientId: string;
    domainCode: string;
    domainId: string;
    conversationId: string;
    customerIdentifier?: string;
    nextSequenceNo: number;
};
export declare class RealtimeService {
    private readonly domainService;
    private readonly domainIntentsService;
    private readonly domainRulesService;
    private readonly promptTemplatesService;
    private readonly conversationsService;
    private readonly logger;
    private readonly clients;
    private readonly sessions;
    constructor(domainService: DomainService, domainIntentsService: DomainIntentsService, domainRulesService: DomainRulesService, promptTemplatesService: PromptTemplatesService, conversationsService: ConversationsService);
    private buildInstructions;
    private loadDomainRealtimeConfig;
    registerClient(client: Socket): Promise<void>;
    unregisterClient(clientId: string): Promise<void>;
    startSession(clientId: string, payload: {
        domainCode: string;
        customerIdentifier?: string;
    }): Promise<{
        ok: true;
        session: ActiveSession;
        welcomeMessage: string;
        voice: string;
        organizationName: string;
        fallbackMessage: string;
        escalationMessage: string;
        intents: string[];
        rules: string[];
        compliance: string[];
        instructions: string;
    }>;
    handleAudioChunk(clientId: string, audioBase64: string): Promise<{
        accepted: boolean;
    }>;
    recordAssistantText(clientId: string, text: string): Promise<void>;
}
export {};
