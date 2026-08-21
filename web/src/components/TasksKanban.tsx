import { useState } from 'react';
import { useStore } from '../store/store';
import { submitTask, type BackendTask } from '../lib/api';
import { statusColor } from '../design/tokens';

/**
 * The formation's kanban board — a READ surface over the backend task
 * ledger (the control agent is the writer, exactly like the reference's
 * board reads the hive ledger). New tasks are queued for real execution.
 */
const PRIORITY_RANK: Record<string, number> = { low: 1, medium: 3, high: 4, critical: 5 };

function priorityOf(t: BackendTask): number {
  return PRIORITY_RANK[t.priority] ?? 3;
}

function mapToColumn(status: string): 'todo' | 'doing' | 'blocked' | 'done' {
  switch (status) {
    case 'running': return 'doing';
    case 'failed': return 'blocked';
    case 'completed': return 'done';
    default: return 'todo';
  }
}

const COLUMNS: Array<{ id: 'todo' | 'doing' | 'blocked' | 'done'; label: string; color: string }> = [
  { id: 'todo', label: 'QUEUED', color: 'var(--cv-status-idle)' },
  { id: 'doing', label: 'RUNNING', color: 'var(--cv-status-working)' },
  { id: 'blocked', label: 'FAILED', color: 'var(--cv-status-blocked)' },
  { id: 'done', label: 'COMPLETED', color: 'var(--cv-status-success)' },
];

export function TasksKanban() {
  const tasks = useStore((s) => s.tasks);
  const openTaskDetail = useStore((s) => s.openTaskDetail);
  const backend = useStore((s) => s.backend);

  const [draft, setDraft] = useState('');
  const [priority, setPriority] = useState('medium');
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const submit = async () => {
    const t = draft.trim();
    if (!t) return;
    setBusy(true);
    setSubmitError('');
    const res = await submitTask(t, priority);
    setBusy(false);
    if (!res) {
      setSubmitError('orchestrator unreachable — task not queued');
      return;
    }
    if (res.error) {
      setSubmitError(res.error);
      return;
    }
    setDraft('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* add row — queues the task into the real pipeline */}
      <div style={{ display: 'flex', gap: 8, padding: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
          placeholder={backend.online ? 'new task — runs through the control agent…' : 'new task — orchestrator offline…'}
          disabled={!backend.online}
          aria-label="New task title"
          style={{
            flex: 1, minWidth: 180, padding: '7px 9px', boxSizing: 'border-box',
            background: 'var(--cv-paper-100)',
            boxShadow: 'var(--cv-panel-border-inset)',
            border: 'none', outline: 'none',
            fontFamily: 'var(--cv-font-mono)', fontSize: 12, color: 'var(--cv-ink-900)',
            opacity: backend.online ? 1 : 0.55,
          }}
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          aria-label="Priority"
          disabled={!backend.online}
          style={{
            padding: '7px 8px', background: 'var(--cv-cream-100)',
            boxShadow: 'var(--cv-panel-border-inset)',
            border: 'none', outline: 'none', cursor: 'pointer',
            fontFamily: 'var(--cv-font-ui)', fontSize: 12, color: 'var(--cv-ink-900)',
          }}
        >
          {['low', 'medium', 'high', 'critical'].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <button
          onClick={() => void submit()}
          disabled={!draft.trim() || busy || !backend.online}
          style={{
            padding: '7px 14px', cursor: 'pointer', border: 'none',
            background: 'var(--cv-cyan)', color: 'var(--cv-on-accent)',
            fontWeight: 700, fontSize: 12, fontFamily: 'var(--cv-font-ui)',
            opacity: draft.trim() && !busy && backend.online ? 1 : 0.5,
          }}
        >{busy ? 'queuing…' : 'queue'}</button>
      </div>
      {submitError && (
        <div style={{
          padding: '2px 10px 6px', fontSize: 11, color: 'var(--cv-status-blocked)',
          fontFamily: 'var(--cv-font-mono)',
        }}>✖ {submitError}</div>
      )}

      {/* columns — backend task states */}
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', gap: 10, padding: '0 10px 10px',
        overflowX: 'auto',
      }}>
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => mapToColumn(t.status) === col.id);
          return (
            <div
              key={col.id}
              style={{
                flex: 1, minWidth: 210, maxWidth: 320,
                display: 'flex', flexDirection: 'column',
                background: 'var(--cv-cream-200)',
                boxShadow: 'var(--cv-panel-border-inset)',
                borderTop: `2px solid ${col.color}`,
                overflow: 'hidden',
              }}
            >
              <div style={{
                padding: '7px 10px 5px',
                fontFamily: 'var(--cv-font-display)', fontSize: 'var(--cv-text-display-sm)',
                letterSpacing: '0.06em',
                color: 'var(--cv-ink-500)',
                display: 'flex', justifyContent: 'space-between',
              }}>
                {col.label}
                <span style={{ color: col.color }}>{colTasks.length}</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {colTasks.length === 0 && (
                  <span style={{ fontSize: 11, color: 'var(--cv-ink-500)', padding: 6 }}>
                    no tasks
                  </span>
                )}
                {colTasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => openTaskDetail(t.id)}
                    title={`${t.description}\nclick to inspect`}
                    style={{
                      cursor: 'pointer',
                      background: 'var(--cv-paper-100)',
                      boxShadow: 'var(--cv-panel-border-inset)',
                      padding: '7px 8px',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                      <span style={{
                        width: 6, height: 6, flexShrink: 0, borderRadius: '50%',
                        background: statusColor(mapToColumn(t.status)),
                      }} />
                      <span style={{
                        flex: 1, fontSize: 11.5, color: 'var(--cv-ink-900)', lineHeight: '15px',
                        wordBreak: 'break-word',
                      }}>{t.description}</span>
                    </div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: 10, color: 'var(--cv-ink-500)', fontFamily: 'var(--cv-font-mono)',
                    }}>
                      <span>P{priorityOf(t)} · {t.id}</span>
                      <span>{t.status}{t.error ? ' ✖' : ''}</span>
                    </div>
                    {t.steps && t.steps.length > 0 && (
                      <div style={{
                        marginTop: 4, fontSize: 10, color: 'var(--cv-ink-500)',
                        fontFamily: 'var(--cv-font-mono)',
                      }}>
                        {t.steps.map((s, i) => (
                          <div key={i}>· {s.agent}: {s.status}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}