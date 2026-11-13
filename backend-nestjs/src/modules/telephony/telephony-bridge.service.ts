import { Injectable, Logger } from '@nestjs/common';
import { RealtimeService } from '../realtime/realtime.service';
import { EscalationsService } from '../escalations/escalations.service';
import { EscalationDetectorService } from '../escalations/escalation-detector.service';
import { TelephonyService } from './telephony.service';
import {
  ESCALATE_TO_HUMAN_TOOL,
  RealtimeToolRunner,
  buildAzureRealtimeConnection,
  buildResponseCreate,
  buildSessionUpdate,
  classifyRealtimeEvent,
} from '../realtime/azure-realtime';
import { transcriptionLanguageHint } from '../realtime/language-policy';
import { HospitalToolsService } from '../hospital/hospital-tools.service';

const { WebSocket } = require('ws');

type TwilioStreamStart = {
  streamSid: string;
  callSid?: string;
  customParameters?: Record<string, string>;
};

type CallContext = {
  callSid: string;
  streamSid: string;
  domainCode: string;
  from: string;
  to: string;
  skillGroup?: string;
  conversationId?: string;
  fallbackMessage: string;
  escalationMessage: string;
  fallbackStreak: number;
  turnCount: number;
  escalating: boolean;
};

/**
 * Bridges a Twilio Media Stream to the Azure OpenAI realtime API.
 *
 * Twilio sends 8 kHz G.711 μ-law base64 frames; the realtime session is
 * configured with the same codec in both directions, so audio is relayed
 * without transcoding. Everything else here is about turning the call into
 * platform state: conversation messages, escalation triggers, call log.
 */
@Injectable()
export class TelephonyBridgeService {
  private readonly logger = new Logger(TelephonyBridgeService.name);

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly telephonyService: TelephonyService,
    private readonly escalationsService: EscalationsService,
    private readonly detector: EscalationDetectorService,
    private readonly hospitalTools: HospitalToolsService,
  ) {}

  /**
   * Handle one Twilio media-stream websocket for the lifetime of a call.
   * `clientId` is the internal session key used by RealtimeService.
   */
  async handleConnection(twilioWs: any, clientId: string, query: URLSearchParams): Promise<void> {
    let realtimeWs: any = null;
    let context: CallContext | null = null;
    let assistantText = '';
    let closed = false;

    const closeAll = () => {
      if (closed) return;
      closed = true;
      safeClose(realtimeWs);
      safeClose(twilioWs);
      this.hospitalTools.endSession(clientId);
      void this.realtimeService.unregisterClient(clientId);
    };

    // Without this the process dies on a mid-call socket error.
    twilioWs.on('error', (error: any) => {
      this.logger.error(`Twilio media stream error [${clientId}]: ${error?.message || error}`);
      closeAll();
    });

    twilioWs.on('close', () => {
      if (context?.callSid) {
        void this.telephonyService
          .updateCallStatus({ callSid: context.callSid, status: 'completed' })
          .catch(() => undefined);
      }
      closeAll();
    });

    twilioWs.on('message', async (raw: any) => {
      let message: any;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (message.event) {
        case 'start': {
          const start: TwilioStreamStart = message.start || {};
          const params = start.customParameters || {};
          context = {
            callSid: start.callSid || params.callSid || query.get('callSid') || clientId,
            streamSid: start.streamSid,
            domainCode: (params.domainCode || query.get('domain') || 'hospital').toLowerCase(),
            from: params.from || query.get('from') || '',
            to: params.to || query.get('to') || '',
            skillGroup: params.skillGroup || undefined,
            fallbackMessage: '',
            escalationMessage: '',
            fallbackStreak: 0,
            turnCount: 0,
            escalating: false,
          };

          this.logger.log(
            `Media stream started for call ${context.callSid} (domain: ${context.domainCode})`,
          );

          try {
            realtimeWs = await this.openRealtimeSession(clientId, context, twilioWs, {
              onAssistantDelta: (delta) => {
                assistantText += delta;
              },
              onResponseDone: async () => {
                const text = assistantText.trim();
                assistantText = '';
                if (!text || !context) return;

                await this.realtimeService.recordAssistantText(clientId, text).catch(() => undefined);

                // Repeated "I can't help with that" is itself an escalation signal.
                context.fallbackStreak = this.detector.isFallbackReply(text, context.fallbackMessage)
                  ? context.fallbackStreak + 1
                  : 0;
                await this.maybeEscalate(clientId, context, '');
              },
              onCallerTranscript: async (transcript) => {
                if (!context) return;
                context.turnCount += 1;
                await this.realtimeService
                  .recordCallerText(clientId, transcript)
                  .catch(() => undefined);
                await this.maybeEscalate(clientId, context, transcript);
              },
              onEscalationTool: async (args) => {
                if (!context) return { ok: false };
                await this.escalateNow(clientId, context, {
                  reason: args.reason || 'Assistant requested human handover',
                  priority: (args.priority as any) || 'high',
                  summary: args.summary,
                });
                // The model closes the turn gracefully while Twilio redirects.
                return { status: 'transferring', message: 'Caller is being connected to an agent.' };
              },
            });
          } catch (error) {
            this.logger.error(`Could not start realtime session for call: ${String(error)}`);
            closeAll();
          }
          return;
        }

        case 'media': {
          const payload = message.media?.payload;
          if (payload && realtimeWs?.readyState === WebSocket.OPEN) {
            sendJson(realtimeWs, { type: 'input_audio_buffer.append', audio: payload });
          }
          return;
        }

        case 'stop': {
          this.logger.log(`Media stream stopped for call ${context?.callSid ?? clientId}`);
          closeAll();
          return;
        }

        default:
          return;
      }
    });
  }

  /** Open the Azure realtime socket configured for telephony-grade audio. */
  private async openRealtimeSession(
    clientId: string,
    context: CallContext,
    twilioWs: any,
    handlers: {
      onAssistantDelta: (delta: string) => void;
      onResponseDone: () => Promise<void>;
      onCallerTranscript: (transcript: string) => Promise<void>;
      onEscalationTool: (args: Record<string, string>) => Promise<Record<string, unknown>>;
    },
  ): Promise<any> {
    const started = await this.realtimeService.startSession(clientId, {
      domainCode: context.domainCode,
      customerIdentifier: context.from || undefined,
      channelType: 'phone',
    });

    context.conversationId = started.session.conversationId;
    context.fallbackMessage = started.fallbackMessage;
    context.escalationMessage = started.escalationMessage;

    await this.telephonyService
      .attachConversation(context.callSid, started.session.conversationId)
      .catch(() => undefined);

    // Hospital lines get the booking tools; every line can escalate.
    const hospitalLine = this.hospitalTools.appliesTo(started);
    if (hospitalLine) {
      this.hospitalTools.startSession(clientId, {
        callerPhone: context.from,
        conversationId: started.session.conversationId,
        organizationName: started.organizationName,
      });
    }
    const tools = hospitalLine
      ? [...this.hospitalTools.definitions(), ESCALATE_TO_HUMAN_TOOL]
      : [ESCALATE_TO_HUMAN_TOOL];
    const instructions = [
      started.instructions,
      hospitalLine ? this.hospitalTools.instructions() : '',
      'When you cannot help or the caller asks for a person, call the escalate_to_human function instead of only apologising.',
      'The caller is on a phone call; their caller ID is known to the system, so do not ask for their number unless verification fails.',
    ]
      .filter(Boolean)
      .join(' ');

    const { url, headers } = buildAzureRealtimeConnection();
    const realtimeWs = new WebSocket(url, { headers });

    const toolRunner = new RealtimeToolRunner(
      (event) => sendJson(realtimeWs, event),
      async (name, args) =>
        name === ESCALATE_TO_HUMAN_TOOL.name
          ? handlers.onEscalationTool(args)
          : this.hospitalTools.execute(clientId, name, args),
      (name, error) => this.logger.error(`Tool ${name} failed on call ${context.callSid}: ${String(error)}`),
    );

    realtimeWs.on('error', (error: any) => {
      this.logger.error(`Azure realtime error on call ${context.callSid}: ${error?.message || error}`);
    });

    // If Azure drops the session the caller would otherwise sit in silence.
    realtimeWs.on('close', (code: number) => {
      this.logger.warn(`Azure realtime closed on call ${context.callSid} (code ${code})`);
      safeClose(twilioWs);
    });

    realtimeWs.on('open', () => {
      sendJson(
        realtimeWs,
        buildSessionUpdate({
          // Telephony audio is 8 kHz G.711 μ-law in both directions.
          codec: 'g711_ulaw',
          voice: started.voice,
          instructions,
          turnDetection: { threshold: 0.55, silenceDurationMs: 350, prefixPaddingMs: 200 },
          tools,
          transcriptionLanguage: transcriptionLanguageHint(started.supportedLanguages),
        }),
      );
      sendJson(realtimeWs, buildResponseCreate(started.greetingInstruction));
    });

    realtimeWs.on('message', async (raw: any) => {
      let event: any;
      try {
        event = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (classifyRealtimeEvent(event.type)) {
        case 'assistant_audio':
          if (event.delta) {
            sendJson(twilioWs, {
              event: 'media',
              streamSid: context.streamSid,
              media: { payload: event.delta },
            });
          }
          return;

        case 'caller_speech_started':
          // Barge-in: drop audio Twilio has buffered so the caller is not
          // talking over a reply that is already obsolete.
          sendJson(twilioWs, { event: 'clear', streamSid: context.streamSid });
          return;

        case 'assistant_text':
          if (event.delta) handlers.onAssistantDelta(event.delta);
          return;

        case 'response_created':
          toolRunner.onResponseCreated();
          return;

        case 'response_done':
          toolRunner.onResponseDone();
          await handlers.onResponseDone();
          return;

        case 'caller_transcript':
          if (event.transcript) {
            await handlers.onCallerTranscript(String(event.transcript));
          }
          return;

        case 'function_call':
          this.logger.log(`Call ${context.callSid} tool: ${event.name}`);
          await toolRunner.onFunctionCall(event);
          return;

        case 'error':
          this.logger.error(
            `Realtime API error on call ${context.callSid}: ${event.error?.message || 'unknown'}`,
          );
          return;

        default:
          return;
      }
    });

    return realtimeWs;
  }

  /** Run the rule-based detector and escalate if it fires. */
  private async maybeEscalate(
    clientId: string,
    context: CallContext,
    utterance: string,
  ): Promise<void> {
    if (context.escalating) return;

    const trigger = this.detector.evaluate(utterance, {
      fallbackStreak: context.fallbackStreak,
      turnCount: context.turnCount,
    });
    if (!trigger.shouldEscalate) return;

    await this.escalateNow(clientId, context, {
      reason: trigger.reason,
      priority: trigger.priority,
      skillGroup: trigger.skillGroup,
    });
  }

  /**
   * Create the escalation for this call. The actual phone transfer is driven by
   * `TelephonyService`, which listens for `escalation.assigned` — so a call is
   * only moved once a specific agent has been picked.
   */
  private async escalateNow(
    clientId: string,
    context: CallContext,
    input: { reason: string; priority?: string; skillGroup?: string; summary?: string },
  ): Promise<void> {
    if (context.escalating || !context.conversationId) return;
    context.escalating = true;

    try {
      const escalation = await this.escalationsService.create({
        conversationId: context.conversationId,
        escalationReason: input.reason.slice(0, 255),
        priority: (input.priority as any) ?? 'high',
        channel: 'phone_transfer',
        skillGroup: input.skillGroup ?? context.skillGroup,
        callerIdentifier: context.from,
        callSid: context.callSid,
        contextSummary: input.summary,
      });

      this.logger.log(
        `Escalation ${escalation.escalationId} raised on call ${context.callSid} (${escalation.status})`,
      );

      // Queued with nobody free: transfer to the number-level fallback so the
      // caller still reaches a person instead of listening to the IVR loop.
      if (escalation.status === 'queued') {
        const target = await this.telephonyService.resolveTransferTarget(escalation);
        if (target) {
          await this.telephonyService.transferCallForEscalation(escalation);
        } else {
          this.logger.warn(
            `Escalation ${escalation.escalationId} queued with no transfer target; caller stays with the IVR.`,
          );
          context.escalating = false;
        }
      }
    } catch (error) {
      this.logger.error(`Failed to escalate call ${context.callSid}: ${String(error)}`);
      context.escalating = false;
    }
  }
}

/* ─────────────── helpers ─────────────── */

function sendJson(ws: any, data: object): void {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  } catch {
    // A dead socket during teardown is expected; nothing to recover.
  }
}

function safeClose(ws: any): void {
  try {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close();
    }
  } catch {
    // ignore
  }
}
