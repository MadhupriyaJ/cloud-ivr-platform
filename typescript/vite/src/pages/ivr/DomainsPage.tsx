import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { KeenIcon } from '@/components';
import { fetchDomains, removeDomain } from './api';
import './ivr-admin.css';
import type { DomainConfig } from './types';

type Toast = { kind: 'success' | 'danger'; text: string } | null;

const DomainsPage = () => {
  const navigate = useNavigate();
  const [domains, setDomains] = useState<DomainConfig[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const loadDomains = useCallback(async () => {
    setBusy(true);
    try {
      const items = await fetchDomains();
      setDomains(items);
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to load domains: ${String(error)}` });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadDomains();
  }, [loadDomains]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const onDelete = useCallback(
    async (domainId: string) => {
      if (!window.confirm(`Delete domain '${domainId}'?`)) return;
      setBusy(true);
      try {
        await removeDomain(domainId);
        setToast({ kind: 'success', text: `Domain '${domainId}' deleted.` });
        await loadDomains();
      } catch (error) {
        setToast({ kind: 'danger', text: `Delete failed: ${String(error)}` });
      } finally {
        setBusy(false);
      }
    },
    [loadDomains]
  );

  return (
    <div className="ivr-admin-shell">
      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h3 className="card-title">Domains</h3>
            <div className="text-xs text-gray-600 mt-1">
              Manage domains here. Create/Edit and testing are in separate pages.
            </div>
          </div>
          <div className="ms-auto">
            <button className="btn btn-primary" onClick={() => navigate('/domains/new')}>
              <KeenIcon icon="plus" className="me-2" />
              Create Domain
            </button>
          </div>
        </div>
        <div className="card-table scrollable-x-auto pb-3">
          <table className="table table-auto table-border align-middle text-sm">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Industry</th>
                <th>Organization</th>
                <th>Status</th>
                <th>Updated</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {domains.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-600 py-8">
                    {busy ? 'Loading domains...' : 'No domains found.'}
                  </td>
                </tr>
              )}
              {domains.map((domain) => (
                <tr key={domain.domain_id}>
                  <td>
                    <div className="font-semibold text-gray-900">{domain.display_name}</div>
                    <div className="text-xs text-gray-600">{domain.domain_id}</div>
                  </td>
                  <td>{domain.industry || '-'}</td>
                  <td>{domain.organization_name || '-'}</td>
                  <td>
                    <span
                      className={`badge ${
                        domain.active ? 'badge-success badge-outline' : 'badge-secondary badge-outline'
                      }`}
                    >
                      {domain.active ? 'Active' : 'Draft'}
                    </span>
                  </td>
                  <td>{new Date(domain.updated_at).toLocaleString()}</td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="btn btn-sm btn-light"
                        onClick={() => navigate(`/domains/${domain.domain_id}`)}
                      >
                        View
                      </button>
                      <button
                        className="btn btn-sm btn-light"
                        onClick={() => navigate(`/domains/${domain.domain_id}/config`)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => navigate(`/domains/${domain.domain_id}/test`)}
                      >
                        Test
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => void onDelete(domain.domain_id)}
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

export { DomainsPage };
