import { useCallback, useEffect, useState } from 'react';
import { Container, KeenIcon } from '@/components';
import {
  startIvrSession,
  processIvrInput,
  endIvrSession,
  getActiveSessions,
  type IvrSession,
  type FlowStepResult,
} from './ivr-engine-api';
import { fetchDomains } from './api';
import type { DomainConfig } from './types';
import { IvrPageHeader, IvrToast, useToast } from './admin';

type Toast = { kind: 'success' | 'danger'; text: string } | null;

interface ChatMessage {
  role: 'system' | 'user';
  text: string;
  nodeCode?: string;
  nodeType?: string;
  timestamp: number;
  variables?: Record<string, any>;
}

export const IvrSimulatorPage = () => {
  const [domains, setDomains] = useState<DomainConfig[]>([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [activeSessions, setActiveSessions] = useState<IvrSession[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [variables, setVariables] = useState<Record<string, any>>({});

  useToast(toast, () => setToast(null));

  useEffect(() => {
    fetchDomains().then(setDomains).catch(() => {});
    getActiveSessions().then(r => setActiveSessions(r.sessions || [])).catch(() => {});
  }, []);

  const addMessage = (msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  };

  const handleStartSession = async () => {
    if (!selectedDomain) {
      setToast({ kind: 'danger', text: 'Please select a domain first.' });
      return;
    }
    setBusy(true);
    setMessages([]);
    setVariables({});
    try {
      const result = await startIvrSession(selectedDomain);
      setSessionId(result.sessionId || null);
      setSessionStatus(result.status);
      addMessage({
        role: 'system',
        text: result.step.promptText,
        nodeCode: result.step.nodeCode,
        nodeType: result.step.nodeType,
        timestamp: result.step.timestamp || Date.now(),
      });
      setToast({ kind: 'success', text: `Session started: ${result.sessionId}` });
    } catch (error: any) {
      setToast({ kind: 'danger', text: `Failed to start: ${error.message}` });
    } finally {
      setBusy(false);
    }
  };

  const handleSendInput = async () => {
    if (!sessionId || !userInput.trim()) return;
    const input = userInput.trim();
    setUserInput('');
    addMessage({ role: 'user', text: input, timestamp: Date.now() });
    setBusy(true);
    try {
      const result = await processIvrInput(sessionId, input);
      setSessionStatus(result.status);
      setVariables(result.variables || {});
      addMessage({
        role: 'system',
        text: result.step.promptText,
        nodeCode: result.step.nodeCode,
        nodeType: result.step.nodeType,
        timestamp: result.step.timestamp || Date.now(),
        variables: result.variables,
      });
      if (result.status === 'completed') {
        setSessionId(null);
        addMessage({
          role: 'system',
          text: '--- Session completed ---',
          timestamp: Date.now(),
        });
      }
    } catch (error: any) {
      addMessage({
        role: 'system',
        text: `Error: ${error.message}`,
        timestamp: Date.now(),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) return;
    try {
      await endIvrSession(sessionId);
      setSessionStatus('ended');
      setSessionId(null);
      addMessage({ role: 'system', text: '--- Session ended by user ---', timestamp: Date.now() });
    } catch (error: any) {
      setToast({ kind: 'danger', text: error.message });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendInput();
    }
  };

  return (
    <Container className="container-fluid">
      <div className="grid gap-5 lg:gap-7.5">
        <IvrPageHeader
          title="IVR Flow Simulator"
          description="Test IVR flows interactively. Select a domain, start a session, and simulate customer interactions."
          actions={
            <div className="flex gap-2">
              <button className="btn btn-sm btn-light" onClick={() => setShowConfig(!showConfig)}>
                <KeenIcon icon="setting" className="me-1" /> {showConfig ? 'Hide' : 'Show'} Config
              </button>
            </div>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Session Controls */}
          <div className="lg:col-span-1 space-y-4">
            {/* Domain Selection */}
            <div className="card p-4">
              <h4 className="text-sm font-semibold mb-3">Session Setup</h4>
              <div className="space-y-3">
                <div>
                  <label className="form-label text-xs">Domain</label>
                  <select className="select w-full" value={selectedDomain} onChange={e => setSelectedDomain(e.target.value)} disabled={!!sessionId}>
                    <option value="">Select domain...</option>
                    {domains.map(d => (
                      <option key={d.domain_id} value={d.domain_id}>{d.display_name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  {!sessionId ? (
                    <button className="btn btn-sm btn-primary w-full" onClick={handleStartSession} disabled={busy || !selectedDomain}>
                      <KeenIcon icon="phone" className="me-1" /> Start Call
                    </button>
                  ) : (
                    <button className="btn btn-sm btn-danger w-full" onClick={handleEndSession}>
                      <KeenIcon icon="cross-circle" className="me-1" /> End Call
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Session Info */}
            {sessionId && (
              <div className="card p-4">
                <h4 className="text-sm font-semibold mb-3">Session Info</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Session ID:</span>
                    <span className="font-mono">{sessionId.slice(-12)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status:</span>
                    <span className={`badge badge-xs ${sessionStatus === 'active' ? 'badge-success' : sessionStatus === 'completed' ? 'badge-info' : 'badge-warning'}`}>
                      {sessionStatus}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Domain:</span>
                    <span>{selectedDomain}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Variables */}
            {Object.keys(variables).length > 0 && (
              <div className="card p-4">
                <h4 className="text-sm font-semibold mb-3">Session Variables</h4>
                <div className="space-y-1 text-xs">
                  {Object.entries(variables).filter(([k]) => !k.startsWith('_')).map(([key, val]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-500">{key}:</span>
                      <span className="font-mono text-primary">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Sessions */}
            <div className="card p-4">
              <h4 className="text-sm font-semibold mb-3">Active Sessions ({activeSessions.length})</h4>
              {activeSessions.length === 0 ? (
                <p className="text-xs text-gray-400">No active sessions.</p>
              ) : (
                <div className="space-y-2">
                  {activeSessions.slice(0, 5).map(s => (
                    <div key={s.sessionId} className="flex items-center justify-between text-xs p-2 rounded bg-gray-50 dark:bg-gray-800/30">
                      <span className="font-mono">{s.sessionId.slice(-10)}</span>
                      <span className="badge badge-xs badge-outline badge-primary">{s.domainCode}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Chat Interface */}
          <div className="lg:col-span-2">
            <div className="card h-full flex flex-col">
              <div className="card-header">
                <h3 className="card-title">
                  <KeenIcon icon="phone" className="me-2 text-primary" />
                  IVR Call Simulation
                </h3>
                {sessionId && (
                  <span className="badge badge-sm badge-success animate-pulse">Live</span>
                )}
              </div>
              <div className="card-body flex-1 overflow-y-auto min-h-[400px] max-h-[600px] p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <KeenIcon icon="phone" className="text-5xl mb-3" />
                    <p className="text-sm">Select a domain and start a call to begin simulation.</p>
                  </div>
                )}
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === 'user'
                        ? 'bg-primary text-white'
                        : msg.text.startsWith('Error:') || msg.text.startsWith('---')
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 italic'
                          : 'bg-gray-100 dark:bg-gray-800'
                    }`}>
                      {msg.nodeCode && (
                        <div className="flex items-center gap-1 mb-1">
                          <span className="badge badge-xs badge-outline badge-info">{msg.nodeCode}</span>
                          {msg.nodeType && <span className="text-[10px] text-gray-400">{msg.nodeType}</span>}
                        </div>
                      )}
                      <p className="text-sm">{msg.text}</p>
                      <span className="text-[10px] opacity-50 mt-1 block">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Input */}
              <div className="card-footer p-4">
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder={sessionId ? 'Type your response...' : 'Start a session first...'}
                    value={userInput}
                    onChange={e => setUserInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!sessionId || busy}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleSendInput}
                    disabled={!sessionId || busy || !userInput.trim()}
                  >
                    <KeenIcon icon="send" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Details (Alt+F1 style) */}
        {showConfig && (
          <div className="card p-4">
            <h4 className="text-sm font-semibold mb-3">Configuration Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <h5 className="font-medium mb-1">IVR Engine Backend</h5>
                <p className="text-gray-500">NestJS + TypeORM + SQL Server</p>
                <p className="text-gray-500">Port: 8010 | Prefix: /api</p>
              </div>
              <div>
                <h5 className="font-medium mb-1">Session Management</h5>
                <p className="text-gray-500">In-memory session store</p>
                <p className="text-gray-500">Flow loaded from DB on session start</p>
              </div>
              <div>
                <h5 className="font-medium mb-1">Flow Execution</h5>
                <p className="text-gray-500">Node-by-node traversal with branch support</p>
                <p className="text-gray-500">API actions executed via DomainApiEndpoints table</p>
              </div>
              <div>
                <h5 className="font-medium mb-1">Error Handling</h5>
                <p className="text-gray-500">Fallback responses on API failure</p>
                <p className="text-gray-500">All errors logged to IvrErrorLog table</p>
              </div>
            </div>
          </div>
        )}
      </div>
      <IvrToast toast={toast} />
    </Container>
  );
};
