import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RealtimeService } from './realtime.service';
export declare class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly realtimeService;
    server: Server;
    constructor(realtimeService: RealtimeService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    startSession(payload: {
        domainCode: string;
        customerIdentifier?: string;
    }, client: Socket): Promise<{
        ok: true;
        session: {
            clientId: string;
            domainCode: string;
            domainId: string;
            conversationId: string;
            customerIdentifier?: string;
            nextSequenceNo: number;
        };
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
    pushAudio(payload: {
        audioBase64: string;
    }, client: Socket): Promise<{
        accepted: boolean;
    }>;
}
