/**
 * IVR Engine API Client
 * 
 * Provides typed API calls to the Generic IVR Engine backend endpoints.
 * All routes are under /api/ivr-engine/...
 */

function resolveApiBase(): string {
  if (import.meta.env.DEV) return '';
  const fromEnv = import.meta.env.VITE_BACKEND_HTTP_URL as string | undefined;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim().replace(/\/$/, '');
  return '';
}

const API_BASE = resolveApiBase();

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${init?.method || 'GET'} ${path} failed (${response.status}): ${body}`);
  }
  return (await response.json()) as T;
}

// ─── Types ───

export interface IvrFlow {
  FlowId: number;
  DomainId: number;
  FlowCode: string;
  FlowName: string;
  Description: string | null;
  IsEntryFlow: boolean;
  FlowVersion: number;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string;
  DomainCode?: string;
  DomainName?: string;
  NodeCount?: number;
}

export interface IvrFlowNode {
  NodeId: number;
  FlowId: number;
  NodeCode: string;
  NodeType: string;
  NodeLabel: string | null;
  PromptText: string | null;
  SortOrder: number;
  NextNodeCode: string | null;
  BranchConfig: string | null;
  TimeoutSeconds: number | null;
  MaxRetries: number | null;
  IsActive: boolean;
  actions?: IvrNodeAction[];
}

export interface IvrNodeAction {
  ActionId: number;
  NodeId: number;
  ActionType: string;
  ActionOrder: number;
  ToolName: string | null;
  EndpointId: number | null;
  RequestMapping: string | null;
  ResponseMapping: string | null;
  FallbackResponse: string | null;
  IsActive: boolean;
}

export interface DomainApiEndpoint {
  EndpointId: number;
  DomainId: number;
  EndpointCode: string;
  EndpointName: string;
  HttpMethod: string;
  BaseUrl: string;
  Path: string | null;
  HeadersJson: string | null;
  AuthType: string;
  AuthConfig: string | null;
  TimeoutMs: number;
  RetryCount: number;
  IsActive: boolean;
  DomainCode?: string;
  DomainName?: string;
}

export interface IvrSession {
  sessionId: string;
  domainCode: string;
  currentNode: string;
  status: string;
  variables?: Record<string, any>;
  history?: any[];
  startedAt?: number;
  durationMs?: number;
}

export interface IvrEngineHealth {
  status: string;
  engine: {
    flows: number;
    nodes: number;
    endpoints: number;
    activeSessions: number;
    errorsLast24h: number;
  };
  timestamp: string;
}

export interface FlowStepResult {
  nodeCode: string;
  nodeType: string;
  promptText: string;
  action: string;
  data: Record<string, any>;
  nextNodeCode: string | null;
  timestamp: number;
}

// ─── Flow Management ───

export async function fetchIvrFlows(domainCode?: string): Promise<IvrFlow[]> {
  const suffix = domainCode ? `?domainCode=${encodeURIComponent(domainCode)}` : '';
  return fetchJson<IvrFlow[]>(`/api/ivr-engine/flows${suffix}`);
}

export async function fetchIvrFlow(flowId: number): Promise<IvrFlow & { nodes: IvrFlowNode[] }> {
  return fetchJson(`/api/ivr-engine/flows/${flowId}`);
}

export async function createIvrFlow(payload: {
  domainCode: string;
  flowCode: string;
  flowName: string;
  description?: string;
  isEntryFlow?: boolean;
}): Promise<IvrFlow> {
  return fetchJson('/api/ivr-engine/flows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateIvrFlow(flowId: number, payload: {
  flowName?: string;
  description?: string;
  isEntryFlow?: boolean;
  isActive?: boolean;
}): Promise<{ success: boolean }> {
  return fetchJson(`/api/ivr-engine/flows/${flowId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ─── Node Management ───

export async function createIvrNode(flowId: number, payload: {
  nodeCode: string;
  nodeType: string;
  nodeLabel?: string;
  promptText?: string;
  sortOrder: number;
  nextNodeCode?: string;
  branchConfig?: Record<string, string>;
}): Promise<IvrFlowNode> {
  return fetchJson(`/api/ivr-engine/flows/${flowId}/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateIvrNode(nodeId: number, payload: {
  nodeLabel?: string;
  promptText?: string;
  sortOrder?: number;
  nextNodeCode?: string;
  branchConfig?: Record<string, string>;
  isActive?: boolean;
}): Promise<{ success: boolean }> {
  return fetchJson(`/api/ivr-engine/nodes/${nodeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteIvrNode(nodeId: number): Promise<{ success: boolean }> {
  return fetchJson(`/api/ivr-engine/nodes/${nodeId}`, { method: 'DELETE' });
}

// ─── Node Actions ───

export async function createNodeAction(nodeId: number, payload: {
  actionType: string;
  actionOrder?: number;
  toolName?: string;
  requestMapping?: Record<string, string>;
  responseMapping?: Record<string, string>;
  fallbackResponse?: Record<string, string>;
}): Promise<IvrNodeAction> {
  return fetchJson(`/api/ivr-engine/nodes/${nodeId}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ─── API Endpoints ───

export async function fetchApiEndpoints(domainCode?: string): Promise<DomainApiEndpoint[]> {
  const suffix = domainCode ? `?domainCode=${encodeURIComponent(domainCode)}` : '';
  return fetchJson<DomainApiEndpoint[]>(`/api/ivr-engine/endpoints${suffix}`);
}

export async function createApiEndpoint(payload: {
  domainCode: string;
  endpointCode: string;
  endpointName: string;
  httpMethod: string;
  baseUrl: string;
  path: string;
  headersJson?: Record<string, string>;
  authType?: string;
  authConfig?: Record<string, string>;
  timeoutMs?: number;
  retryCount?: number;
}): Promise<DomainApiEndpoint> {
  return fetchJson('/api/ivr-engine/endpoints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateApiEndpoint(endpointId: number, payload: Record<string, any>): Promise<{ success: boolean }> {
  return fetchJson(`/api/ivr-engine/endpoints/${endpointId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ─── Session Management ───

export async function startIvrSession(domainCode: string, sessionId?: string): Promise<{
  sessionId?: string;
  step: FlowStepResult;
  status: string;
}> {
  return fetchJson('/api/ivr-engine/session/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domainCode, sessionId }),
  });
}

export async function processIvrInput(sessionId: string, userInput: string, detectedIntent?: string): Promise<{
  sessionId: string;
  step: FlowStepResult;
  status: string;
  variables: Record<string, any>;
}> {
  return fetchJson(`/api/ivr-engine/session/${encodeURIComponent(sessionId)}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userInput, detectedIntent }),
  });
}

export async function getIvrSession(sessionId: string): Promise<IvrSession> {
  return fetchJson(`/api/ivr-engine/session/${encodeURIComponent(sessionId)}`);
}

export async function endIvrSession(sessionId: string): Promise<{ sessionId: string; status: string }> {
  return fetchJson(`/api/ivr-engine/session/${encodeURIComponent(sessionId)}/end`, {
    method: 'POST',
  });
}

export async function getActiveSessions(): Promise<{ count: number; sessions: IvrSession[] }> {
  return fetchJson('/api/ivr-engine/sessions/active');
}

// ─── Health & Monitoring ───

export async function getIvrEngineHealth(): Promise<IvrEngineHealth> {
  return fetchJson('/api/ivr-engine/health');
}

export async function getErrorLogs(domainCode?: string, limit?: number): Promise<any[]> {
  const params = new URLSearchParams();
  if (domainCode) params.set('domainCode', domainCode);
  if (limit) params.set('limit', String(limit));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return fetchJson(`/api/ivr-engine/errors${suffix}`);
}

export async function invalidateCache(domainCode?: string): Promise<{ success: boolean; message: string }> {
  return fetchJson('/api/ivr-engine/cache/invalidate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domainCode }),
  });
}
