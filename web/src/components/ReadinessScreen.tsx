import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useStore } from '../store/store';
import { fetchHealth, fetchBackendAgents, fetchIntegrations, fetchTasks, fetchMemoryStats } from '../lib/api';
import { Icon } from './Icon';

/**
 * Readiness screen — automatic initialization surface (reference: the
 * prerequisites / hive-picker gate). Shows the REAL status of every
 * integration (backend, Ollama, memory, tools) with reason + alternative,
 * and blocks the command center until the engine reports ready.
 */
export function ReadinessScreen({ onReady }: { onReady: () => void }) {
  const setBackend = useStore((s) => s.setBackend);
  const reconcileBackendAgents = useStore((s) => s.reconcileBackendAgents);
  const syncTasks = useStore((s) => s.syncTasks);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [integrationLines, setIntegrationLines] = useState<string[]>([]);

  async function check() {
    setChecking(true);
    setError('');
    const h = await fetchHealth();
    if (!h) {
      setError('Orchestrator is unreachable at /health (expected the API on port 3001).');
      setChecking(false);
      return;
    }
    setBackend({
      online: true,
      checking: false,
      version: String(h.version ?? ''),
      routerMode: String(h.router_mode ?? 'local'),
      ollamaConnected: Boolean(h.ollama_connected),
      modelsInstalled: Number(h.models_installed ?? 0),
    });

    const [agents, integrations, tasks, memory] = await Promise.all([
      fetchBackendAgents(),
      fetchIntegrations(),
      fetchTasks(),
      fetchMemoryStats(),
    ]);
    if (agents.length > 0) reconcileBackendAgents(agents as unknown as Array<Record<string, unknown>>);
    if (integrations) {
      setBackend({ integrations: integrations.integrations, integrationsLoaded: true });
      setIntegrationLines(integrations.integrations.map((i) => `${i.status}: ${i.name}`));
    }
    if (tasks.length > 0) syncTasks(tasks);
    if (memory) setBackend({ memoryTotal: memory.total });
    setChecking(false);
  }

  useEffect(() => {
    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={head}>
          <Icon name="shield" size={1.1} />
          <div>
            <div style={title}>CHAKRAVYUH AI — ENGINE READINESS</div>
            <div style={sub}>automatic initialization: services → agents → tools → ready</div>
          </div>
        </div>

        {error ? (
          <div style={errBox}>
            <div style={{ fontWeight: 700, color: 'var(--cv-status-blocked)' }}>Connection failed</div>
            <div style={errText}>{error}</div>
            <div style={errText}>
              Start the engine: <code style={code}>./venv/bin/python -m uvicorn api.app:app --port 3001</code>
            </div>
            <button style={retryBtn} onClick={() => void check()}>retry connection</button>
          </div>
        ) : checking ? (
          <div style={checkingBox}>
            <div className="cv-spinner" style={spinner} />
            <div style={errText}>probing orchestrator, agents, and integrations…</div>
          </div>
        ) : (
          <div>
            <div style={readyRow}>
              <span style={dotOk} />
              <span style={readyText}>orchestrator online · {integrationLines.length} integrations probed</span>
            </div>
            <div style={lines}>
              {integrationLines.map((l, i) => (
                <div key={i} style={line}>{l}</div>
              ))}
            </div>
            <button style={enterBtn} onClick={onReady}>enter command center</button>
          </div>
        )}
      </div>
    </div>
  );
}

const wrap: CSSProperties = {
  height: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--cv-cream-200)',
  fontFamily: 'var(--cv-font-ui)',
};
const card: CSSProperties = {
  width: 520,
  maxWidth: '92vw',
  padding: 28,
  background: 'var(--cv-paper-100)',
  boxShadow: 'var(--cv-shadow-hard)',
  boxSizing: 'border-box',
};
const head: CSSProperties = {
  display: 'flex',
  gap: 14,
  alignItems: 'center',
  color: 'var(--cv-cyan)',
  marginBottom: 18,
};
const title: CSSProperties = {
  fontFamily: 'var(--cv-font-display)',
  fontSize: 'var(--cv-text-display-md)',
  letterSpacing: '0.08em',
  color: 'var(--cv-ink-900)',
};
const sub: CSSProperties = {
  fontSize: 'var(--cv-text-body-sm)',
  color: 'var(--cv-ink-500)',
  fontFamily: 'var(--cv-font-mono)',
};
const errBox: CSSProperties = {
  padding: 14,
  background: 'var(--cv-cream-300)',
  boxShadow: 'var(--cv-panel-border-inset)',
  color: 'var(--cv-ink-700)',
  fontSize: 'var(--cv-text-body-sm)',
};
const errText: CSSProperties = { marginTop: 8, lineHeight: 1.5 };
const code: CSSProperties = {
  fontFamily: 'var(--cv-font-mono)',
  fontSize: 11,
  color: 'var(--cv-ink-900)',
  background: 'var(--cv-ink-100)',
  padding: '1px 5px',
};
const checkingBox: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: 10 };
const spinner: CSSProperties = {
  width: 14,
  height: 14,
  border: '2px solid var(--cv-ink-100)',
  borderTopColor: 'var(--cv-cyan)',
  borderRadius: '50%',
  animation: 'cv-spin 0.9s linear infinite',
};
const readyRow: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 };
const dotOk: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: 'var(--cv-status-success)',
  boxShadow: '0 0 10px var(--cv-status-success)',
};
const readyText: CSSProperties = { fontSize: 'var(--cv-text-body-md)', color: 'var(--cv-ink-900)' };
const lines: CSSProperties = {
  maxHeight: 200,
  overflowY: 'auto',
  marginBottom: 18,
  fontFamily: 'var(--cv-font-mono)',
  fontSize: 'var(--cv-text-mono-sm)',
  color: 'var(--cv-ink-500)',
  lineHeight: 'var(--cv-lh-mono)',
};
const line: CSSProperties = {
  padding: '2px 0',
  borderBottom: '1px solid var(--cv-ink-100)',
};
const retryBtn: CSSProperties = {
  marginTop: 14,
  padding: '7px 14px',
  cursor: 'pointer',
  border: 'none',
  background: 'var(--cv-cyan)',
  color: 'var(--cv-on-accent)',
  fontWeight: 700,
  fontFamily: 'var(--cv-font-ui)',
  fontSize: 'var(--cv-text-body-md)',
};
const enterBtn: CSSProperties = {
  ...retryBtn,
  marginTop: 0,
  background: 'var(--cv-cyan)',
  boxShadow: 'var(--cv-shadow-glow)',
};