/**
 * Minimal client for the Azure OpenAI Responses API (GA v1 path), used for
 * text tasks that need a chat model — e.g. web search. The realtime voice
 * deployment cannot serve these, so a separate chat deployment is required:
 *
 *   AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-5-mini   (or gpt-4.1-mini, …)
 *
 * It uses the same resource and key as the realtime deployment
 * (AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY) unless
 * AZURE_OPENAI_CHAT_ENDPOINT / AZURE_OPENAI_CHAT_API_KEY point elsewhere.
 */

export class AzureResponsesError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export function chatDeployment(): string {
  return (
    process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ||
    process.env.AZURE_OPENAI_ORCHESTRATION_DEPLOYMENT ||
    ''
  ).trim();
}

export type ResponsesResult = {
  text: string;
  citations: { url: string; title?: string }[];
  sources: string[];
  searches: number;
  raw: any;
};

export async function createResponse(body: Record<string, unknown>, timeoutMs = 180_000): Promise<ResponsesResult> {
  // The chat model may live in another resource (web search is not offered in
  // every region), so it can have its own endpoint and key.
  const endpoint = (process.env.AZURE_OPENAI_CHAT_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT || '').trim();
  const apiKey = (process.env.AZURE_OPENAI_CHAT_API_KEY || process.env.AZURE_OPENAI_API_KEY || '').trim();
  const model = (body.model as string) || chatDeployment();

  if (!endpoint || !apiKey) {
    throw new AzureResponsesError('AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY are not set.', 503);
  }
  if (!model) {
    throw new AzureResponsesError(
      'No chat model deployment configured. Deploy a chat model (e.g. gpt-5-mini) in Azure AI Foundry ' +
        'and set AZURE_OPENAI_CHAT_DEPLOYMENT to its deployment name.',
      503,
    );
  }

  const host = new URL(endpoint).host;
  let response: Response;
  try {
    response = await fetch(`https://${host}/openai/v1/responses`, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, model }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new AzureResponsesError(`Azure OpenAI request failed: ${String(error)}`, 502);
  }

  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `HTTP ${response.status}`;
    throw new AzureResponsesError(`Azure OpenAI: ${message}`, response.status === 404 ? 503 : 502);
  }

  const output: any[] = Array.isArray(payload.output) ? payload.output : [];
  const parts = output
    .filter((item) => item?.type === 'message')
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .filter((part) => part?.type === 'output_text');

  const citations = parts
    .flatMap((part) => (Array.isArray(part.annotations) ? part.annotations : []))
    .filter((annotation) => annotation?.type === 'url_citation' && annotation.url)
    .map((annotation) => ({ url: String(annotation.url), title: annotation.title ? String(annotation.title) : undefined }));

  const searchCalls = output.filter((item) => item?.type === 'web_search_call');
  const sources = searchCalls
    .flatMap((item) => (Array.isArray(item?.action?.sources) ? item.action.sources : []))
    .map((source: any) => String(source?.url || ''))
    .filter(Boolean);

  return {
    text: parts.map((part) => String(part.text || '')).join('\n').trim(),
    citations,
    sources: [...new Set(sources)],
    searches: Number(payload?.tool_usage?.web_search?.num_requests ?? searchCalls.length) || 0,
    raw: payload,
  };
}

/** Pull the first JSON object out of model text (tolerates ```json fences and prose). */
export function extractJsonObject(text: string): any | null {
  const cleaned = text.replace(/```(?:json)?/gi, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}
