import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { KeenIcon } from '@/components';
import { fetchDomains, removeDomain } from './api';
import { EmptyRow, IvrPageHeader, IvrToast, useToast } from './admin';
import type { DomainConfig } from './types';

type Toast = { kind: 'success' | 'danger'; text: string } | null;

const DomainsPage = () => {
  const navigate = useNavigate();
  const [domains, setDomains] = useState<DomainConfig[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  useToast(toast, () => setToast(null));

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
    <div className="container-fluid grid gap-5">
      <IvrPageHeader
        title="Domains"
        description="Manage configured IVR domains, open test sessions, and jump into domain workspaces."
        actions={
          <>
            <button className="btn btn-light" onClick={() => void loadDomains()} disabled={busy}>
              Reload
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/domains/new')}>
              <KeenIcon icon="plus" className="me-2" />
              Create Domain
            </button>
            <button className="btn btn-success" onClick={() => navigate('/ivr/hospital')}>
              <KeenIcon icon="hospital" className="me-2" />
              Hospital Workspace
            </button>
          </>
        }
      />

      <div className="card border border-gray-200 shadow-none dark:border-coal-100">
        <div className="card-header flex-wrap gap-3 border-b border-gray-200 dark:border-coal-100">
          <div>
            <h3 className="card-title">Domains</h3>
            <div className="text-xs text-gray-600 mt-1">
              Manage domains here. Create/Edit and testing are in separate pages.
            </div>
          </div>
          <div className="ms-auto text-xs text-gray-600">{domains.length} configured domains</div>
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
              {domains.length === 0 && <EmptyRow colSpan={6} text={busy ? 'Loading domains...' : 'No domains found.'} />}
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

      <IvrToast toast={toast} />
    </div>
  );
};

export { DomainsPage };
