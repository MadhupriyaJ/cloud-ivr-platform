import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppModule } from './app.module';
import { RealtimeService } from './modules/realtime/realtime.service';

const { WebSocket, WebSocketServer } = require('ws');

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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
  const httpServer = app.getHttpServer();
  const rawWss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request: any, socket: any, head: any) => {
    const url = new URL(request.url || '/', 'http://localhost');
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }

    rawWss.handleUpgrade(request, socket, head, (ws: any) => {
      rawWss.emit('connection', ws, request);
    });
  });

  rawWss.on('connection', async (ws: any, request: any) => {
    const clientId = randomUUID();
    const url = new URL(request.url || '/', 'http://localhost');
    const domainCode = (url.searchParams.get('domain') || 'general').trim().toLowerCase();
    let realtimeWs: any = null;
    let assistantText = '';

    try {
      const started = await realtimeService.startSession(clientId, { domainCode });
      const { url: realtimeUrl, headers } = buildAzureRealtimeUrl();

      realtimeWs = new WebSocket(realtimeUrl, {
        headers,
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
            ws.send(JSON.stringify({ type: 'output_text', text: message.delta }));
            return;
          }

          if (type === 'response.audio.delta' && message.delta) {
            ws.send(JSON.stringify({ type: 'output_audio', audio: message.delta }));
            return;
          }

          if (type === 'response.done') {
            if (assistantText.trim()) {
              await realtimeService.recordAssistantText(clientId, assistantText);
            }
            ws.send(JSON.stringify({ type: 'output_text_done' }));
            assistantText = '';
            return;
          }

          if (type === 'error') {
            const text = message.error?.message || 'Realtime API returned an error.';
            ws.send(JSON.stringify({ type: 'output_text', text }));
            ws.send(JSON.stringify({ type: 'output_text_done' }));
          }
        } catch (error) {
          console.error('Failed to handle realtime message:', error);
        }
      });

      realtimeWs.on('close', () => {
        if (ws.readyState === ws.OPEN) {
          ws.close();
        }
      });

      realtimeWs.on('error', (error: any) => {
        console.error('Azure OpenAI realtime websocket error:', error);
        if (ws.readyState === ws.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'output_text',
              text: 'Backend could not connect to Azure OpenAI realtime.',
            }),
          );
          ws.send(JSON.stringify({ type: 'output_text_done' }));
          ws.close();
        }
      });
    } catch (error) {
      console.error('Failed to start IVR websocket session:', error);
      ws.send(
        JSON.stringify({
          type: 'output_text',
          text: `Backend could not start the IVR session for this domain.`,
        }),
      );
      ws.send(JSON.stringify({ type: 'output_text_done' }));
      ws.close();
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
        }
      } catch {
        ws.send(JSON.stringify({ type: 'output_text', text: 'Invalid websocket message.' }));
        ws.send(JSON.stringify({ type: 'output_text_done' }));
      }
    });

    ws.on('close', async () => {
      if (realtimeWs && realtimeWs.readyState === WebSocket.OPEN) {
        realtimeWs.close();
      }
      await realtimeService.unregisterClient(clientId);
    });
  });

  await app.listen(8010);
}

void bootstrap();
