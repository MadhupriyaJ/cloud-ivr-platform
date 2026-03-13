import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeenIcon } from '@/components';
import { fetchDomains, generateDomain, removeDomain, saveDomain } from './api';
import { useRealtimeIvr } from './useRealtimeIvr';
import type { DomainConfig, DomainPayload } from './types';

type Toast = { kind: 'success' | 'danger'; text: string } | null;

const EMPTY_DOMAIN: DomainPayload = {
  domain_id: '',
  display_name: '',
  industry: '',
  organization_name: '',
  voice: 'alloy',
  language: 'English',
  welcome_message: '',
  intents: [],
  rules: [],
  compliance: [],
  escalation_message: 'Connecting you to an operator.',
  active: true
};

const toLines = (items: string[]): string => items.join('\n');
const fromLines = (raw: string): string[] =>
  raw
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const toPayload = (domain: DomainConfig): DomainPayload => ({
  domain_id: domain.domain_id,
  display_name: domain.display_name,
  industry: domain.industry,
  organization_name: domain.organization_name,
  voice: domain.voice,
  language: domain.language,
  welcome_message: domain.welcome_message,
  intents: domain.intents,
  rules: domain.rules,
  compliance: domain.compliance,
  escalation_message: domain.escalation_message,
  active: domain.active
});

const IvrStudioPage = () => {
  const { status, logs, start, stop, clearLogs } = useRealtimeIvr();

  const [domains, setDomains] = useState<DomainConfig[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [form, setForm] = useState<DomainPayload>(EMPTY_DOMAIN);
  const [intentsText, setIntentsText] = useState('');
  const [rulesText, setRulesText] = useState('');
  const [complianceText, setComplianceText] = useState('');
  const [newDomainName, setNewDomainName] = useState('');
  const [newOrgName, setNewOrgName] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

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

  const selectedDomain = useMemo(
    () => domains.find((item) => item.domain_id === selectedDomainId) ?? null,
    [domains, selectedDomainId]
  );

  const loadDomains = useCallback(
    async (preferredDomainId?: string) => {
      setBusy(true);
      try {
        const items = await fetchDomains();
        setDomains(items);
        if (items.length === 0) {
          setSelectedDomainId('');
          setForm(EMPTY_DOMAIN);
          setIntentsText('');
          setRulesText('');
          setComplianceText('');
          return;
        }

        const targetId = preferredDomainId || selectedDomainId || items[0].domain_id;
        const active = items.find((item) => item.domain_id === targetId) || items[0];
        setSelectedDomainId(active.domain_id);
        setForm(toPayload(active));
        setIntentsText(toLines(active.intents));
        setRulesText(toLines(active.rules));
        setComplianceText(toLines(active.compliance));
      } catch (error) {
        setToast({ kind: 'danger', text: `Failed to load domains: ${String(error)}` });
      } finally {
        setBusy(false);
      }
    },
    [selectedDomainId]
  );

  useEffect(() => {
    void loadDomains();
  }, [loadDomains]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const selectDomain = useCallback(
    (domainId: string) => {
      const selected = domains.find((item) => item.domain_id === domainId);
      if (!selected) return;
      setSelectedDomainId(selected.domain_id);
      setForm(toPayload(selected));
      setIntentsText(toLines(selected.intents));
      setRulesText(toLines(selected.rules));
      setComplianceText(toLines(selected.compliance));
      clearLogs();
    },
    [clearLogs, domains]
  );

  const onGenerate = useCallback(async () => {
    if (!newDomainName.trim()) return;
    setBusy(true);
    try {
      const created = await generateDomain(newDomainName, newOrgName);
      setNewDomainName('');
      setNewOrgName('');
      setToast({ kind: 'success', text: `Domain '${created.domain_id}' created.` });
      await loadDomains(created.domain_id);
    } catch (error) {
      setToast({ kind: 'danger', text: `Generation failed: ${String(error)}` });
    } finally {
      setBusy(false);
    }
  }, [loadDomains, newDomainName, newOrgName]);

  const onSave = useCallback(async () => {
    if (!form.domain_id.trim()) return;
    setBusy(true);
    try {
      const payload: DomainPayload = {
        ...form,
        intents: fromLines(intentsText),
        rules: fromLines(rulesText),
        compliance: fromLines(complianceText)
      };
      const saved = await saveDomain(form.domain_id, payload);
      setToast({ kind: 'success', text: `Domain '${saved.domain_id}' saved.` });
      await loadDomains(saved.domain_id);
    } catch (error) {
      setToast({ kind: 'danger', text: `Save failed: ${String(error)}` });
    } finally {
      setBusy(false);
    }
  }, [complianceText, form, intentsText, loadDomains, rulesText]);

  const onDelete = useCallback(async () => {
    if (!selectedDomainId || domains.length <= 1) return;
    if (!window.confirm(`Delete domain '${selectedDomainId}'?`)) return;

    setBusy(true);
    try {
      await removeDomain(selectedDomainId);
      setToast({ kind: 'success', text: `Domain '${selectedDomainId}' deleted.` });
      await loadDomains();
    } catch (error) {
      setToast({ kind: 'danger', text: `Delete failed: ${String(error)}` });
    } finally {
      setBusy(false);
    }
  }, [domains.length, loadDomains, selectedDomainId]);

  return (
    <div className="grid xl:grid-cols-[320px_1fr] gap-5 lg:gap-7.5">
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Domain Control</h3>
        </div>
        <div className="card-body flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">Realtime Session</div>
            <span className={statusClass}>{statusLabel}</span>
          </div>

          <div className="border border-gray-200 rounded-xl p-4 bg-light">
            <div className="text-sm font-semibold text-gray-900 mb-3">Create new domain</div>
            <div className="flex flex-col gap-2.5">
              <input
                className="input"
                placeholder="Domain name (bank, hospital...)"
                value={newDomainName}
                onChange={(event) => setNewDomainName(event.target.value)}
              />
              <input
                className="input"
                placeholder="Organization name"
                value={newOrgName}
                onChange={(event) => setNewOrgName(event.target.value)}
              />
              <button
                className="btn btn-primary justify-center"
                onClick={onGenerate}
                disabled={busy || !newDomainName.trim()}
              >
                <KeenIcon icon="plus" className="me-2" />
                Generate IVR
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold text-gray-900">Available domains</div>
            <div className="max-h-[420px] overflow-auto pe-1 flex flex-col gap-2">
              {domains.map((item) => (
                <button
                  key={item.domain_id}
                  onClick={() => selectDomain(item.domain_id)}
                  className={`btn flex-col items-start !h-auto !py-3 !px-3 !justify-start border ${
                    item.domain_id === selectedDomainId
                      ? 'btn-primary'
                      : 'btn-light border-gray-200 text-gray-800'
                  }`}
                >
                  <span className="font-semibold">{item.display_name}</span>
                  <span className="text-xs opacity-80">{item.domain_id}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:gap-7.5">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Domain Configuration</h3>
          </div>
          <div className="card-body flex flex-col gap-4">
            <div className="grid md:grid-cols-2 gap-4">
              <label className="form-label">
                Domain ID
                <input className="input mt-1.5" value={form.domain_id} disabled />
              </label>
              <label className="form-label">
                Display Name
                <input
                  className="input mt-1.5"
                  value={form.display_name}
                  onChange={(event) => setForm((prev) => ({ ...prev, display_name: event.target.value }))}
                />
              </label>
              <label className="form-label">
                Industry
                <input
                  className="input mt-1.5"
                  value={form.industry}
                  onChange={(event) => setForm((prev) => ({ ...prev, industry: event.target.value }))}
                />
              </label>
              <label className="form-label">
                Organization
                <input
                  className="input mt-1.5"
                  value={form.organization_name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, organization_name: event.target.value }))
                  }
                />
              </label>
              <label className="form-label">
                Voice
                <input
                  className="input mt-1.5"
                  value={form.voice}
                  onChange={(event) => setForm((prev) => ({ ...prev, voice: event.target.value }))}
                />
              </label>
              <label className="form-label">
                Language
                <input
                  className="input mt-1.5"
                  value={form.language}
                  onChange={(event) => setForm((prev) => ({ ...prev, language: event.target.value }))}
                />
              </label>
            </div>

            <label className="form-label">
              Welcome Message
              <textarea
                className="textarea mt-1.5"
                rows={2}
                value={form.welcome_message}
                onChange={(event) => setForm((prev) => ({ ...prev, welcome_message: event.target.value }))}
              />
            </label>

            <div className="grid xl:grid-cols-2 gap-4">
              <label className="form-label">
                Intents (one per line)
                <textarea
                  className="textarea mt-1.5"
                  rows={5}
                  value={intentsText}
                  onChange={(event) => setIntentsText(event.target.value)}
                />
              </label>
              <label className="form-label">
                Rules (one per line)
                <textarea
                  className="textarea mt-1.5"
                  rows={5}
                  value={rulesText}
                  onChange={(event) => setRulesText(event.target.value)}
                />
              </label>
              <label className="form-label">
                Compliance (one per line)
                <textarea
                  className="textarea mt-1.5"
                  rows={5}
                  value={complianceText}
                  onChange={(event) => setComplianceText(event.target.value)}
                />
              </label>
              <label className="form-label">
                Escalation Message
                <textarea
                  className="textarea mt-1.5"
                  rows={5}
                  value={form.escalation_message}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, escalation_message: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button className="btn btn-primary" onClick={onSave} disabled={busy || !selectedDomain}>
                <KeenIcon icon="check" className="me-2" />
                Save Domain
              </button>
              <button
                className="btn btn-danger"
                onClick={onDelete}
                disabled={busy || domains.length <= 1}
              >
                <KeenIcon icon="trash" className="me-2" />
                Delete Domain
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Realtime IVR Console</h3>
          </div>
          <div className="card-body flex flex-col gap-4">
            <div className="text-sm text-gray-700">
              Active domain:{' '}
              <span className="font-semibold text-gray-900">
                {selectedDomain?.display_name ?? 'No domain selected'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                className="btn btn-primary"
                onClick={() => start(selectedDomainId)}
                disabled={status !== 'idle' || !selectedDomainId}
              >
                <KeenIcon icon="phone" className="me-2" />
                Start Session
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
            <div className="rounded-xl border border-gray-200 bg-gray-900 p-4 text-sm text-gray-100 overflow-auto min-h-[260px] max-h-[400px]">
              {logs.length === 0 ? (
                <div className="text-gray-500">Logs will appear here.</div>
              ) : (
                logs.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)
              )}
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[100]">
          <div className={`alert ${toast.kind === 'success' ? 'alert-success' : 'alert-danger'}`}>
            {toast.text}
          </div>
        </div>
      )}
    </div>
  );
};

export { IvrStudioPage };
