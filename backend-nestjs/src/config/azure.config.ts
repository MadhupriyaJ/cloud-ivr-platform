import { registerAs } from '@nestjs/config';

export const azureConfig = registerAs('azure', () => ({
  openAiEndpoint: process.env.AZURE_OPENAI_ENDPOINT ?? '',
  openAiApiKey: process.env.AZURE_OPENAI_API_KEY ?? '',
  openAiDeployment: process.env.AZURE_OPENAI_DEPLOYMENT ?? '',
  openAiApiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2025-01-01-preview',
  speechRegion: process.env.AZURE_SPEECH_REGION ?? '',
  speechApiKey: process.env.AZURE_SPEECH_API_KEY ?? process.env.AZURE_SPEECH_API ?? '',
  speechEndpoint: process.env.AZURE_SPEECH_ENDPOINT ?? '',
  avatarRegion: process.env.AZURE_AVATAR_REGION ?? process.env.AZURE_SPEECH_REGION ?? '',
  avatarApiKey:
    process.env.AZURE_AVATAR_API_KEY ??
    process.env.AZURE_SPEECH_API_KEY ??
    process.env.AZURE_SPEECH_API ??
    '',
  communicationConnectionString: process.env.AZURE_COMMUNICATION_CONNECTION_STRING ?? '',
}));
