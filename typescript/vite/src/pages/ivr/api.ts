import type {
  Agent,
  Conversation,
  ConversationMessage,
  DomainConfig,
  DomainIntent,
  DomainPayload,
  DomainRule,
  CallSession,
  Escalation,
  EscalationStats,
  HospitalAppointment,
  HospitalBilling,
  HospitalDepartment,
  HospitalDoctor,
  HospitalLabReport,
  HospitalPatient,
  HospitalSchedule,
  PhoneNumberMapping,
  PromptTemplate,
  TelephonyConfig,
  ToolDefinition
} from './types';
import { cachedFetch, invalidateCachePrefix } from './apiCache';

function resolveApiBase(): string {
  // In development, use the Vite proxy (relative paths) so the app works
  // both on localhost and when accessed through any exposed/proxied URL.
  // Only fall back to the explicit env var when running outside Vite dev server.
  if (import.meta.env.DEV) {
    return '';
  }
  const fromEnv = import.meta.env.VITE_BACKEND_HTTP_URL as string | undefined;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/$/, '');
  }
  return '';
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
  return cachedFetch('domains:list', () => fetchItems<DomainConfig>('/api/domains'), 60_000);
}

export async function fetchDomain(domainId: string): Promise<DomainConfig> {
  return cachedFetch(`domains:${domainId}`, () => fetchJson<DomainConfig>(`/api/domains/${encodeURIComponent(domainId)}`), 60_000);
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

export async function createDomain(payload: DomainPayload): Promise<DomainConfig> {
  return fetchJson<DomainConfig>('/api/domains', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
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
  invalidateCachePrefix('domains:');
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

export async function updateDomainIntent(
  domainUuid: string,
  intentId: string,
  payload: {
    intentCode?: string;
    intentLabel?: string;
    description?: string;
    priority?: number;
    isActive?: boolean;
  }
): Promise<DomainIntent> {
  return fetchJson<DomainIntent>(
    `/api/domains/${encodeURIComponent(domainUuid)}/intents/${encodeURIComponent(intentId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
  );
}

export async function deleteDomainIntent(domainUuid: string, intentId: string): Promise<void> {
  await fetchJson(
    `/api/domains/${encodeURIComponent(domainUuid)}/intents/${encodeURIComponent(intentId)}`,
    { method: 'DELETE' }
  );
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

export async function updateDomainRule(
  domainUuid: string,
  ruleId: string,
  payload: {
    ruleType?: string;
    ruleText?: string;
    priority?: number;
    isActive?: boolean;
  }
): Promise<DomainRule> {
  return fetchJson<DomainRule>(
    `/api/domains/${encodeURIComponent(domainUuid)}/rules/${encodeURIComponent(ruleId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
  );
}

export async function deleteDomainRule(domainUuid: string, ruleId: string): Promise<void> {
  await fetchJson(
    `/api/domains/${encodeURIComponent(domainUuid)}/rules/${encodeURIComponent(ruleId)}`,
    { method: 'DELETE' }
  );
}

export async function fetchConversations(): Promise<Conversation[]> {
  return cachedFetch('conversations:list', () => fetchItems<Conversation>('/api/conversations'), 15_000);
}

export async function fetchConversationMessages(
  conversationId: string
): Promise<ConversationMessage[]> {
  return fetchItems<ConversationMessage>(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages`
  );
}

/* ─── Escalations ─── */

export async function fetchEscalations(args?: {
  status?: 'open' | 'all' | Escalation['status'];
  agentId?: string;
  conversationId?: string;
  limit?: number;
}): Promise<Escalation[]> {
  const params = new URLSearchParams();
  if (args?.status) params.set('status', args.status);
  if (args?.agentId) params.set('agentId', args.agentId);
  if (args?.conversationId) params.set('conversationId', args.conversationId);
  if (args?.limit) params.set('limit', String(args.limit));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return fetchItems<Escalation>(`/api/escalations${suffix}`);
}

export async function fetchEscalationStats(): Promise<EscalationStats> {
  return fetchJson<EscalationStats>('/api/escalations/stats');
}

export async function createEscalation(payload: {
  conversationId: string;
  escalationReason: string;
  assignedAgentId?: string;
  priority?: Escalation['priority'];
  channel?: Escalation['channel'];
  skillGroup?: string;
  callerIdentifier?: string;
  contextSummary?: string;
}): Promise<Escalation> {
  return fetchJson<Escalation>('/api/escalations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function assignEscalation(escalationId: string, agentId: string): Promise<Escalation> {
  return fetchJson<Escalation>(`/api/escalations/${encodeURIComponent(escalationId)}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId })
  });
}

export async function acceptEscalation(escalationId: string, agentId?: string): Promise<Escalation> {
  return fetchJson<Escalation>(`/api/escalations/${encodeURIComponent(escalationId)}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agentId ? { agentId } : {})
  });
}

export async function closeEscalation(
  escalationId: string,
  payload?: { outcome?: 'resolved' | 'abandoned' | 'failed'; resolutionNotes?: string }
): Promise<Escalation> {
  return fetchJson<Escalation>(`/api/escalations/${encodeURIComponent(escalationId)}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {})
  });
}

export async function requeueEscalation(escalationId: string, reason?: string): Promise<Escalation> {
  return fetchJson<Escalation>(`/api/escalations/${encodeURIComponent(escalationId)}/requeue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reason ? { reason } : {})
  });
}

/** Websocket URL for the live escalation feed consumed by the agent console. */
export function agentDeskSocketUrl(): string {
  if (typeof window === 'undefined') return '';
  const configured = import.meta.env.DEV
    ? ''
    : ((import.meta.env.VITE_BACKEND_WS_URL as string | undefined) || '').trim();
  if (configured) {
    return `${configured.replace(/\/$/, '').replace(/^http/, 'ws')}/ws/agent-desk`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/ws/agent-desk`;
}

/* ─── Agents ─── */

export async function fetchAgents(): Promise<Agent[]> {
  return cachedFetch('agents:list', () => fetchItems<Agent>('/api/agents'), 15_000);
}

export async function fetchAvailableAgents(skillGroup?: string): Promise<Agent[]> {
  const suffix = skillGroup ? `?skillGroup=${encodeURIComponent(skillGroup)}` : '';
  return fetchItems<Agent>(`/api/agents/available${suffix}`);
}

export async function createAgent(payload: {
  name: string;
  email: string;
  skillGroup?: string;
  availabilityStatus?: string;
  phoneNumber?: string;
  maxConcurrent?: number;
  isActive?: boolean;
}): Promise<Agent> {
  const agent = await fetchJson<Agent>('/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  invalidateCachePrefix('agents:');
  return agent;
}

export async function updateAgent(
  agentId: string,
  payload: {
    name?: string;
    skillGroup?: string;
    availabilityStatus?: Agent['availabilityStatus'];
    phoneNumber?: string;
    maxConcurrent?: number;
    isActive?: boolean;
  }
): Promise<Agent> {
  const agent = await fetchJson<Agent>(`/api/agents/${encodeURIComponent(agentId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  invalidateCachePrefix('agents:');
  return agent;
}

export async function setAgentAvailability(
  agentId: string,
  availabilityStatus: Agent['availabilityStatus']
): Promise<Agent> {
  const agent = await fetchJson<Agent>(`/api/agents/${encodeURIComponent(agentId)}/availability`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ availabilityStatus })
  });
  invalidateCachePrefix('agents:');
  return agent;
}

/* ─── Telephony ─── */

export async function fetchTelephonyConfig(): Promise<TelephonyConfig> {
  return fetchJson<TelephonyConfig>('/api/telephony/config');
}

export async function fetchPhoneNumbers(): Promise<PhoneNumberMapping[]> {
  return fetchItems<PhoneNumberMapping>('/api/telephony/numbers');
}

export async function createPhoneNumber(payload: {
  phoneNumber: string;
  domainId: string;
  friendlyName?: string;
  escalationNumber?: string;
  escalationSkillGroup?: string;
  greetingOverride?: string;
  isActive?: boolean;
}): Promise<PhoneNumberMapping> {
  return fetchJson<PhoneNumberMapping>('/api/telephony/numbers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function updatePhoneNumber(
  phoneNumberId: string,
  payload: Partial<{
    phoneNumber: string;
    domainId: string;
    friendlyName: string;
    escalationNumber: string;
    escalationSkillGroup: string;
    greetingOverride: string;
    isActive: boolean;
  }>
): Promise<PhoneNumberMapping> {
  return fetchJson<PhoneNumberMapping>(
    `/api/telephony/numbers/${encodeURIComponent(phoneNumberId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
  );
}

export async function deletePhoneNumber(phoneNumberId: string): Promise<void> {
  await fetchJson(`/api/telephony/numbers/${encodeURIComponent(phoneNumberId)}`, {
    method: 'DELETE'
  });
}

export async function fetchCallSessions(limit = 100): Promise<CallSession[]> {
  return fetchItems<CallSession>(`/api/telephony/calls?limit=${limit}`);
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

export async function updatePromptTemplate(
  domainUuid: string,
  promptTemplateId: string,
  payload: {
    promptType?: string;
    templateText?: string;
    versionNo?: number;
    isActive?: boolean;
  }
): Promise<PromptTemplate> {
  return fetchJson<PromptTemplate>(
    `/api/domains/${encodeURIComponent(domainUuid)}/prompts/${encodeURIComponent(promptTemplateId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
  );
}

export async function deletePromptTemplate(domainUuid: string, promptTemplateId: string): Promise<void> {
  await fetchJson(
    `/api/domains/${encodeURIComponent(domainUuid)}/prompts/${encodeURIComponent(promptTemplateId)}`,
    { method: 'DELETE' }
  );
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

export async function updateToolDefinition(
  domainUuid: string,
  toolId: string,
  payload: {
    toolName?: string;
    description?: string;
    schemaJson?: string;
    handlerName?: string;
    isActive?: boolean;
  }
): Promise<ToolDefinition> {
  return fetchJson<ToolDefinition>(
    `/api/domains/${encodeURIComponent(domainUuid)}/tools/${encodeURIComponent(toolId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
  );
}

export async function deleteToolDefinition(domainUuid: string, toolId: string): Promise<void> {
  await fetchJson(
    `/api/domains/${encodeURIComponent(domainUuid)}/tools/${encodeURIComponent(toolId)}`,
    { method: 'DELETE' }
  );
}

export async function bootstrapHospital(payload?: {
  domainCode?: string;
  displayName?: string;
  organizationName?: string;
}): Promise<{
  seeded: boolean;
  domainId: string;
  domainCode: string;
  departmentsCreated: number;
  doctorsCreated: number;
  schedulesCreated: number;
}> {
  return fetchJson('/api/hospital/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {})
  });
}

export async function fetchHospitalDepartments(): Promise<HospitalDepartment[]> {
  return cachedFetch('hospital:departments', () => fetchItems<HospitalDepartment>('/api/hospital/departments'), 120_000);
}

export async function fetchHospitalDoctors(departmentId?: string): Promise<HospitalDoctor[]> {
  const suffix = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : '';
  return fetchItems<HospitalDoctor>(`/api/hospital/doctors${suffix}`);
}

export async function fetchAvailableHospitalDoctors(args?: {
  departmentId?: string;
  date?: string;
}): Promise<HospitalDoctor[]> {
  const params = new URLSearchParams();
  if (args?.departmentId) params.set('departmentId', args.departmentId);
  if (args?.date) params.set('date', args.date);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return fetchItems<HospitalDoctor>(`/api/hospital/doctors/available${suffix}`);
}

export async function fetchHospitalDoctorSlots(
  doctorId: string,
  date?: string
): Promise<HospitalSchedule[]> {
  const suffix = date ? `?date=${encodeURIComponent(date)}` : '';
  return fetchItems<HospitalSchedule>(
    `/api/hospital/doctors/${encodeURIComponent(doctorId)}/slots${suffix}`
  );
}

export async function createHospitalPatient(payload: {
  fullName: string;
  phoneNumber: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
  addressLine?: string;
  emergencyContact?: string;
}): Promise<HospitalPatient> {
  return fetchJson('/api/hospital/patients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function lookupHospitalPatient(args: {
  patientCode?: string;
  phone?: string;
}): Promise<HospitalPatient | null> {
  const params = new URLSearchParams();
  if (args.patientCode) params.set('patientCode', args.patientCode);
  if (args.phone) params.set('phone', args.phone);
  return fetchJson<HospitalPatient | null>(`/api/hospital/patients/lookup?${params.toString()}`);
}

export async function createHospitalAppointment(payload: {
  patientId?: string;
  patientCode?: string;
  phoneNumber?: string;
  doctorId: string;
  departmentId: string;
  appointmentDate: string;
  appointmentTime: string;
  reasonForVisit?: string;
  conversationId?: string;
  patientName?: string;
}): Promise<HospitalAppointment> {
  return fetchJson('/api/hospital/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function verifyHospitalAppointment(args: {
  patientCode?: string;
  phone?: string;
}): Promise<HospitalAppointment | null> {
  const params = new URLSearchParams();
  if (args.patientCode) params.set('patientCode', args.patientCode);
  if (args.phone) params.set('phone', args.phone);
  return fetchJson<HospitalAppointment | null>(
    `/api/hospital/appointments/verify?${params.toString()}`
  );
}

export async function fetchHospitalBilling(args: {
  patientCode?: string;
  phone?: string;
}): Promise<HospitalBilling[]> {
  const params = new URLSearchParams();
  if (args.patientCode) params.set('patientCode', args.patientCode);
  if (args.phone) params.set('phone', args.phone);
  return fetchItems<HospitalBilling>(`/api/hospital/billing?${params.toString()}`);
}

export async function fetchHospitalLabReports(args: {
  patientCode?: string;
  phone?: string;
}): Promise<HospitalLabReport[]> {
  const params = new URLSearchParams();
  if (args.patientCode) params.set('patientCode', args.patientCode);
  if (args.phone) params.set('phone', args.phone);
  return fetchItems<HospitalLabReport>(`/api/hospital/lab-reports?${params.toString()}`);
}

export async function fetchHospitalAppointments(args?: {
  departmentId?: string;
  date?: string;
  status?: string;
  patientCode?: string;
  phone?: string;
}): Promise<HospitalAppointment[]> {
  const params = new URLSearchParams();
  if (args?.departmentId) params.set('departmentId', args.departmentId);
  if (args?.date) params.set('date', args.date);
  if (args?.status) params.set('status', args.status);
  if (args?.patientCode) params.set('patientCode', args.patientCode);
  if (args?.phone) params.set('phone', args.phone);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return fetchItems<HospitalAppointment>(`/api/hospital/appointments${suffix}`);
}

export async function rescheduleHospitalAppointment(
  appointmentId: string,
  payload: { appointmentDate: string; appointmentTime: string }
): Promise<HospitalAppointment> {
  return fetchJson(`/api/hospital/appointments/${encodeURIComponent(appointmentId)}/reschedule`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function cancelHospitalAppointment(
  appointmentId: string
): Promise<HospitalAppointment> {
  return fetchJson(`/api/hospital/appointments/${encodeURIComponent(appointmentId)}/cancel`, {
    method: 'PUT'
  });
}

export async function createConversation(payload: {
  domainId: string;
  channelType: string;
  customerIdentifier?: string;
}): Promise<Conversation> {
  return fetchJson('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function createConversationMessage(payload: {
  conversationId: string;
  speakerType: string;
  messageType: string;
  messageText: string;
  sequenceNo: number;
}): Promise<ConversationMessage> {
  return fetchJson('/api/conversations/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}


/* ─── Analytics ─── */
export type AnalyticsOverview = {
  domains: { total: number; active: number };
  conversations: { total: number; live: number; escalated: number; avgDurationSec: number };
  agents: { total: number; available: number; busy: number };
  escalations: { total: number; open: number; closed: number };
  conversationsByChannel: { channel: string; count: number }[];
  conversationsByStatus: { status: string; count: number }[];
};
export type ConversationTrend = { date: string; count: number };
export type DomainDistribution = { domainCode: string; displayName: string; count: number };

export async function fetchAnalyticsOverview(): Promise<AnalyticsOverview> {
  return cachedFetch('analytics:overview', () => fetchJson<AnalyticsOverview>('/api/analytics/overview'), 30_000);
}
export async function fetchConversationTrends(): Promise<ConversationTrend[]> {
  return fetchItems<ConversationTrend>('/api/analytics/conversation-trends');
}
export async function fetchDomainDistribution(): Promise<DomainDistribution[]> {
  return fetchItems<DomainDistribution>('/api/analytics/domain-distribution');
}
export async function fetchSystemHealth(): Promise<{ status: string; database: string; timestamp: string }> {
  return fetchJson('/api/analytics/health');
}
