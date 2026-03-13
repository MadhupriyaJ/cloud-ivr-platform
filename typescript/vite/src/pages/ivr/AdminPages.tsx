import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { KeenIcon } from '@/components';
import {
  createAgent,
  createDomainIntent,
  createDomainRule,
  createEscalation,
  createPromptTemplate,
  createToolDefinition,
  fetchAgents,
  fetchConversationMessages,
  fetchConversations,
  fetchDomain,
  fetchDomainIntents,
  fetchDomains,
  fetchDomainRules,
  fetchEscalations,
  fetchPromptTemplates,
  fetchToolDefinitions
} from './api';
import {
  EmptyRow,
  formatDateTime,
  getErrorText,
  IvrPageHeader,
  IvrStatCard,
  IvrToast,
  slugify,
  useToast
} from './admin';
import type {
  Agent,
  Conversation,
  ConversationMessage,
  DomainConfig,
  DomainIntent,
  DomainRule,
  Escalation,
  PromptTemplate,
  ToolDefinition
} from './types';

type Toast = { kind: 'success' | 'danger'; text: string } | null;

function DomainSelect(props: {
  domains: DomainConfig[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className="select min-w-[220px]"
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
      disabled={props.disabled}
    >
      <option value="">Select domain</option>
      {props.domains.map((domain) => (
        <option key={domain.domain_id} value={domain.domain_id}>
          {domain.display_name}
        </option>
      ))}
    </select>
  );
}

function resolveDomainUuid(domain?: DomainConfig | null): string {
  return domain?.domain_uuid || '';
}

const OverviewPage = () => {
  const navigate = useNavigate();
  const [domains, setDomains] = useState<DomainConfig[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  useToast(toast, () => setToast(null));

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [domainItems, conversationItems, escalationItems, agentItems] = await Promise.all([
        fetchDomains(),
        fetchConversations(),
        fetchEscalations(),
        fetchAgents()
      ]);
      setDomains(domainItems);
      setConversations(conversationItems);
      setEscalations(escalationItems);
      setAgents(agentItems);
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to load overview: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const liveConversations = conversations.filter((item) => item.sessionStatus === 'started').length;
  const openEscalations = escalations.filter((item) => !item.closedAt).length;
  const activeDomains = domains.filter((item) => item.active).length;
  const availableAgents = agents.filter((item) => item.isActive).length;

  return (
    <div className="ivr-admin-shell">
      <IvrPageHeader
        title="IVR Overview"
        description="Monitor the current tenant setup, conversation volume, and escalation pressure."
        actions={
          <>
            <button className="btn btn-light" onClick={() => void load()} disabled={busy}>
              Reload
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/domains/new')}>
              <KeenIcon icon="plus" className="me-2" />
              New Domain
            </button>
          </>
        }
      />

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">
        <IvrStatCard label="Active Domains" value={activeDomains} meta={`${domains.length} total`} tone="teal" />
        <IvrStatCard label="Live Calls" value={liveConversations} meta={`${conversations.length} recent sessions`} tone="blue" />
        <IvrStatCard label="Open Escalations" value={openEscalations} meta={`${escalations.length} total escalations`} tone="amber" />
        <IvrStatCard label="Available Agents" value={availableAgents} meta={`${agents.length} configured`} tone="rose" />
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Domains</h3>
          </div>
          <div className="card-table scrollable-x-auto pb-3">
            <table className="table table-auto table-border align-middle text-sm">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th className="text-end">Open</th>
                </tr>
              </thead>
              <tbody>
                {domains.length === 0 && <EmptyRow colSpan={4} text={busy ? 'Loading domains...' : 'No domains found.'} />}
                {domains.slice(0, 6).map((domain) => (
                  <tr key={domain.domain_id}>
                    <td>
                      <div className="font-semibold text-gray-900">{domain.display_name}</div>
                      <div className="text-xs text-gray-600">{domain.domain_id}</div>
                    </td>
                    <td>{domain.active ? 'Active' : 'Draft'}</td>
                    <td>{formatDateTime(domain.updated_at)}</td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-light" onClick={() => navigate(`/domains/${domain.domain_id}`)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Escalations</h3>
          </div>
          <div className="card-table scrollable-x-auto pb-3">
            <table className="table table-auto table-border align-middle text-sm">
              <thead>
                <tr>
                  <th>Conversation</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {escalations.length === 0 && (
                  <EmptyRow colSpan={4} text={busy ? 'Loading escalations...' : 'No escalations found.'} />
                )}
                {escalations.slice(0, 6).map((item) => (
                  <tr key={item.escalationId}>
                    <td className="font-mono text-xs">{item.conversationId.slice(0, 8)}</td>
                    <td>{item.escalationReason}</td>
                    <td>{item.closedAt ? 'Closed' : item.acceptedAt ? 'Accepted' : 'Open'}</td>
                    <td>{formatDateTime(item.escalatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <IvrToast toast={toast} />
    </div>
  );
};

const DomainDetailPage = () => {
  const navigate = useNavigate();
  const { domainId } = useParams();
  const [domain, setDomain] = useState<DomainConfig | null>(null);
  const [intents, setIntents] = useState<DomainIntent[]>([]);
  const [rules, setRules] = useState<DomainRule[]>([]);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  useToast(toast, () => setToast(null));

  const load = useCallback(async () => {
    if (!domainId) return;
    setBusy(true);
    try {
      const domainItem = await fetchDomain(domainId);
      const domainUuid = resolveDomainUuid(domainItem);
      const [intentItems, ruleItems, promptItems, toolItems, conversationItems] = await Promise.all([
        domainUuid ? fetchDomainIntents(domainUuid) : Promise.resolve([]),
        domainUuid ? fetchDomainRules(domainUuid) : Promise.resolve([]),
        domainUuid ? fetchPromptTemplates(domainUuid) : Promise.resolve([]),
        domainUuid ? fetchToolDefinitions(domainUuid) : Promise.resolve([]),
        fetchConversations()
      ]);
      setDomain(domainItem);
      setIntents(intentItems);
      setRules(ruleItems);
      setPrompts(promptItems);
      setTools(toolItems);
      setConversations(conversationItems.filter((item) => item.domainId === domainUuid));
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to load domain workspace: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [domainId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="ivr-admin-shell">
      <IvrPageHeader
        title={domain ? domain.display_name : 'Domain Workspace'}
        description={domain ? `${domain.organization_name} | ${domain.domain_id}` : 'Loading domain details'}
        actions={
          <>
            <button className="btn btn-light" onClick={() => navigate('/domains')}>
              Back
            </button>
            {domain && (
              <>
                <button className="btn btn-light" onClick={() => navigate(`/domains/${domain.domain_id}/config`)}>
                  Edit Config
                </button>
                <button className="btn btn-primary" onClick={() => navigate(`/domains/${domain.domain_id}/test`)}>
                  Test IVR
                </button>
              </>
            )}
          </>
        }
      />

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">
        <IvrStatCard label="Intents" value={intents.length} meta="Routing intents" tone="teal" />
        <IvrStatCard label="Rules" value={rules.length} meta="Voice and compliance rules" tone="amber" />
        <IvrStatCard label="Prompt Templates" value={prompts.length} meta="Active and historical prompts" tone="blue" />
        <IvrStatCard label="Tool Definitions" value={tools.length} meta={`${conversations.length} recent conversations`} tone="rose" />
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Domain Summary</h3>
          </div>
          <div className="card-body grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-600">Industry</div>
              <div className="font-semibold">{domain?.industry || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Voice</div>
              <div className="font-semibold">{domain?.voice || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Language</div>
              <div className="font-semibold">{domain?.language || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Status</div>
              <div className="font-semibold">{domain?.active ? 'Active' : 'Draft'}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs text-gray-600">Welcome Message</div>
              <div className="font-medium">{domain?.welcome_message || '-'}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs text-gray-600">Escalation Message</div>
              <div className="font-medium">{domain?.escalation_message || '-'}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex-wrap gap-2">
            <h3 className="card-title">Quick Actions</h3>
          </div>
          <div className="card-body flex flex-wrap gap-3">
            <button className="btn btn-light" onClick={() => navigate('/ivr/intents-rules')}>
              Intents & Rules
            </button>
            <button className="btn btn-light" onClick={() => navigate('/ivr/prompts-tools')}>
              Prompts & Tools
            </button>
            <button className="btn btn-light" onClick={() => navigate('/ivr/conversations')}>
              Conversations
            </button>
            <button className="btn btn-light" onClick={() => navigate('/ivr/escalations')}>
              Escalations
            </button>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Configured Intents</h3>
          </div>
          <div className="card-body flex flex-wrap gap-2">
            {intents.length === 0 && <div className="text-sm text-gray-600">{busy ? 'Loading intents...' : 'No intents configured.'}</div>}
            {intents.map((item) => (
              <span key={item.intentId} className="badge badge-outline badge-primary">
                {item.intentLabel}
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Conversations</h3>
          </div>
          <div className="card-table scrollable-x-auto pb-3">
            <table className="table table-auto table-border align-middle text-sm">
              <thead>
                <tr>
                  <th>Conversation</th>
                  <th>Status</th>
                  <th>Intent</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {conversations.length === 0 && (
                  <EmptyRow colSpan={4} text={busy ? 'Loading conversations...' : 'No conversations found.'} />
                )}
                {conversations.slice(0, 6).map((item) => (
                  <tr key={item.conversationId}>
                    <td className="font-mono text-xs">{item.conversationId.slice(0, 8)}</td>
                    <td>{item.sessionStatus}</td>
                    <td>{item.currentIntent || '-'}</td>
                    <td>{formatDateTime(item.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <IvrToast toast={toast} />
    </div>
  );
};

const IntentsRulesPage = () => {
  const [domains, setDomains] = useState<DomainConfig[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [intents, setIntents] = useState<DomainIntent[]>([]);
  const [rules, setRules] = useState<DomainRule[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [intentForm, setIntentForm] = useState({
    intentLabel: '',
    description: '',
    priority: 100,
    isActive: true
  });
  const [ruleForm, setRuleForm] = useState({
    ruleType: 'rule',
    ruleText: '',
    priority: 100,
    isActive: true
  });

  useToast(toast, () => setToast(null));

  const selectedDomain = useMemo(
    () => domains.find((item) => item.domain_id === selectedDomainId) || null,
    [domains, selectedDomainId]
  );

  const loadDomainsAndData = useCallback(async () => {
    setBusy(true);
    try {
      const domainItems = await fetchDomains();
      setDomains(domainItems);
      const nextDomain = selectedDomainId || domainItems[0]?.domain_id || '';
      setSelectedDomainId(nextDomain);
      const selected = domainItems.find((item) => item.domain_id === nextDomain);
      const domainUuid = resolveDomainUuid(selected);
      if (domainUuid) {
        const [intentItems, ruleItems] = await Promise.all([
          fetchDomainIntents(domainUuid),
          fetchDomainRules(domainUuid)
        ]);
        setIntents(intentItems);
        setRules(ruleItems);
      } else {
        setIntents([]);
        setRules([]);
      }
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to load domain policies: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [selectedDomainId]);

  const reloadSelected = useCallback(
    async (nextDomainId: string) => {
      setSelectedDomainId(nextDomainId);
      const selected = domains.find((item) => item.domain_id === nextDomainId);
      const domainUuid = resolveDomainUuid(selected);
      if (!domainUuid) {
        setIntents([]);
        setRules([]);
        return;
      }
      setBusy(true);
      try {
        const [intentItems, ruleItems] = await Promise.all([
          fetchDomainIntents(domainUuid),
          fetchDomainRules(domainUuid)
        ]);
        setIntents(intentItems);
        setRules(ruleItems);
      } catch (error) {
        setToast({ kind: 'danger', text: `Failed to load selected domain: ${getErrorText(error)}` });
      } finally {
        setBusy(false);
      }
    },
    [domains]
  );

  useEffect(() => {
    void loadDomainsAndData();
  }, [loadDomainsAndData]);

  const onCreateIntent = useCallback(async () => {
    const domainUuid = resolveDomainUuid(selectedDomain);
    if (!domainUuid || !intentForm.intentLabel.trim()) return;
    setBusy(true);
    try {
      await createDomainIntent(domainUuid, {
        intentCode: slugify(intentForm.intentLabel),
        intentLabel: intentForm.intentLabel,
        description: intentForm.description || undefined,
        priority: Number(intentForm.priority) || 100,
        isActive: intentForm.isActive
      });
      setIntentForm({ intentLabel: '', description: '', priority: 100, isActive: true });
      setToast({ kind: 'success', text: 'Intent created.' });
      await reloadSelected(selectedDomainId);
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to create intent: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [intentForm, reloadSelected, selectedDomain, selectedDomainId]);

  const onCreateRule = useCallback(async () => {
    const domainUuid = resolveDomainUuid(selectedDomain);
    if (!domainUuid || !ruleForm.ruleText.trim()) return;
    setBusy(true);
    try {
      await createDomainRule(domainUuid, {
        ruleType: ruleForm.ruleType,
        ruleText: ruleForm.ruleText,
        priority: Number(ruleForm.priority) || 100,
        isActive: ruleForm.isActive
      });
      setRuleForm({ ruleType: 'rule', ruleText: '', priority: 100, isActive: true });
      setToast({ kind: 'success', text: 'Rule created.' });
      await reloadSelected(selectedDomainId);
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to create rule: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [reloadSelected, ruleForm, selectedDomain, selectedDomainId]);

  return (
    <div className="ivr-admin-shell">
      <IvrPageHeader
        title="Intents & Rules"
        description="Manage routing intents and IVR policy rules per domain."
        actions={<DomainSelect domains={domains} value={selectedDomainId} onChange={(value) => void reloadSelected(value)} disabled={busy} />}
      />

      <div className="grid xl:grid-cols-2 gap-5">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Add Intent</h3>
          </div>
          <div className="card-body grid gap-3">
            <input className="input" value={intentForm.intentLabel} placeholder="Intent label" onChange={(event) => setIntentForm((prev) => ({ ...prev, intentLabel: event.target.value }))} />
            <input className="input" value={intentForm.description} placeholder="Description" onChange={(event) => setIntentForm((prev) => ({ ...prev, description: event.target.value }))} />
            <input className="input" type="number" value={intentForm.priority} onChange={(event) => setIntentForm((prev) => ({ ...prev, priority: Number(event.target.value) }))} />
            <label className="checkbox-group">
              <input type="checkbox" checked={intentForm.isActive} onChange={(event) => setIntentForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
              <span className="checkbox-label">Active intent</span>
            </label>
            <button className="btn btn-primary" onClick={() => void onCreateIntent()} disabled={busy || !selectedDomainId}>
              Create Intent
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Add Rule</h3>
          </div>
          <div className="card-body grid gap-3">
            <select className="select" value={ruleForm.ruleType} onChange={(event) => setRuleForm((prev) => ({ ...prev, ruleType: event.target.value }))}>
              <option value="rule">Rule</option>
              <option value="compliance">Compliance</option>
            </select>
            <textarea className="textarea" rows={4} value={ruleForm.ruleText} placeholder="Rule text" onChange={(event) => setRuleForm((prev) => ({ ...prev, ruleText: event.target.value }))} />
            <input className="input" type="number" value={ruleForm.priority} onChange={(event) => setRuleForm((prev) => ({ ...prev, priority: Number(event.target.value) }))} />
            <label className="checkbox-group">
              <input type="checkbox" checked={ruleForm.isActive} onChange={(event) => setRuleForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
              <span className="checkbox-label">Active rule</span>
            </label>
            <button className="btn btn-primary" onClick={() => void onCreateRule()} disabled={busy || !selectedDomainId}>
              Create Rule
            </button>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Intents</h3>
          </div>
          <div className="card-table scrollable-x-auto pb-3">
            <table className="table table-auto table-border align-middle text-sm">
              <thead>
                <tr>
                  <th>Intent</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {intents.length === 0 && <EmptyRow colSpan={4} text={busy ? 'Loading intents...' : 'No intents found.'} />}
                {intents.map((item) => (
                  <tr key={item.intentId}>
                    <td>
                      <div className="font-semibold">{item.intentLabel}</div>
                      <div className="text-xs text-gray-600">{item.intentCode}</div>
                    </td>
                    <td>{item.priority}</td>
                    <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                    <td>{formatDateTime(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Rules</h3>
          </div>
          <div className="card-table scrollable-x-auto pb-3">
            <table className="table table-auto table-border align-middle text-sm">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Rule</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 && <EmptyRow colSpan={4} text={busy ? 'Loading rules...' : 'No rules found.'} />}
                {rules.map((item) => (
                  <tr key={item.ruleId}>
                    <td>{item.ruleType}</td>
                    <td>{item.ruleText}</td>
                    <td>{item.priority}</td>
                    <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <IvrToast toast={toast} />
    </div>
  );
};

const ConversationsPage = () => {
  const [domains, setDomains] = useState<DomainConfig[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  useToast(toast, () => setToast(null));

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [domainItems, conversationItems] = await Promise.all([fetchDomains(), fetchConversations()]);
      setDomains(domainItems);
      setConversations(conversationItems);
      const nextConversationId = selectedConversationId || conversationItems[0]?.conversationId || '';
      setSelectedConversationId(nextConversationId);
      if (nextConversationId) {
        setMessages(await fetchConversationMessages(nextConversationId));
      } else {
        setMessages([]);
      }
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to load conversations: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [selectedConversationId]);

  const selectConversation = useCallback(async (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setBusy(true);
    try {
      setMessages(await fetchConversationMessages(conversationId));
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to load messages: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const domainNameByUuid = useMemo(() => {
    const lookup = new Map<string, string>();
    domains.forEach((item) => lookup.set(item.domain_uuid || '', item.display_name));
    return lookup;
  }, [domains]);

  return (
    <div className="ivr-admin-shell">
      <IvrPageHeader
        title="Conversations"
        description="Browse recent sessions and inspect transcript messages."
        actions={
          <button className="btn btn-light" onClick={() => void load()} disabled={busy}>
            Reload
          </button>
        }
      />

      <div className="grid xl:grid-cols-[420px_1fr] gap-5">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Session List</h3>
          </div>
          <div className="card-body max-h-[720px] overflow-auto flex flex-col gap-3">
            {conversations.length === 0 && <div className="text-sm text-gray-600">{busy ? 'Loading sessions...' : 'No conversations found.'}</div>}
            {conversations.map((item) => (
              <button
                key={item.conversationId}
                className={`btn flex-col items-start !h-auto !justify-start !px-4 !py-3 border ${
                  item.conversationId === selectedConversationId
                    ? 'btn-primary'
                    : 'btn-light border-gray-200 text-gray-800'
                }`}
                onClick={() => void selectConversation(item.conversationId)}
              >
                <span className="font-semibold">
                  {domainNameByUuid.get(item.domainId) || item.domainId.slice(0, 8)}
                </span>
                <span className="text-xs opacity-80">{item.conversationId}</span>
                <span className="text-xs opacity-80">
                  {item.sessionStatus} · {formatDateTime(item.startedAt)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Transcript</h3>
          </div>
          <div className="card-body max-h-[720px] overflow-auto flex flex-col gap-3">
            {messages.length === 0 && <div className="text-sm text-gray-600">{busy ? 'Loading transcript...' : 'No transcript messages found.'}</div>}
            {messages.map((item) => (
              <div key={item.messageId} className="rounded-xl border border-gray-200 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="badge badge-outline">{item.speakerType}</span>
                  <span>{item.messageType}</span>
                  <span>#{item.sequenceNo}</span>
                  <span>{formatDateTime(item.createdAt)}</span>
                </div>
                <div className="mt-2 text-sm text-gray-900 whitespace-pre-wrap">{item.messageText}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <IvrToast toast={toast} />
    </div>
  );
};

const EscalationsPage = () => {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [form, setForm] = useState({
    conversationId: '',
    escalationReason: '',
    assignedAgentId: ''
  });

  useToast(toast, () => setToast(null));

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [escalationItems, conversationItems, agentItems] = await Promise.all([
        fetchEscalations(),
        fetchConversations(),
        fetchAgents()
      ]);
      setEscalations(escalationItems);
      setConversations(conversationItems);
      setAgents(agentItems);
      setForm((prev) => ({
        ...prev,
        conversationId: prev.conversationId || conversationItems[0]?.conversationId || ''
      }));
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to load escalations: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = useCallback(async () => {
    if (!form.conversationId || !form.escalationReason.trim()) return;
    setBusy(true);
    try {
      await createEscalation({
        conversationId: form.conversationId,
        escalationReason: form.escalationReason,
        assignedAgentId: form.assignedAgentId || undefined
      });
      setForm((prev) => ({ ...prev, escalationReason: '', assignedAgentId: '' }));
      setToast({ kind: 'success', text: 'Escalation created.' });
      await load();
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to create escalation: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [form, load]);

  return (
    <div className="ivr-admin-shell">
      <IvrPageHeader
        title="Escalation Queue"
        description="Track unresolved escalations and create manual handoffs."
        actions={
          <button className="btn btn-light" onClick={() => void load()} disabled={busy}>
            Reload
          </button>
        }
      />

      <div className="grid xl:grid-cols-[420px_1fr] gap-5">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Create Escalation</h3>
          </div>
          <div className="card-body grid gap-3">
            <select className="select" value={form.conversationId} onChange={(event) => setForm((prev) => ({ ...prev, conversationId: event.target.value }))}>
              <option value="">Select conversation</option>
              {conversations.map((item) => (
                <option key={item.conversationId} value={item.conversationId}>
                  {item.conversationId}
                </option>
              ))}
            </select>
            <textarea className="textarea" rows={4} value={form.escalationReason} placeholder="Why should this call be escalated?" onChange={(event) => setForm((prev) => ({ ...prev, escalationReason: event.target.value }))} />
            <select className="select" value={form.assignedAgentId} onChange={(event) => setForm((prev) => ({ ...prev, assignedAgentId: event.target.value }))}>
              <option value="">Assign later</option>
              {agents.map((item) => (
                <option key={item.agentId} value={item.agentId}>
                  {item.name}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={() => void onCreate()} disabled={busy}>
              Create Escalation
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Queue</h3>
          </div>
          <div className="card-table scrollable-x-auto pb-3">
            <table className="table table-auto table-border align-middle text-sm">
              <thead>
                <tr>
                  <th>Conversation</th>
                  <th>Reason</th>
                  <th>Assigned</th>
                  <th>Status</th>
                  <th>Escalated</th>
                </tr>
              </thead>
              <tbody>
                {escalations.length === 0 && <EmptyRow colSpan={5} text={busy ? 'Loading queue...' : 'No escalations found.'} />}
                {escalations.map((item) => (
                  <tr key={item.escalationId}>
                    <td className="font-mono text-xs">{item.conversationId.slice(0, 8)}</td>
                    <td>{item.escalationReason}</td>
                    <td>{agents.find((agent) => agent.agentId === item.assignedAgentId)?.name || '-'}</td>
                    <td>{item.closedAt ? 'Closed' : item.acceptedAt ? 'Accepted' : 'Open'}</td>
                    <td>{formatDateTime(item.escalatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <IvrToast toast={toast} />
    </div>
  );
};

const AgentsPage = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    skillGroup: '',
    availabilityStatus: 'offline',
    isActive: true
  });

  useToast(toast, () => setToast(null));

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setAgents(await fetchAgents());
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to load agents: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = useCallback(async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    setBusy(true);
    try {
      await createAgent({
        name: form.name,
        email: form.email,
        skillGroup: form.skillGroup || undefined,
        availabilityStatus: form.availabilityStatus,
        isActive: form.isActive
      });
      setForm({ name: '', email: '', skillGroup: '', availabilityStatus: 'offline', isActive: true });
      setToast({ kind: 'success', text: 'Agent created.' });
      await load();
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to create agent: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [form, load]);

  return (
    <div className="ivr-admin-shell">
      <IvrPageHeader
        title="Agents"
        description="Configure operator accounts available for escalation handoff."
        actions={
          <button className="btn btn-light" onClick={() => void load()} disabled={busy}>
            Reload
          </button>
        }
      />

      <div className="grid xl:grid-cols-[420px_1fr] gap-5">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Add Agent</h3>
          </div>
          <div className="card-body grid gap-3">
            <input className="input" value={form.name} placeholder="Name" onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            <input className="input" value={form.email} placeholder="Email" onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
            <input className="input" value={form.skillGroup} placeholder="Skill group" onChange={(event) => setForm((prev) => ({ ...prev, skillGroup: event.target.value }))} />
            <select className="select" value={form.availabilityStatus} onChange={(event) => setForm((prev) => ({ ...prev, availabilityStatus: event.target.value }))}>
              <option value="offline">Offline</option>
              <option value="available">Available</option>
              <option value="busy">Busy</option>
            </select>
            <label className="checkbox-group">
              <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
              <span className="checkbox-label">Active agent</span>
            </label>
            <button className="btn btn-primary" onClick={() => void onCreate()} disabled={busy}>
              Create Agent
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Configured Agents</h3>
          </div>
          <div className="card-table scrollable-x-auto pb-3">
            <table className="table table-auto table-border align-middle text-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Skill Group</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {agents.length === 0 && <EmptyRow colSpan={5} text={busy ? 'Loading agents...' : 'No agents found.'} />}
                {agents.map((item) => (
                  <tr key={item.agentId}>
                    <td>{item.name}</td>
                    <td>{item.email}</td>
                    <td>{item.skillGroup || '-'}</td>
                    <td>{item.availabilityStatus}</td>
                    <td>{formatDateTime(item.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <IvrToast toast={toast} />
    </div>
  );
};

const PromptsToolsPage = () => {
  const [domains, setDomains] = useState<DomainConfig[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [promptForm, setPromptForm] = useState({
    promptType: 'welcome',
    templateText: '',
    versionNo: 1,
    isActive: true
  });
  const [toolForm, setToolForm] = useState({
    toolName: '',
    description: '',
    schemaJson: '{"type":"object","properties":{}}',
    handlerName: '',
    isActive: true
  });

  useToast(toast, () => setToast(null));

  const selectedDomain = useMemo(
    () => domains.find((item) => item.domain_id === selectedDomainId) || null,
    [domains, selectedDomainId]
  );

  const reloadSelected = useCallback(
    async (domainCode: string, domainItems = domains) => {
      setSelectedDomainId(domainCode);
      const selected = domainItems.find((item) => item.domain_id === domainCode);
      const domainUuid = resolveDomainUuid(selected);
      if (!domainUuid) {
        setPrompts([]);
        setTools([]);
        return;
      }
      setBusy(true);
      try {
        const [promptItems, toolItems] = await Promise.all([
          fetchPromptTemplates(domainUuid),
          fetchToolDefinitions(domainUuid)
        ]);
        setPrompts(promptItems);
        setTools(toolItems);
      } catch (error) {
        setToast({ kind: 'danger', text: `Failed to load prompts/tools: ${getErrorText(error)}` });
      } finally {
        setBusy(false);
      }
    },
    [domains]
  );

  useEffect(() => {
    const run = async () => {
      setBusy(true);
      try {
        const domainItems = await fetchDomains();
        setDomains(domainItems);
        const next = domainItems[0]?.domain_id || '';
        if (next) {
          await reloadSelected(next, domainItems);
        } else {
          setPrompts([]);
          setTools([]);
        }
      } catch (error) {
        setToast({ kind: 'danger', text: `Failed to load domains: ${getErrorText(error)}` });
      } finally {
        setBusy(false);
      }
    };
    void run();
  }, [reloadSelected]);

  const onCreatePrompt = useCallback(async () => {
    const domainUuid = resolveDomainUuid(selectedDomain);
    if (!domainUuid || !promptForm.templateText.trim()) return;
    setBusy(true);
    try {
      await createPromptTemplate(domainUuid, promptForm);
      setPromptForm({ promptType: 'welcome', templateText: '', versionNo: 1, isActive: true });
      setToast({ kind: 'success', text: 'Prompt template created.' });
      await reloadSelected(selectedDomainId);
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to create prompt: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [promptForm, reloadSelected, selectedDomain, selectedDomainId]);

  const onCreateTool = useCallback(async () => {
    const domainUuid = resolveDomainUuid(selectedDomain);
    if (!domainUuid || !toolForm.toolName.trim() || !toolForm.handlerName.trim()) return;
    setBusy(true);
    try {
      await createToolDefinition(domainUuid, toolForm);
      setToolForm({
        toolName: '',
        description: '',
        schemaJson: '{"type":"object","properties":{}}',
        handlerName: '',
        isActive: true
      });
      setToast({ kind: 'success', text: 'Tool definition created.' });
      await reloadSelected(selectedDomainId);
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to create tool: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [reloadSelected, selectedDomain, selectedDomainId, toolForm]);

  return (
    <div className="ivr-admin-shell">
      <IvrPageHeader
        title="Prompts & Tools"
        description="Manage prompt templates and callable tools for each domain."
        actions={<DomainSelect domains={domains} value={selectedDomainId} onChange={(value) => void reloadSelected(value)} disabled={busy} />}
      />

      <div className="grid xl:grid-cols-2 gap-5">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Add Prompt Template</h3>
          </div>
          <div className="card-body grid gap-3">
            <select className="select" value={promptForm.promptType} onChange={(event) => setPromptForm((prev) => ({ ...prev, promptType: event.target.value }))}>
              <option value="welcome">Welcome</option>
              <option value="fallback">Fallback</option>
              <option value="system">System</option>
              <option value="escalation">Escalation</option>
            </select>
            <textarea className="textarea" rows={5} value={promptForm.templateText} placeholder="Template text" onChange={(event) => setPromptForm((prev) => ({ ...prev, templateText: event.target.value }))} />
            <input className="input" type="number" value={promptForm.versionNo} onChange={(event) => setPromptForm((prev) => ({ ...prev, versionNo: Number(event.target.value) || 1 }))} />
            <label className="checkbox-group">
              <input type="checkbox" checked={promptForm.isActive} onChange={(event) => setPromptForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
              <span className="checkbox-label">Active template</span>
            </label>
            <button className="btn btn-primary" onClick={() => void onCreatePrompt()} disabled={busy || !selectedDomainId}>
              Create Prompt
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Add Tool Definition</h3>
          </div>
          <div className="card-body grid gap-3">
            <input className="input" value={toolForm.toolName} placeholder="Tool name" onChange={(event) => setToolForm((prev) => ({ ...prev, toolName: event.target.value }))} />
            <input className="input" value={toolForm.description} placeholder="Description" onChange={(event) => setToolForm((prev) => ({ ...prev, description: event.target.value }))} />
            <input className="input" value={toolForm.handlerName} placeholder="Handler name" onChange={(event) => setToolForm((prev) => ({ ...prev, handlerName: event.target.value }))} />
            <textarea className="textarea" rows={5} value={toolForm.schemaJson} placeholder="JSON schema" onChange={(event) => setToolForm((prev) => ({ ...prev, schemaJson: event.target.value }))} />
            <label className="checkbox-group">
              <input type="checkbox" checked={toolForm.isActive} onChange={(event) => setToolForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
              <span className="checkbox-label">Active tool</span>
            </label>
            <button className="btn btn-primary" onClick={() => void onCreateTool()} disabled={busy || !selectedDomainId}>
              Create Tool
            </button>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Prompt Templates</h3>
          </div>
          <div className="card-table scrollable-x-auto pb-3">
            <table className="table table-auto table-border align-middle text-sm">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {prompts.length === 0 && <EmptyRow colSpan={4} text={busy ? 'Loading prompts...' : 'No prompts found.'} />}
                {prompts.map((item) => (
                  <tr key={item.promptTemplateId}>
                    <td>{item.promptType}</td>
                    <td>{item.versionNo}</td>
                    <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                    <td>{formatDateTime(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Tool Definitions</h3>
          </div>
          <div className="card-table scrollable-x-auto pb-3">
            <table className="table table-auto table-border align-middle text-sm">
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Handler</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {tools.length === 0 && <EmptyRow colSpan={4} text={busy ? 'Loading tools...' : 'No tools found.'} />}
                {tools.map((item) => (
                  <tr key={item.toolId}>
                    <td>
                      <div className="font-semibold">{item.toolName}</div>
                      <div className="text-xs text-gray-600">{item.description}</div>
                    </td>
                    <td>{item.handlerName}</td>
                    <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                    <td>{formatDateTime(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <IvrToast toast={toast} />
    </div>
  );
};

export {
  AgentsPage,
  ConversationsPage,
  DomainDetailPage,
  EscalationsPage,
  IntentsRulesPage,
  OverviewPage,
  PromptsToolsPage
};
