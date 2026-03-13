import { registerAs } from '@nestjs/config';

export const azureConfig = registerAs('azure', () => ({
  openAiEndpoint: process.env.AZURE_OPENAI_ENDPOINT ?? '',
  openAiApiKey: process.env.AZURE_OPENAI_API_KEY ?? '',
  openAiDeployment: process.env.AZURE_OPENAI_DEPLOYMENT ?? '',
  openAiApiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2025-01-01-preview',
  speechRegion: process.env.AZURE_SPEECH_REGION ?? '',
  speechApiKey: process.env.AZURE_SPEECH_API_KEY ?? '',
  communicationConnectionString: process.env.AZURE_COMMUNICATION_CONNECTION_STRING ?? '',
}));
