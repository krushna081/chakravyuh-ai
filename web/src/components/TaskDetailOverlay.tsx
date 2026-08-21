import type { CSSProperties } from 'react';
import { useStore } from '../store/store';
import { statusColor } from '../design/tokens';

/**
 * Task detail overlay — read-only view of a real backend task: description,
 * lifecycle, steps with tool-level results, and errors. The backend owns the
 * truth; the UI never mutates the ledger.
 */
export function TaskDetailOverlay() {
  const taskId = useStore((s) => s.taskDetailId);
  const close = useStore((s) => s.closeTaskDetail);
  const task = useStore((s) => s.tasks.find((t) => t.id === s.taskDetailId));

  if (!task || !taskId) return null;

  const statusKind = task.status === 'completed' ? 'success'
    : task.status === 'failed' ? 'blocked'
      : task.status === 'running' ? 'working' : 'idle';

  return (
    <>
      <div
        onClick={close}
        style={{ position: 'fixed', inset: 0, zIndex: 920, background: 'rgba(4,6,9,0.6)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Task detail"
        style={{
          position: 'fixed', zIndex: 921,
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(540px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          background: 'var(--cv-cream-100)',
          boxShadow: 'var(--cv-shadow-hard)',
          padding: 16,
          fontFamily: 'var(--cv-font-ui)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: 'var(--cv-ink-500)', marginBottom: 2, fontFamily: 'var(--cv-font-mono)' }}>
              {task.id} · queued {new Date(task.created_at).toLocaleString()}
              {task.completed_at ? ` · finished ${new Date(task.completed_at).toLocaleString()}` : ''}
            </div>
            <h2 style={{
              margin: 0, fontSize: 16, lineHeight: '22px', color: 'var(--cv-ink-900)',
              wordBreak: 'break-word',
            }}>{task.description}</h2>
          </div>
          <button
            onClick={close}
            aria-label="Close task"
            style={{
              width: 26, height: 26, border: 'none', cursor: 'pointer', flexShrink: 0,
              background: 'var(--cv-paper-100)',
              boxShadow: 'var(--cv-panel-border-inset)',
              color: 'var(--cv-ink-500)', fontSize: 13, lineHeight: 1,
            }}
          >✕</button>
        </div>

        {/* status */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{
            padding: '3px 9px', fontFamily: 'var(--cv-font-mono)', fontSize: 10.5,
            letterSpacing: '0.05em',
            color: statusColor(statusKind),
            background: 'var(--cv-paper-100)',
            boxShadow: `inset 0 0 0 1px ${statusColor(statusKind)}`,
          }}>
            {task.status.toUpperCase()}
          </span>
          <span style={{ fontSize: 11, color: 'var(--cv-ink-500)', fontFamily: 'var(--cv-font-mono)' }}>
            priority {task.priority}
          </span>
          {task.error && (
            <span style={{ fontSize: 11, color: 'var(--cv-status-blocked)', marginLeft: 'auto', textAlign: 'right' }}>
              ✖ {task.error}
            </span>
          )}
        </div>

        {/* execution record */}
        <div style={{ marginBottom: 8 }}>
          <div style={fieldLabel}>EXECUTION RECORD</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(task.steps ?? []).length === 0 && (
              <div style={{
                background: 'var(--cv-paper-100)',
                boxShadow: 'var(--cv-panel-border-inset)',
                padding: '8px 10px', fontSize: 11.5, color: 'var(--cv-ink-500)',
                fontFamily: 'var(--cv-font-mono)',
              }}>
                {task.status === 'queued'
                  ? 'queued — the control agent will decompose and route this task.'
                  : task.status === 'running'
                    ? 'running — steps will appear here as agents execute them.'
                    : 'no steps recorded.'}
              </div>
            )}
            {(task.steps ?? []).map((s, i) => (
              <div key={s.step_id || i} style={{
                background: 'var(--cv-paper-100)',
                boxShadow: 'var(--cv-panel-border-inset)',
                padding: '8px 10px', fontSize: 11.5, lineHeight: '17px',
              }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(s.status === 'completed' ? 'success' : 'blocked') }} />
                  <span style={{ color: 'var(--cv-ink-900)', fontWeight: 600, fontFamily: 'var(--cv-font-mono)' }}>
                    step {i + 1} · {s.agent}
                  </span>
                  <span style={{ marginLeft: 'auto', color: 'var(--cv-ink-500)', fontFamily: 'var(--cv-font-mono)', fontSize: 10 }}>
                    {s.status}
                  </span>
                </div>
                {s.error && (
                  <div style={{ color: 'var(--cv-status-blocked)', marginTop: 2, wordBreak: 'break-word' }}>
                    ✖ {s.error}
                  </div>
                )}
                {s.response && (
                  <div style={{ color: 'var(--cv-ink-700)', marginTop: 2, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                    {s.response.slice(0, 800)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--cv-ink-500)' }}>
          The task ledger lives on the backend — this view is read-only.
        </div>
      </div>
    </>
  );
}

const fieldLabel: CSSProperties = {
  fontFamily: 'var(--cv-font-mono)', fontSize: 10,
  letterSpacing: '0.06em',
  color: 'var(--cv-ink-500)', marginBottom: 4,
};