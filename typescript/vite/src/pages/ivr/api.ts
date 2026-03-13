import type {
  Agent,
  Conversation,
  ConversationMessage,
  DomainConfig,
  DomainIntent,
  DomainPayload,
  DomainRule,
  Escalation,
  PromptTemplate,
  ToolDefinition
} from './types';

function resolveApiBase(): string {
  const fromEnv = import.meta.env.VITE_BACKEND_HTTP_URL as string | undefined;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/$/, '');
  }
  return 'http://localhost:8010';
}

const API_BASE = resolveApiBase();

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    throw new Error(`${init?.method || 'GET'} ${path} failed (${response.status})`);
  }
  return (await response.json()) as T;
}

async function fetchItems<T>(path: string): Promise<T[]> {
  const payload = await fetchJson<{ items: T[] }>(path);
  return payload.items;
}

export async function fetchDomains(): Promise<DomainConfig[]> {
  return fetchItems<DomainConfig>('/api/domains');
}

export async function fetchDomain(domainId: string): Promise<DomainConfig> {
  return fetchJson<DomainConfig>(`/api/domains/${encodeURIComponent(domainId)}`);
}

export async function generateDomain(
  domainName: string,
  organizationName: string
): Promise<DomainConfig> {
  return fetchJson<DomainConfig>('/api/domains/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain_name: domainName,
      organization_name: organizationName || undefined
    })
  });
}

export async function saveDomain(domainId: string, payload: DomainPayload): Promise<DomainConfig> {
  return fetchJson<DomainConfig>(`/api/domains/${encodeURIComponent(domainId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function removeDomain(domainId: string): Promise<void> {
  await fetchJson(`/api/domains/${encodeURIComponent(domainId)}`, { method: 'DELETE' });
}

export async function fetchDomainIntents(domainUuid: string): Promise<DomainIntent[]> {
  return fetchItems<DomainIntent>(`/api/domains/${encodeURIComponent(domainUuid)}/intents`);
}

export async function createDomainIntent(
  domainUuid: string,
  payload: {
    intentCode: string;
    intentLabel: string;
    description?: string;
    priority?: number;
    isActive?: boolean;
  }
): Promise<DomainIntent> {
  return fetchJson<DomainIntent>(`/api/domains/${encodeURIComponent(domainUuid)}/intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchDomainRules(domainUuid: string): Promise<DomainRule[]> {
  return fetchItems<DomainRule>(`/api/domains/${encodeURIComponent(domainUuid)}/rules`);
}

export async function createDomainRule(
  domainUuid: string,
  payload: {
    ruleType: string;
    ruleText: string;
    priority?: number;
    isActive?: boolean;
  }
): Promise<DomainRule> {
  return fetchJson<DomainRule>(`/api/domains/${encodeURIComponent(domainUuid)}/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchConversations(): Promise<Conversation[]> {
  return fetchItems<Conversation>('/api/conversations');
}

export async function fetchConversationMessages(
  conversationId: string
): Promise<ConversationMessage[]> {
  return fetchItems<ConversationMessage>(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages`
  );
}

export async function fetchEscalations(): Promise<Escalation[]> {
  return fetchItems<Escalation>('/api/escalations');
}

export async function createEscalation(payload: {
  conversationId: string;
  escalationReason: string;
  assignedAgentId?: string;
}): Promise<Escalation> {
  return fetchJson<Escalation>('/api/escalations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchAgents(): Promise<Agent[]> {
  return fetchItems<Agent>('/api/agents');
}

export async function createAgent(payload: {
  name: string;
  email: string;
  skillGroup?: string;
  availabilityStatus?: string;
  isActive?: boolean;
}): Promise<Agent> {
  return fetchJson<Agent>('/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchPromptTemplates(domainUuid: string): Promise<PromptTemplate[]> {
  return fetchItems<PromptTemplate>(`/api/domains/${encodeURIComponent(domainUuid)}/prompts`);
}

export async function createPromptTemplate(
  domainUuid: string,
  payload: {
    promptType: string;
    templateText: string;
    versionNo?: number;
    isActive?: boolean;
  }
): Promise<PromptTemplate> {
  return fetchJson<PromptTemplate>(`/api/domains/${encodeURIComponent(domainUuid)}/prompts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchToolDefinitions(domainUuid: string): Promise<ToolDefinition[]> {
  return fetchItems<ToolDefinition>(`/api/domains/${encodeURIComponent(domainUuid)}/tools`);
}

export async function createToolDefinition(
  domainUuid: string,
  payload: {
    toolName: string;
    description: string;
    schemaJson: string;
    handlerName: string;
    isActive?: boolean;
  }
): Promise<ToolDefinition> {
  return fetchJson<ToolDefinition>(`/api/domains/${encodeURIComponent(domainUuid)}/tools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
