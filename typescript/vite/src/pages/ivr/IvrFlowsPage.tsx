import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Container, KeenIcon } from '@/components';
import {
  fetchIvrFlows,
  createIvrFlow,
  updateIvrFlow,
  getIvrEngineHealth,
  invalidateCache,
  type IvrFlow,
  type IvrEngineHealth,
} from './ivr-engine-api';
import { fetchDomains } from './api';
import type { DomainConfig } from './types';
import { IvrPageHeader, IvrStatCard, IvrToast, useToast, EmptyRow, formatDateTime } from './admin';

type Toast = { kind: 'success' | 'danger'; text: string } | null;

const NODE_TYPE_COLORS: Record<string, string> = {
  prompt: 'badge-primary',
  branch: 'badge-warning',
  action: 'badge-success',
  collect_input: 'badge-info',
  end: 'badge-danger',
};

export const IvrFlowsPage = () => {
  const navigate = useNavigate();
  const [flows, setFlows] = useState<IvrFlow[]>([]);
  const [domains, setDomains] = useState<DomainConfig[]>([]);
  const [health, setHealth] = useState<IvrEngineHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [filterDomain, setFilterDomain] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editFlow, setEditFlow] = useState<IvrFlow | null>(null);
  const [sortField, setSortField] = useState<string>('FlowCode');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Create form state
  const [formDomainCode, setFormDomainCode] = useState('');
  const [formFlowCode, setFormFlowCode] = useState('');
  const [formFlowName, setFormFlowName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsEntry, setFormIsEntry] = useState(false);

  useToast(toast, () => setToast(null));

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [flowItems, domainItems, healthData] = await Promise.all([
        fetchIvrFlows(filterDomain || undefined),
        fetchDomains(),
        getIvrEngineHealth(),
      ]);
      setFlows(flowItems);
      setDomains(domainItems);
      setHealth(healthData);
    } catch (error: any) {
      setToast({ kind: 'danger', text: `Failed to load: ${error.message}` });
    } finally {
      setBusy(false);
    }
  }, [filterDomain]);

  useEffect(() => { void load(); }, [load]);

  const sortedFlows = useMemo(() => {
    const sorted = [...flows];
    sorted.sort((a, b) => {
      const aVal = (a as any)[sortField] ?? '';
      const bVal = (b as any)[sortField] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [flows, sortField, sortDir]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => (
    <span className="ml-1 text-gray-400">
      {sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );

  const handleCreate = async () => {
    if (!formDomainCode || !formFlowCode || !formFlowName) {
      setToast({ kind: 'danger', text: 'Domain, Flow Code, and Flow Name are required.' });
      return;
    }
    setBusy(true);
    try {
      await createIvrFlow({
        domainCode: formDomainCode,
        flowCode: formFlowCode,
        flowName: formFlowName,
        description: formDescription || undefined,
        isEntryFlow: formIsEntry,
      });
      setToast({ kind: 'success', text: `Flow "${formFlowName}" created successfully.` });
      setShowCreate(false);
      resetForm();
      await load();
    } catch (error: any) {
      setToast({ kind: 'danger', text: `Create failed: ${error.message}` });
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async () => {
    if (!editFlow) return;
    setBusy(true);
    try {
      await updateIvrFlow(editFlow.FlowId, {
        flowName: formFlowName,
        description: formDescription || undefined,
        isEntryFlow: formIsEntry,
        isActive: editFlow.IsActive,
      });
      setToast({ kind: 'success', text: `Flow updated.` });
      setEditFlow(null);
      resetForm();
      await load();
    } catch (error: any) {
      setToast({ kind: 'danger', text: `Update failed: ${error.message}` });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (flow: IvrFlow) => {
    try {
      await updateIvrFlow(flow.FlowId, { isActive: !flow.IsActive });
      setToast({ kind: 'success', text: `Flow ${flow.IsActive ? 'deactivated' : 'activated'}.` });
      await load();
    } catch (error: any) {
      setToast({ kind: 'danger', text: error.message });
    }
  };

  const handleInvalidateCache = async () => {
    try {
      const result = await invalidateCache();
      setToast({ kind: 'success', text: result.message });
    } catch (error: any) {
      setToast({ kind: 'danger', text: error.message });
    }
  };

  const resetForm = () => {
    setFormDomainCode('');
    setFormFlowCode('');
    setFormFlowName('');
    setFormDescription('');
    setFormIsEntry(false);
  };

  const openEdit = (flow: IvrFlow) => {
    setEditFlow(flow);
    setFormFlowName(flow.FlowName);
    setFormDescription(flow.Description || '');
    setFormIsEntry(flow.IsEntryFlow);
    setShowCreate(false);
  };



  return (
    <Container className="container-fluid">
      <div className="grid gap-5 lg:gap-7.5">
        <IvrPageHeader
          title="IVR Flow Engine"
          description="Manage domain-driven IVR flows, nodes, and API integrations. All flows are database-configured with no hardcoded logic."
          actions={
            <div className="flex gap-2">
              <button className="btn btn-sm btn-light" onClick={handleInvalidateCache}>
                <KeenIcon icon="arrows-circle" className="me-1" /> Refresh Cache
              </button>
              <button className="btn btn-sm btn-primary" onClick={() => { setShowCreate(true); setEditFlow(null); resetForm(); }}>
                <KeenIcon icon="plus" className="me-1" /> New Flow
              </button>
            </div>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <IvrStatCard label="Total Flows" value={health?.engine.flows ?? 0} tone="blue" />
          <IvrStatCard label="Total Nodes" value={health?.engine.nodes ?? 0} tone="teal" />
          <IvrStatCard label="API Endpoints" value={health?.engine.endpoints ?? 0} tone="amber" />
          <IvrStatCard label="Errors (24h)" value={health?.engine.errorsLast24h ?? 0} tone="rose" />
        </div>

        {/* Create / Edit Form */}
        {(showCreate || editFlow) && (
          <div className="card p-5">
            <h3 className="text-base font-semibold mb-4">{editFlow ? 'Edit Flow' : 'Create New Flow'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {!editFlow && (
                <div>
                  <label className="form-label">Domain</label>
                  <select className="select w-full" value={formDomainCode} onChange={e => setFormDomainCode(e.target.value)}>
                    <option value="">Select domain...</option>
                    {domains.map(d => (
                      <option key={d.domain_id} value={d.domain_id}>{d.display_name} ({d.domain_id})</option>
                    ))}
                  </select>
                </div>
              )}
              {!editFlow && (
                <div>
                  <label className="form-label">Flow Code</label>
                  <input className="input w-full" placeholder="e.g. ecommerce-support" value={formFlowCode} onChange={e => setFormFlowCode(e.target.value)} />
                </div>
              )}
              <div>
                <label className="form-label">Flow Name</label>
                <input className="input w-full" placeholder="E-commerce Support Flow" value={formFlowName} onChange={e => setFormFlowName(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="form-label">Description</label>
                <textarea className="textarea w-full" rows={2} placeholder="Describe the flow purpose..." value={formDescription} onChange={e => setFormDescription(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" className="checkbox" checked={formIsEntry} onChange={e => setFormIsEntry(e.target.checked)} />
                <label className="form-label mb-0">Entry Flow (main flow for domain)</label>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn btn-sm btn-primary" onClick={editFlow ? handleUpdate : handleCreate} disabled={busy}>
                {editFlow ? 'Update' : 'Create'}
              </button>
              <button className="btn btn-sm btn-light" onClick={() => { setShowCreate(false); setEditFlow(null); resetForm(); }}>Cancel</button>
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
            <button className="btn btn-sm btn-light" onClick={load} disabled={busy}>
              <KeenIcon icon="arrows-circle" className="me-1" /> Reload
            </button>
          </div>
        </div>

        {/* Flows Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">IVR Flows ({sortedFlows.length})</h3>
          </div>
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="table table-auto w-full">
                <thead>
                  <tr>
                    <th className="cursor-pointer" onClick={() => handleSort('FlowCode')}>Flow Code <SortIcon field="FlowCode" /></th>
                    <th className="cursor-pointer" onClick={() => handleSort('FlowName')}>Flow Name <SortIcon field="FlowName" /></th>
                    <th className="cursor-pointer" onClick={() => handleSort('DomainCode')}>Domain <SortIcon field="DomainCode" /></th>
                    <th>Description</th>
                    <th className="cursor-pointer text-center" onClick={() => handleSort('NodeCount')}>Nodes <SortIcon field="NodeCount" /></th>
                    <th className="text-center">Entry</th>
                    <th className="text-center">Version</th>
                    <th className="text-center">Active</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFlows.length === 0 && <EmptyRow colSpan={9} text={busy ? 'Loading...' : 'No flows found.'} />}
                  {sortedFlows.map(flow => (
                    <tr key={flow.FlowId} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td>
                        <button
                          className="text-primary hover:underline font-medium"
                          onClick={() => navigate(`/ivr/flows/${flow.FlowId}`)}
                        >
                          {flow.FlowCode}
                        </button>
                      </td>
                      <td>{flow.FlowName}</td>
                      <td>
                        <span className="badge badge-sm badge-outline badge-primary">{flow.DomainCode || 'N/A'}</span>
                      </td>
                      <td className="max-w-[200px] truncate text-gray-500 text-xs">{flow.Description || '-'}</td>
                      <td className="text-center">
                        <span className="badge badge-sm badge-light">{flow.NodeCount ?? '?'}</span>
                      </td>
                      <td className="text-center">
                        {flow.IsEntryFlow ? <KeenIcon icon="check-circle" className="text-success" /> : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="text-center text-xs text-gray-500">v{flow.FlowVersion}</td>
                      <td className="text-center">
                        <button
                          className={`badge badge-sm ${flow.IsActive ? 'badge-success' : 'badge-danger'} cursor-pointer`}
                          onClick={() => handleToggleActive(flow)}
                        >
                          {flow.IsActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button className="btn btn-xs btn-light" onClick={() => navigate(`/ivr/flows/${flow.FlowId}`)}>
                            <KeenIcon icon="eye" className="text-sm" /> View
                          </button>
                          <button className="btn btn-xs btn-light" onClick={() => openEdit(flow)}>
                            <KeenIcon icon="pencil" className="text-sm" />
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
      </div>
      <IvrToast toast={toast} />
    </Container>
  );
};
