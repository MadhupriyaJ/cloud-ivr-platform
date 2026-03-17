import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { KeenIcon } from '@/components';
import { fetchDomains } from './api';
import { IvrPageHeader } from './admin';
import { useRealtimeIvr } from './useRealtimeIvr';
import type { DomainConfig } from './types';

const LAST_TESTED_DOMAIN_KEY = 'ivr:last_tested_domain_id';

const DomainTestPage = () => {
  const { domainId } = useParams();
  const navigate = useNavigate();
  const { status, logs, avatarReady, setAvatarVideoElement, start, stop, clearLogs } =
    useRealtimeIvr();
  const [domains, setDomains] = useState<DomainConfig[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState('');
  const avatarVideoRef = useRef<HTMLVideoElement | null>(null);

  const statusClass = useMemo(() => {
    if (status === 'connected') return 'badge badge-success badge-outline';
    if (status === 'connecting') return 'badge badge-warning badge-outline';
    return 'badge badge-secondary badge-outline';
  }, [status]);

  const statusLabel = useMemo(() => {
    if (status === 'connected') return 'Live';
    if (status === 'connecting') return 'Connecting';
    return 'Idle';
  }, [status]);

  const loadDomains = useCallback(async () => {
    setBusy(true);
    setLoadError('');
    try {
      const items = await fetchDomains();
      setDomains(items);
    } catch (error) {
      setLoadError(`Failed to load domains: ${String(error)}`);
    } finally {
      setLoadedOnce(true);
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadDomains();
  }, [loadDomains]);

  useEffect(() => {
    if (!domainId) return;
    localStorage.setItem(LAST_TESTED_DOMAIN_KEY, domainId);
  }, [domainId]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  useEffect(() => {
    setAvatarVideoElement(avatarVideoRef.current);
    return () => setAvatarVideoElement(null);
  }, [setAvatarVideoElement]);

  const selectedDomain = useMemo(
    () => domains.find((item) => item.domain_id === domainId) ?? null,
    [domainId, domains]
  );

  if (!domainId) {
    const remembered = localStorage.getItem(LAST_TESTED_DOMAIN_KEY);
    if (remembered) {
      return <Navigate to={`/domains/${remembered}/test`} replace />;
    }
    if (!loadedOnce) {
      return <div className="text-sm text-gray-600">Loading IVR test...</div>;
    }
    const fallback = domains[0]?.domain_id;
    if (fallback) {
      return <Navigate to={`/domains/${fallback}/test`} replace />;
    }
    return <Navigate to="/domains" replace />;
  }

  return (
    <div className="container-fluid grid gap-5 xl:grid-cols-[320px_1fr]">
      <div className="xl:col-span-2">
        <IvrPageHeader
          title="Realtime IVR Test"
          description={selectedDomain ? `Live testing for ${selectedDomain.display_name}` : 'Load a domain and start a realtime IVR session.'}
          actions={
            <span className={`${statusClass}`}>{statusLabel}</span>
          }
        />
      </div>
      <div className="card border border-gray-200 shadow-none dark:border-coal-100">
        <div className="card-header border-b border-gray-200 dark:border-coal-100">
          <h3 className="card-title">Available Domains</h3>
        </div>
        <div className="card-body flex flex-col gap-3">
          <button className="btn btn-light justify-center" onClick={() => navigate('/domains')}>
            <KeenIcon icon="left" className="me-2" />
            Back to Domains
          </button>
          <button
            className="btn btn-primary justify-center"
            onClick={() => navigate(`/domains/${domainId}/config`)}
          >
            <KeenIcon icon="setting-2" className="me-2" />
            Edit This Domain
          </button>

          <div className="text-xs text-gray-600 mt-1">Switch domain and test immediately.</div>
          <div className="max-h-[560px] overflow-auto pe-1 flex flex-col gap-2">
            {domains.map((item) => (
              <button
                key={item.domain_id}
                onClick={() => navigate(`/domains/${item.domain_id}/test`)}
                className={`btn flex-col items-start !h-auto !py-3 !px-3 !justify-start border ${
                  item.domain_id === domainId
                    ? 'btn-primary'
                    : 'btn-light border-gray-200 text-gray-800'
                }`}
              >
                <span className="font-semibold">{item.display_name}</span>
                <span className="text-xs opacity-80">{item.domain_id}</span>
              </button>
            ))}
          </div>
          {busy && <div className="text-xs text-gray-600">Loading domains...</div>}
          {loadError && <div className="text-xs text-danger">{loadError}</div>}
        </div>
      </div>

      <div className="card border border-gray-200 shadow-none dark:border-coal-100">
        <div className="card-header flex-wrap gap-2 border-b border-gray-200 dark:border-coal-100">
          <div>
            <h3 className="card-title">Realtime IVR Test</h3>
            <div className="text-xs text-gray-600 mt-1">
              Domain: <span className="font-semibold text-gray-800">{selectedDomain?.display_name || domainId}</span>
            </div>
          </div>
          <span className={`${statusClass} ms-auto xl:hidden`}>{statusLabel}</span>
        </div>
        <div className="card-body flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-light p-4">
              <div className="text-xs text-gray-600">Connection State</div>
              <div className="mt-2 font-semibold text-gray-900">{statusLabel}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-light p-4">
              <div className="text-xs text-gray-600">Domain Code</div>
              <div className="mt-2 font-semibold text-gray-900">{domainId}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-light p-4">
              <div className="text-xs text-gray-600">Log Entries</div>
              <div className="mt-2 font-semibold text-gray-900">{logs.length}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              className="btn btn-primary"
              onClick={() => start(domainId)}
              disabled={status !== 'idle'}
            >
              <KeenIcon icon="phone" className="me-2" />
              Start Session with Avatar
            </button>
            <button className="btn btn-warning" onClick={stop} disabled={status === 'idle'}>
              <KeenIcon icon="cross-circle" className="me-2" />
              Stop Session
            </button>
            <button className="btn btn-light" onClick={clearLogs}>
              <KeenIcon icon="eraser" className="me-2" />
              Clear Logs
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 bg-light p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Azure Avatar</div>
                <div className="mt-1 text-xs text-gray-600">
                  {avatarReady
                    ? 'Avatar connected and speaking.'
                    : 'Avatar will connect when the session starts.'}
                </div>
              </div>
              <span
                className={`badge badge-sm ${avatarReady ? 'badge-success' : 'badge-secondary'}`}
              >
                {avatarReady ? 'Ready' : 'Idle'}
              </span>
            </div>

            <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-xl bg-gray-950">
              <video
                ref={avatarVideoRef}
                autoPlay
                playsInline
                muted={false}
                className="h-full w-full object-cover"
              />
              {!avatarReady && (
                <div className="absolute px-4 text-center text-xs text-gray-400">
                  Avatar will connect after clicking the Start Session button.
                </div>
              )}
            </div>
          </div>

          <div className="min-h-[420px] overflow-auto rounded-xl border border-gray-200 bg-gray-900 p-4 text-sm text-gray-100">
            {logs.length === 0 ? (
              <div className="text-gray-500">Logs will appear here.</div>
            ) : (
              logs.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export { DomainTestPage, LAST_TESTED_DOMAIN_KEY };
