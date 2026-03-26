import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeenIcon } from '@/components';
import {
  createDomain,
  createDomainIntent,
  createDomainRule,
  deleteDomainIntent,
  deleteDomainRule,
  fetchDomain,
  fetchDomainIntents,
  fetchDomainRules,
  fetchDomains,
  saveDomain,
  updateDomainIntent,
  updateDomainRule
} from './api';
import { getErrorText, IvrPageHeader, IvrToast, slugify, useToast } from './admin';
import { EMPTY_DOMAIN } from './form';
import type { DomainPayload } from './types';

type Toast = { kind: 'success' | 'danger'; text: string } | null;

type WorkflowNodeType = 'welcome' | 'menu' | 'collect' | 'route' | 'api' | 'fallback' | 'escalate';

type BuilderNode = {
  id: string;
  type: WorkflowNodeType;
  title: string;
  prompt: string;
  description: string;
  intentsCsv: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT';
  collectField: string;
};

const WORKFLOW_STORAGE_PREFIX = 'ivr-flow-builder:';

const NODE_LIBRARY: Array<{
  type: WorkflowNodeType;
  title: string;
  icon: string;
  description: string;
}> = [
  { type: 'welcome', title: 'Welcome', icon: 'message-text-2', description: 'Greets the caller and opens the call.' },
  { type: 'menu', title: 'Intent Menu', icon: 'abstract-26', description: 'Defines the top-level caller choices.' },
  { type: 'collect', title: 'Collect Input', icon: 'document', description: 'Captures patient ID, phone, or other data.' },
  { type: 'route', title: 'Route Branch', icon: 'arrow-mix', description: 'Branches the flow for selected intents.' },
  { type: 'api', title: 'Backend Action', icon: 'technology-4', description: 'Calls a NestJS endpoint or service.' },
  { type: 'fallback', title: 'Fallback', icon: 'information-4', description: 'Handles unsupported or unclear requests.' },
  { type: 'escalate', title: 'Escalation', icon: 'support-24', description: 'Transfers the caller to a human.' }
];

function makeNodeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function createNode(type: WorkflowNodeType): BuilderNode {
  const base = {
    id: makeNodeId(),
    type,
    title: '',
    prompt: '',
    description: '',
    intentsCsv: '',
    endpoint: '',
    method: 'POST' as const,
    collectField: ''
  };

  switch (type) {
    case 'welcome':
      return { ...base, title: 'Welcome Caller', prompt: 'Welcome to your organization. Please tell me how I can help you today.', description: 'Primary greeting' };
    case 'menu':
      return { ...base, title: 'Main Menu', prompt: 'You can say appointments, billing, lab reports, or operator.', intentsCsv: 'appointments, billing, lab reports, operator', description: 'Top-level intent menu' };
    case 'collect':
      return { ...base, title: 'Collect Caller Detail', prompt: 'Please tell me your patient ID or registered phone number.', collectField: 'patient_id', description: 'Capture a lookup key' };
    case 'route':
      return { ...base, title: 'Route Intent', prompt: 'When the caller asks for appointments, continue with appointment handling.', intentsCsv: 'appointments', description: 'Intent branch' };
    case 'api':
      return { ...base, title: 'Call Backend', prompt: 'Use a backend action to complete the request.', endpoint: '/api/hospital/appointments/verify', method: 'GET', description: 'Backend handoff' };
    case 'fallback':
      return { ...base, title: 'Fallback Response', prompt: 'Sorry, I did not understand. Please say appointments, billing, lab reports, or operator.', description: 'Unrecognized intent handling' };
    case 'escalate':
      return { ...base, title: 'Escalate to Agent', prompt: 'Connecting you to an operator now.', description: 'Human transfer' };
  }
}

function parseCsv(value: string): string[] {
  return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function workflowKey(domainId: string): string {
  return `${WORKFLOW_STORAGE_PREFIX}${domainId}`;
}

function buildStarterNodes(): BuilderNode[] {
  return ['welcome', 'menu', 'collect', 'route', 'api', 'fallback', 'escalate'].map((type) =>
    createNode(type as WorkflowNodeType)
  );
}

function hydrateNodes(raw: string | null): BuilderNode[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BuilderNode[];
    if (!Array.isArray(parsed)) return null;
    return parsed.map((node) => ({ ...createNode(node.type), ...node, id: node.id || makeNodeId() }));
  } catch {
    return null;
  }
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildNodesFromDomain(payload: DomainPayload): BuilderNode[] {
  return buildStarterNodes().map((node) => {
    if (node.type === 'welcome') return { ...node, prompt: payload.welcome_message };
    if (node.type === 'menu') return { ...node, prompt: payload.intents.length > 0 ? `You can say ${payload.intents.join(', ')}.` : node.prompt, intentsCsv: payload.intents.join(', ') };
    if (node.type === 'fallback') return { ...node, prompt: payload.fallback_message };
    if (node.type === 'escalate') return { ...node, prompt: payload.escalation_message };
    if (node.type === 'route') return { ...node, prompt: payload.rules[0] || 'Route the caller to the right business handler based on their intent.', intentsCsv: payload.intents.join(', ') };
    if (node.type === 'api') return { ...node, endpoint: '/api/hospital/appointments/verify', prompt: payload.rules[1] || node.prompt };
    return node;
  });
}

function derivePayload(form: DomainPayload, nodes: BuilderNode[], complianceText: string): DomainPayload {
  const welcome = nodes.find((node) => node.type === 'welcome');
  const fallback = nodes.find((node) => node.type === 'fallback');
  const escalate = nodes.find((node) => node.type === 'escalate');
  const menuNodes = nodes.filter((node) => node.type === 'menu' || node.type === 'route');
  const collectNodes = nodes.filter((node) => node.type === 'collect');
  const apiNodes = nodes.filter((node) => node.type === 'api');
  const intents = Array.from(new Set(menuNodes.flatMap((node) => parseCsv(node.intentsCsv))));
  const rules = Array.from(
    new Set([
      ...collectNodes.map((node) => node.prompt || `Collect ${node.collectField || 'required caller information'} before routing.`),
      ...apiNodes.map((node) => `${node.method} ${node.endpoint || '/api/...'}: ${node.prompt || 'Call the backend action.'}`),
      ...nodes.filter((node) => node.type === 'route').map((node) => node.prompt || 'Route the caller to the matching intent path.')
    ].filter(Boolean))
  );

  return {
    ...form,
    domain_id: slugify(form.domain_id || form.display_name),
    display_name: form.display_name.trim(),
    organization_name: form.organization_name.trim(),
    industry: form.industry.trim(),
    language: form.language.trim(),
    voice: form.voice.trim(),
    welcome_message: welcome?.prompt.trim() || form.welcome_message,
    fallback_message: fallback?.prompt.trim() || form.fallback_message,
    escalation_message: escalate?.prompt.trim() || form.escalation_message,
    intents,
    rules,
    compliance: parseCsv(complianceText),
    active: form.active
  };
}

async function syncIntents(domainUuid: string, intents: string[]) {
  const existing = await fetchDomainIntents(domainUuid);
  for (let index = 0; index < intents.length; index += 1) {
    const label = intents[index];
    const payload = {
      intentCode: slugify(label),
      intentLabel: label,
      description: `${label} workflow path`,
      priority: (index + 1) * 10,
      isActive: true
    };
    const current = existing[index];
    if (current) await updateDomainIntent(domainUuid, current.intentId, payload);
    else await createDomainIntent(domainUuid, payload);
  }
  for (const extra of existing.slice(intents.length)) {
    await deleteDomainIntent(domainUuid, extra.intentId);
  }
}

async function syncRules(domainUuid: string, rules: string[], compliance: string[]) {
  const desired = [
    ...rules.map((text, index) => ({ ruleType: 'rule', ruleText: text, priority: (index + 1) * 10, isActive: true })),
    ...compliance.map((text, index) => ({ ruleType: 'compliance', ruleText: text, priority: 200 + index, isActive: true }))
  ];
  const existing = await fetchDomainRules(domainUuid);
  for (let index = 0; index < desired.length; index += 1) {
    const current = existing[index];
    if (current) await updateDomainRule(domainUuid, current.ruleId, desired[index]);
    else await createDomainRule(domainUuid, desired[index]);
  }
  for (const extra of existing.slice(desired.length)) {
    await deleteDomainRule(domainUuid, extra.ruleId);
  }
}

const N8nDomainBuilderPage = () => {
  const [domains, setDomains] = useState<Array<{ domain_id: string; display_name: string }>>([]);
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [form, setForm] = useState<DomainPayload>({
    ...EMPTY_DOMAIN,
    domain_id: 'hospital-builder',
    display_name: 'Hospital Builder Flow',
    organization_name: 'ABC Hospital',
    industry: 'healthcare',
    welcome_message: 'Welcome to ABC Hospital. Please tell me how I can help you today.'
  });
  const [complianceText, setComplianceText] = useState(
    'Do not disclose patient-sensitive information without verification.'
  );
  const [nodes, setNodes] = useState<BuilderNode[]>(() => buildStarterNodes());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  useToast(toast, () => setToast(null));

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );
  const payloadPreview = useMemo(
    () => derivePayload(form, nodes, complianceText),
    [complianceText, form, nodes]
  );

  const loadDomains = useCallback(async () => {
    const items = await fetchDomains();
    setDomains(items.map((item) => ({ domain_id: item.domain_id, display_name: item.display_name })));
  }, []);

  useEffect(() => {
    void loadDomains().catch((error) =>
      setToast({ kind: 'danger', text: `Failed to load domains: ${getErrorText(error)}` })
    );
  }, [loadDomains]);

  useEffect(() => {
    const stored = hydrateNodes(localStorage.getItem(workflowKey(form.domain_id)));
    if (stored?.length) {
      setNodes(stored);
      setSelectedNodeId(stored[0]?.id ?? null);
    }
  }, [form.domain_id]);

  const persistWorkflow = useCallback((domainId: string, nextNodes: BuilderNode[]) => {
    if (!domainId.trim()) return;
    localStorage.setItem(workflowKey(domainId), JSON.stringify(nextNodes));
  }, []);

  const createBlank = useCallback(() => {
    const starter = buildStarterNodes();
    setSelectedDomainId('');
    setForm({
      ...EMPTY_DOMAIN,
      domain_id: 'new-ivr-flow',
      display_name: 'New IVR Flow',
      organization_name: 'New Organization',
      industry: 'general',
      welcome_message: 'Welcome. Please tell me how I can help you.'
    });
    setComplianceText('Do not disclose confidential information without verification.');
    setNodes(starter);
    setSelectedNodeId(starter[0]?.id ?? null);
  }, []);

  const loadExisting = useCallback(async () => {
    if (!selectedDomainId) return;
    setBusy(true);
    try {
      const domain = await fetchDomain(selectedDomainId);
      const nextForm: DomainPayload = {
        domain_id: domain.domain_id,
        display_name: domain.display_name,
        industry: domain.industry,
        organization_name: domain.organization_name,
        voice: domain.voice,
        language: domain.language,
        welcome_message: domain.welcome_message,
        fallback_message: domain.fallback_message,
        intents: domain.intents,
        rules: domain.rules,
        compliance: domain.compliance,
        escalation_message: domain.escalation_message,
        active: domain.active
      };
      const storedNodes = hydrateNodes(localStorage.getItem(workflowKey(domain.domain_id)));
      const nextNodes = storedNodes && storedNodes.length > 0 ? storedNodes : buildNodesFromDomain(nextForm);
      setForm(nextForm);
      setComplianceText(nextForm.compliance.join('\n'));
      setNodes(nextNodes);
      setSelectedNodeId(nextNodes[0]?.id ?? null);
      setToast({ kind: 'success', text: `Loaded '${domain.domain_id}' into the flow builder.` });
    } catch (error) {
      setToast({ kind: 'danger', text: `Load failed: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [selectedDomainId]);

  const addNode = useCallback((type: WorkflowNodeType) => {
    setNodes((prev) => {
      const nextNode = createNode(type);
      const nextNodes = [...prev, nextNode];
      setSelectedNodeId(nextNode.id);
      persistWorkflow(form.domain_id, nextNodes);
      return nextNodes;
    });
  }, [form.domain_id, persistWorkflow]);

  const updateNode = useCallback((nodeId: string, patch: Partial<BuilderNode>) => {
    setNodes((prev) => {
      const nextNodes = prev.map((node) => (node.id === nodeId ? { ...node, ...patch } : node));
      persistWorkflow(form.domain_id, nextNodes);
      return nextNodes;
    });
  }, [form.domain_id, persistWorkflow]);

  const removeNode = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((prev) => {
      const nextNodes = prev.filter((node) => node.id !== selectedNodeId);
      setSelectedNodeId(nextNodes[0]?.id ?? null);
      persistWorkflow(form.domain_id, nextNodes);
      return nextNodes;
    });
  }, [form.domain_id, persistWorkflow, selectedNodeId]);

  const moveNode = useCallback((fromId: string, toId: string) => {
    setNodes((prev) => {
      if (fromId === toId) return prev;
      const fromIndex = prev.findIndex((node) => node.id === fromId);
      const toIndex = prev.findIndex((node) => node.id === toId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const nextNodes = [...prev];
      const [moved] = nextNodes.splice(fromIndex, 1);
      nextNodes.splice(toIndex, 0, moved);
      persistWorkflow(form.domain_id, nextNodes);
      return nextNodes;
    });
  }, [form.domain_id, persistWorkflow]);

  const onSave = useCallback(async () => {
    const payload = derivePayload(form, nodes, complianceText);
    if (!payload.domain_id || !payload.display_name || !payload.organization_name) {
      setToast({ kind: 'danger', text: 'Domain ID, display name, and organization are required.' });
      return;
    }

    setBusy(true);
    try {
      const exists = domains.some((domain) => domain.domain_id === payload.domain_id);
      const saved = exists ? await saveDomain(payload.domain_id, payload) : await createDomain(payload);
      if (!saved.domain_uuid) throw new Error('Saved domain did not return domain_uuid.');
      await syncIntents(saved.domain_uuid, payload.intents);
      await syncRules(saved.domain_uuid, payload.rules, payload.compliance);
      persistWorkflow(payload.domain_id, nodes);
      setForm(payload);
      await loadDomains();
      setToast({
        kind: 'success',
        text: exists
          ? `Updated '${payload.domain_id}' and synced its builder workflow.`
          : `Created '${payload.domain_id}' and synced its builder workflow.`
      });
    } catch (error) {
      setToast({ kind: 'danger', text: `Save failed: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [complianceText, domains, form, loadDomains, nodes, persistWorkflow]);

  return (
    <div className="container-fluid grid gap-5">
      <IvrPageHeader
        title="IVR Flow Builder"
        description="Build IVR flows inside the app, drag nodes into sequence, and publish directly to the current domain APIs."
        actions={
          <>
            <button className="btn btn-light" onClick={createBlank} disabled={busy}>
              New Flow
            </button>
            <button
              className="btn btn-light"
              onClick={() =>
                downloadJson(`${payloadPreview.domain_id || 'ivr-flow'}.json`, {
                  meta: payloadPreview,
                  workflow: nodes
                })
              }
            >
              <KeenIcon icon="file-down" className="me-2" />
              Export JSON
            </button>
            <button className="btn btn-primary" onClick={onSave} disabled={busy}>
              <KeenIcon icon="check" className="me-2" />
              Save Flow
            </button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <div className="card border border-gray-200 shadow-none dark:border-coal-100">
            <div className="card-header border-b border-gray-200 dark:border-coal-100">
              <div>
                <h3 className="card-title">Domain Target</h3>
                <div className="text-xs text-gray-600 mt-1">
                  Start a new flow or load an existing domain into the builder.
                </div>
              </div>
            </div>
            <div className="card-body grid gap-3">
              <label className="form-label flex-col">
                Existing Domain
                <select
                  className="select mt-1.5"
                  value={selectedDomainId}
                  onChange={(event) => setSelectedDomainId(event.target.value)}
                >
                  <option value="">Select a domain</option>
                  {domains.map((domain) => (
                    <option key={domain.domain_id} value={domain.domain_id}>
                      {domain.display_name} ({domain.domain_id})
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2">
                <button
                  className="btn btn-light flex-1"
                  onClick={loadExisting}
                  disabled={busy || !selectedDomainId}
                >
                  Load Existing
                </button>
                <button className="btn btn-light flex-1" onClick={createBlank} disabled={busy}>
                  Start Blank
                </button>
              </div>
              <label className="form-label flex-col">
                Domain ID
                <input
                  className="input mt-1.5"
                  value={form.domain_id}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, domain_id: slugify(event.target.value) }))
                  }
                />
              </label>
              <label className="form-label flex-col">
                Display Name
                <input
                  className="input mt-1.5"
                  value={form.display_name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, display_name: event.target.value }))
                  }
                />
              </label>
              <label className="form-label flex-col">
                Organization
                <input
                  className="input mt-1.5"
                  value={form.organization_name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, organization_name: event.target.value }))
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="form-label flex-col">
                  Industry
                  <input
                    className="input mt-1.5"
                    value={form.industry}
                    onChange={(event) => setForm((prev) => ({ ...prev, industry: event.target.value }))}
                  />
                </label>
                <label className="form-label flex-col">
                  Voice
                  <input
                    className="input mt-1.5"
                    value={form.voice}
                    onChange={(event) => setForm((prev) => ({ ...prev, voice: event.target.value }))}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="card border border-gray-200 shadow-none dark:border-coal-100">
            <div className="card-header border-b border-gray-200 dark:border-coal-100">
              <div>
                <h3 className="card-title">Node Library</h3>
                <div className="text-xs text-gray-600 mt-1">
                  Add blocks into the flow. Reorder on the canvas with drag-and-drop.
                </div>
              </div>
            </div>
            <div className="card-body grid gap-2.5">
              {NODE_LIBRARY.map((item) => (
                <button
                  key={item.type}
                  className="flex items-start gap-3 rounded-2xl border border-gray-200 p-4 text-left transition hover:border-primary/40 hover:bg-light"
                  onClick={() => addNode(item.type)}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <KeenIcon icon={item.icon} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                    <div className="mt-1 text-xs leading-5 text-gray-600">{item.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="card border border-gray-200 shadow-none dark:border-coal-100">
            <div className="card-header flex-wrap gap-3 border-b border-gray-200 dark:border-coal-100">
              <div>
                <h3 className="card-title">Flow Canvas</h3>
                <div className="text-xs text-gray-600 mt-1">
                  Click a node to edit it. Drag cards to change execution order.
                </div>
              </div>
              <div className="ms-auto text-xs text-gray-600">{nodes.length} nodes</div>
            </div>
            <div className="card-body grid gap-3">
              {nodes.map((node, index) => (
                <div key={node.id} className="grid gap-3">
                  <button
                    draggable
                    onDragStart={() => setDragNodeId(node.id)}
                    onDragEnd={() => setDragNodeId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragNodeId) moveNode(dragNodeId, node.id);
                      setDragNodeId(null);
                    }}
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`rounded-3xl border p-5 text-left transition ${
                      selectedNodeId === node.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-950 text-white">
                        <span className="text-xs font-semibold">{index + 1}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-700">
                            {node.type}
                          </span>
                          <div className="text-sm font-semibold text-gray-900">{node.title}</div>
                        </div>
                        <div className="mt-2 text-sm leading-6 text-gray-700">
                          {node.prompt || node.description || 'No prompt configured yet.'}
                        </div>
                        {node.intentsCsv && (
                          <div className="mt-2 text-xs text-gray-500">Intents: {node.intentsCsv}</div>
                        )}
                        {node.endpoint && (
                          <div className="mt-1 text-xs text-gray-500">
                            {node.method} {node.endpoint}
                          </div>
                        )}
                      </div>
                      <div className="text-gray-400">
                        <KeenIcon icon="abstract-14" />
                      </div>
                    </div>
                  </button>
                  {index < nodes.length - 1 && (
                    <div className="flex items-center justify-center text-gray-300">
                      <KeenIcon icon="arrow-down" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card border border-gray-200 shadow-none dark:border-coal-100">
            <div className="card-header border-b border-gray-200 dark:border-coal-100">
              <div>
                <h3 className="card-title">Compliance Notes</h3>
                <div className="text-xs text-gray-600 mt-1">
                  Stored as compliance rules when you save the flow.
                </div>
              </div>
            </div>
            <div className="card-body">
              <textarea
                className="textarea min-h-[140px]"
                value={complianceText}
                onChange={(event) => setComplianceText(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="card border border-gray-200 shadow-none dark:border-coal-100">
            <div className="card-header flex-wrap gap-3 border-b border-gray-200 dark:border-coal-100">
              <div>
                <h3 className="card-title">Node Editor</h3>
                <div className="text-xs text-gray-600 mt-1">
                  Configure the selected step and shape the derived domain config.
                </div>
              </div>
              <button className="btn btn-light btn-sm ms-auto" onClick={removeNode} disabled={!selectedNode}>
                Remove
              </button>
            </div>
            <div className="card-body">
              {!selectedNode && (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-light p-6 text-sm text-gray-700">
                  Select a node from the canvas to edit its properties.
                </div>
              )}
              {selectedNode && (
                <div className="grid gap-4">
                  <label className="form-label flex-col">
                    Node Title
                    <input
                      className="input mt-1.5"
                      value={selectedNode.title}
                      onChange={(event) => updateNode(selectedNode.id, { title: event.target.value })}
                    />
                  </label>
                  <label className="form-label flex-col">
                    Prompt / Instruction
                    <textarea
                      className="textarea mt-1.5"
                      rows={4}
                      value={selectedNode.prompt}
                      onChange={(event) => updateNode(selectedNode.id, { prompt: event.target.value })}
                    />
                  </label>
                  <label className="form-label flex-col">
                    Description
                    <input
                      className="input mt-1.5"
                      value={selectedNode.description}
                      onChange={(event) => updateNode(selectedNode.id, { description: event.target.value })}
                    />
                  </label>
                  {(selectedNode.type === 'menu' || selectedNode.type === 'route') && (
                    <label className="form-label flex-col">
                      Intents
                      <textarea
                        className="textarea mt-1.5"
                        rows={3}
                        value={selectedNode.intentsCsv}
                        onChange={(event) => updateNode(selectedNode.id, { intentsCsv: event.target.value })}
                      />
                    </label>
                  )}
                  {selectedNode.type === 'collect' && (
                    <label className="form-label flex-col">
                      Collected Field
                      <input
                        className="input mt-1.5"
                        value={selectedNode.collectField}
                        onChange={(event) => updateNode(selectedNode.id, { collectField: event.target.value })}
                      />
                    </label>
                  )}
                  {selectedNode.type === 'api' && (
                    <>
                      <label className="form-label flex-col">
                        Method
                        <select
                          className="select mt-1.5"
                          value={selectedNode.method}
                          onChange={(event) =>
                            updateNode(selectedNode.id, {
                              method: event.target.value as BuilderNode['method']
                            })
                          }
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                        </select>
                      </label>
                      <label className="form-label flex-col">
                        Endpoint
                        <input
                          className="input mt-1.5"
                          value={selectedNode.endpoint}
                          onChange={(event) => updateNode(selectedNode.id, { endpoint: event.target.value })}
                        />
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="card border border-gray-200 shadow-none dark:border-coal-100">
            <div className="card-header border-b border-gray-200 dark:border-coal-100">
              <div>
                <h3 className="card-title">Generated Domain JSON</h3>
                <div className="text-xs text-gray-600 mt-1">
                  This is what will be published to the backend on save.
                </div>
              </div>
            </div>
            <div className="card-body">
              <pre className="max-h-[62vh] overflow-auto rounded-2xl bg-gray-950 p-4 text-xs leading-6 text-gray-100">
                {JSON.stringify(payloadPreview, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>

      <IvrToast toast={toast} />
    </div>
  );
};

export { N8nDomainBuilderPage };
