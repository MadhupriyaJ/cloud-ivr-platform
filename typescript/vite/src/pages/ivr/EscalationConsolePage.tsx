import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Container } from '@/components';
import {
  acceptEscalation,
  agentDeskSocketUrl,
  assignEscalation,
  closeEscalation,
  fetchAgents,
  fetchEscalations,
  fetchEscalationStats,
  requeueEscalation,
  setAgentAvailability
} from './api';
import {
  EmptyRow,
  formatDateTime,
  getErrorText,
  IvrPageHeader,
  IvrStatCard,
  IvrToast,
  useToast
} from './admin';
import type { Agent, Escalation, EscalationEvent, EscalationStats } from './types';

type Toast = { kind: 'success' | 'danger'; text: string } | null;
type StatusFilter = 'open' | 'all' | Escalation['status'];

const PRIORITY_STYLES: Record<Escalation['priority'], string> = {
  urgent: 'badge-danger',
  high: 'badge-warning',
  normal: 'badge-primary',
  low: 'badge-light'
};

const STATUS_STYLES: Record<Escalation['status'], string> = {
  pending: 'badge-light',
  queued: 'badge-warning',
  assigned: 'badge-info',
  accepted: 'badge-primary',
  resolved: 'badge-success',
  abandoned: 'badge-light',
  failed: 'badge-danger'
};

function Badge({ text, className }: { text: string; className: string }) {
  return <span className={`badge badge-sm ${className}`}>{text}</span>;
}

/** "3m 12s ago" — queue age is the number an agent actually reacts to. */
function timeAgo(iso: string): string {
  const started = new Date(iso).getTime();
  if (Number.isNaN(started)) return '-';
  const seconds = Math.max(0, Math.round((Date.now() - started) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0s';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

const EscalationConsolePage = () => {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<EscalationStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [meAgentId, setMeAgentId] = useState<string>('');
  const [selected, setSelected] = useState<Escalation | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [feed, setFeed] = useState<EscalationEvent[]>([]);
  const [toast, setToast] = useState<Toast>(null);
  const [tick, setTick] = useState(0);

  useToast(toast, () => setToast(null));

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [escalationItems, agentItems, statItems] = await Promise.all([
        fetchEscalations({ status: statusFilter, limit: 200 }),
        fetchAgents(),
        fetchEscalationStats()
      ]);
      setEscalations(escalationItems);
      setAgents(agentItems);
      setStats(statItems);
      setMeAgentId((prev) => prev || agentItems[0]?.agentId || '');
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to load escalations: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Re-render once a second so queue ages stay honest without refetching.
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  /* Live feed: the backend pushes every lifecycle change to /ws/agent-desk. */
  const reloadRef = useRef(load);
  reloadRef.current = load;

  useEffect(() => {
    const url = agentDeskSocketUrl();
    if (!url) return;

    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      socket = new WebSocket(url);

      socket.onopen = () => setLive(true);

      socket.onmessage = (event) => {
        let payload: EscalationEvent;
        try {
          payload = JSON.parse(event.data as string);
        } catch {
          return;
        }
        if (payload.type === 'ping' || payload.type === 'connected') return;

        setFeed((prev) => [payload, ...prev].slice(0, 40));
        // The event carries the row, but a refetch keeps ordering, filters and
        // agent load counters consistent with the server.
        void reloadRef.current();
      };

      socket.onclose = () => {
        setLive(false);
        if (!disposed) {
          retry = setTimeout(connect, 3000);
        }
      };

      socket.onerror = () => socket?.close();
    };

    connect();

    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, []);

  const me = useMemo(
    () => agents.find((agent) => agent.agentId === meAgentId) || null,
    [agents, meAgentId]
  );

  const assignableAgents = useMemo(
    () => agents.filter((agent) => agent.isActive && agent.availabilityStatus !== 'offline'),
    [agents]
  );

  const runAction = useCallback(
    async (label: string, action: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await action();
        setToast({ kind: 'success', text: label });
        await load();
      } catch (error) {
        setToast({ kind: 'danger', text: `${label} failed: ${getErrorText(error)}` });
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const onTogglePresence = useCallback(async () => {
    if (!me) {
      setToast({ kind: 'danger', text: 'Select which agent you are first.' });
      return;
    }
    const next = me.availabilityStatus === 'available' ? 'offline' : 'available';
    await runAction(`You are now ${next}`, () => setAgentAvailability(me.agentId, next));
  }, [me, runAction]);

  const queueAgeLabel = useCallback((escalation: Escalation) => timeAgo(escalation.escalatedAt), []);
  void tick; // queue ages recompute on each tick

  return (
    <Container>
      <IvrPageHeader
        title="Escalation console"
        description="Live queue of callers waiting for a human, with assignment and handover controls."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`badge badge-sm ${live ? 'badge-success' : 'badge-light'}`}
              title={live ? 'Receiving live updates' : 'Live feed disconnected — polling on actions only'}
            >
              {live ? 'Live' : 'Offline'}
            </span>
            <select
              className="select select-sm w-44"
              value={meAgentId}
              onChange={(event) => setMeAgentId(event.target.value)}
            >
              <option value="">I am…</option>
              {agents.map((agent) => (
                <option key={agent.agentId} value={agent.agentId}>
                  {agent.name}
                </option>
              ))}
            </select>
            <button className="btn btn-sm btn-light" onClick={onTogglePresence} disabled={busy || !me}>
              {me?.availabilityStatus === 'available' ? 'Go offline' : 'Go available'}
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => void load()} disabled={busy}>
              Refresh
            </button>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-4">
        <IvrStatCard label="Waiting" value={stats?.queued ?? 0} meta="Queued or pending" tone="amber" />
        <IvrStatCard label="In progress" value={(stats?.assigned ?? 0) + (stats?.accepted ?? 0)} meta="Assigned or accepted" tone="blue" />
        <IvrStatCard label="Avg wait" value={formatDuration(stats?.avgWaitSeconds ?? 0)} meta="Escalated → accepted" tone="teal" />
        <IvrStatCard
          label="Resolved today"
          value={stats?.resolvedToday ?? 0}
          meta={`Avg handle ${formatDuration(stats?.avgHandleSeconds ?? 0)}`}
          tone="teal"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card border border-gray-200 shadow-none dark:border-coal-100">
          <div className="card-header flex flex-wrap items-center justify-between gap-3">
            <h3 className="card-title">Queue</h3>
            <div className="flex flex-wrap gap-1">
              {(['open', 'queued', 'assigned', 'accepted', 'resolved', 'all'] as StatusFilter[]).map(
                (value) => (
                  <button
                    key={value}
                    className={`btn btn-sm ${statusFilter === value ? 'btn-primary' : 'btn-light'}`}
                    onClick={() => setStatusFilter(value)}
                  >
                    {value}
                  </button>
                )
              )}
            </div>
          </div>
          <div className="card-body overflow-x-auto p-0">
            <table className="table align-middle text-sm">
              <thead>
                <tr>
                  <th className="min-w-[220px]">Caller / reason</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Agent</th>
                  <th>Waiting</th>
                  <th className="text-end min-w-[240px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {escalations.length === 0 && (
                  <EmptyRow colSpan={6} text={busy ? 'Loading…' : 'No escalations for this filter.'} />
                )}
                {escalations.map((escalation) => {
                  const agent = agents.find((item) => item.agentId === escalation.assignedAgentId);
                  const isOpen = !escalation.closedAt;
                  return (
                    <tr
                      key={escalation.escalationId}
                      className={selected?.escalationId === escalation.escalationId ? 'bg-primary/5' : ''}
                    >
                      <td>
                        <button
                          className="text-start"
                          onClick={() => {
                            setSelected(escalation);
                            setNotes(escalation.resolutionNotes || '');
                          }}
                        >
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {escalation.callerIdentifier || 'Unknown caller'}
                            {escalation.callSid && (
                              <span className="ms-2 badge badge-sm badge-light">phone</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {escalation.escalationReason}
                          </div>
                        </button>
                      </td>
                      <td>
                        <Badge text={escalation.priority} className={PRIORITY_STYLES[escalation.priority]} />
                      </td>
                      <td>
                        <Badge text={escalation.status} className={STATUS_STYLES[escalation.status]} />
                      </td>
                      <td className="text-xs">
                        {agent ? agent.name : <span className="text-gray-500">unassigned</span>}
                      </td>
                      <td className="text-xs">
                        {escalation.acceptedAt
                          ? formatDuration(
                              Math.round(
                                (new Date(escalation.acceptedAt).getTime() -
                                  new Date(escalation.escalatedAt).getTime()) /
                                  1000
                              )
                            )
                          : queueAgeLabel(escalation)}
                      </td>
                      <td className="text-end">
                        <div className="flex flex-wrap justify-end gap-1">
                          <select
                            className="select select-sm w-32"
                            value={escalation.assignedAgentId || ''}
                            disabled={busy || !isOpen}
                            onChange={(event) => {
                              const agentId = event.target.value;
                              if (!agentId) return;
                              void runAction('Escalation assigned', () =>
                                assignEscalation(escalation.escalationId, agentId)
                              );
                            }}
                          >
                            <option value="">Assign…</option>
                            {assignableAgents.map((item) => (
                              <option key={item.agentId} value={item.agentId}>
                                {item.name} ({item.activeEscalations}/{item.maxConcurrent})
                              </option>
                            ))}
                          </select>
                          <button
                            className="btn btn-sm btn-primary"
                            disabled={busy || !isOpen || escalation.status === 'accepted'}
                            onClick={() =>
                              void runAction('Escalation accepted', () =>
                                acceptEscalation(escalation.escalationId, meAgentId || undefined)
                              )
                            }
                          >
                            Accept
                          </button>
                          <button
                            className="btn btn-sm btn-light"
                            disabled={busy || !isOpen}
                            onClick={() =>
                              void runAction('Escalation requeued', () =>
                                requeueEscalation(escalation.escalationId, 'returned by agent')
                              )
                            }
                          >
                            Requeue
                          </button>
                          <button
                            className="btn btn-sm btn-light"
                            disabled={busy || !isOpen}
                            onClick={() =>
                              void runAction('Escalation resolved', () =>
                                closeEscalation(escalation.escalationId, { outcome: 'resolved' })
                              )
                            }
                          >
                            Resolve
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-5 content-start">
          <div className="card border border-gray-200 shadow-none dark:border-coal-100">
            <div className="card-header">
              <h3 className="card-title">Handover details</h3>
            </div>
            <div className="card-body grid gap-3 text-sm">
              {!selected && (
                <div className="text-gray-600 dark:text-gray-400">
                  Select an escalation to see the caller context captured by the IVR.
                </div>
              )}
              {selected && (
                <>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500">Caller</div>
                    <div className="font-medium">{selected.callerIdentifier || 'Unknown'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500">Reason</div>
                    <div>{selected.escalationReason}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500">Raised</div>
                    <div>{formatDateTime(selected.escalatedAt)}</div>
                  </div>
                  {selected.transferTarget && (
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-500">Transferred to</div>
                      <div>{selected.transferTarget}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500">Conversation so far</div>
                    <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap rounded bg-gray-100 p-3 text-xs dark:bg-coal-500">
                      {selected.contextSummary || 'No transcript captured.'}
                    </pre>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-gray-500">
                      Resolution notes
                    </label>
                    <textarea
                      className="textarea mt-1 w-full"
                      rows={3}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="What was done for the caller?"
                    />
                  </div>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={busy || Boolean(selected.closedAt)}
                    onClick={() =>
                      void runAction('Escalation closed', async () => {
                        await closeEscalation(selected.escalationId, {
                          outcome: 'resolved',
                          resolutionNotes: notes || undefined
                        });
                        setSelected(null);
                        setNotes('');
                      })
                    }
                  >
                    Close with notes
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="card border border-gray-200 shadow-none dark:border-coal-100">
            <div className="card-header">
              <h3 className="card-title">Live activity</h3>
            </div>
            <div className="card-body grid gap-2 text-xs">
              {feed.length === 0 && (
                <div className="text-gray-600 dark:text-gray-400">
                  {live ? 'Waiting for events…' : 'Live feed disconnected.'}
                </div>
              )}
              {feed.map((event, index) => (
                <div key={`${event.at}-${index}`} className="flex items-start gap-2">
                  <span className="badge badge-sm badge-light">{event.type.replace('escalation.', '')}</span>
                  <div className="flex-1">
                    <div>{event.message || event.escalation?.escalationReason || event.agent?.name}</div>
                    <div className="text-gray-500">{formatDateTime(event.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <IvrToast toast={toast} />
    </Container>
  );
};

export { EscalationConsolePage };
