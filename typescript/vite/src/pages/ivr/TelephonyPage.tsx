import { useCallback, useEffect, useMemo, useState } from 'react';
import { Container } from '@/components';
import {
  createPhoneNumber,
  deletePhoneNumber,
  fetchCallSessions,
  fetchDomains,
  fetchPhoneNumbers,
  fetchTelephonyConfig,
  updatePhoneNumber
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
import type { CallSession, DomainConfig, PhoneNumberMapping, TelephonyConfig } from './types';

type Toast = { kind: 'success' | 'danger'; text: string } | null;

const EMPTY_FORM = {
  phoneNumber: '',
  domainId: '',
  friendlyName: '',
  escalationNumber: '',
  escalationSkillGroup: '',
  greetingOverride: ''
};

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded bg-gray-100 px-2 py-1 text-xs dark:bg-coal-500">
          {value || '—'}
        </code>
        <button className="btn btn-sm btn-light" onClick={() => void onCopy()} disabled={!value}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

const TelephonyPage = () => {
  const [config, setConfig] = useState<TelephonyConfig | null>(null);
  const [numbers, setNumbers] = useState<PhoneNumberMapping[]>([]);
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [domains, setDomains] = useState<DomainConfig[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  useToast(toast, () => setToast(null));

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [configItem, numberItems, callItems, domainItems] = await Promise.all([
        fetchTelephonyConfig(),
        fetchPhoneNumbers(),
        fetchCallSessions(50),
        fetchDomains()
      ]);
      setConfig(configItem);
      setNumbers(numberItems);
      setCalls(callItems);
      setDomains(domainItems);
      setForm((prev) => ({
        ...prev,
        domainId:
          prev.domainId || domainItems.find((domain) => domain.domain_uuid)?.domain_uuid || ''
      }));
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to load telephony data: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const domainName = useCallback(
    (domainId: string | null) =>
      domains.find((domain) => domain.domain_uuid === domainId)?.display_name || domainId || '—',
    [domains]
  );

  const liveCalls = useMemo(() => calls.filter((call) => !call.endedAt).length, [calls]);

  // Only domains persisted in SQL carry a UUID, and the API requires one.
  const selectableDomains = useMemo(
    () => domains.filter((domain) => Boolean(domain.domain_uuid)),
    [domains]
  );

  const onCreate = useCallback(async () => {
    if (!form.phoneNumber.trim() || !form.domainId) {
      setToast({ kind: 'danger', text: 'A phone number and a domain are required.' });
      return;
    }
    setBusy(true);
    try {
      await createPhoneNumber({
        phoneNumber: form.phoneNumber.trim(),
        domainId: form.domainId,
        friendlyName: form.friendlyName.trim() || undefined,
        escalationNumber: form.escalationNumber.trim() || undefined,
        escalationSkillGroup: form.escalationSkillGroup.trim() || undefined,
        greetingOverride: form.greetingOverride.trim() || undefined
      });
      setForm({ ...EMPTY_FORM, domainId: form.domainId });
      setToast({ kind: 'success', text: 'Phone number connected to the IVR.' });
      await load();
    } catch (error) {
      setToast({ kind: 'danger', text: `Could not save number: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [form, load]);

  const onToggleActive = useCallback(
    async (mapping: PhoneNumberMapping) => {
      setBusy(true);
      try {
        await updatePhoneNumber(mapping.phoneNumberId, { isActive: !mapping.isActive });
        await load();
      } catch (error) {
        setToast({ kind: 'danger', text: `Update failed: ${getErrorText(error)}` });
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const onDelete = useCallback(
    async (mapping: PhoneNumberMapping) => {
      setBusy(true);
      try {
        await deletePhoneNumber(mapping.phoneNumberId);
        setToast({ kind: 'success', text: 'Number disconnected.' });
        await load();
      } catch (error) {
        setToast({ kind: 'danger', text: `Delete failed: ${getErrorText(error)}` });
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  return (
    <Container>
      <IvrPageHeader
        title="Telephony"
        description="Connect real phone numbers to an IVR domain and watch inbound calls."
        actions={
          <button className="btn btn-sm btn-primary" onClick={() => void load()} disabled={busy}>
            Refresh
          </button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-4">
        <IvrStatCard
          label="Provider"
          value={config?.provider ?? '—'}
          meta={config?.configured ? 'Credentials present' : 'Credentials missing'}
          tone={config?.configured ? 'teal' : 'rose'}
        />
        <IvrStatCard label="Numbers" value={numbers.length} meta="Mapped to a domain" tone="blue" />
        <IvrStatCard label="Live calls" value={liveCalls} meta="Currently in progress" tone="amber" />
        <IvrStatCard
          label="Signature check"
          value={config?.signatureValidation ? 'On' : 'Off'}
          meta={config?.signatureValidation ? 'Webhooks are verified' : 'VALIDATE_TWILIO_SIGNATURE=false'}
          tone={config?.signatureValidation ? 'teal' : 'amber'}
        />
      </div>

      {config && config.missing.length > 0 && (
        <div className="alert alert-warning mt-5">
          <div>
            <strong>Telephony is not fully configured.</strong> Missing environment variables:{' '}
            {config.missing.join(', ')}. Inbound calls will not reach the IVR until these are set on
            the backend.
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5 content-start">
          <div className="card border border-gray-200 shadow-none dark:border-coal-100">
            <div className="card-header">
              <h3 className="card-title">Connect a number</h3>
            </div>
            <div className="card-body grid gap-3 md:grid-cols-2">
              <div>
                <label className="form-label">Phone number (E.164)</label>
                <input
                  className="input"
                  placeholder="+14155550123"
                  value={form.phoneNumber}
                  onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Answering domain</label>
                <select
                  className="select"
                  value={form.domainId}
                  onChange={(event) => setForm({ ...form, domainId: event.target.value })}
                >
                  <option value="">Select a domain…</option>
                  {selectableDomains.map((domain) => (
                    <option key={domain.domain_uuid} value={domain.domain_uuid}>
                      {domain.display_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Friendly name</label>
                <input
                  className="input"
                  placeholder="Main hospital line"
                  value={form.friendlyName}
                  onChange={(event) => setForm({ ...form, friendlyName: event.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Escalation number</label>
                <input
                  className="input"
                  placeholder="+14155550199"
                  value={form.escalationNumber}
                  onChange={(event) => setForm({ ...form, escalationNumber: event.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Escalation skill group</label>
                <input
                  className="input"
                  placeholder="front-desk"
                  value={form.escalationSkillGroup}
                  onChange={(event) => setForm({ ...form, escalationSkillGroup: event.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Greeting override</label>
                <input
                  className="input"
                  placeholder="Leave blank to use the domain welcome message"
                  value={form.greetingOverride}
                  onChange={(event) => setForm({ ...form, greetingOverride: event.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <button className="btn btn-primary" onClick={() => void onCreate()} disabled={busy}>
                  Connect number
                </button>
              </div>
            </div>
          </div>

          <div className="card border border-gray-200 shadow-none dark:border-coal-100">
            <div className="card-header">
              <h3 className="card-title">Connected numbers</h3>
            </div>
            <div className="card-body overflow-x-auto p-0">
              <table className="table align-middle text-sm">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Domain</th>
                    <th>Escalates to</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {numbers.length === 0 && (
                    <EmptyRow colSpan={5} text={busy ? 'Loading…' : 'No numbers connected yet.'} />
                  )}
                  {numbers.map((mapping) => (
                    <tr key={mapping.phoneNumberId}>
                      <td>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {mapping.phoneNumber}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {mapping.friendlyName || '—'}
                        </div>
                      </td>
                      <td className="text-xs">{domainName(mapping.domainId)}</td>
                      <td className="text-xs">
                        {mapping.escalationNumber || <span className="text-gray-500">agent direct dial</span>}
                      </td>
                      <td>
                        <span className={`badge badge-sm ${mapping.isActive ? 'badge-success' : 'badge-light'}`}>
                          {mapping.isActive ? 'active' : 'disabled'}
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="flex justify-end gap-2">
                          <button
                            className="btn btn-sm btn-light"
                            onClick={() => void onToggleActive(mapping)}
                            disabled={busy}
                          >
                            {mapping.isActive ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            className="btn btn-sm btn-light"
                            onClick={() => void onDelete(mapping)}
                            disabled={busy}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card border border-gray-200 shadow-none dark:border-coal-100">
            <div className="card-header">
              <h3 className="card-title">Recent calls</h3>
            </div>
            <div className="card-body overflow-x-auto p-0">
              <table className="table align-middle text-sm">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Escalated</th>
                    <th>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.length === 0 && <EmptyRow colSpan={6} text="No calls recorded yet." />}
                  {calls.map((call) => (
                    <tr key={call.callId}>
                      <td className="text-xs">{call.fromNumber || '—'}</td>
                      <td className="text-xs">{call.toNumber || '—'}</td>
                      <td>
                        <span
                          className={`badge badge-sm ${
                            call.callStatus === 'completed' ? 'badge-light' : 'badge-primary'
                          }`}
                        >
                          {call.callStatus}
                        </span>
                      </td>
                      <td className="text-xs">
                        {call.durationSeconds != null ? `${call.durationSeconds}s` : '—'}
                      </td>
                      <td className="text-xs">
                        {call.escalationId ? (
                          <span className="badge badge-sm badge-warning">yes</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="text-xs">{formatDateTime(call.startedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card border border-gray-200 shadow-none dark:border-coal-100 h-fit">
          <div className="card-header">
            <h3 className="card-title">Provider setup</h3>
          </div>
          <div className="card-body grid gap-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              In the Twilio console, open your phone number and paste these URLs. Both must be
              reachable from the public internet — use a tunnel (ngrok, cloudflared) during
              development and set <code>PUBLIC_BASE_URL</code> to match.
            </p>
            <CopyField label="A call comes in (HTTP POST)" value={config?.webhooks.incomingCall || ''} />
            <CopyField label="Call status changes (HTTP POST)" value={config?.webhooks.statusCallback || ''} />
            <CopyField label="Media stream (set automatically)" value={config?.webhooks.mediaStream || ''} />
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <div>
                Caller ID for transfers: <strong>{config?.callerId || 'not set'}</strong>
              </div>
              <div>
                Fallback agent number: <strong>{config?.fallbackAgentNumber || 'not set'}</strong>
              </div>
              <div>
                Unmapped numbers answer as: <strong>{config?.defaultDomain || '—'}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <IvrToast toast={toast} />
    </Container>
  );
};

export { TelephonyPage };
