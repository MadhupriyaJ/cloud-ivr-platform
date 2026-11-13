import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIST = pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')).href;
const lang = await import(`${DIST}/modules/realtime/language-policy.js`);
const { EscalationDetectorService } = await import(`${DIST}/modules/escalations/escalation-detector.service.js`);
const { buildSessionUpdate } = await import(`${DIST}/modules/realtime/azure-realtime.js`);

// Parsing and transcription hints
assert.deepEqual(lang.parseLanguages('English, Tamil ,English,'), ['English', 'Tamil']);
assert.deepEqual(lang.parseLanguages(null), []);
assert.equal(lang.transcriptionLanguageHint(['Tamil']), 'ta');
assert.equal(lang.transcriptionLanguageHint(['English', 'Tamil']), undefined, 'multi-language must auto-detect');
assert.equal(lang.transcriptionLanguageHint([]), undefined);
console.log('OK language parsing and transcription hint');

// Instructions
const both = lang.buildLanguageInstructions('English', ['English', 'Tamil']);
assert.match(both, /English, Tamil/);
assert.match(both, /reply in the language the caller is using/i);
assert.match(both, /Tamil with English words/);
assert.match(both, /பேச்சுத் தமிழ்/);
const any = lang.buildLanguageInstructions('English', []);
assert.match(any, /any language/);
const hindiOnly = lang.buildLanguageInstructions('Hindi', ['Hindi']);
assert.doesNotMatch(hindiOnly, /பேச்சுத் தமிழ்/, 'Tamil register hint only when Tamil is in scope');
console.log('OK language instructions');

// Greeting
const g2 = lang.buildGreetingInstruction('Welcome to City Hospital.', 'English', ['English', 'Tamil']);
assert.match(g2, /in English/);
assert.match(g2, /Tamil/);
assert.match(g2, /Welcome to City Hospital\./);
const g1 = lang.buildGreetingInstruction('Welcome.', 'English', ['English']);
assert.doesNotMatch(g1, /also speak/);
const g0 = lang.buildGreetingInstruction('Welcome.', 'English', []);
assert.match(g0, /whichever language/);
console.log('OK greeting instruction');

// Session update carries the hint only when given
const turn = { threshold: 0.5, silenceDurationMs: 300, prefixPaddingMs: 200 };
const withHint = buildSessionUpdate({ codec: 'pcm16', instructions: 'x', turnDetection: turn, transcriptionLanguage: 'ta' });
assert.equal(withHint.session.audio.input.transcription.language, 'ta');
const noHint = buildSessionUpdate({ codec: 'pcm16', instructions: 'x', turnDetection: turn });
assert.ok(!('language' in noHint.session.audio.input.transcription));
console.log('OK transcription language in session.update');

// Escalation detection across languages
const detector = new EscalationDetectorService();
const calm = { fallbackStreak: 0, turnCount: 1 };
const urgent = [
  'எனக்கு நெஞ்சு வலி இருக்கு',
  'அப்பாவுக்கு மூச்சு விட முடியல',
  'ரத்தம் நிக்கல',
  'enakku nenju vali ah irukku',
  'mere seene me dard hai',
  'मुझे सीने में दर्द है',
  'I have chest pain',
];
for (const text of urgent) {
  const r = detector.evaluate(text, calm);
  assert.equal(r.priority, 'urgent', `should be urgent: ${text}`);
  assert.equal(r.skillGroup, 'emergency');
}
const human = [
  'ஏஜென்ட் கிட்ட பேசணும்',
  'oru aal kitta pesanum',
  'agent kitta pesanum please',
  'मुझे एजेंट से बात करनी है',
  'can I talk to a human',
];
for (const text of human) {
  assert.equal(detector.evaluate(text, calm).matchedRule, 'human_request', `should ask for human: ${text}`);
}
const routine = [
  'ரத்த பரிசோதனை report வந்துடுச்சா',
  'blood test report ready ah',
  'naalaiku cardiology appointment venum',
  'நாளைக்கு டாக்டர் appointment வேணும்',
  'bill evlo aachu',
];
for (const text of routine) {
  assert.equal(detector.evaluate(text, calm).shouldEscalate, false, `should not escalate: ${text}`);
}
assert.equal(detector.isFallbackReply('மன்னிக்கவும், எனக்கு புரியல', 'Sorry, I can only help with appointments.'), true);
assert.equal(detector.isFallbackReply('உங்க appointment confirm ஆயிடுச்சு', 'Sorry, I can only help with appointments.'), false);
console.log('OK multilingual escalation detection (no false positives on routine requests)');

console.log('All multilingual checks passed.');
