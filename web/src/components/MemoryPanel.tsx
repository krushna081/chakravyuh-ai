import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useStore } from '../store/store';
import { PixelButton } from './PixelButton';
import { TasksKanban } from './TasksKanban';
import { queryMemory, storeMemory, fetchMemoryStats } from '../lib/api';

/**
 * The commander's memory panel — search the orchestrator's memory store,
 * inspect entry types, and record new observations for any agent.
 */
export function MemoryPanel() {
  const agents = useStore((s) => s.agents);
  const resolveName = useStore((s) => s.resolveName);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{
    id: string; agent_id: string; type: string; content: string; timestamp: string;
  }>>([]);
  const [stats, setStats] = useState<{ counts: Record<string, number>; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [stored, setStored] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newAgent, setNewAgent] = useState(agents[0]?.id ?? '');
  const [newType, setNewType] = useState('episodic');

  const search = () => {
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    void queryMemory(q).then((r) => {
      setResults(r);
      setBusy(false);
    });
  };

  const refreshStats = () => {
    void fetchMemoryStats().then((s) => setStats(s));
  };
  void refreshStats;

  const store = () => {
    const content = newContent.trim();
    if (!content) return;
    void storeMemory(newAgent, content, newType).then((ok) => {
      setStored(ok);
      setNewContent('');
      window.setTimeout(() => setStored(false), 2500);
      refreshStats();
    });
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* stats strip */}
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        padding: '6px 8px', background: 'var(--cv-cream-200)',
        boxShadow: 'inset 0 0 0 1px var(--cv-ink-100)',
        fontSize: 11, color: 'var(--cv-ink-500)',
      }}>
        {stats === null
          ? <span>memory store: backend offline</span>
          : <>
            <span>total: <b style={{ color: 'var(--cv-ink-900)' }}>{stats.total}</b></span>
            {Object.entries(stats.counts).map(([k, v]) => (
              <span key={k}>{k}: <b style={{ color: 'var(--cv-ink-900)' }}>{v}</b></span>
            ))}
          </>}
      </div>

      {/* search */}
      <div>
        <div style={fieldLabel}>SEARCH MEMORY</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
            placeholder="e.g. ollama, deployment, decisions…"
            aria-label="Search memory"
            style={inputStyle}
          />
          <PixelButton variant="secondary" size="sm" disabled={busy || !query.trim()} onClick={search}>
            {busy ? 'searching…' : 'search'}
          </PixelButton>
        </div>
        {results.length > 0 && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {results.map((r) => (
              <div key={r.id} style={{
                background: 'var(--cv-paper-100)',
                boxShadow: 'inset 0 0 0 1px var(--cv-ink-100)',
                padding: '6px 8px', fontSize: 11, lineHeight: '16px',
              }}>
                <div style={{ color: 'var(--cv-ink-500)', fontSize: 9.5, marginBottom: 2 }}>
                  [{r.type}] {resolveName(r.agent_id) ?? r.agent_id} · {new Date(r.timestamp).toLocaleString()}
                </div>
                <div style={{ color: 'var(--cv-ink-900)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {r.content}
                </div>
              </div>
            ))}
          </div>
        )}
        {results.length === 0 && busy === false && query.trim() !== '' && (
          <span style={{ fontSize: 11, color: 'var(--cv-ink-500)', marginTop: 6, display: 'block' }}>
            no matches (or backend offline).
          </span>
        )}
      </div>

      {/* store */}
      <div style={{ borderTop: '1px dashed var(--cv-ink-300)', paddingTop: 10 }}>
        <div style={fieldLabel}>RECORD MEMORY</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <select
            value={newAgent}
            onChange={(e) => setNewAgent(e.target.value)}
            aria-label="Memory owner"
            style={selectStyle}
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}{a.isCommander ? ' ★' : ''}</option>
            ))}
          </select>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            aria-label="Memory type"
            style={selectStyle}
          >
            {['episodic', 'semantic', 'procedural'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') store(); }}
            placeholder="what should the formation remember?"
            aria-label="Memory content"
            style={inputStyle}
          />
          <PixelButton variant="primary" size="sm" disabled={!newContent.trim()} onClick={store}>
            {stored ? 'stored ✓' : 'store'}
          </PixelButton>
        </div>
      </div>
    </div>
  );
}

export function useMemorySize(): string {
  const [size, setSize] = useState<string | null>(null);
  useEffect(() => {
    void fetchMemoryStats().then((s) => setSize(s ? String(s.total) : 'offline'));
  }, []);
  return size ?? '…';
}

const fieldLabel: CSSProperties = {
  fontFamily: 'var(--cv-font-display)', fontSize: 8, lineHeight: '12px',
  color: 'var(--cv-ink-500)', marginBottom: 4,
};

const inputStyle: CSSProperties = {
  flex: 1, padding: '6px 8px', boxSizing: 'border-box', minWidth: 0,
  background: 'var(--cv-paper-100)',
  boxShadow: 'inset 0 0 0 1px var(--cv-ink-100)',
  border: 'none', outline: 'none',
  fontFamily: 'var(--cv-font-mono)', fontSize: 11, color: 'var(--cv-ink-900)',
};

const selectStyle: CSSProperties = {
  padding: '6px 8px', background: 'var(--cv-cream-100)',
  boxShadow: 'inset 0 0 0 1px var(--cv-ink-100)',
  border: 'none', outline: 'none', cursor: 'pointer',
  fontFamily: 'var(--cv-font-ui)', fontSize: 12, color: 'var(--cv-ink-900)',
};