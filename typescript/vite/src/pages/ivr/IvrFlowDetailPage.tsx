import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Container, KeenIcon } from '@/components';
import {
  fetchIvrFlow,
  createIvrNode,
  updateIvrNode,
  deleteIvrNode,
  createNodeAction,
  invalidateCache,
  type IvrFlow,
  type IvrFlowNode,
} from './ivr-engine-api';
import { IvrPageHeader, IvrToast, useToast, EmptyRow } from './admin';

type Toast = { kind: 'success' | 'danger'; text: string } | null;

const NODE_TYPE_COLORS: Record<string, string> = {
  prompt: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  branch: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  action: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  collect_input: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  end: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const NODE_TYPE_ICONS: Record<string, string> = {
  prompt: 'message-text',
  branch: 'arrow-mix',
  action: 'setting',
  collect_input: 'notepad-edit',
  end: 'cross-circle',
};

export const IvrFlowDetailPage = () => {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const [flow, setFlow] = useState<(IvrFlow & { nodes: IvrFlowNode[] }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [showAddNode, setShowAddNode] = useState(false);
  const [editNode, setEditNode] = useState<IvrFlowNode | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'visual'>('visual');

  // Node form state
  const [nodeCode, setNodeCode] = useState('');
  const [nodeType, setNodeType] = useState('prompt');
  const [nodeLabel, setNodeLabel] = useState('');
  const [promptText, setPromptText] = useState('');
  const [sortOrder, setSortOrder] = useState(10);
  const [nextNodeCode, setNextNodeCode] = useState('');
  const [branchConfigStr, setBranchConfigStr] = useState('');

  useToast(toast, () => setToast(null));

  const load = useCallback(async () => {
    if (!flowId) return;
    setBusy(true);
    try {
      const data = await fetchIvrFlow(Number(flowId));
      setFlow(data);
    } catch (error: any) {
      setToast({ kind: 'danger', text: `Failed to load flow: ${error.message}` });
    } finally {
      setBusy(false);
    }
  }, [flowId]);

  useEffect(() => { void load(); }, [load]);

  const resetNodeForm = () => {
    setNodeCode(''); setNodeType('prompt'); setNodeLabel(''); setPromptText('');
    setSortOrder((flow?.nodes?.length ?? 0) * 10 + 10); setNextNodeCode(''); setBranchConfigStr('');
  };

  const handleAddNode = async () => {
    if (!flowId || !nodeCode) {
      setToast({ kind: 'danger', text: 'Node Code is required.' });
      return;
    }
    setBusy(true);
    try {
      let branchConfig: Record<string, string> | undefined;
      if (branchConfigStr.trim()) {
        branchConfig = JSON.parse(branchConfigStr);
      }
      await createIvrNode(Number(flowId), {
        nodeCode, nodeType, nodeLabel: nodeLabel || undefined,
        promptText: promptText || undefined, sortOrder,
        nextNodeCode: nextNodeCode || undefined, branchConfig,
      });
      setToast({ kind: 'success', text: `Node "${nodeCode}" added.` });
      setShowAddNode(false);
      resetNodeForm();
      await load();
    } catch (error: any) {
      setToast({ kind: 'danger', text: `Add node failed: ${error.message}` });
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateNode = async () => {
    if (!editNode) return;
    setBusy(true);
    try {
      let branchConfig: Record<string, string> | undefined;
      if (branchConfigStr.trim()) {
        branchConfig = JSON.parse(branchConfigStr);
      }
      await updateIvrNode(editNode.NodeId, {
        nodeLabel: nodeLabel || undefined,
        promptText: promptText || undefined,
        sortOrder,
        nextNodeCode: nextNodeCode || undefined,
        branchConfig,
      });
      setToast({ kind: 'success', text: `Node updated.` });
      setEditNode(null);
      resetNodeForm();
      await load();
    } catch (error: any) {
      setToast({ kind: 'danger', text: `Update failed: ${error.message}` });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteNode = async (nodeId: number, code: string) => {
    if (!confirm(`Delete node "${code}"? This also removes its actions.`)) return;
    try {
      await deleteIvrNode(nodeId);
      setToast({ kind: 'success', text: `Node "${code}" deleted.` });
      await load();
    } catch (error: any) {
      setToast({ kind: 'danger', text: error.message });
    }
  };

  const openEditNode = (node: IvrFlowNode) => {
    setEditNode(node);
    setNodeCode(node.NodeCode);
    setNodeType(node.NodeType);
    setNodeLabel(node.NodeLabel || '');
    setPromptText(node.PromptText || '');
    setSortOrder(node.SortOrder);
    setNextNodeCode(node.NextNodeCode || '');
    setBranchConfigStr(node.BranchConfig || '');
    setShowAddNode(false);
  };

  const nodes = flow?.nodes ?? [];

  // Build visual flow graph
  const renderVisualFlow = () => {
    const sorted = [...nodes].sort((a, b) => a.SortOrder - b.SortOrder);
    return (
      <div className="flex flex-col items-center gap-1 py-4">
        {sorted.map((node, idx) => {
          const typeColor = NODE_TYPE_COLORS[node.NodeType] || 'bg-gray-100 text-gray-800';
          const icon = NODE_TYPE_ICONS[node.NodeType] || 'abstract-26';
          const branches = node.BranchConfig ? (() => { try { return JSON.parse(node.BranchConfig); } catch { return null; } })() : null;

          return (
            <div key={node.NodeId} className="flex flex-col items-center w-full max-w-2xl">
              {/* Node Card */}
              <div
                className={`w-full rounded-lg border p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow ${node.IsActive ? '' : 'opacity-50'}`}
                onClick={() => openEditNode(node)}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${typeColor}`}>
                    <KeenIcon icon={icon} className="text-lg" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{node.NodeCode}</span>
                      <span className={`badge badge-xs ${typeColor} rounded-full px-2`}>{node.NodeType}</span>
                      {node.NodeLabel && <span className="text-xs text-gray-500">({node.NodeLabel})</span>}
                      {!node.IsActive && <span className="badge badge-xs badge-danger">Inactive</span>}
                    </div>
                    {node.PromptText && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{node.PromptText}</p>
                    )}
                    {branches && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Object.entries(branches).map(([key, target]) => (
                          <span key={key} className="badge badge-xs badge-outline badge-warning">
                            {key} → {String(target)}
                          </span>
                        ))}
                      </div>
                    )}
                    {node.actions && node.actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {node.actions.map(a => (
                          <span key={a.ActionId} className="badge badge-xs badge-outline badge-success">
                            {a.ActionType}: {a.ToolName || 'api_call'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button className="btn btn-xs btn-icon btn-light" onClick={(e) => { e.stopPropagation(); openEditNode(node); }}>
                      <KeenIcon icon="pencil" className="text-xs" />
                    </button>
                    <button className="btn btn-xs btn-icon btn-light" onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.NodeId, node.NodeCode); }}>
                      <KeenIcon icon="trash" className="text-xs text-danger" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Arrow to next */}
              {idx < sorted.length - 1 && (
                <div className="flex flex-col items-center py-1">
                  <div className="w-0.5 h-4 bg-gray-300 dark:bg-gray-600"></div>
                  <KeenIcon icon="down" className="text-gray-400 text-xs" />
                  {node.NextNodeCode && (
                    <span className="text-[10px] text-gray-400">{node.NextNodeCode}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Container className="container-fluid">
      <div className="grid gap-5 lg:gap-7.5">
        <IvrPageHeader
          title={flow ? `Flow: ${flow.FlowName}` : 'Loading...'}
          description={flow ? `${flow.FlowCode} | Domain: ${flow.DomainCode || 'N/A'} | v${flow.FlowVersion} | ${nodes.length} nodes` : ''}
          actions={
            <div className="flex gap-2">
              <button className="btn btn-sm btn-light" onClick={() => navigate('/ivr/flows')}>
                <KeenIcon icon="arrow-left" className="me-1" /> Back
              </button>
              <div className="btn-group">
                <button className={`btn btn-sm ${viewMode === 'visual' ? 'btn-primary' : 'btn-light'}`} onClick={() => setViewMode('visual')}>Visual</button>
                <button className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-light'}`} onClick={() => setViewMode('table')}>Table</button>
              </div>
              <button className="btn btn-sm btn-primary" onClick={() => { setShowAddNode(true); setEditNode(null); resetNodeForm(); }}>
                <KeenIcon icon="plus" className="me-1" /> Add Node
              </button>
            </div>
          }
        />

        {/* Add / Edit Node Form */}
        {(showAddNode || editNode) && (
          <div className="card p-5">
            <h3 className="text-base font-semibold mb-4">{editNode ? `Edit Node: ${editNode.NodeCode}` : 'Add New Node'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Node Code</label>
                <input className="input w-full" value={nodeCode} onChange={e => setNodeCode(e.target.value)} disabled={!!editNode} placeholder="e.g. welcome" />
              </div>
              <div>
                <label className="form-label">Node Type</label>
                <select className="select w-full" value={nodeType} onChange={e => setNodeType(e.target.value)} disabled={!!editNode}>
                  <option value="prompt">Prompt</option>
                  <option value="branch">Branch</option>
                  <option value="action">Action</option>
                  <option value="collect_input">Collect Input</option>
                  <option value="end">End</option>
                </select>
              </div>
              <div>
                <label className="form-label">Label</label>
                <input className="input w-full" value={nodeLabel} onChange={e => setNodeLabel(e.target.value)} placeholder="Human-readable label" />
              </div>
              <div className="md:col-span-2">
                <label className="form-label">Prompt Text</label>
                <textarea className="textarea w-full" rows={2} value={promptText} onChange={e => setPromptText(e.target.value)} placeholder="What the IVR says at this node..." />
              </div>
              <div>
                <label className="form-label">Sort Order</label>
                <input type="number" className="input w-full" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
              </div>
              <div>
                <label className="form-label">Next Node Code</label>
                <select className="select w-full" value={nextNodeCode} onChange={e => setNextNodeCode(e.target.value)}>
                  <option value="">None (end or branch)</option>
                  {nodes.filter(n => n.NodeCode !== nodeCode).map(n => (
                    <option key={n.NodeId} value={n.NodeCode}>{n.NodeCode} ({n.NodeType})</option>
                  ))}
                </select>
              </div>
              {(nodeType === 'branch') && (
                <div className="md:col-span-2">
                  <label className="form-label">Branch Config (JSON)</label>
                  <textarea className="textarea w-full font-mono text-xs" rows={3} value={branchConfigStr} onChange={e => setBranchConfigStr(e.target.value)}
                    placeholder='{"appointment": "collect_department", "billing": "billing_info", "emergency": "emergency_transfer"}' />
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn btn-sm btn-primary" onClick={editNode ? handleUpdateNode : handleAddNode} disabled={busy}>
                {editNode ? 'Update Node' : 'Add Node'}
              </button>
              <button className="btn btn-sm btn-light" onClick={() => { setShowAddNode(false); setEditNode(null); resetNodeForm(); }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Flow Content */}
        {viewMode === 'visual' ? (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Flow Diagram ({nodes.length} nodes)</h3>
            </div>
            <div className="card-body">
              {nodes.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <KeenIcon icon="abstract-26" className="text-4xl mb-2" />
                  <p>No nodes yet. Click "Add Node" to start building the flow.</p>
                </div>
              ) : renderVisualFlow()}
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Nodes Table ({nodes.length})</h3>
            </div>
            <div className="card-body">
              <div className="overflow-x-auto">
                <table className="table table-auto w-full">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Code</th>
                      <th>Type</th>
                      <th>Label</th>
                      <th>Prompt</th>
                      <th>Next</th>
                      <th>Branch</th>
                      <th>Actions</th>
                      <th className="text-center">Active</th>
                      <th className="text-end">Ops</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodes.length === 0 && <EmptyRow colSpan={10} text="No nodes." />}
                    {[...nodes].sort((a, b) => a.SortOrder - b.SortOrder).map(node => (
                      <tr key={node.NodeId}>
                        <td className="text-center">{node.SortOrder}</td>
                        <td className="font-medium">{node.NodeCode}</td>
                        <td>
                          <span className={`badge badge-xs ${NODE_TYPE_COLORS[node.NodeType] || 'bg-gray-100'} rounded-full px-2`}>
                            {node.NodeType}
                          </span>
                        </td>
                        <td className="text-xs text-gray-500">{node.NodeLabel || '-'}</td>
                        <td className="max-w-[200px] truncate text-xs">{node.PromptText || '-'}</td>
                        <td className="text-xs">{node.NextNodeCode || '-'}</td>
                        <td className="text-xs max-w-[150px] truncate">{node.BranchConfig || '-'}</td>
                        <td className="text-xs">{node.actions?.length || 0}</td>
                        <td className="text-center">
                          <span className={`badge badge-xs ${node.IsActive ? 'badge-success' : 'badge-danger'}`}>
                            {node.IsActive ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <button className="btn btn-xs btn-light" onClick={() => openEditNode(node)}>
                              <KeenIcon icon="pencil" className="text-xs" />
                            </button>
                            <button className="btn btn-xs btn-light" onClick={() => handleDeleteNode(node.NodeId, node.NodeCode)}>
                              <KeenIcon icon="trash" className="text-xs text-danger" />
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
      </div>
      <IvrToast toast={toast} />
    </Container>
  );
};
