/**
 * Minimal TwiML builders.
 *
 * The Twilio helper SDK is deliberately not a dependency: the platform only
 * needs four verbs and an HMAC check, and keeping the surface small avoids
 * pulling a large SDK into the container image.
 */

/** Escape text destined for an XML text node or attribute value. */
export function escapeXml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function document(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${body}\n</Response>`;
}

/**
 * Answer the call and open a bidirectional media stream to our websocket.
 * `<Connect>` blocks until the stream ends, which is what keeps the caller on
 * the line while the realtime model talks to them.
 */
export function connectStreamTwiml(input: {
  streamUrl: string;
  greeting?: string;
  parameters?: Record<string, string>;
}): string {
  const parameters = Object.entries(input.parameters ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([name, value]) => `      <Parameter name="${escapeXml(name)}" value="${escapeXml(value)}" />`)
    .join('\n');

  const greeting = input.greeting
    ? `  <Say voice="alice">${escapeXml(input.greeting)}</Say>\n`
    : '';

  return document(
    `${greeting}  <Connect>\n    <Stream url="${escapeXml(input.streamUrl)}">\n${parameters}\n    </Stream>\n  </Connect>`,
  );
}

/** Warm transfer to a human. `callerId` must be a number owned at the provider. */
export function dialTwiml(input: {
  target: string;
  callerId?: string;
  announcement?: string;
  timeoutSeconds?: number;
  actionUrl?: string;
}): string {
  const announcement = input.announcement
    ? `  <Say voice="alice">${escapeXml(input.announcement)}</Say>\n`
    : '';
  const attributes = [
    `timeout="${input.timeoutSeconds ?? 30}"`,
    input.callerId ? `callerId="${escapeXml(input.callerId)}"` : '',
    input.actionUrl ? `action="${escapeXml(input.actionUrl)}" method="POST"` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const isSip = input.target.trim().toLowerCase().startsWith('sip:');
  const destination = isSip
    ? `    <Sip>${escapeXml(input.target)}</Sip>`
    : `    <Number>${escapeXml(input.target)}</Number>`;

  return document(`${announcement}  <Dial ${attributes}>\n${destination}\n  </Dial>`);
}

/** Park the caller in a hold queue when no human is reachable yet. */
export function holdTwiml(input: { message: string; waitUrl?: string; redirectUrl?: string }): string {
  const parts = [`  <Say voice="alice">${escapeXml(input.message)}</Say>`];
  if (input.waitUrl) {
    parts.push(`  <Play loop="0">${escapeXml(input.waitUrl)}</Play>`);
  } else {
    parts.push('  <Pause length="15" />');
  }
  if (input.redirectUrl) {
    parts.push(`  <Redirect method="POST">${escapeXml(input.redirectUrl)}</Redirect>`);
  }
  return document(parts.join('\n'));
}

export function sayHangupTwiml(message: string): string {
  return document(`  <Say voice="alice">${escapeXml(message)}</Say>\n  <Hangup />`);
}

export function rejectTwiml(reason: 'busy' | 'rejected' = 'rejected'): string {
  return document(`  <Reject reason="${reason}" />`);
}
