import { useCallback, useEffect, useState } from 'react';
import { Container, KeenIcon } from '@/components';
import {
  getActiveSessions,
  getErrorLogs,
  getIvrEngineHealth,
  endIvrSession,
  type IvrSession,
  type IvrEngineHealth,
} from './ivr-engine-api';
import { fetchDomains } from './api';
import type { DomainConfig } from './types';
import { IvrPageHeader, IvrStatCard, IvrToast, useToast, EmptyRow } from './admin';

type Toast = { kind: 'success' | 'danger'; text: string } | null;

interface ErrorLogEntry {
  ErrorId: number;
  DomainId: number | null;
  SessionId: string | null;
  ErrorType: string;
  ErrorMessage: string;
  StackTrace: string | null;
  EndpointId: number | null;
  NodeId: number | null;
  OccurredAt: string;
  IsResolved: boolean;
  DomainCode?: string;
}

export const IvrSessionsPage = () => {
  const [sessions, setSessions] = useState<IvrSession[]>([]);
  const [errors, setErrors] = useState<ErrorLogEntry[]>([]);
  const [health, setHealth] = useState<IvrEngineHealth | null>(null);
  const [domains, setDomains] = useState<DomainConfig[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [tab, setTab] = useState<'sessions' | 'errors'>('sessions');
  const [filterDomain, setFilterDomain] = useState('');

  useToast(toast, () => setToast(null));

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [sessResult, errResult, healthResult, domResult] = await Promise.all([
        getActiveSessions(),
        getErrorLogs(filterDomain || undefined, 50),
        getIvrEngineHealth(),
        fetchDomains(),
      ]);
      setSessions(sessResult.sessions || []);
      setErrors(errResult || []);
      setHealth(healthResult);
      setDomains(domResult);
    } catch (error: any) {
      setToast({ kind: 'danger', text: error.message });
    } finally {
      setBusy(false);
    }
  }, [filterDomain]);

  useEffect(() => { void load(); }, [load]);

  const handleEndSession = async (sessionId: string) => {
    if (!confirm(`End session ${sessionId.slice(-12)}?`)) return;
    try {
      await endIvrSession(sessionId);
      setToast({ kind: 'success', text: 'Session ended.' });
      await load();
    } catch (error: any) {
      setToast({ kind: 'danger', text: error.message });
    }
  };



  return (
    <Container className="container-fluid">
      <div className="grid gap-5 lg:gap-7.5">
        <IvrPageHeader
          title="IVR Sessions & Monitoring"
          description="Monitor active IVR sessions, view error logs, and track engine health."
          actions={
            <div className="flex gap-2">
              <button className="btn btn-sm btn-light" onClick={load} disabled={busy}>
                <KeenIcon icon="arrows-circle" className="me-1" /> Refresh
              </button>
            </div>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <IvrStatCard label="Active Sessions" value={sessions.length} tone="teal" />
          <IvrStatCard label="Errors (24h)" value={health?.engine.errorsLast24h ?? 0} tone="rose" />
          <IvrStatCard label="Loaded Flows" value={health?.engine.flows ?? 0} tone="blue" />
          <IvrStatCard label="API Endpoints" value={health?.engine.endpoints ?? 0} tone="amber" />
        </div>

        {/* Tab Switcher */}
        <div className="card p-4">
          <div className="flex items-center gap-4">
            <div className="btn-group">
              <button className={`btn btn-sm ${tab === 'sessions' ? 'btn-primary' : 'btn-light'}`} onClick={() => setTab('sessions')}>
                Active Sessions ({sessions.length})
              </button>
              <button className={`btn btn-sm ${tab === 'errors' ? 'btn-primary' : 'btn-light'}`} onClick={() => setTab('errors')}>
                Error Logs ({errors.length})
              </button>
            </div>
            {tab === 'errors' && (
              <select className="select min-w-[180px]" value={filterDomain} onChange={e => setFilterDomain(e.target.value)}>
                <option value="">All Domains</option>
                {domains.map(d => (
                  <option key={d.domain_id} value={d.domain_id}>{d.display_name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Sessions Tab */}
        {tab === 'sessions' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Active Sessions</h3>
            </div>
            <div className="card-body">
              <div className="overflow-x-auto">
                <table className="table table-auto w-full">
                  <thead>
                    <tr>
                      <th>Session ID</th>
                      <th>Domain</th>
                      <th>Current Node</th>
                      <th>Status</th>
                      <th>Variables</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.length === 0 && <EmptyRow colSpan={6} text={busy ? 'Loading...' : 'No active sessions.'} />}
                    {sessions.map(s => (
                      <tr key={s.sessionId}>
                        <td className="font-mono text-xs">{s.sessionId.slice(-16)}</td>
                        <td>
                          <span className="badge badge-sm badge-outline badge-primary">{s.domainCode}</span>
                        </td>
                        <td className="text-sm">{s.currentNode || '-'}</td>
                        <td>
                          <span className={`badge badge-sm ${s.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="text-xs max-w-[200px] truncate text-gray-500">
                          {s.variables ? Object.entries(s.variables).filter(([k]) => !k.startsWith('_')).map(([k, v]) => `${k}=${v}`).join(', ') : '-'}
                        </td>
                        <td>
                          <div className="flex justify-end">
                            <button className="btn btn-xs btn-danger" onClick={() => handleEndSession(s.sessionId)}>
                              End
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Errors Tab */}
        {tab === 'errors' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Error Logs</h3>
            </div>
            <div className="card-body">
              <div className="overflow-x-auto">
                <table className="table table-auto w-full">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Type</th>
                      <th>Message</th>
                      <th>Domain</th>
                      <th>Session</th>
                      <th>Occurred</th>
                      <th className="text-center">Resolved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errors.length === 0 && <EmptyRow colSpan={7} text={busy ? 'Loading...' : 'No errors found.'} />}
                    {errors.map(err => (
                      <tr key={err.ErrorId}>
                        <td className="text-xs">{err.ErrorId}</td>
                        <td>
                          <span className="badge badge-xs badge-danger">{err.ErrorType}</span>
                        </td>
                        <td className="max-w-[300px] truncate text-xs">{err.ErrorMessage}</td>
                        <td className="text-xs">{err.DomainCode || '-'}</td>
                        <td className="font-mono text-xs">{err.SessionId?.slice(-10) || '-'}</td>
                        <td className="text-xs text-gray-500">{new Date(err.OccurredAt).toLocaleString()}</td>
                        <td className="text-center">
                          <span className={`badge badge-xs ${err.IsResolved ? 'badge-success' : 'badge-warning'}`}>
                            {err.IsResolved ? 'Yes' : 'No'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
      <IvrToast toast={toast} />
    </Container>
  );
};
