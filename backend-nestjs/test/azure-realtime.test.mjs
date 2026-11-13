import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIST = pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')).href;
const {
  buildAzureRealtimeConnection,
  buildSessionUpdate,
  buildResponseCreate,
  classifyRealtimeEvent,
} = await import(`${DIST}/modules/realtime/azure-realtime.js`);

const saved = { ...process.env };
function withEnv(env, fn) {
  Object.assign(process.env, env);
  try {
    return fn();
  } finally {
    for (const key of Object.keys(env)) {
      if (key in saved) process.env[key] = saved[key];
      else delete process.env[key];
    }
  }
}

// GA endpoint: /openai/v1/realtime?model=..., api-key header, no preview header or api-version.
withEnv(
  {
    AZURE_OPENAI_ENDPOINT: 'https://my-res.openai.azure.com/',
    AZURE_OPENAI_API_KEY: 'k',
    AZURE_OPENAI_DEPLOYMENT: 'gpt-realtime-mini',
    AZURE_OPENAI_API_VERSION: '2024-10-01-preview',
  },
  () => {
    const { url, headers } = buildAzureRealtimeConnection();
    assert.equal(url, 'wss://my-res.openai.azure.com/openai/v1/realtime?model=gpt-realtime-mini');
    assert.ok(!url.includes('api-version'));
    assert.deepEqual(headers, { 'api-key': 'k' });
  },
);
withEnv({ AZURE_OPENAI_ENDPOINT: '', AZURE_OPENAI_API_KEY: '', AZURE_OPENAI_DEPLOYMENT: '' }, () => {
  assert.throws(() => buildAzureRealtimeConnection(), /configuration missing/);
});
console.log('OK GA realtime URL and headers');

// GA session.update shape.
const phone = buildSessionUpdate({
  codec: 'g711_ulaw',
  voice: 'alloy',
  instructions: 'be brief',
  turnDetection: { threshold: 0.5, silenceDurationMs: 300, prefixPaddingMs: 200 },
  tools: [{ type: 'function', name: 'escalate_to_human', description: 'x', parameters: { type: 'object' } }],
}).session;
assert.equal(phone.type, 'realtime');
assert.deepEqual(phone.output_modalities, ['audio']);
assert.deepEqual(phone.audio.input.format, { type: 'audio/pcmu' });
assert.deepEqual(phone.audio.output.format, { type: 'audio/pcmu' });
assert.equal(phone.audio.output.voice, 'alloy');
assert.equal(phone.audio.input.turn_detection.type, 'server_vad');
assert.equal(phone.tool_choice, 'auto');
for (const legacy of ['modalities', 'temperature', 'input_audio_format', 'voice', 'turn_detection']) {
  assert.ok(!(legacy in phone), `preview-only field "${legacy}" must not be sent`);
}
const web = buildSessionUpdate({
  codec: 'pcm16',
  instructions: 'x',
  turnDetection: { threshold: 0.5, silenceDurationMs: 300, prefixPaddingMs: 200 },
}).session;
assert.deepEqual(web.audio.input.format, { type: 'audio/pcm', rate: 24000 });
assert.ok(!('tools' in web));
assert.deepEqual(buildResponseCreate('hi'), { type: 'response.create', response: { instructions: 'hi' } });
console.log('OK GA session.update shape');

// Both GA and preview event names are understood.
assert.equal(classifyRealtimeEvent('response.output_audio.delta'), 'assistant_audio');
assert.equal(classifyRealtimeEvent('response.audio.delta'), 'assistant_audio');
assert.equal(classifyRealtimeEvent('response.output_audio_transcript.delta'), 'assistant_text');
assert.equal(classifyRealtimeEvent('response.audio_transcript.delta'), 'assistant_text');
assert.equal(classifyRealtimeEvent('conversation.item.input_audio_transcription.completed'), 'caller_transcript');
assert.equal(classifyRealtimeEvent('response.function_call_arguments.done'), 'function_call');
assert.equal(classifyRealtimeEvent('session.created'), 'other');
assert.equal(classifyRealtimeEvent(undefined), 'other');
console.log('OK realtime event classification');

console.log('All Azure realtime protocol checks passed.');
