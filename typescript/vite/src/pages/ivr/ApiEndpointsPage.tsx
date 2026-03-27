import { useCallback, useEffect, useMemo, useState } from 'react';
import { Container, KeenIcon } from '@/components';
import {
  fetchApiEndpoints,
  createApiEndpoint,
  updateApiEndpoint,
  type DomainApiEndpoint,
} from './ivr-engine-api';
import { fetchDomains } from './api';
import type { DomainConfig } from './types';
import { IvrPageHeader, IvrToast, useToast, EmptyRow } from './admin';

type Toast = { kind: 'success' | 'danger'; text: string } | null;

const METHOD_COLORS: Record<string, string> = {
  GET: 'badge-success',
  POST: 'badge-primary',
  PUT: 'badge-warning',
  DELETE: 'badge-danger',
  PATCH: 'badge-info',
};

export const ApiEndpointsPage = () => {
  const [endpoints, setEndpoints] = useState<DomainApiEndpoint[]>([]);
  const [domains, setDomains] = useState<DomainConfig[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [filterDomain, setFilterDomain] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editEndpoint, setEditEndpoint] = useState<DomainApiEndpoint | null>(null);
  const [testResult, setTestResult] = useState<{ endpointId: number; status: string; body: string } | null>(null);

  // Form state
  const [formDomainCode, setFormDomainCode] = useState('');
  const [formEndpointCode, setFormEndpointCode] = useState('');
  const [formEndpointName, setFormEndpointName] = useState('');
  const [formHttpMethod, setFormHttpMethod] = useState('POST');
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formPath, setFormPath] = useState('');
  const [formAuthType, setFormAuthType] = useState('none');
  const [formTimeoutMs, setFormTimeoutMs] = useState(30000);
  const [formRetryCount, setFormRetryCount] = useState(2);

  useToast(toast, () => setToast(null));

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [ep, dom] = await Promise.all([
        fetchApiEndpoints(filterDomain || undefined),
        fetchDomains(),
      ]);
      setEndpoints(ep);
      setDomains(dom);
    } catch (error: any) {
      setToast({ kind: 'danger', text: error.message });
    } finally {
      setBusy(false);
    }
  }, [filterDomain]);

  useEffect(() => { void load(); }, [load]);

  const resetForm = () => {
    setFormDomainCode(''); setFormEndpointCode(''); setFormEndpointName('');
    setFormHttpMethod('POST'); setFormBaseUrl(''); setFormPath('');
    setFormAuthType('none'); setFormTimeoutMs(30000); setFormRetryCount(2);
  };

  const handleCreate = async () => {
    if (!formDomainCode || !formEndpointCode || !formEndpointName || !formBaseUrl) {
      setToast({ kind: 'danger', text: 'Domain, Code, Name, and Base URL are required.' });
      return;
    }
    setBusy(true);
    try {
      await createApiEndpoint({
        domainCode: formDomainCode, endpointCode: formEndpointCode,
        endpointName: formEndpointName, httpMethod: formHttpMethod,
        baseUrl: formBaseUrl, path: formPath, authType: formAuthType,
        timeoutMs: formTimeoutMs, retryCount: formRetryCount,
      });
      setToast({ kind: 'success', text: `Endpoint "${formEndpointCode}" created.` });
      setShowCreate(false);
      resetForm();
      await load();
    } catch (error: any) {
      setToast({ kind: 'danger', text: error.message });
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async () => {
    if (!editEndpoint) return;
    setBusy(true);
    try {
      await updateApiEndpoint(editEndpoint.EndpointId, {
        endpointName: formEndpointName,
        httpMethod: formHttpMethod,
        baseUrl: formBaseUrl,
        path: formPath,
        authType: formAuthType,
        timeoutMs: formTimeoutMs,
        retryCount: formRetryCount,
      });
      setToast({ kind: 'success', text: 'Endpoint updated.' });
      setEditEndpoint(null);
      resetForm();
      await load();
    } catch (error: any) {
      setToast({ kind: 'danger', text: error.message });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (ep: DomainApiEndpoint) => {
    try {
      await updateApiEndpoint(ep.EndpointId, { isActive: !ep.IsActive });
      setToast({ kind: 'success', text: `Endpoint ${ep.IsActive ? 'deactivated' : 'activated'}.` });
      await load();
    } catch (error: any) {
      setToast({ kind: 'danger', text: error.message });
    }
  };

  const handleTestEndpoint = async (ep: DomainApiEndpoint) => {
    setTestResult(null);
    try {
      const url = ep.BaseUrl + (ep.Path || '');
      const res = await fetch(url, {
        method: ep.HttpMethod,
        headers: { 'Content-Type': 'application/json' },
        body: ep.HttpMethod !== 'GET' ? JSON.stringify({}) : undefined,
      });
      const body = await res.text();
      setTestResult({ endpointId: ep.EndpointId, status: `${res.status} ${res.statusText}`, body: body.slice(0, 500) });
    } catch (error: any) {
      setTestResult({ endpointId: ep.EndpointId, status: 'ERROR', body: error.message });
    }
  };

  const openEdit = (ep: DomainApiEndpoint) => {
    setEditEndpoint(ep);
    setFormDomainCode(ep.DomainCode || '');
    setFormEndpointCode(ep.EndpointCode);
    setFormEndpointName(ep.EndpointName);
    setFormHttpMethod(ep.HttpMethod);
    setFormBaseUrl(ep.BaseUrl);
    setFormPath(ep.Path || '');
    setFormAuthType(ep.AuthType);
    setFormTimeoutMs(ep.TimeoutMs);
    setFormRetryCount(ep.RetryCount);
    setShowCreate(false);
  };

  return (
    <Container className="container-fluid">
      <div className="grid gap-5 lg:gap-7.5">
        <IvrPageHeader
          title="Domain API Endpoints"
          description="Configure REST API integrations for each domain. The IVR engine routes actions to these endpoints during flow execution."
          actions={
            <div className="flex gap-2">
              <button className="btn btn-sm btn-primary" onClick={() => { setShowCreate(true); setEditEndpoint(null); resetForm(); }}>
                <KeenIcon icon="plus" className="me-1" /> New Endpoint
              </button>
            </div>
          }
        />

        {/* Create / Edit Form */}
        {(showCreate || editEndpoint) && (
          <div className="card p-5">
            <h3 className="text-base font-semibold mb-4">{editEndpoint ? `Edit: ${editEndpoint.EndpointCode}` : 'Create New Endpoint'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {!editEndpoint && (
                <div>
                  <label className="form-label">Domain</label>
                  <select className="select w-full" value={formDomainCode} onChange={e => setFormDomainCode(e.target.value)}>
                    <option value="">Select domain...</option>
                    {domains.map(d => (
                      <option key={d.domain_id} value={d.domain_id}>{d.display_name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="form-label">Endpoint Code</label>
                <input className="input w-full" value={formEndpointCode} onChange={e => setFormEndpointCode(e.target.value)} disabled={!!editEndpoint} placeholder="e.g. check_balance" />
              </div>
              <div>
                <label className="form-label">Endpoint Name</label>
                <input className="input w-full" value={formEndpointName} onChange={e => setFormEndpointName(e.target.value)} placeholder="Check Account Balance" />
              </div>
              <div>
                <label className="form-label">HTTP Method</label>
                <select className="select w-full" value={formHttpMethod} onChange={e => setFormHttpMethod(e.target.value)}>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="form-label">Base URL</label>
                <input className="input w-full" value={formBaseUrl} onChange={e => setFormBaseUrl(e.target.value)} placeholder="http://localhost:8010/api/mock/banking/check-balance" />
              </div>
              <div>
                <label className="form-label">Path (optional)</label>
                <input className="input w-full" value={formPath} onChange={e => setFormPath(e.target.value)} placeholder="/v1/accounts" />
              </div>
              <div>
                <label className="form-label">Auth Type</label>
                <select className="select w-full" value={formAuthType} onChange={e => setFormAuthType(e.target.value)}>
                  <option value="none">None</option>
                  <option value="api_key">API Key</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                </select>
              </div>
              <div>
                <label className="form-label">Timeout (ms)</label>
                <input type="number" className="input w-full" value={formTimeoutMs} onChange={e => setFormTimeoutMs(Number(e.target.value))} />
              </div>
              <div>
                <label className="form-label">Retry Count</label>
                <input type="number" className="input w-full" value={formRetryCount} onChange={e => setFormRetryCount(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn btn-sm btn-primary" onClick={editEndpoint ? handleUpdate : handleCreate} disabled={busy}>
                {editEndpoint ? 'Update' : 'Create'}
              </button>
              <button className="btn btn-sm btn-light" onClick={() => { setShowCreate(false); setEditEndpoint(null); resetForm(); }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <label className="form-label mb-0 text-sm">Filter by Domain:</label>
            <select className="select min-w-[220px]" value={filterDomain} onChange={e => setFilterDomain(e.target.value)}>
              <option value="">All Domains</option>
              {domains.map(d => (
                <option key={d.domain_id} value={d.domain_id}>{d.display_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Endpoints Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">API Endpoints ({endpoints.length})</h3>
          </div>
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="table table-auto w-full">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Domain</th>
                    <th>Method</th>
                    <th>URL</th>
                    <th>Auth</th>
                    <th className="text-center">Timeout</th>
                    <th className="text-center">Active</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.length === 0 && <EmptyRow colSpan={9} text={busy ? 'Loading...' : 'No endpoints found.'} />}
                  {endpoints.map(ep => (
                    <tr key={ep.EndpointId} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="font-medium text-sm">{ep.EndpointCode}</td>
                      <td className="text-sm">{ep.EndpointName}</td>
                      <td>
                        <span className="badge badge-sm badge-outline badge-primary">{ep.DomainCode || 'N/A'}</span>
                      </td>
                      <td>
                        <span className={`badge badge-sm ${METHOD_COLORS[ep.HttpMethod] || 'badge-light'}`}>{ep.HttpMethod}</span>
                      </td>
                      <td className="max-w-[250px] truncate text-xs text-gray-500 font-mono">{ep.BaseUrl}{ep.Path || ''}</td>
                      <td className="text-xs">{ep.AuthType}</td>
                      <td className="text-center text-xs">{ep.TimeoutMs}ms</td>
                      <td className="text-center">
                        <button
                          className={`badge badge-sm ${ep.IsActive ? 'badge-success' : 'badge-danger'} cursor-pointer`}
                          onClick={() => handleToggleActive(ep)}
                        >
                          {ep.IsActive ? 'Active' : 'Off'}
                        </button>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button className="btn btn-xs btn-light" onClick={() => handleTestEndpoint(ep)} title="Test endpoint">
                            <KeenIcon icon="rocket" className="text-xs" />
                          </button>
                          <button className="btn btn-xs btn-light" onClick={() => openEdit(ep)}>
                            <KeenIcon icon="pencil" className="text-xs" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Test Result */}
            {testResult && (
              <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Test Result</span>
                  <button className="btn btn-xs btn-light" onClick={() => setTestResult(null)}>Close</button>
                </div>
                <div className="text-xs">
                  <span className={`badge badge-sm ${testResult.status.startsWith('2') ? 'badge-success' : 'badge-danger'} me-2`}>
                    {testResult.status}
                  </span>
                </div>
                <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto max-h-[200px]">
                  {testResult.body}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
      <IvrToast toast={toast} />
    </Container>
  );
};
