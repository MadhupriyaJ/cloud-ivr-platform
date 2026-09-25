import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Tests run against the compiled output; run `npm run build` first.
const DIST = pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')).href;

const twiml = await import(`${DIST}/modules/telephony/twiml.js`);
const { TwilioService } = await import(`${DIST}/modules/telephony/twilio.service.js`);
const { normalizeNumber } = await import(`${DIST}/modules/telephony/telephony.service.js`);
const { EscalationDetectorService } = await import(
  `${DIST}/modules/escalations/escalation-detector.service.js`
);

/* 1. TwiML for an inbound call */
const connect = twiml.connectStreamTwiml({
  streamUrl: 'wss://example.test/telephony/media',
  greeting: 'Welcome to Ram & Co "Hospital"',
  parameters: { domainCode: 'hospital', callSid: 'CA123' },
});
assert.match(connect, /<Connect>/);
assert.match(connect, /<Stream url="wss:\/\/example\.test\/telephony\/media">/);
assert.match(connect, /<Parameter name="domainCode" value="hospital" \/>/);
assert.match(connect, /Ram &amp; Co &quot;Hospital&quot;/, 'greeting must be XML-escaped');
console.log('OK connect/stream TwiML');

/* 2. Transfer TwiML, PSTN and SIP */
const dial = twiml.dialTwiml({
  target: '+14155550123',
  callerId: '+14155550100',
  announcement: 'Hold please',
  actionUrl: 'https://x.test/a',
});
assert.match(dial, /<Number>\+14155550123<\/Number>/);
assert.match(dial, /callerId="\+14155550100"/);
assert.match(dial, /action="https:\/\/x\.test\/a" method="POST"/);
assert.match(twiml.dialTwiml({ target: 'sip:agent@pbx.test' }), /<Sip>sip:agent@pbx\.test<\/Sip>/);
console.log('OK dial TwiML (PSTN + SIP)');

/* 3. Twilio signature validation */
process.env.TWILIO_AUTH_TOKEN = 'test_token_123';
process.env.VALIDATE_TWILIO_SIGNATURE = 'true';
const svc = new TwilioService();
const url = 'https://ivr.test/api/telephony/voice/incoming';
const params = { CallSid: 'CA1', From: '+15550001111', To: '+15550002222' };
const expected = createHmac('sha1', 'test_token_123')
  .update(Buffer.from(url + 'CallSidCA1From+15550001111To+15550002222', 'utf8'))
  .digest('base64');
assert.equal(svc.validateSignature({ signature: expected, url, params }), true, 'valid signature passes');
assert.equal(svc.validateSignature({ signature: 'AAAA', url, params }), false, 'bad signature fails');
assert.equal(svc.validateSignature({ signature: undefined, url, params }), false, 'missing signature fails');
assert.equal(
  svc.validateSignature({ signature: expected, url, params: { ...params, To: '+19999999999' } }),
  false,
  'tampered body fails',
);
process.env.VALIDATE_TWILIO_SIGNATURE = 'false';
assert.equal(new TwilioService().validateSignature({ url, params }), true, 'can be disabled explicitly');
process.env.VALIDATE_TWILIO_SIGNATURE = 'true';
console.log('OK Twilio webhook signature validation');

/* 4. Number normalisation */
assert.equal(normalizeNumber(' +1 (415) 555-0123 '), '+14155550123');
assert.equal(normalizeNumber('04442223333'), '04442223333');
assert.equal(normalizeNumber(null), '');
console.log('OK phone number normalisation');

/* 5. Escalation detection */
const detector = new EscalationDetectorService();
const quiet = { fallbackStreak: 0, turnCount: 1 };
assert.equal(detector.evaluate('I want to book an appointment', quiet).shouldEscalate, false);

const human = detector.evaluate('can I talk to a human please', quiet);
assert.equal(human.shouldEscalate, true);
assert.equal(human.priority, 'high');

const emergency = detector.evaluate('my father has chest pain', quiet);
assert.equal(emergency.priority, 'urgent');
assert.equal(emergency.skillGroup, 'emergency');

const fraud = detector.evaluate('there is an unauthorized transaction on my card', quiet);
assert.equal(fraud.skillGroup, 'fraud');

assert.equal(detector.evaluate('this is useless, you are not helping', quiet).shouldEscalate, true);
assert.equal(detector.evaluate('', { fallbackStreak: 3, turnCount: 5 }).matchedRule, 'fallback_streak');
assert.equal(detector.evaluate('', { fallbackStreak: 0, turnCount: 30 }).matchedRule, 'max_turns');
assert.equal(
  detector.isFallbackReply(
    'Sorry, I can only help with appointments.',
    'Sorry, I can only help with appointments.',
  ),
  true,
);
assert.equal(detector.isFallbackReply('Your appointment is confirmed for Monday.'), false);
console.log('OK escalation trigger detection');

console.log('\nAll telephony + escalation logic checks passed.');
