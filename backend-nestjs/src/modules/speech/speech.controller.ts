import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('speech')
export class SpeechController {
  constructor(private readonly configService: ConfigService) {}

  @Get('token')
  async issueToken() {
    const region = this.configService.get<string>('azure.speechRegion') || process.env.AZURE_SPEECH_REGION;
    const apiKey =
      this.configService.get<string>('azure.speechApiKey') ||
      process.env.AZURE_SPEECH_API_KEY ||
      process.env.AZURE_SPEECH_API;

    if (!region || !apiKey) {
      throw new HttpException('Azure Speech configuration missing.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const response = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': '0',
      },
    });

    if (!response.ok) {
      throw new HttpException(
        `Azure Speech token request failed with status ${response.status}.`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const token = await response.text();
    return {
      token,
      region,
    };
  }

  @Get('avatar-relay-token')
  async issueAvatarRelayToken() {
    const region =
      this.configService.get<string>('azure.avatarRegion') ||
      this.configService.get<string>('azure.speechRegion') ||
      process.env.AZURE_AVATAR_REGION ||
      process.env.AZURE_SPEECH_REGION;
    const apiKey =
      this.configService.get<string>('azure.avatarApiKey') ||
      this.configService.get<string>('azure.speechApiKey') ||
      process.env.AZURE_AVATAR_API_KEY ||
      process.env.AZURE_SPEECH_API_KEY ||
      process.env.AZURE_SPEECH_API;

    if (!region || !apiKey) {
      throw new HttpException(
        'Azure Avatar Speech configuration missing.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const response = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1`,
      {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
        },
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new HttpException(
        `Azure avatar relay token request failed with status ${response.status}.${detail ? ` ${detail}` : ''}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    return response.json();
  }
}
