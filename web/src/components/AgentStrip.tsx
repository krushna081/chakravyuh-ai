import { useEffect, useRef, useState } from 'react';
import { AgentCard } from './AgentCard';
import { PixelButton } from './PixelButton';
import { Icon } from './Icon';
import { useStore, type Agent } from '../store/store';

/**
 * The roster dock at the bottom of the command center: one card per agent,
 * drag-to-reorder, private notes, and the restore-team control for the
 * previous session's agents.
 */
export function AgentStrip() {
  const agents = useStore((s) => s.agents);
  const restorableAgents = useStore((s) => s.restorableAgents);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const setAddAgentOpen = useStore((s) => s.setAddAgentOpen);
  const openTaskDetail = useStore((s) => s.openTaskDetail);
  const reorderAgents = useStore((s) => s.reorderAgents);
  const setAgentNote = useStore((s) => s.setAgentNote);
  const restoreTeam = useStore((s) => s.restoreTeam);
  const tasks = useStore((s) => s.tasks);

  const [restoreMenuOpen, setRestoreMenuOpen] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const restoreBtnRef = useRef<HTMLSpanElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [noteEditId, setNoteEditId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (restorableAgents.length === 0 || restoreBusy) setRestoreMenuOpen(false);
  }, [restorableAgents.length, restoreBusy]);

  // Doing-count per agent from the backend task ledger.
  const doingByAgent: Record<string, number> = {};
  for (const t of tasks) {
    if (t.status === 'queued' || t.status === 'running') {
      for (const s of t.steps ?? []) {
        doingByAgent[s.agent] = (doingByAgent[s.agent] ?? 0) + 1;
      }
    }
  }

  const toggleRestoreMenu = (anchor: HTMLElement | null) => {
    if (restoreMenuOpen) { setRestoreMenuOpen(false); return; }
    if (!anchor) return;
    setRestoreMenuOpen(true);
    void anchor;
  };

  const doRestore = () => {
    setRestoreMenuOpen(false);
    setRestoreBusy(true);
    window.setTimeout(() => {
      restoreTeam();
      setRestoreBusy(false);
    }, 600);
  };

  return (
    <div style={{
      display: 'flex',
      gap: 12,
      padding: '14px 16px',
      overflowX: 'auto',
      overflowY: 'hidden',
      borderTop: '1px solid var(--cv-ink-300)',
      background: 'var(--cv-cream-200)',
      height: 112,
      minHeight: 112,
      alignItems: 'center',
    }}>
      {agents.map((a) => (
        <div
          key={a.id}
          ref={(el) => { cardRefs.current[a.id] = el; }}
          draggable
          onDragStart={(e) => { setDragId(a.id); e.dataTransfer.effectAllowed = 'move'; }}
          onDragOver={(e) => {
            if (!dragId || dragId === a.id) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (overId !== a.id) setOverId(a.id);
          }}
          onDragLeave={() => { if (overId === a.id) setOverId(null); }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragId && dragId !== a.id) reorderAgents(dragId, a.id);
            setDragId(null);
            setOverId(null);
          }}
          onDragEnd={() => { setDragId(null); setOverId(null); }}
          style={{
            position: 'relative',
            flexShrink: 0,
            cursor: 'grab',
            opacity: dragId === a.id ? 0.4 : 1,
            boxShadow: overId === a.id && dragId && dragId !== a.id
              ? 'inset 3px 0 0 0 var(--cv-ink-900)'
              : 'none',
            transition: 'opacity 120ms ease',
          }}
        >
          <AgentCard
            draggable
            name={a.name}
            callSign={a.callSign}
            accent={a.accent}
            status={a.status}
            project={a.project}
            action={a.action}
            progress={a.progress}
            contextTokens={a.contextTokens}
            contextLimit={a.contextLimit}
            selected={a.id === selectedId}
            isCommander={a.isCommander}
            onClick={() => select(a.id)}
            doingCount={doingByAgent[a.id] ?? 0}
            onTaskNoteClick={() => {
              const first = tasks.find((t) => (t.status === 'queued' || t.status === 'running')
                && (t.steps ?? []).some((s) => s.agent === a.id));
              if (first) openTaskDetail(first.id);
            }}
            note={a.note}
            onEditNote={a.isCommander ? undefined : () => setNoteEditId(a.id)}
          />
          {noteEditId === a.id && !dragId && (() => {
            const rect = cardRefs.current[a.id]?.getBoundingClientRect();
            if (!rect) return null;
            const width = 280;
            const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
            const bottom = Math.max(8, window.innerHeight - rect.top + 8);
            return (
              <>
                <div
                  onClick={() => setNoteEditId(null)}
                  style={{ position: 'fixed', inset: 0, zIndex: 349, background: 'transparent' }}
                />
                <div
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    position: 'fixed', left, bottom, width, zIndex: 350,
                    padding: 10, boxSizing: 'border-box',
                    background: 'var(--cv-paper-100)',
                    boxShadow: 'inset 0 0 0 1px var(--cv-ink-300), 3px 3px 0 rgba(26,19,32,0.14)',
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontFamily: 'var(--cv-font-display)', fontSize: 8, lineHeight: '12px',
                      color: 'var(--cv-ink-500)',
                    }}>PRIVATE NOTE · {a.name.toUpperCase()}</span>
                    <button
                      onClick={() => setNoteEditId(null)}
                      title="Done"
                      aria-label="Close note editor"
                      style={{
                        flexShrink: 0, width: 18, height: 18, padding: 0, lineHeight: 1,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--cv-font-ui)', fontSize: 11,
                        color: 'var(--cv-ink-500)', background: 'transparent',
                        border: 'none', cursor: 'pointer',
                      }}
                    >✕</button>
                  </div>
                  <textarea
                    autoFocus
                    rows={3}
                    value={a.note ?? ''}
                    onChange={(e) => setAgentNote(a.id, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setNoteEditId(null); }}
                    placeholder="one line per bullet…"
                    aria-label={`Note for ${a.name}`}
                    style={{
                      width: '100%', padding: '6px 8px',
                      border: 'none', outline: 'none', resize: 'none', boxSizing: 'border-box',
                      background: 'var(--cv-cream-100)',
                      boxShadow: 'inset 0 0 0 1px var(--cv-ink-100)',
                      fontFamily: 'var(--cv-font-mono)', fontSize: 12,
                      lineHeight: '18px', color: 'var(--cv-ink-900)',
                    }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--cv-ink-500)' }}>
                    one line = one bullet · esc to close
                  </span>
                </div>
              </>
            );
          })()}
        </div>
      ))}
      <PixelButton
        variant="secondary"
        size="lg"
        style={{ alignSelf: 'center', flexShrink: 0 }}
        onClick={() => setAddAgentOpen(true)}
      >
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
          <Icon name="plus" /> add agent
        </span>
      </PixelButton>
      {(restorableAgents.length > 0 || restoreBusy) && (
        <span
          ref={restoreBtnRef}
          style={{ alignSelf: 'center', flexShrink: 0, marginLeft: 'auto' }}
          title={restoreBusy
            ? "Your previous session's agents are being respawned with their original ids."
            : `Previous session: ${restorableAgents.map((a: Agent) => a.name).join(', ')}`}
        >
          <PixelButton
            variant="primary"
            size="lg"
            disabled={restoreBusy}
            onClick={() => toggleRestoreMenu(restoreBtnRef.current)}
          >
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
              <Icon name="play" />
              {restoreBusy ? 'reforming your team…' : `restore team (${restorableAgents.length}) ▴`}
            </span>
          </PixelButton>
        </span>
      )}
      {restoreMenuOpen && restorableAgents.length > 0 && (
        <>
          <div
            onClick={() => setRestoreMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 349, background: 'transparent' }}
          />
          <div style={{
            position: 'fixed', right: 12, bottom: 120,
            zIndex: 350, minWidth: 240, maxHeight: '50vh', overflowY: 'auto',
            background: 'var(--cv-cream-50)',
            boxShadow: '0 0 0 2px var(--cv-ink-900), 3px 4px 0 0 rgba(26,19,32,0.22)',
            padding: 8, display: 'flex', flexDirection: 'column', gap: 6,
            fontFamily: 'var(--cv-font-ui)',
          }}>
            <span style={{
              fontFamily: 'var(--cv-font-display)', fontSize: 8, lineHeight: '12px',
              color: 'var(--cv-ink-500)', textTransform: 'uppercase',
            }}>
              previous session
            </span>
            {restorableAgents.map((a: Agent) => (
              <span
                key={a.id}
                title={`${a.name} — restorable from last session`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  height: 26, padding: '0 4px 0 8px',
                  fontSize: 12, color: 'var(--cv-ink-900)',
                  background: 'var(--cv-paper-100)',
                  boxShadow: 'inset 0 0 0 1px var(--cv-ink-300)',
                }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.name}
                </span>
                <span style={{ fontSize: 11, color: 'var(--cv-ink-500)', whiteSpace: 'nowrap' }}>
                  {a.description ? a.description.slice(0, 24) : ''}
                </span>
                <button
                  onClick={() => useStore.getState().removeRestorableAgent(a.id)}
                  title={`Dismiss ${a.name} — remove permanently from the restore list`}
                  aria-label={`Dismiss ${a.name}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 18, height: 18, padding: 0, lineHeight: 1,
                    fontSize: 12, color: 'var(--cv-ink-500)',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                  }}
                >✕</button>
              </span>
            ))}
            <PixelButton
              variant="primary"
              size="sm"
              onClick={doRestore}
            >
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
                <Icon name="play" /> restore all ({restorableAgents.length})
              </span>
            </PixelButton>
          </div>
        </>
      )}
    </div>
  );
}