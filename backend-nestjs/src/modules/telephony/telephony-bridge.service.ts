import { Injectable, Logger } from '@nestjs/common';
import { RealtimeService } from '../realtime/realtime.service';
import { EscalationsService } from '../escalations/escalations.service';
import { EscalationDetectorService } from '../escalations/escalation-detector.service';
import { TelephonyService } from './telephony.service';

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

/** Tool the model can call to hand the caller to a human. */
const ESCALATE_TOOL = {
  type: 'function',
  name: 'escalate_to_human',
  description:
    'Transfer the caller to a human agent. Use when the caller asks for a person, is upset, ' +
    'reports an emergency or fraud, or asks for something outside the supported intents.',
  parameters: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        description: 'Short reason for the handover, shown to the agent.',
      },
      priority: {
        type: 'string',
        enum: ['low', 'normal', 'high', 'urgent'],
        description: 'urgent for medical emergencies or fraud, high when the caller is upset.',
      },
      summary: {
        type: 'string',
        description: 'One or two sentences summarising what the caller needs.',
      },
    },
    required: ['reason'],
  },
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
              onEscalationTool: async (args, callId) => {
                if (!context) return;
                await this.escalateNow(clientId, context, {
                  reason: args.reason || 'Assistant requested human handover',
                  priority: (args.priority as any) || 'high',
                  summary: args.summary,
                });
                // Let the model close the turn gracefully while Twilio redirects.
                sendJson(realtimeWs, {
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: callId,
                    output: JSON.stringify({
                      status: 'transferring',
                      message: 'Caller is being connected to an agent.',
                    }),
                  },
                });
                sendJson(realtimeWs, { type: 'response.create' });
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
      onEscalationTool: (args: Record<string, string>, callId: string) => Promise<void>;
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

    const { url, headers } = buildAzureRealtimeUrl();
    const realtimeWs = new WebSocket(url, { headers });

    realtimeWs.on('error', (error: any) => {
      this.logger.error(`Azure realtime error on call ${context.callSid}: ${error?.message || error}`);
    });

    realtimeWs.on('open', () => {
      sendJson(realtimeWs, {
        type: 'session.update',
        session: {
          turn_detection: {
            type: 'server_vad',
            threshold: 0.55,
            silence_duration_ms: 350,
            prefix_padding_ms: 200,
            create_response: true,
          },
          input_audio_transcription: { model: 'gpt-4o-mini-transcribe' },
          // Telephony audio is 8 kHz G.711 μ-law in both directions.
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
          voice: started.voice || 'alloy',
          instructions: `${started.instructions} When you cannot help or the caller asks for a person, call the escalate_to_human function instead of only apologising.`,
          modalities: ['text', 'audio'],
          temperature: 0.7,
          tools: [ESCALATE_TOOL],
          tool_choice: 'auto',
        },
      });

      sendJson(realtimeWs, {
        type: 'response.create',
        response: {
          modalities: ['text', 'audio'],
          instructions: `Greet the caller with exactly: ${started.welcomeMessage}`,
        },
      });
    });

    realtimeWs.on('message', async (raw: any) => {
      let event: any;
      try {
        event = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (event.type) {
        case 'response.audio.delta':
          if (event.delta) {
            sendJson(twilioWs, {
              event: 'media',
              streamSid: context.streamSid,
              media: { payload: event.delta },
            });
          }
          return;

        case 'input_audio_buffer.speech_started':
          // Barge-in: drop audio Twilio has buffered so the caller is not
          // talking over a reply that is already obsolete.
          sendJson(twilioWs, { event: 'clear', streamSid: context.streamSid });
          return;

        case 'response.audio_transcript.delta':
        case 'response.text.delta':
        case 'response.output_text.delta':
          if (event.delta) handlers.onAssistantDelta(event.delta);
          return;

        case 'response.done':
          await handlers.onResponseDone();
          return;

        case 'conversation.item.input_audio_transcription.completed':
          if (event.transcript) {
            await handlers.onCallerTranscript(String(event.transcript));
          }
          return;

        case 'response.function_call_arguments.done': {
          if (event.name !== ESCALATE_TOOL.name) return;
          let args: Record<string, string> = {};
          try {
            args = JSON.parse(event.arguments || '{}');
          } catch {
            args = {};
          }
          await handlers.onEscalationTool(args, event.call_id);
          return;
        }

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

/** Azure realtime endpoint + auth headers, shared shape with main.ts. */
export function buildAzureRealtimeUrl(): { url: string; headers: Record<string, string> } {
  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/+$/, '');
  const deployment = (process.env.AZURE_OPENAI_DEPLOYMENT || '').trim();
  const apiKey = (process.env.AZURE_OPENAI_API_KEY || '').trim();
  const apiVersion = (process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview').trim();

  if (!endpoint || !deployment || !apiKey) {
    throw new Error('Azure OpenAI realtime configuration missing.');
  }

  const host = new URL(endpoint).host;
  const previewApiVersion = apiVersion.endsWith('-preview') ? apiVersion : '2025-01-01-preview';

  return {
    url: `wss://${host}/openai/realtime?api-version=${previewApiVersion}&deployment=${deployment}`,
    headers: {
      'api-key': apiKey,
      'OpenAI-Beta': 'realtime=v1',
    },
  };
}
