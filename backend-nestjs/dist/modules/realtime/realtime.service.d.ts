import { Socket } from 'socket.io';
import { ConversationsService } from '../conversations/conversations.service';
import { DomainService } from '../domains/domain.service';
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
    private readonly conversationsService;
    private readonly logger;
    private readonly clients;
    private readonly sessions;
    constructor(domainService: DomainService, conversationsService: ConversationsService);
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
    }>;
    handleAudioChunk(clientId: string, audioBase64: string): Promise<{
        accepted: boolean;
    }>;
    recordAssistantText(clientId: string, text: string): Promise<void>;
}
export {};
