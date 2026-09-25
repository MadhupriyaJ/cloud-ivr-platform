import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppModule } from './app.module';
import { RealtimeService } from './modules/realtime/realtime.service';
import { TelephonyBridgeService } from './modules/telephony/telephony-bridge.service';
import { EscalationEventsService } from './modules/escalations/escalation-events.service';
import { EscalationsService } from './modules/escalations/escalations.service';

const { WebSocket, WebSocketServer } = require('ws');

/** Websocket paths this process serves directly (socket.io handles its own). */
const WS_PATH_STUDIO = '/ws';
const WS_PATH_AGENT_DESK = '/ws/agent-desk';
const WS_PATH_TELEPHONY = '/telephony/media';
/** engine.io transport path; the Nest socket.io gateway handles these itself. */
const WS_PATH_SOCKET_IO = '/socket.io';

function candidateWsBases(endpoint: string): string[] {
  const trimmed = endpoint.replace(/\/+$/, '');
  const parsed = new URL(trimmed);
  const host = parsed.host;
  const bases = [`wss://${host}`];

  if (host.endsWith('.cognitiveservices.azure.com')) {
    const resource = host.split('.')[0];
    bases.push(`wss://${resource}.openai.azure.com`);
  }

  return [...new Set(bases)];
}

function buildAzureRealtimeUrl(): { url: string; headers: Record<string, string> } {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || '';
  const apiKey = process.env.AZURE_OPENAI_API_KEY || '';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';

  if (!endpoint || !deployment || !apiKey) {
    throw new Error('Azure OpenAI realtime configuration missing.');
  }

  const wsBase = candidateWsBases(endpoint)[0];
  const previewApiVersion = apiVersion.endsWith('-preview') ? apiVersion : '2025-01-01-preview';

  return {
    url: `${wsBase}/openai/realtime?api-version=${previewApiVersion}&deployment=${deployment}`,
    headers: {
      'api-key': apiKey,
      'OpenAI-Beta': 'realtime=v1',
    },
  };
}

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
      const { url: realtimeUrl, headers } = buildAzureRealtimeUrl();

      realtimeWs = new WebSocket(realtimeUrl, {
        headers,
      });

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
        const sessionUpdate = {
          type: 'session.update',
          session: {
            turn_detection: {
              type: 'server_vad',
              threshold: 0.58,
              silence_duration_ms: 150,
              prefix_padding_ms: 120,
              create_response: true,
            },
            input_audio_transcription: { model: 'gpt-4o-mini-transcribe' },
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            voice: started.voice || 'alloy',
            instructions: started.instructions,
            modalities: ['text', 'audio'],
            temperature: 0.8,
            max_response_output_tokens: 128,
          },
        };

        realtimeWs.send(JSON.stringify(sessionUpdate));
        realtimeWs.send(
          JSON.stringify({
            type: 'response.create',
            response: {
              modalities: ['text', 'audio'],
              instructions: `Say exactly this sentence and nothing else: ${started.welcomeMessage}`,
            },
          }),
        );
      });

      realtimeWs.on('message', async (payload: any) => {
        try {
          const message = JSON.parse(payload.toString());
          const type = message.type;

          if (
            (
              type === 'response.text.delta' ||
              type === 'response.output_text.delta' ||
              type === 'response.audio_transcript.delta'
            ) &&
            message.delta
          ) {
            assistantText += message.delta;
            safeSend(ws, { type: 'output_text', text: message.delta });
            return;
          }

          if (type === 'response.audio.delta' && message.delta) {
            safeSend(ws, { type: 'output_audio', audio: message.delta });
            return;
          }

          if (type === 'conversation.item.input_audio_transcription.completed' && message.transcript) {
            // Keep the browser session transcript in the conversation log so an
            // escalated web chat reaches the agent with the same context a call
            // would have.
            await realtimeService.recordCallerText(clientId, String(message.transcript));
            safeSend(ws, { type: 'input_transcript', text: String(message.transcript) });
            return;
          }

          if (type === 'response.done') {
            if (assistantText.trim()) {
              await realtimeService.recordAssistantText(clientId, assistantText);
            }
            safeSend(ws, { type: 'output_text_done' });
            assistantText = '';
            return;
          }

          if (type === 'error') {
            const text = message.error?.message || 'Realtime API returned an error.';
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
          await realtimeService.handleAudioChunk(clientId, message.audio);
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
