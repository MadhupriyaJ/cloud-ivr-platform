import { Injectable, Logger } from '@nestjs/common';
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

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly clients = new Map<string, Socket>();
  private readonly sessions = new Map<string, ActiveSession>();

  constructor(
    private readonly domainService: DomainService,
    private readonly conversationsService: ConversationsService,
  ) {}

  async registerClient(client: Socket): Promise<void> {
    this.clients.set(client.id, client);
    this.logger.log(`Client connected: ${client.id}`);
  }

  async unregisterClient(clientId: string): Promise<void> {
    this.clients.delete(clientId);
    this.sessions.delete(clientId);
    this.logger.log(`Client disconnected: ${clientId}`);
  }

  async startSession(
    clientId: string,
    payload: { domainCode: string; customerIdentifier?: string },
  ): Promise<{
    ok: true;
    session: ActiveSession;
    welcomeMessage: string;
    voice: string;
    organizationName: string;
    fallbackMessage: string;
  }> {
    const domain = await this.domainService.getByCode(payload.domainCode);
    const conversation = await this.conversationsService.create({
      domainId: domain.domainId,
      channelType: 'websocket',
      customerIdentifier: payload.customerIdentifier,
    });

    const session: ActiveSession = {
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

  async handleAudioChunk(clientId: string, audioBase64: string): Promise<{ accepted: boolean }> {
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

    // Placeholder for Azure OpenAI Realtime integration:
    // 1. load prompt + tools for session.domainCode
    // 2. forward audioBase64
    // 3. evaluate transcript against intent guard
    // 4. execute tools only if allowed by domain config
    void audioBase64;
    return { accepted: true };
  }

  async recordAssistantText(clientId: string, text: string): Promise<void> {
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
}
