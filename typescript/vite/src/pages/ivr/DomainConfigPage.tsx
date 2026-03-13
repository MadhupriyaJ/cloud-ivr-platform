import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { KeenIcon } from '@/components';
import { fetchDomain, generateDomain, saveDomain } from './api';
import { EMPTY_DOMAIN, fromLines, toLines, toPayload } from './form';
import './ivr-admin.css';
import type { DomainPayload } from './types';

type Toast = { kind: 'success' | 'danger'; text: string } | null;

const DomainConfigPage = () => {
  const navigate = useNavigate();
  const { domainId } = useParams();
  const isCreateMode = !domainId;

  const [form, setForm] = useState<DomainPayload>(EMPTY_DOMAIN);
  const [intentsText, setIntentsText] = useState('');
  const [rulesText, setRulesText] = useState('');
  const [complianceText, setComplianceText] = useState('');
  const [seedDomainName, setSeedDomainName] = useState('');
  const [seedOrganization, setSeedOrganization] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const pageTitle = useMemo(
    () => (isCreateMode ? 'Create + Configure Domain' : `Configure: ${domainId}`),
    [domainId, isCreateMode]
  );

  const loadDomain = useCallback(async () => {
    if (!domainId) {
      setForm(EMPTY_DOMAIN);
      setIntentsText('');
      setRulesText('');
      setComplianceText('');
      return;
    }

    setBusy(true);
    try {
      const domain = await fetchDomain(domainId);
      const payload = toPayload(domain);
      setForm(payload);
      setSeedDomainName(domain.display_name || domain.domain_id);
      setSeedOrganization(domain.organization_name || '');
      setIntentsText(toLines(payload.intents));
      setRulesText(toLines(payload.rules));
      setComplianceText(toLines(payload.compliance));
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to load domain: ${String(error)}` });
    } finally {
      setBusy(false);
    }
  }, [domainId]);

  useEffect(() => {
    void loadDomain();
  }, [loadDomain]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const onGenerate = useCallback(async () => {
    if (!seedDomainName.trim()) return;
    setBusy(true);
    try {
      const created = await generateDomain(seedDomainName, seedOrganization);
      setToast({ kind: 'success', text: `Generated '${created.domain_id}'.` });
      navigate(`/domains/${created.domain_id}/config`, { replace: true });
    } catch (error) {
      setToast({ kind: 'danger', text: `Generate failed: ${String(error)}` });
    } finally {
      setBusy(false);
    }
  }, [navigate, seedDomainName, seedOrganization]);

  const onSave = useCallback(async () => {
    if (!form.domain_id.trim()) {
      setToast({ kind: 'danger', text: 'Generate/create domain first, then save config.' });
      return;
    }

    setBusy(true);
    try {
      const payload: DomainPayload = {
        ...form,
        intents: fromLines(intentsText),
        rules: fromLines(rulesText),
        compliance: fromLines(complianceText)
      };
      const saved = await saveDomain(form.domain_id, payload);
      setToast({ kind: 'success', text: `Saved '${saved.domain_id}'. Redirecting to test...` });
      navigate(`/domains/${saved.domain_id}/test`);
    } catch (error) {
      setToast({ kind: 'danger', text: `Save failed: ${String(error)}` });
    } finally {
      setBusy(false);
    }
  }, [complianceText, form, intentsText, navigate, rulesText]);

  return (
    <div className="ivr-admin-shell">
      <div className="card">
        <div className="card-header flex-wrap items-start md:items-center gap-3">
          <div>
            <h3 className="card-title">{pageTitle}</h3>
            <div className="text-xs text-gray-600 mt-1">
              Domain creation and configuration are in one page. Save will move to IVR test.
            </div>
          </div>
          <div className="flex w-full gap-2 md:ms-auto md:w-auto">
            <button className="btn btn-light" onClick={() => navigate('/domains')}>
              Back to Domains
            </button>
            {!isCreateMode && (
              <button className="btn btn-primary" onClick={() => navigate(`/domains/${form.domain_id}/test`)}>
                <KeenIcon icon="phone" className="me-2" />
                Go to Test
              </button>
            )}
          </div>
        </div>
        <div className="card-body flex flex-col gap-4">
          {isCreateMode && (
            <div className="grid md:grid-cols-[1fr_1fr_auto] md:items-end gap-3 border border-gray-200 rounded-xl p-4 bg-light">
              <label className="form-label flex-col">
                Domain Name
                <input
                  className="input mt-1.5"
                  value={seedDomainName}
                  placeholder="hospital, bank, insurance..."
                  onChange={(event) => setSeedDomainName(event.target.value)}
                />
              </label>
              <label className="form-label flex-col">
                Organization Name
                <input
                  className="input mt-1.5"
                  value={seedOrganization}
                  placeholder="Optional"
                  onChange={(event) => setSeedOrganization(event.target.value)}
                />
              </label>
              <div className="flex w-full md:w-auto">
                <button
                  className="btn btn-primary w-full md:w-auto"
                  onClick={onGenerate}
                  disabled={busy || !seedDomainName.trim()}
                >
                  <KeenIcon icon="magic-star" className="me-2" />
                  Generate Configuration
                </button>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <label className="form-label flex-col">
              Domain ID
              <input
                className="input mt-1.5"
                value={form.domain_id}
                disabled={!isCreateMode}
                onChange={(event) => setForm((prev) => ({ ...prev, domain_id: event.target.value }))}
              />
            </label>
            <label className="form-label flex-col">
              Display Name
              <input
                className="input mt-1.5"
                value={form.display_name}
                onChange={(event) => setForm((prev) => ({ ...prev, display_name: event.target.value }))}
              />
            </label>
            <label className="form-label flex-col">
              Industry
              <input
                className="input mt-1.5"
                value={form.industry}
                onChange={(event) => setForm((prev) => ({ ...prev, industry: event.target.value }))}
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
            <label className="form-label flex-col">
              Voice
              <input
                className="input mt-1.5"
                value={form.voice}
                onChange={(event) => setForm((prev) => ({ ...prev, voice: event.target.value }))}
              />
            </label>
            <label className="form-label flex-col">
              Language
              <input
                className="input mt-1.5"
                value={form.language}
                onChange={(event) => setForm((prev) => ({ ...prev, language: event.target.value }))}
              />
            </label>
          </div>

          <label className="form-label flex-col">
            Welcome Message
            <textarea
              className="textarea mt-1.5"
              rows={2}
              value={form.welcome_message}
              onChange={(event) => setForm((prev) => ({ ...prev, welcome_message: event.target.value }))}
            />
          </label>

          <div className="grid xl:grid-cols-2 gap-4">
            <label className="form-label flex-col">
              Intents (one per line)
              <textarea
                className="textarea mt-1.5"
                rows={5}
                value={intentsText}
                onChange={(event) => setIntentsText(event.target.value)}
              />
            </label>
            <label className="form-label flex-col">
              Rules (one per line)
              <textarea
                className="textarea mt-1.5"
                rows={5}
                value={rulesText}
                onChange={(event) => setRulesText(event.target.value)}
              />
            </label>
            <label className="form-label flex-col">
              Compliance (one per line)
              <textarea
                className="textarea mt-1.5"
                rows={5}
                value={complianceText}
                onChange={(event) => setComplianceText(event.target.value)}
              />
            </label>
            <label className="form-label flex-col">
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
            <button className="btn btn-primary" onClick={onSave} disabled={busy}>
              <KeenIcon icon="check" className="me-2" />
              Save and Open Test
            </button>
            <button className="btn btn-light" onClick={() => void loadDomain()} disabled={busy}>
              Reload
            </button>
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

export { DomainConfigPage };
