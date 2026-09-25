import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { TelephonyService } from './telephony.service';
import { TwilioService } from './twilio.service';
import { CreatePhoneNumberDto, UpdatePhoneNumberDto } from './dto/phone-number.dto';
import { EscalationsService } from '../escalations/escalations.service';
import { connectStreamTwiml, dialTwiml, sayHangupTwiml } from './twiml';

/** Twilio posts form-encoded webhooks; these are the fields we rely on. */
type TwilioVoiceWebhook = {
  CallSid?: string;
  From?: string;
  To?: string;
  Direction?: string;
  CallStatus?: string;
  CallDuration?: string;
  DialCallStatus?: string;
  [key: string]: unknown;
};

@Controller('telephony')
export class TelephonyController {
  private readonly logger = new Logger(TelephonyController.name);

  constructor(
    private readonly telephony: TelephonyService,
    private readonly twilio: TwilioService,
    private readonly escalations: EscalationsService,
  ) {}

  /* ─────────────── Inbound voice webhooks ─────────────── */

  /**
   * Twilio Voice webhook for an inbound call.
   *
   * Point the phone number's "A CALL COMES IN" webhook at:
   *   POST https://<PUBLIC_BASE_URL>/api/telephony/voice/incoming
   *
   * Answers with TwiML that opens a bidirectional media stream to
   * `wss://<host>/telephony/media`, where the realtime model runs the call.
   */
  @Post('voice/incoming')
  @Header('Content-Type', 'text/xml')
  async incomingCall(@Req() request: Request, @Body() body: TwilioVoiceWebhook): Promise<string> {
    this.assertTwilioSignature(request, body);

    const base = this.resolveBaseUrl(request);
    this.telephony.rememberBaseUrl(base);

    const callSid = String(body.CallSid || '');
    const from = String(body.From || '');
    const to = String(body.To || '');

    const routing = await this.telephony.resolveInboundNumber(to);
    this.logger.log(`Inbound call ${callSid} ${from} → ${to} routed to domain "${routing.domainCode}"`);

    if (callSid) {
      await this.telephony
        .startCall({ callSid, from, to, domainId: routing.domainId, direction: String(body.Direction || 'inbound') })
        .catch((error) => this.logger.warn(`Could not log call session: ${String(error)}`));
    }

    const streamUrl = `${base.replace(/^http/, 'ws')}/telephony/media`;

    // Custom parameters arrive in the stream's `start` event, so the websocket
    // knows which domain to load and who is calling without another lookup.
    return connectStreamTwiml({
      streamUrl,
      greeting: routing.greeting,
      parameters: {
        domainCode: routing.domainCode,
        callSid,
        from,
        to,
        skillGroup: routing.escalationSkillGroup || '',
      },
    });
  }

  /** Call progress events (`completed`, `no-answer`, …) for the call log. */
  @Post('voice/status')
  @Header('Content-Type', 'text/xml')
  async callStatus(@Req() request: Request, @Body() body: TwilioVoiceWebhook): Promise<string> {
    this.assertTwilioSignature(request, body);

    const callSid = String(body.CallSid || '');
    if (callSid) {
      await this.telephony.updateCallStatus({
        callSid,
        status: String(body.CallStatus || 'unknown'),
        durationSeconds: body.CallDuration ? Number(body.CallDuration) : undefined,
      });

      // A caller who hangs up while waiting should not hold an agent slot.
      const call = await this.telephony.getCallBySid(callSid);
      if (call?.conversationId && ['completed', 'canceled', 'failed'].includes(String(body.CallStatus))) {
        const open = await this.escalations.findOpenByConversation(call.conversationId);
        if (open && open.status !== 'accepted') {
          await this.escalations
            .close(open.escalationId, { outcome: 'abandoned', resolutionNotes: 'Caller hung up' })
            .catch(() => undefined);
        }
      }
    }

    return '<?xml version="1.0" encoding="UTF-8"?><Response/>';
  }

  /**
   * TwiML served when a live call is transferred to a human. Twilio fetches
   * this after `TelephonyService.transferCallForEscalation` redirects the call.
   */
  @Post('voice/transfer/:escalationId')
  @Header('Content-Type', 'text/xml')
  async transfer(
    @Req() request: Request,
    @Param('escalationId') escalationId: string,
    @Body() body: TwilioVoiceWebhook = {},
  ): Promise<string> {
    this.assertTwilioSignature(request, body);

    const escalation = await this.escalations.getById(escalationId).catch(() => null);
    if (!escalation) {
      return sayHangupTwiml('Sorry, we could not complete your transfer. Please call again.');
    }

    const target = await this.telephony.resolveTransferTarget(escalation);
    if (!target) {
      this.logger.error(`Escalation ${escalationId} has no reachable transfer target.`);
      await this.escalations
        .markFailed(escalationId, 'No agent phone number configured for transfer')
        .catch(() => undefined);
      return sayHangupTwiml(
        'All of our agents are currently unavailable. We have logged your request and will call you back shortly.',
      );
    }

    await this.escalations.recordTransfer(escalationId, target).catch(() => undefined);

    const base = this.resolveBaseUrl(request);
    return dialTwiml({
      target,
      callerId: this.twilio.callerId || undefined,
      announcement: 'Connecting you to an agent now. Please hold.',
      timeoutSeconds: 30,
      actionUrl: `${base}/api/telephony/voice/transfer-result/${escalationId}`,
    });
  }

  /** Same TwiML over GET, since a Twilio redirect may be configured either way. */
  @Get('voice/transfer/:escalationId')
  @Header('Content-Type', 'text/xml')
  async transferViaGet(
    @Req() request: Request,
    @Param('escalationId') escalationId: string,
  ): Promise<string> {
    // A GET carries no form body, so the signature covers the URL alone.
    return this.transfer(request, escalationId, {});
  }

  /** Result of the `<Dial>`: closes the escalation or requeues a missed call. */
  @Post('voice/transfer-result/:escalationId')
  @Header('Content-Type', 'text/xml')
  async transferResult(
    @Req() request: Request,
    @Param('escalationId') escalationId: string,
    @Body() body: TwilioVoiceWebhook,
  ): Promise<string> {
    // This endpoint closes or requeues an escalation, so it must be Twilio.
    this.assertTwilioSignature(request, body);

    const dialStatus = String(body.DialCallStatus || '');
    this.logger.log(`Transfer result for ${escalationId}: ${dialStatus}`);

    if (dialStatus === 'completed' || dialStatus === 'answered') {
      await this.escalations
        .close(escalationId, { outcome: 'resolved', resolutionNotes: 'Handled by agent on live call' })
        .catch(() => undefined);
      return '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>';
    }

    // No answer / busy / failed: put it back on the queue for someone else.
    await this.escalations
      .requeue(escalationId, `agent did not answer (${dialStatus || 'unknown'})`)
      .catch(() => undefined);

    return sayHangupTwiml(
      'Our agent is not available right now. Your request has been queued and we will call you back.',
    );
  }

  /* ─────────────── Administration API ─────────────── */

  @Get('numbers')
  async listNumbers() {
    return { items: await this.telephony.listNumbers() };
  }

  @Post('numbers')
  async createNumber(@Body() payload: CreatePhoneNumberDto) {
    return this.telephony.createNumber(payload);
  }

  @Patch('numbers/:phoneNumberId')
  async updateNumber(
    @Param('phoneNumberId') phoneNumberId: string,
    @Body() payload: UpdatePhoneNumberDto,
  ) {
    return this.telephony.updateNumber(phoneNumberId, payload);
  }

  @Delete('numbers/:phoneNumberId')
  async deleteNumber(@Param('phoneNumberId') phoneNumberId: string) {
    await this.telephony.deleteNumber(phoneNumberId);
    return { deleted: true };
  }

  @Get('calls')
  async listCalls(@Query('limit') limit?: string) {
    return { items: await this.telephony.listCalls(limit ? Number(limit) : 100) };
  }

  /**
   * Everything the operator needs to wire a number up at the provider, plus a
   * readiness check so misconfiguration is visible before the first real call.
   */
  @Get('config')
  async config(@Req() request: Request) {
    const base = this.resolveBaseUrl(request);
    return {
      provider: 'twilio',
      configured: this.twilio.isConfigured,
      signatureValidation: this.twilio.signatureValidationEnabled,
      publicBaseUrl: base,
      callerId: this.twilio.callerId || null,
      fallbackAgentNumber: (process.env.TELEPHONY_FALLBACK_AGENT_NUMBER || '').trim() || null,
      defaultDomain: (process.env.TELEPHONY_DEFAULT_DOMAIN || 'hospital').trim(),
      webhooks: {
        incomingCall: `${base}/api/telephony/voice/incoming`,
        statusCallback: `${base}/api/telephony/voice/status`,
        mediaStream: `${base.replace(/^http/, 'ws')}/telephony/media`,
      },
      missing: [
        this.twilio.accountSid ? null : 'TWILIO_ACCOUNT_SID',
        this.twilio.authToken ? null : 'TWILIO_AUTH_TOKEN',
        process.env.PUBLIC_BASE_URL ? null : 'PUBLIC_BASE_URL',
        process.env.AZURE_OPENAI_API_KEY ? null : 'AZURE_OPENAI_API_KEY',
        process.env.AZURE_OPENAI_ENDPOINT ? null : 'AZURE_OPENAI_ENDPOINT',
        process.env.AZURE_OPENAI_DEPLOYMENT ? null : 'AZURE_OPENAI_DEPLOYMENT',
      ].filter(Boolean),
    };
  }

  /* ─────────────── Helpers ─────────────── */

  private resolveBaseUrl(request: Request): string {
    const forwardedProto = (request.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0];
    const protocol = forwardedProto || request.protocol || 'https';
    const host = (request.headers['x-forwarded-host'] as string | undefined) || request.get('host') || '';
    return this.twilio.publicBaseUrl(host, protocol);
  }

  /**
   * Twilio signs each webhook against the exact URL it called. Rejecting
   * unsigned requests stops anyone who guesses the URL from driving calls
   * (or racking up transfer charges) through this backend.
   */
  private assertTwilioSignature(request: Request, body: Record<string, unknown>): void {
    if (!this.twilio.signatureValidationEnabled) {
      return;
    }

    const base = this.resolveBaseUrl(request);
    const url = `${base}${request.originalUrl}`;
    const valid = this.twilio.validateSignature({
      signature: request.headers['x-twilio-signature'] as string | undefined,
      url,
      params: body ?? {},
    });

    if (!valid) {
      this.logger.warn(`Rejected webhook with invalid Twilio signature: ${url}`);
      throw new ForbiddenException('Invalid Twilio signature');
    }
  }
}
