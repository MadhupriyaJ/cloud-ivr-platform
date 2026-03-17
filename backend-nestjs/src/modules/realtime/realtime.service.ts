import { Injectable, Logger } from '@nestjs/common';
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

type DomainRealtimeConfig = {
  intents: string[];
  rules: string[];
  compliance: string[];
  instructions: string;
  welcomeMessage: string;
  fallbackMessage: string;
  escalationMessage: string;
  systemPrompt: string;
};

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly clients = new Map<string, Socket>();
  private readonly sessions = new Map<string, ActiveSession>();

  constructor(
    private readonly domainService: DomainService,
    private readonly domainIntentsService: DomainIntentsService,
    private readonly domainRulesService: DomainRulesService,
    private readonly promptTemplatesService: PromptTemplatesService,
    private readonly conversationsService: ConversationsService,
  ) {}

  private buildInstructions(input: {
    organizationName: string;
    intents: string[];
    rules: string[];
    compliance: string[];
    systemPrompt: string;
    fallbackMessage: string;
    escalationMessage: string;
  }): string {
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

  private async loadDomainRealtimeConfig(
    domainId: string,
    organizationName: string,
    welcomeMessage: string,
    fallbackMessage: string,
    escalationMessage: string,
  ): Promise<DomainRealtimeConfig> {
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
    const promptMap = new Map<string, string>();
    activePrompts.forEach((item) => {
      const key = item.promptType.trim().toLowerCase();
      if (!promptMap.has(key)) {
        promptMap.set(key, item.templateText.trim());
      }
    });
    const resolvedWelcomeMessage = promptMap.get('welcome') || welcomeMessage;
    const resolvedFallbackMessage = promptMap.get('fallback') || fallbackMessage;
    const resolvedEscalationMessage = promptMap.get('escalation') || escalationMessage;
    const resolvedSystemPrompt =
      promptMap.get('system') ||
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
    escalationMessage: string;
    intents: string[];
    rules: string[];
    compliance: string[];
    instructions: string;
  }> {
    const domain = await this.domainService.getByCode(payload.domainCode);
    const config = await this.loadDomainRealtimeConfig(
      domain.domainId,
      domain.organizationName,
      domain.welcomeMessage,
      domain.fallbackMessage,
      domain.escalationMessage,
    );
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
