import { Injectable, Logger } from '@nestjs/common';

export type SmsResult =
  | { status: 'sent'; sid: string; to: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string };

/**
 * Outbound SMS through Twilio's REST API.
 *
 * Never throws: an SMS is a courtesy after a booking, so a missing Twilio
 * setup or a send failure is reported back to the caller of `send` (and on to
 * the voice assistant) instead of failing the booking.
 *
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_SMS_FROM (falls back
 * to TWILIO_CALLER_ID). Numbers without a country code get
 * SMS_DEFAULT_COUNTRY_CODE (default +91).
 *
 * India note: SMS to Indian numbers needs DLT registration of the sender and
 * template with the operators; on a Twilio trial only verified numbers work.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  private get config() {
    return {
      accountSid: (process.env.TWILIO_ACCOUNT_SID || '').trim(),
      authToken: (process.env.TWILIO_AUTH_TOKEN || '').trim(),
      from: (process.env.TWILIO_SMS_FROM || process.env.TWILIO_CALLER_ID || '').trim(),
      countryCode: (process.env.SMS_DEFAULT_COUNTRY_CODE || '+91').trim(),
    };
  }

  get isConfigured(): boolean {
    const { accountSid, authToken, from } = this.config;
    return Boolean(accountSid && authToken && from);
  }

  /** E.164 form of a stored phone number, or null if it cannot be one. */
  toE164(raw: string): string | null {
    const digits = String(raw || '').replace(/[^\d+]/g, '');
    if (!digits) return null;
    if (digits.startsWith('+')) return /^\+\d{8,15}$/.test(digits) ? digits : null;
    const plain = digits.replace(/^0+/, '');
    if (plain.length === 10) return `${this.config.countryCode}${plain}`;
    if (plain.length >= 11 && plain.length <= 15) return `+${plain}`;
    return null;
  }

  async send(toRaw: string, body: string): Promise<SmsResult> {
    const { accountSid, authToken, from } = this.config;
    if (!this.isConfigured) {
      return { status: 'skipped', reason: 'SMS is not configured (Twilio account, token or sender number missing).' };
    }
    const to = this.toE164(toRaw);
    if (!to) {
      return { status: 'skipped', reason: `"${toRaw}" is not a valid mobile number.` };
    }

    try {
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: from, Body: body.slice(0, 600) }),
      });
      const payload: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = `Twilio ${response.status}: ${payload?.message || 'send failed'}`;
        this.logger.warn(`SMS to ${to} failed — ${error}`);
        return { status: 'failed', error };
      }
      this.logger.log(`SMS ${payload.sid} sent to ${to}`);
      return { status: 'sent', sid: String(payload.sid), to };
    } catch (error) {
      this.logger.warn(`SMS to ${to} failed — ${String(error)}`);
      return { status: 'failed', error: String(error) };
    }
  }
}
