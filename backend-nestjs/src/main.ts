import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppModule } from './app.module';
import { RealtimeService } from './modules/realtime/realtime.service';
import { TelephonyBridgeService } from './modules/telephony/telephony-bridge.service';
import { EscalationEventsService } from './modules/escalations/escalation-events.service';
import { EscalationsService } from './modules/escalations/escalations.service';
import {
  ESCALATE_TO_HUMAN_TOOL,
  RealtimeToolRunner,
  buildAzureRealtimeConnection,
  buildResponseCreate,
  buildSessionUpdate,
  classifyRealtimeEvent,
} from './modules/realtime/azure-realtime';
import { transcriptionLanguageHint } from './modules/realtime/language-policy';
import { HospitalToolsService } from './modules/hospital/hospital-tools.service';

const { WebSocket, WebSocketServer } = require('ws');

/** Websocket paths this process serves directly (socket.io handles its own). */
const WS_PATH_STUDIO = '/ws';
const WS_PATH_AGENT_DESK = '/ws/agent-desk';
const WS_PATH_TELEPHONY = '/telephony/media';
/** engine.io transport path; the Nest socket.io gateway handles these itself. */
const WS_PATH_SOCKET_IO = '/socket.io';

/** Safely send a JSON message to a WebSocket if it's still open */
function safeSend(ws: any, data: object): boolean {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      return true;
    }
  } catch (err) {
    console.error('safeSend failed:', err);
  }
  return false;
}

/** Safely close a WebSocket if it's still open */
function safeClose(ws: any, code?: number, reason?: string): void {
  try {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close(code, reason);
    }
  } catch (err) {
    console.error('safeClose failed:', err);
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT || 8010);
  const host = process.env.HOST || '0.0.0.0';
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const realtimeService = app.get(RealtimeService);
  const telephonyBridge = app.get(TelephonyBridgeService);
  const escalationEvents = app.get(EscalationEventsService);
  const escalationsService = app.get(EscalationsService);
  const hospitalTools = app.get(HospitalToolsService);
  const httpServer = app.getHttpServer();

  const studioWss = new WebSocketServer({ noServer: true });
  const agentDeskWss = new WebSocketServer({ noServer: true });
  const telephonyWss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request: any, socket: any, head: any) => {
    const url = new URL(request.url || '/', 'http://localhost');
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    const target =
      pathname === WS_PATH_STUDIO
        ? studioWss
        : pathname === WS_PATH_AGENT_DESK
          ? agentDeskWss
          : pathname === WS_PATH_TELEPHONY
            ? telephonyWss
            : null;

    if (!target) {
      // socket.io handshakes arrive on its transport path (/socket.io/...), not
      // on the gateway's namespace, and engine.io installs its own upgrade
      // listener. Leave those alone — destroying them here, as this handler
      // used to, killed every socket.io connection before it was established.
      if (!pathname.startsWith(WS_PATH_SOCKET_IO)) {
        socket.destroy();
      }
      return;
    }

    target.handleUpgrade(request, socket, head, (ws: any) => {
      target.emit('connection', ws, request);
    });
  });

  /* ───────────────────────── Browser IVR studio ───────────────────────── */

  studioWss.on('connection', async (ws: any, request: any) => {
    const clientId = randomUUID();
    const url = new URL(request.url || '/', 'http://localhost');
    const domainCode = (url.searchParams.get('domain') || 'general').trim().toLowerCase();
    let realtimeWs: any = null;
    let assistantText = '';

    // ── CRITICAL: Add error handler on client ws immediately ──
    // Without this, any error on the client WebSocket (e.g., invalid close
    // code from a proxy) causes an unhandled 'error' event that crashes
    // the entire Node.js process.
    ws.on('error', (error: any) => {
      console.error(`Client WS error [${clientId}]:`, error?.message || error);
      safeClose(realtimeWs);
    });

    try {
      const started = await realtimeService.startSession(clientId, { domainCode });
      const { url: realtimeUrl, headers } = buildAzureRealtimeConnection();

      // Hospital domains get the booking tools; every domain can escalate.
      const hospitalLine = hospitalTools.appliesTo(started);
      if (hospitalLine) {
        hospitalTools.startSession(clientId, {
          conversationId: started.session.conversationId,
          organizationName: started.organizationName,
        });
      }
      const tools = hospitalLine
        ? [...hospitalTools.definitions(), ESCALATE_TO_HUMAN_TOOL]
        : [ESCALATE_TO_HUMAN_TOOL];
      const instructions = [
        started.instructions,
        hospitalLine ? hospitalTools.instructions() : '',
        'When the caller asks for a person or you cannot help, call escalate_to_human.',
      ]
        .filter(Boolean)
        .join(' ');

      realtimeWs = new WebSocket(realtimeUrl, {
        headers,
      });

      const toolRunner = new RealtimeToolRunner(
        (event) => safeSend(realtimeWs, event),
        async (name, args) => {
          // Lets the browser show what the assistant is doing.
          safeSend(ws, { type: 'tool_call', name });
          if (name !== ESCALATE_TO_HUMAN_TOOL.name) {
            return hospitalTools.execute(clientId, name, args);
          }
          const escalation = await escalationsService.create({
            conversationId: started.session.conversationId,
            escalationReason: String(args.reason || 'Assistant requested human handover').slice(0, 255),
            priority: ['low', 'normal', 'high', 'urgent'].includes(args.priority) ? args.priority : 'high',
            channel: 'queue',
            contextSummary: args.summary,
          });
          safeSend(ws, { type: 'escalated', escalationId: escalation.escalationId, status: escalation.status });
          return { status: escalation.status, message: 'A staff member will join or call back shortly.' };
        },
        (name, error) => console.error(`Tool ${name} failed [${clientId}]:`, error),
      );

      // ── CRITICAL: Attach error handler IMMEDIATELY after creating the
      // Azure WebSocket, BEFORE the 'open' event fires. This prevents
      // unhandled 'error' events from crashing the process when Azure
      // OpenAI is unreachable or returns invalid frames. ──
      realtimeWs.on('error', (error: any) => {
        console.error(`Azure OpenAI realtime websocket error [${clientId}]:`, error?.message || error);
        safeSend(ws, {
          type: 'output_text',
          text: 'Backend could not connect to Azure OpenAI realtime.',
        });
        safeSend(ws, { type: 'output_text_done' });
        safeClose(ws);
      });

      realtimeWs.on('open', () => {
        // No output-token cap: the old 128-token limit cut spoken answers off
        // after a few seconds, mid-sentence.
        realtimeWs.send(
          JSON.stringify(
            buildSessionUpdate({
              codec: 'pcm16',
              voice: started.voice,
              instructions,
              tools,
              turnDetection: { threshold: 0.58, silenceDurationMs: 150, prefixPaddingMs: 120 },
              transcriptionLanguage: transcriptionLanguageHint(started.supportedLanguages),
            }),
          ),
        );
        realtimeWs.send(JSON.stringify(buildResponseCreate(started.greetingInstruction)));
      });

      realtimeWs.on('message', async (payload: any) => {
        try {
          const message = JSON.parse(payload.toString());
          const kind = classifyRealtimeEvent(message.type);

          if (kind === 'assistant_text' && message.delta) {
            assistantText += message.delta;
            safeSend(ws, { type: 'output_text', text: message.delta });
            return;
          }

          if (kind === 'assistant_audio' && message.delta) {
            safeSend(ws, { type: 'output_audio', audio: message.delta });
            return;
          }

          if (kind === 'caller_transcript' && message.transcript) {
            // Keep the browser session transcript in the conversation log so an
            // escalated web chat reaches the agent with the same context a call
            // would have.
            await realtimeService.recordCallerText(clientId, String(message.transcript));
            safeSend(ws, { type: 'input_transcript', text: String(message.transcript) });
            return;
          }

          if (kind === 'response_created') {
            toolRunner.onResponseCreated();
            return;
          }

          if (kind === 'function_call') {
            await toolRunner.onFunctionCall(message);
            return;
          }

          if (kind === 'response_done') {
            toolRunner.onResponseDone();
            if (assistantText.trim()) {
              await realtimeService.recordAssistantText(clientId, assistantText);
            }
            safeSend(ws, { type: 'output_text_done' });
            assistantText = '';
            return;
          }

          if (kind === 'error') {
            const text = message.error?.message || 'Realtime API returned an error.';
            console.error(`Azure realtime error [${clientId}]:`, text);
            safeSend(ws, { type: 'output_text', text });
            safeSend(ws, { type: 'output_text_done' });
          }
        } catch (error) {
          console.error('Failed to handle realtime message:', error);
        }
      });

      realtimeWs.on('close', () => {
        safeClose(ws);
      });

    } catch (error: any) {
      console.error(`Failed to start IVR websocket session [${clientId}]:`, error?.message || error);
      safeSend(ws, {
        type: 'output_text',
        text: `Backend could not start the IVR session for this domain.`,
      });
      safeSend(ws, { type: 'output_text_done' });
      safeClose(ws);
      return;
    }

    ws.on('message', async (payload: any) => {
      try {
        const message = JSON.parse(payload.toString());

        if (message.type === 'input_audio' && message.audio) {
          // Forward immediately; nothing is written to the database per chunk.
          if (realtimeWs && realtimeWs.readyState === WebSocket.OPEN) {
            realtimeWs.send(
              JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: message.audio,
              }),
            );
          }
          return;
        }

        // Caller-initiated handover from the browser client ("talk to a human").
        if (message.type === 'escalate') {
          const session = realtimeService.getSession(clientId);
          if (!session) {
            safeSend(ws, { type: 'escalation_failed', text: 'No active session to escalate.' });
            return;
          }
          const escalation = await escalationsService.create({
            conversationId: session.conversationId,
            escalationReason: String(message.reason || 'Caller requested a human agent'),
            priority: 'high',
            channel: 'queue',
          });
          safeSend(ws, {
            type: 'escalated',
            escalationId: escalation.escalationId,
            status: escalation.status,
          });
        }
      } catch {
        safeSend(ws, { type: 'output_text', text: 'Invalid websocket message.' });
        safeSend(ws, { type: 'output_text_done' });
      }
    });

    ws.on('close', async () => {
      safeClose(realtimeWs);
      hospitalTools.endSession(clientId);
      await realtimeService.unregisterClient(clientId);
    });
  });

  /* ───────────────────── Agent desk (escalation console) ───────────────────── */

  agentDeskWss.on('connection', (ws: any) => {
    const subscriberId = randomUUID();
    const unsubscribe = escalationEvents.subscribe(subscriberId, (event) => {
      safeSend(ws, event);
    });

    safeSend(ws, { type: 'connected', at: new Date().toISOString(), subscriberId });

    // Keep intermediaries from dropping an idle console overnight.
    const heartbeat = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      safeSend(ws, { type: 'ping', at: new Date().toISOString() });
    }, 25_000);

    const teardown = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };

    ws.on('error', teardown);
    ws.on('close', teardown);
  });

  /* ───────────────────────── Twilio media stream ───────────────────────── */

  telephonyWss.on('connection', (ws: any, request: any) => {
    const clientId = randomUUID();
    const url = new URL(request.url || '/', 'http://localhost');
    void telephonyBridge.handleConnection(ws, clientId, url.searchParams).catch((error: any) => {
      console.error(`Telephony bridge failed [${clientId}]:`, error?.message || error);
      safeClose(ws);
    });
  });

  await app.listen(port, host);
  console.log(`NestJS IVR backend running on http://${host}:${port}`);
  console.log(`  browser IVR websocket   ws://${host}:${port}${WS_PATH_STUDIO}`);
  console.log(`  agent desk websocket    ws://${host}:${port}${WS_PATH_AGENT_DESK}`);
  console.log(`  telephony media stream  ws://${host}:${port}${WS_PATH_TELEPHONY}`);
}

void bootstrap();
