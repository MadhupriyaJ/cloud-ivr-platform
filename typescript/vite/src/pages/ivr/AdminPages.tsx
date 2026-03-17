import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Container, KeenIcon } from '@/components';
import ApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { toAbsoluteUrl } from '@/utils/Assets';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  createAgent,
  createDomainIntent,
  createDomainRule,
  createEscalation,
  createPromptTemplate,
  createToolDefinition,
  deleteDomainIntent,
  deleteDomainRule,
  deletePromptTemplate,
  deleteToolDefinition,
  fetchAgents,
  fetchConversationMessages,
  fetchConversations,
  fetchDomain,
  fetchDomainIntents,
  fetchDomains,
  fetchDomainRules,
  fetchEscalations,
  fetchPromptTemplates,
  fetchToolDefinitions,
  updateDomainIntent,
  updateDomainRule,
  updatePromptTemplate,
  updateToolDefinition
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

function ActionButtons(props: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <button className="btn btn-sm btn-light" onClick={props.onEdit}>
        Edit
      </button>
      <button className="btn btn-sm btn-light" onClick={props.onDelete}>
        Delete
      </button>
    </div>
  );
}

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

function isRawAudioChunkMessage(message: ConversationMessage): boolean {
  const type = message.messageType.trim().toLowerCase();
  const text = message.messageText.trim().toLowerCase();
  return type === 'audio_chunk' || /^\[audio_chunk:\d+\]$/.test(text);
}

function getReadableSpeakerLabel(speakerType: string): string {
  const normalized = speakerType.trim().toLowerCase();
  if (normalized === 'assistant' || normalized === 'agent') return 'IVR';
  if (normalized === 'customer' || normalized === 'user') return 'Customer';
  return speakerType;
}

function getReadableMessageType(message: ConversationMessage): string {
  if (isRawAudioChunkMessage(message)) return 'Audio chunk';
  const normalized = message.messageType.trim().toLowerCase();
  if (normalized === 'input_text') return 'Customer message';
  if (normalized === 'output_text') return 'IVR response';
  return message.messageType.replace(/_/g, ' ');
}

function getReadableTranscriptText(message: ConversationMessage): string {
  if (isRawAudioChunkMessage(message)) {
    return 'Audio captured for this turn. Transcript text is not available yet.';
  }
  const text = message.messageText.trim();
  return text || 'No transcript text available.';
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
  const closedEscalations = escalations.filter((item) => item.closedAt).length;
  const activeDomains = domains.filter((item) => item.active).length;
  const availableAgents = agents.filter((item) => item.isActive).length;
  const escalatedSessions = conversations.filter((item) => item.escalatedToAgent).length;
  const chartMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyCalls = useMemo(() => {
    const counts = new Array(12).fill(0);
    conversations.forEach((item) => {
      const date = new Date(item.startedAt);
      if (!Number.isNaN(date.getTime())) counts[date.getMonth()] += 1;
    });
    return counts;
  }, [conversations]);
  const chartOptions: ApexOptions = useMemo(
    () => ({
      chart: { type: 'area', height: 250, toolbar: { show: false } },
      dataLabels: { enabled: false },
      legend: { show: false },
      stroke: { curve: 'smooth', width: 3, colors: ['var(--tw-primary)'] },
      fill: { gradient: { opacityFrom: 0.22, opacityTo: 0.02 } },
      xaxis: {
        categories: chartMonths,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { colors: 'var(--tw-gray-500)', fontSize: '12px' } }
      },
      yaxis: {
        labels: { style: { colors: 'var(--tw-gray-500)', fontSize: '12px' } }
      },
      grid: {
        borderColor: 'var(--tw-gray-200)',
        strokeDashArray: 5,
        yaxis: { lines: { show: true } },
        xaxis: { lines: { show: false } }
      },
      tooltip: { enabled: true }
    }),
    []
  );
  const topCards = [
    { icon: 'abstract-26', value: `${activeDomains}`, desc: 'Active domains', color: 'text-primary' },
    { icon: 'phone', value: `${liveConversations}`, desc: 'Live calls', color: 'text-success' },
    { icon: 'delivery-24', value: `${openEscalations}`, desc: 'Open escalations', color: 'text-warning' },
    { icon: 'people', value: `${availableAgents}`, desc: 'Ready agents', color: 'text-info' }
  ];
  const summaryRows = [
    { icon: 'phone', text: 'Voice sessions', total: conversations.length, stats: liveConversations, increase: true },
    { icon: 'security-user', text: 'Escalation cases', total: escalatedSessions, stats: openEscalations, increase: false },
    { icon: 'user-tick', text: 'Resolved handoffs', total: closedEscalations, stats: availableAgents, increase: true }
  ];

  return (
    <Container className="container-fluid">
      <style>
        {`
          .ivr-overview-stat-bg {
            background-image: url('${toAbsoluteUrl('/media/images/2600x1600/bg-3.png')}');
          }
          .dark .ivr-overview-stat-bg {
            background-image: url('${toAbsoluteUrl('/media/images/2600x1600/bg-3-dark.png')}');
          }
          .ivr-overview-callout-bg {
            background-image: url('${toAbsoluteUrl('/media/images/2600x1600/2.png')}');
          }
          .dark .ivr-overview-callout-bg {
            background-image: url('${toAbsoluteUrl('/media/images/2600x1600/2-dark.png')}');
          }
        `}
      </style>
      <div className="grid gap-5 lg:gap-7.5">
        <IvrPageHeader
          title="Dashboard"
          description="Central hub for IVR operations, live calls, and domain activity."
          actions={
            <>
              <button className="btn btn-sm btn-light" onClick={() => void load()} disabled={busy}>
                Reload
              </button>
              <button className="btn btn-sm btn-primary" onClick={() => navigate('/domains/new')}>
                <KeenIcon icon="plus" className="me-2" />
                New Domain
              </button>
            </>
          }
        />

        <div className="grid items-stretch gap-y-5 lg:grid-cols-3 lg:gap-7.5">
          <div className="lg:col-span-1">
            <div className="grid h-full grid-cols-2 gap-5 lg:gap-7.5">
              {topCards.map((item) => (
                <div
                  key={item.desc}
                  className="card ivr-overview-stat-bg h-full flex-col justify-between gap-6 border border-gray-200 bg-cover bg-[right_top_-1.7rem] bg-no-repeat shadow-none rtl:bg-[left_top_-1.7rem] dark:border-coal-100 "
                >
                  <div className={`mt-4 ms-5 flex size-11 items-center justify-center rounded-lg bg-light  ${item.color}`}>
                    <KeenIcon icon={item.icon} className="text-xl" />
                  </div>
                  <div className="flex flex-col gap-1 px-5 pb-4">
                    <span className="text-3xl font-semibold text-gray-900 dark:text-white">{item.value}</span>
                    <span className="text-2sm font-normal text-gray-700 dark:text-gray-500">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="card h-full border border-gray-200 shadow-none dark:border-coal-100 ">
              <div className="card-body ivr-overview-callout-bg bg-[length:80%] bg-no-repeat p-10 [background-position:175%_25%] rtl:[background-position:-70%_25%]">
                <div className="flex flex-col justify-center gap-4">
                  <div className="flex -space-x-2">
                    {['AI', 'QA', 'Ops', `${availableAgents}`].map((item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className={`flex size-10 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-white dark:ring-coal-100 ${index === 3 ? 'bg-success' : 'bg-primary'}`}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                  <h2 className="text-1.5xl font-semibold text-gray-900 dark:text-white">
                    Run live voice journeys and monitor <br /> the{' '}
                    <a className="link" href="#">
                      IVR operations workspace
                    </a>
                  </h2>
                  <p className="text-sm font-normal leading-5.5 text-gray-700 dark:text-gray-400">
                    Track domain coverage, live call load, and escalation movement from one
                    dashboard. Use the workspace to update prompts, rules, and agents without
                    leaving the IVR module.
                  </p>
                </div>
              </div>
              <div className="card-footer justify-center border-t border-gray-200 dark:border-coal-100">
                <button className="btn btn-link" onClick={() => navigate('/ivr/conversations')}>
                  Open Live Console
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid items-stretch gap-5 lg:grid-cols-3 lg:gap-7.5">
          <div className="lg:col-span-1">
            <div className="card h-full border border-gray-200 shadow-none dark:border-coal-100 ">
              <div className="card-header border-b border-gray-200 dark:border-coal-100">
                <h3 className="card-title">Highlights</h3>
                <button className="btn btn-sm btn-icon btn-light btn-clear">
                  <KeenIcon icon="dots-vertical" />
                </button>
              </div>
              <div className="card-body flex flex-col gap-4 p-5 lg:p-7.5 lg:pt-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-normal text-gray-700 dark:text-gray-500">
                    All time call volume
                  </span>
                  <div className="flex items-center gap-2.5">
                    <span className="text-3xl font-semibold text-gray-900 dark:text-white">
                      {conversations.length}
                    </span>
                    <span className="badge badge-outline badge-success badge-sm">
                      {availableAgents} active agents
                    </span>
                  </div>
                </div>
                <div className="mb-1.5 flex items-center gap-1">
                  <div className="h-2 w-full max-w-[55%] rounded-sm bg-success"></div>
                  <div className="h-2 w-full max-w-[28%] rounded-sm bg-primary"></div>
                  <div className="h-2 w-full max-w-[17%] rounded-sm bg-warning"></div>
                </div>
                <div className="mb-1 flex items-center flex-wrap gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="badge badge-dot size-2 badge-success"></span>
                    <span className="text-sm text-gray-800 dark:text-gray-300">Completed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="badge badge-dot size-2 badge-primary"></span>
                    <span className="text-sm text-gray-800 dark:text-gray-300">Live</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="badge badge-dot size-2 badge-warning"></span>
                    <span className="text-sm text-gray-800 dark:text-gray-300">Escalated</span>
                  </div>
                </div>
                <div className="border-b border-gray-300 dark:border-coal-100"></div>
                <div className="grid gap-3">
                  {summaryRows.map((row) => (
                    <div key={row.text} className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <KeenIcon icon={row.icon} className="text-base text-gray-500" />
                        <span className="text-sm font-normal text-gray-900 dark:text-white">
                          {row.text}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 text-sm font-medium text-gray-800 dark:text-gray-300">
                        <span>{row.total}</span>
                        <span>
                          <KeenIcon
                            icon={row.increase ? 'arrow-up' : 'arrow-down'}
                            className={row.increase ? 'text-success' : 'text-danger'}
                          />{' '}
                          {row.stats}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="card h-full border border-gray-200 shadow-none dark:border-coal-100 ">
              <div className="card-header">
                <h3 className="card-title">Conversation Trend</h3>
                <div className="flex items-center gap-5">
                  <label className="switch switch-sm">
                    <input name="calls" type="checkbox" value="1" className="order-2" readOnly />
                    <span className="switch-label order-1">Live sessions only</span>
                  </label>
                  <Select defaultValue="12">
                    <SelectTrigger className="w-28" size="sm">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="w-32">
                      <SelectItem value="1">1 month</SelectItem>
                      <SelectItem value="3">3 months</SelectItem>
                      <SelectItem value="6">6 months</SelectItem>
                      <SelectItem value="12">12 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="card-body flex grow flex-col items-stretch justify-end px-3 py-1">
                <ApexChart
                  options={chartOptions}
                  series={[{ name: 'Calls', data: monthlyCalls }]}
                  type="area"
                  height={250}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid items-stretch gap-5 lg:grid-cols-3 lg:gap-7.5">
          <div className="lg:col-span-1">
            <div className="card h-full border border-gray-200 shadow-none dark:border-coal-100 ">
              <div className="card-body p-5 lg:p-7.5 lg:pt-6">
                <div className="mb-7.5 flex items-center justify-between gap-5 flex-wrap">
                  <div className="flex flex-col gap-1">
                    <span className="text-1.5xl font-semibold text-gray-900 dark:text-white">
                      Live Session Window
                    </span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-300">
                      Now monitoring
                    </span>
                  </div>
                  <div className="flex size-9 items-center justify-center rounded-full bg-primary-light text-primary">
                    <KeenIcon icon="phone" className="text-lg" />
                  </div>
                </div>
                <p className="mb-8 text-sm font-normal leading-5.5 text-gray-800 dark:text-gray-400">
                  Use this panel to jump into active calls, review domain readiness, and keep the
                  escalation queue under control during live traffic.
                </p>
                <div className="flex gap-10 rounded-lg bg-gray-100 p-5 ">
                  <div className="flex flex-col gap-5">
                    <div className="flex items-center gap-1.5 text-sm font-normal text-gray-800 dark:text-gray-200">
                      <KeenIcon icon="security-user" className="text-base text-gray-500" />
                      Queue
                    </div>
                    <div className="pt-1.5 text-sm font-medium text-gray-800 dark:text-gray-100">
                      {openEscalations} open
                    </div>
                  </div>
                  <div className="flex flex-col gap-5">
                    <div className="flex items-center gap-1.5 text-sm font-normal text-gray-800 dark:text-gray-200">
                      <KeenIcon icon="users" className="text-base text-gray-500" />
                      Domains
                    </div>
                    <div className="pt-1.5 text-sm font-medium text-gray-800 dark:text-gray-100">
                      {activeDomains} active
                    </div>
                  </div>
                </div>
              </div>
              <div className="card-footer justify-center border-t border-gray-200 dark:border-coal-100">
                <button className="btn btn-link" onClick={() => navigate('/ivr/conversations')}>
                  Open Conversations
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="card h-full border border-gray-200 shadow-none dark:border-coal-100 ">
              <div className="card-header flex-wrap gap-2 border-b border-gray-200 px-5 dark:border-coal-100">
                <h3 className="card-title font-medium text-sm">Domains</h3>
                <div className="ms-auto flex flex-wrap gap-2 lg:gap-5">
                  <label className="input input-sm">
                    <KeenIcon icon="magnifier" />
                    <input type="text" placeholder="Search Domains..." readOnly />
                  </label>
                </div>
              </div>
              <div className="card-table scrollable-x-auto">
                <table className="table table-auto align-middle text-sm">
                  <thead>
                    <tr>
                      <th>Domain</th>
                      <th>Status</th>
                      <th>Industry</th>
                      <th>Updated</th>
                      <th className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {domains.length === 0 && (
                      <EmptyRow colSpan={5} text={busy ? 'Loading domains...' : 'No domains found.'} />
                    )}
                    {domains.slice(0, 6).map((item) => (
                      <tr key={item.domain_id}>
                        <td>
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            {item.display_name}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {item.organization_name}
                          </div>
                        </td>
                        <td>{item.active ? 'Active' : 'Draft'}</td>
                        <td>{item.industry || '-'}</td>
                        <td>{formatDateTime(item.updated_at)}</td>
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-light"
                            onClick={() => navigate(`/domains/${item.domain_id}`)}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <IvrToast toast={toast} />
      </div>
    </Container>
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
    <div className="container-fluid grid gap-5">
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
    intentCode: '',
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
  const [editingIntentId, setEditingIntentId] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

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

  const onSaveIntent = useCallback(async () => {
    const domainUuid = resolveDomainUuid(selectedDomain);
    if (!domainUuid || !intentForm.intentLabel.trim()) return;
    setBusy(true);
    try {
      const payload = {
        intentCode: intentForm.intentCode.trim() || slugify(intentForm.intentLabel),
        intentLabel: intentForm.intentLabel,
        description: intentForm.description || undefined,
        priority: Number(intentForm.priority) || 100,
        isActive: intentForm.isActive
      };
      if (editingIntentId) {
        await updateDomainIntent(domainUuid, editingIntentId, payload);
        setToast({ kind: 'success', text: 'Intent updated.' });
      } else {
        await createDomainIntent(domainUuid, payload);
        setToast({ kind: 'success', text: 'Intent created.' });
      }
      setEditingIntentId(null);
      setIntentForm({ intentCode: '', intentLabel: '', description: '', priority: 100, isActive: true });
      await reloadSelected(selectedDomainId);
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to save intent: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [editingIntentId, intentForm, reloadSelected, selectedDomain, selectedDomainId]);

  const onSaveRule = useCallback(async () => {
    const domainUuid = resolveDomainUuid(selectedDomain);
    if (!domainUuid || !ruleForm.ruleText.trim()) return;
    setBusy(true);
    try {
      const payload = {
        ruleType: ruleForm.ruleType,
        ruleText: ruleForm.ruleText,
        priority: Number(ruleForm.priority) || 100,
        isActive: ruleForm.isActive
      };
      if (editingRuleId) {
        await updateDomainRule(domainUuid, editingRuleId, payload);
        setToast({ kind: 'success', text: 'Rule updated.' });
      } else {
        await createDomainRule(domainUuid, payload);
        setToast({ kind: 'success', text: 'Rule created.' });
      }
      setEditingRuleId(null);
      setRuleForm({ ruleType: 'rule', ruleText: '', priority: 100, isActive: true });
      await reloadSelected(selectedDomainId);
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to save rule: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [editingRuleId, reloadSelected, ruleForm, selectedDomain, selectedDomainId]);

  const onDeleteIntent = useCallback(async (intentId: string) => {
    const domainUuid = resolveDomainUuid(selectedDomain);
    if (!domainUuid || !window.confirm('Delete this intent?')) return;
    setBusy(true);
    try {
      await deleteDomainIntent(domainUuid, intentId);
      if (editingIntentId === intentId) {
        setEditingIntentId(null);
        setIntentForm({ intentCode: '', intentLabel: '', description: '', priority: 100, isActive: true });
      }
      setToast({ kind: 'success', text: 'Intent deleted.' });
      await reloadSelected(selectedDomainId);
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to delete intent: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [editingIntentId, reloadSelected, selectedDomain, selectedDomainId]);

  const onDeleteRule = useCallback(async (ruleId: string) => {
    const domainUuid = resolveDomainUuid(selectedDomain);
    if (!domainUuid || !window.confirm('Delete this rule?')) return;
    setBusy(true);
    try {
      await deleteDomainRule(domainUuid, ruleId);
      if (editingRuleId === ruleId) {
        setEditingRuleId(null);
        setRuleForm({ ruleType: 'rule', ruleText: '', priority: 100, isActive: true });
      }
      setToast({ kind: 'success', text: 'Rule deleted.' });
      await reloadSelected(selectedDomainId);
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to delete rule: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [editingRuleId, reloadSelected, selectedDomain, selectedDomainId]);

  return (
    <div className="container-fluid grid gap-5">
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
            <input className="input" value={intentForm.intentCode} placeholder="Intent code" onChange={(event) => setIntentForm((prev) => ({ ...prev, intentCode: event.target.value }))} />
            <input className="input" value={intentForm.description} placeholder="Description" onChange={(event) => setIntentForm((prev) => ({ ...prev, description: event.target.value }))} />
            <input className="input" type="number" value={intentForm.priority} onChange={(event) => setIntentForm((prev) => ({ ...prev, priority: Number(event.target.value) }))} />
            <label className="checkbox-group">
              <input type="checkbox" checked={intentForm.isActive} onChange={(event) => setIntentForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
              <span className="checkbox-label">Active intent</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={() => void onSaveIntent()} disabled={busy || !selectedDomainId}>
                {editingIntentId ? 'Update Intent' : 'Create Intent'}
              </button>
              {editingIntentId && (
                <button className="btn btn-light" onClick={() => { setEditingIntentId(null); setIntentForm({ intentCode: '', intentLabel: '', description: '', priority: 100, isActive: true }); }}>
                  Cancel
                </button>
              )}
            </div>
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
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={() => void onSaveRule()} disabled={busy || !selectedDomainId}>
                {editingRuleId ? 'Update Rule' : 'Create Rule'}
              </button>
              {editingRuleId && (
                <button className="btn btn-light" onClick={() => { setEditingRuleId(null); setRuleForm({ ruleType: 'rule', ruleText: '', priority: 100, isActive: true }); }}>
                  Cancel
                </button>
              )}
            </div>
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
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {intents.length === 0 && <EmptyRow colSpan={5} text={busy ? 'Loading intents...' : 'No intents found.'} />}
                {intents.map((item) => (
                  <tr key={item.intentId}>
                    <td>
                      <div className="font-semibold">{item.intentLabel}</div>
                      <div className="text-xs text-gray-600">{item.intentCode}</div>
                    </td>
                    <td>{item.priority}</td>
                    <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td className="text-end">
                      <ActionButtons
                        onEdit={() => {
                          setEditingIntentId(item.intentId);
                          setIntentForm({
                            intentCode: item.intentCode,
                            intentLabel: item.intentLabel,
                            description: item.description || '',
                            priority: item.priority,
                            isActive: item.isActive
                          });
                        }}
                        onDelete={() => void onDeleteIntent(item.intentId)}
                      />
                    </td>
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
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 && <EmptyRow colSpan={5} text={busy ? 'Loading rules...' : 'No rules found.'} />}
                {rules.map((item) => (
                  <tr key={item.ruleId}>
                    <td>{item.ruleType}</td>
                    <td>{item.ruleText}</td>
                    <td>{item.priority}</td>
                    <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="text-end">
                      <ActionButtons
                        onEdit={() => {
                          setEditingRuleId(item.ruleId);
                          setRuleForm({
                            ruleType: item.ruleType,
                            ruleText: item.ruleText,
                            priority: item.priority,
                            isActive: item.isActive
                          });
                        }}
                        onDelete={() => void onDeleteRule(item.ruleId)}
                      />
                    </td>
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

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.conversationId === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const transcriptMessages = useMemo(
    () => messages.filter((item) => !isRawAudioChunkMessage(item)),
    [messages]
  );

  const hiddenAudioChunkCount = useMemo(
    () => messages.filter((item) => isRawAudioChunkMessage(item)).length,
    [messages]
  );

  return (
    <div className="container-fluid grid gap-5">
      <IvrPageHeader
        title="Conversations"
        description="Browse recent sessions and inspect readable customer and IVR transcript messages."
        actions={
          <button className="btn btn-light" onClick={() => void load()} disabled={busy}>
            Reload
          </button>
        }
      />

      <div className="grid xl:grid-cols-[420px_1fr] gap-5">
        <div className="card border border-gray-200 shadow-none dark:border-coal-100">
          <div className="card-header border-b border-gray-200 dark:border-coal-100">
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
                    : 'btn-light border-gray-200 text-gray-800 dark:border-coal-100 dark:text-gray-200'
                }`}
                onClick={() => void selectConversation(item.conversationId)}
              >
                <span className="font-semibold">
                  {domainNameByUuid.get(item.domainId) || item.domainId.slice(0, 8)}
                </span>
                <span className="text-xs opacity-80">{item.currentIntent || 'No active intent'}</span>
                <span className="text-xs opacity-80">
                  {item.sessionStatus} · {formatDateTime(item.startedAt)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="card border border-gray-200 shadow-none dark:border-coal-100">
          <div className="card-header flex-wrap gap-3 border-b border-gray-200 dark:border-coal-100">
            <div>
              <h3 className="card-title">Transcript</h3>
              <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {selectedConversation
                  ? `${domainNameByUuid.get(selectedConversation.domainId) || selectedConversation.domainId} · ${selectedConversation.sessionStatus}`
                  : 'Select a session to inspect the transcript.'}
              </div>
            </div>
            {selectedConversation && (
              <div className="ms-auto flex flex-wrap gap-2 text-xs">
                <span className="badge badge-outline">{selectedConversation.channelType}</span>
                {selectedConversation.escalatedToAgent && (
                  <span className="badge badge-warning badge-outline">Escalated</span>
                )}
              </div>
            )}
          </div>
          <div className="card-body max-h-[720px] overflow-auto flex flex-col gap-3">
            {selectedConversation && (
              <div className="rounded-xl border border-gray-200 bg-light px-4 py-3 dark:border-coal-100 dark:bg-coal-200">
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.08em] text-gray-600 dark:text-gray-400">Started</div>
                    <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{formatDateTime(selectedConversation.startedAt)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.08em] text-gray-600 dark:text-gray-400">Status</div>
                    <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{selectedConversation.sessionStatus}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.08em] text-gray-600 dark:text-gray-400">Intent</div>
                    <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{selectedConversation.currentIntent || '-'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.08em] text-gray-600 dark:text-gray-400">Summary</div>
                    <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{selectedConversation.summaryText || 'No summary available.'}</div>
                  </div>
                </div>
              </div>
            )}
            {hiddenAudioChunkCount > 0 && (
              <div className="rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 dark:border-coal-100 dark:text-gray-400">
                {hiddenAudioChunkCount} raw audio chunk message{hiddenAudioChunkCount > 1 ? 's were' : ' was'} hidden to keep the transcript readable.
              </div>
            )}
            {transcriptMessages.length === 0 && <div className="text-sm text-gray-600">{busy ? 'Loading transcript...' : 'No readable transcript messages found.'}</div>}
            {transcriptMessages.map((item) => (
              <div key={item.messageId} className="rounded-xl border border-gray-200 px-4 py-3 dark:border-coal-100">
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="badge badge-outline">{getReadableSpeakerLabel(item.speakerType)}</span>
                  <span>{getReadableMessageType(item)}</span>
                  <span>#{item.sequenceNo}</span>
                  <span>{formatDateTime(item.createdAt)}</span>
                </div>
                <div className="mt-2 text-sm text-gray-900 whitespace-pre-wrap dark:text-white">{getReadableTranscriptText(item)}</div>
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
    <div className="container-fluid grid gap-5">
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
    <div className="container-fluid grid gap-5">
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
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const domainsRef = useRef<DomainConfig[]>([]);

  useToast(toast, () => setToast(null));

  useEffect(() => {
    domainsRef.current = domains;
  }, [domains]);

  const selectedDomain = useMemo(
    () => domains.find((item) => item.domain_id === selectedDomainId) || null,
    [domains, selectedDomainId]
  );

  const reloadSelected = useCallback(
    async (domainCode: string, domainItems?: DomainConfig[]) => {
      setSelectedDomainId(domainCode);
      const availableDomains = domainItems ?? domainsRef.current;
      const selected = availableDomains.find((item) => item.domain_id === domainCode);
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
    []
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

  const onSavePrompt = useCallback(async () => {
    const domainUuid = resolveDomainUuid(selectedDomain);
    if (!domainUuid || !promptForm.templateText.trim()) return;
    setBusy(true);
    try {
      if (editingPromptId) {
        await updatePromptTemplate(domainUuid, editingPromptId, promptForm);
        setToast({ kind: 'success', text: 'Prompt updated.' });
      } else {
        await createPromptTemplate(domainUuid, promptForm);
        setToast({ kind: 'success', text: 'Prompt template created.' });
      }
      setEditingPromptId(null);
      setPromptForm({ promptType: 'welcome', templateText: '', versionNo: 1, isActive: true });
      await reloadSelected(selectedDomainId);
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to save prompt: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [editingPromptId, promptForm, reloadSelected, selectedDomain, selectedDomainId]);

  const onSaveTool = useCallback(async () => {
    const domainUuid = resolveDomainUuid(selectedDomain);
    if (!domainUuid || !toolForm.toolName.trim() || !toolForm.handlerName.trim()) return;
    setBusy(true);
    try {
      if (editingToolId) {
        await updateToolDefinition(domainUuid, editingToolId, toolForm);
        setToast({ kind: 'success', text: 'Tool updated.' });
      } else {
        await createToolDefinition(domainUuid, toolForm);
        setToast({ kind: 'success', text: 'Tool definition created.' });
      }
      setEditingToolId(null);
      setToolForm({
        toolName: '',
        description: '',
        schemaJson: '{"type":"object","properties":{}}',
        handlerName: '',
        isActive: true
      });
      await reloadSelected(selectedDomainId);
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to save tool: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [editingToolId, reloadSelected, selectedDomain, selectedDomainId, toolForm]);

  const onDeletePrompt = useCallback(async (promptTemplateId: string) => {
    const domainUuid = resolveDomainUuid(selectedDomain);
    if (!domainUuid || !window.confirm('Delete this prompt template?')) return;
    setBusy(true);
    try {
      await deletePromptTemplate(domainUuid, promptTemplateId);
      if (editingPromptId === promptTemplateId) {
        setEditingPromptId(null);
        setPromptForm({ promptType: 'welcome', templateText: '', versionNo: 1, isActive: true });
      }
      setToast({ kind: 'success', text: 'Prompt deleted.' });
      await reloadSelected(selectedDomainId);
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to delete prompt: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [editingPromptId, reloadSelected, selectedDomain, selectedDomainId]);

  const onDeleteTool = useCallback(async (toolId: string) => {
    const domainUuid = resolveDomainUuid(selectedDomain);
    if (!domainUuid || !window.confirm('Delete this tool definition?')) return;
    setBusy(true);
    try {
      await deleteToolDefinition(domainUuid, toolId);
      if (editingToolId === toolId) {
        setEditingToolId(null);
        setToolForm({
          toolName: '',
          description: '',
          schemaJson: '{"type":"object","properties":{}}',
          handlerName: '',
          isActive: true
        });
      }
      setToast({ kind: 'success', text: 'Tool deleted.' });
      await reloadSelected(selectedDomainId);
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to delete tool: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [editingToolId, reloadSelected, selectedDomain, selectedDomainId]);

  return (
    <div className="container-fluid grid gap-5">
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
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={() => void onSavePrompt()} disabled={busy || !selectedDomainId}>
                {editingPromptId ? 'Update Prompt' : 'Create Prompt'}
              </button>
              {editingPromptId && (
                <button className="btn btn-light" onClick={() => { setEditingPromptId(null); setPromptForm({ promptType: 'welcome', templateText: '', versionNo: 1, isActive: true }); }}>
                  Cancel
                </button>
              )}
            </div>
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
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={() => void onSaveTool()} disabled={busy || !selectedDomainId}>
                {editingToolId ? 'Update Tool' : 'Create Tool'}
              </button>
              {editingToolId && (
                <button className="btn btn-light" onClick={() => { setEditingToolId(null); setToolForm({ toolName: '', description: '', schemaJson: '{"type":"object","properties":{}}', handlerName: '', isActive: true }); }}>
                  Cancel
                </button>
              )}
            </div>
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
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {prompts.length === 0 && <EmptyRow colSpan={5} text={busy ? 'Loading prompts...' : 'No prompts found.'} />}
                {prompts.map((item) => (
                  <tr key={item.promptTemplateId}>
                    <td>{item.promptType}</td>
                    <td>{item.versionNo}</td>
                    <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td className="text-end">
                      <ActionButtons
                        onEdit={() => {
                          setEditingPromptId(item.promptTemplateId);
                          setPromptForm({
                            promptType: item.promptType,
                            templateText: item.templateText,
                            versionNo: item.versionNo,
                            isActive: item.isActive
                          });
                        }}
                        onDelete={() => void onDeletePrompt(item.promptTemplateId)}
                      />
                    </td>
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
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tools.length === 0 && <EmptyRow colSpan={5} text={busy ? 'Loading tools...' : 'No tools found.'} />}
                {tools.map((item) => (
                  <tr key={item.toolId}>
                    <td>
                      <div className="font-semibold">{item.toolName}</div>
                      <div className="text-xs text-gray-600">{item.description}</div>
                    </td>
                    <td>{item.handlerName}</td>
                    <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td className="text-end">
                      <ActionButtons
                        onEdit={() => {
                          setEditingToolId(item.toolId);
                          setToolForm({
                            toolName: item.toolName,
                            description: item.description,
                            schemaJson: item.schemaJson,
                            handlerName: item.handlerName,
                            isActive: item.isActive
                          });
                        }}
                        onDelete={() => void onDeleteTool(item.toolId)}
                      />
                    </td>
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
