import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Twilio REST + webhook security, implemented directly against the HTTP API.
 *
 * Only two things are needed from Twilio at runtime: verifying that a webhook
 * really came from them, and redirecting a live call to new TwiML (which is how
 * an escalation transfers the caller to a human mid-conversation).
 */
@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);

  get accountSid(): string {
    return (process.env.TWILIO_ACCOUNT_SID || '').trim();
  }

  get authToken(): string {
    return (process.env.TWILIO_AUTH_TOKEN || '').trim();
  }

  get callerId(): string {
    return (process.env.TWILIO_CALLER_ID || '').trim();
  }

  get isConfigured(): boolean {
    return Boolean(this.accountSid && this.authToken);
  }

  /** Signature checking is on by default and can only be disabled explicitly. */
  get signatureValidationEnabled(): boolean {
    const raw = (process.env.VALIDATE_TWILIO_SIGNATURE || 'true').trim().toLowerCase();
    return !['false', 'no', '0'].includes(raw);
  }

  /**
   * Public base URL of this backend, used to build the callback URLs handed to
   * Twilio. Falls back to the host of the incoming request when unset.
   */
  publicBaseUrl(requestHost?: string, protocol = 'https'): string {
    const configured = (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
    if (configured) {
      return configured;
    }
    return requestHost ? `${protocol}://${requestHost}` : '';
  }

  /**
   * Validate the `X-Twilio-Signature` header.
   *
   * Twilio signs the full request URL with the POST body parameters appended in
   * alphabetical order (key immediately followed by value), HMAC-SHA1 with the
   * auth token, base64 encoded.
   * https://www.twilio.com/docs/usage/security#validating-requests
   */
  validateSignature(input: {
    signature?: string;
    url: string;
    params: Record<string, unknown>;
  }): boolean {
    if (!this.signatureValidationEnabled) {
      return true;
    }
    if (!this.authToken) {
      this.logger.warn('TWILIO_AUTH_TOKEN is not set; refusing to accept signed webhooks.');
      return false;
    }
    if (!input.signature) {
      return false;
    }

    const payload = Object.keys(input.params)
      .sort()
      .reduce((acc, key) => acc + key + String(input.params[key] ?? ''), input.url);

    const expected = createHmac('sha1', this.authToken).update(Buffer.from(payload, 'utf8')).digest();
    let provided: Buffer;
    try {
      provided = Buffer.from(input.signature, 'base64');
    } catch {
      return false;
    }

    return expected.length === provided.length && timingSafeEqual(expected, provided);
  }

  /**
   * Redirect an in-progress call to new TwiML. This is the mechanism behind a
   * live escalation: the caller is moved off the media stream and onto a
   * `<Dial>` that rings the human agent.
   */
  async redirectCall(callSid: string, twimlUrl: string): Promise<boolean> {
    if (!this.isConfigured) {
      this.logger.error('Cannot redirect call: TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing.');
      return false;
    }

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls/${encodeURIComponent(callSid)}.json`;
    const body = new URLSearchParams({ Url: twimlUrl, Method: 'POST' });

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      if (!response.ok) {
        this.logger.error(
          `Twilio redirect failed for ${callSid}: ${response.status} ${await response.text()}`,
        );
        return false;
      }
      this.logger.log(`Call ${callSid} redirected to ${twimlUrl}`);
      return true;
    } catch (error) {
      this.logger.error(`Twilio redirect error for ${callSid}: ${String(error)}`);
      return false;
    }
  }

  /** End a call from the server side. */
  async hangupCall(callSid: string): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls/${encodeURIComponent(callSid)}.json`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ Status: 'completed' }),
      });
      return response.ok;
    } catch (error) {
      this.logger.error(`Twilio hangup error for ${callSid}: ${String(error)}`);
      return false;
    }
  }
}
