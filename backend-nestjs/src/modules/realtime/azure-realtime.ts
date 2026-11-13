/**
 * Azure OpenAI Realtime (GA protocol) helpers shared by the browser studio
 * socket (main.ts) and the Twilio phone bridge.
 *
 * Azure deprecated the preview protocol (`/openai/realtime?api-version=…`
 * with the `OpenAI-Beta: realtime=v1` header) on 2026-04-30. The GA protocol
 * differs in three ways that matter here:
 *   1. URL: `wss://<resource>/openai/v1/realtime?model=<deployment>`, with no
 *      api-version (an api-version on the GA path is rejected).
 *   2. `session.update` needs `session.type = "realtime"`, and audio settings
 *      move under `session.audio.input` / `session.audio.output`.
 *   3. Server events are renamed (`response.audio.delta` →
 *      `response.output_audio.delta`, and so on).
 *
 * `classifyRealtimeEvent` accepts both the preview and GA event names so the
 * bridges keep working whichever one the service sends.
 */

/** Audio codecs used by the two entry points. */
export type RealtimeAudioCodec =
  /** 24 kHz 16-bit PCM — browser studio. */
  | 'pcm16'
  /** 8 kHz G.711 μ-law — Twilio phone calls. */
  | 'g711_ulaw';

export type RealtimeTool = {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type TurnDetection = {
  threshold: number;
  silenceDurationMs: number;
  prefixPaddingMs: number;
};

/** Lets the model hand the caller to a human agent (phone and browser). */
export const ESCALATE_TO_HUMAN_TOOL: RealtimeTool = {
  type: 'function',
  name: 'escalate_to_human',
  description:
    'Transfer the caller to a human agent. Use when the caller asks for a person, is upset, ' +
    'reports an emergency or fraud, or asks for something outside the supported intents.',
  parameters: {
    type: 'object',
    properties: {
      reason: { type: 'string', description: 'Short reason for the handover, shown to the agent.' },
      priority: {
        type: 'string',
        enum: ['low', 'normal', 'high', 'urgent'],
        description: 'urgent for medical emergencies or fraud, high when the caller is upset.',
      },
      summary: { type: 'string', description: 'One or two sentences summarising what the caller needs.' },
    },
    required: ['reason'],
  },
};

/** Default transcription model for caller speech; override per deployment. */
const DEFAULT_TRANSCRIPTION_MODEL = 'whisper-1';

export function isRealtimeConfigured(): boolean {
  return Boolean(
    (process.env.AZURE_OPENAI_ENDPOINT || '').trim() &&
      (process.env.AZURE_OPENAI_DEPLOYMENT || '').trim() &&
      (process.env.AZURE_OPENAI_API_KEY || '').trim(),
  );
}

/** GA websocket URL and auth headers for the configured realtime deployment. */
export function buildAzureRealtimeConnection(): { url: string; headers: Record<string, string> } {
  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').trim().replace(/\/+$/, '');
  const deployment = (process.env.AZURE_OPENAI_DEPLOYMENT || '').trim();
  const apiKey = (process.env.AZURE_OPENAI_API_KEY || '').trim();

  if (!endpoint || !deployment || !apiKey) {
    throw new Error(
      'Azure OpenAI realtime configuration missing: set AZURE_OPENAI_ENDPOINT, ' +
        'AZURE_OPENAI_DEPLOYMENT and AZURE_OPENAI_API_KEY.',
    );
  }

  const host = new URL(endpoint).host;
  return {
    url: `wss://${host}/openai/v1/realtime?model=${encodeURIComponent(deployment)}`,
    // GA rejects the preview-era `OpenAI-Beta` header, so only the key is sent.
    headers: { 'api-key': apiKey },
  };
}

function audioFormat(codec: RealtimeAudioCodec): Record<string, unknown> {
  return codec === 'g711_ulaw' ? { type: 'audio/pcmu' } : { type: 'audio/pcm', rate: 24000 };
}

/** GA `session.update` event for a speech-to-speech IVR session. */
export function buildSessionUpdate(options: {
  instructions: string;
  voice?: string;
  codec: RealtimeAudioCodec;
  turnDetection: TurnDetection;
  tools?: RealtimeTool[];
  /** ISO-639-1 hint for caller transcription; omit to auto-detect. */
  transcriptionLanguage?: string;
}): Record<string, unknown> {
  const transcriptionModel =
    (process.env.AZURE_OPENAI_TRANSCRIPTION_MODEL || '').trim() || DEFAULT_TRANSCRIPTION_MODEL;
  const transcription: Record<string, string> = { model: transcriptionModel };
  if (options.transcriptionLanguage) {
    transcription.language = options.transcriptionLanguage;
  }

  const session: Record<string, unknown> = {
    type: 'realtime',
    instructions: options.instructions,
    output_modalities: ['audio'],
    audio: {
      input: {
        format: audioFormat(options.codec),
        transcription,
        turn_detection: {
          type: 'server_vad',
          threshold: options.turnDetection.threshold,
          silence_duration_ms: options.turnDetection.silenceDurationMs,
          prefix_padding_ms: options.turnDetection.prefixPaddingMs,
          create_response: true,
        },
      },
      output: {
        format: audioFormat(options.codec),
        voice: options.voice || 'alloy',
      },
    },
  };

  if (options.tools?.length) {
    session.tools = options.tools;
    session.tool_choice = 'auto';
  }

  return { type: 'session.update', session };
}

/** Ask the model to speak one response with turn-specific instructions. */
export function buildResponseCreate(instructions: string): Record<string, unknown> {
  return { type: 'response.create', response: { instructions } };
}

export type RealtimeEventKind =
  | 'response_created'
  | 'assistant_audio'
  | 'assistant_text'
  | 'caller_transcript'
  | 'caller_speech_started'
  | 'function_call'
  | 'response_done'
  | 'error'
  | 'other';

const EVENT_KINDS: Record<string, RealtimeEventKind> = {
  // GA names
  'response.output_audio.delta': 'assistant_audio',
  'response.output_audio_transcript.delta': 'assistant_text',
  'response.output_text.delta': 'assistant_text',
  'conversation.item.audio_transcription.completed': 'caller_transcript',
  // Names shared by both protocols
  'conversation.item.input_audio_transcription.completed': 'caller_transcript',
  'input_audio_buffer.speech_started': 'caller_speech_started',
  'response.function_call_arguments.done': 'function_call',
  'response.created': 'response_created',
  'response.done': 'response_done',
  error: 'error',
  // Preview names, still accepted
  'response.audio.delta': 'assistant_audio',
  'response.audio_transcript.delta': 'assistant_text',
  'response.text.delta': 'assistant_text',
};

/** Map a realtime server event type to what the bridges care about. */
export function classifyRealtimeEvent(type: unknown): RealtimeEventKind {
  return (typeof type === 'string' && EVENT_KINDS[type]) || 'other';
}

/**
 * Runs the model's function calls and asks it to continue afterwards.
 *
 * Each result goes back as a `function_call_output` item as soon as it is
 * ready, but the follow-up `response.create` waits until the model's current
 * response has finished AND every call from it has returned — sending it
 * while a response is still active is rejected by the service, and one
 * response can contain several calls.
 */
export class RealtimeToolRunner {
  private pending = 0;
  private responseActive = false;
  private needsFollowUp = false;

  constructor(
    private readonly send: (event: Record<string, unknown>) => void,
    private readonly execute: (name: string, args: Record<string, any>) => Promise<unknown>,
    private readonly onError: (name: string, error: unknown) => void = () => undefined,
  ) {}

  onResponseCreated(): void {
    this.responseActive = true;
  }

  onResponseDone(): void {
    this.responseActive = false;
    this.maybeContinue();
  }

  /** Handle a `response.function_call_arguments.done` event. */
  async onFunctionCall(event: { name?: string; call_id?: string; arguments?: string }): Promise<void> {
    const name = String(event.name || '');
    let args: Record<string, any> = {};
    try {
      args = JSON.parse(event.arguments || '{}');
    } catch {
      args = {};
    }

    this.pending += 1;
    this.needsFollowUp = true;
    let output: unknown;
    try {
      output = await this.execute(name, args);
    } catch (error) {
      this.onError(name, error);
      output = { ok: false, error: 'The tool failed; apologise and offer another option.' };
    }

    this.send({
      type: 'conversation.item.create',
      item: { type: 'function_call_output', call_id: event.call_id, output: JSON.stringify(output ?? {}) },
    });
    this.pending -= 1;
    this.maybeContinue();
  }

  private maybeContinue(): void {
    if (this.responseActive || this.pending > 0 || !this.needsFollowUp) return;
    this.needsFollowUp = false;
    this.responseActive = true;
    this.send({ type: 'response.create' });
  }
}
