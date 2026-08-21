import type { CSSProperties } from 'react';
import { useStore } from '../store/store';
import { PixelBadge } from './PixelBadge';
import { CallSignBadge } from './CallSignBadge';
import { TasksKanban } from './TasksKanban';
import { MemoryPanel } from './MemoryPanel';
import { statusColor } from '../design/tokens';

type CommanderTab = 'monitor' | 'tasks' | 'memory' | 'activity';

const TABS: Array<{ id: CommanderTab; label: string }> = [
  { id: 'monitor', label: 'monitor' },
  { id: 'tasks', label: 'tasks' },
  { id: 'memory', label: 'memory' },
  { id: 'activity', label: 'activity' },
];

/**
 * The commander's panel — the formation's operations center: formation
 * monitor, the real task ledger, the memory store, and the live activity feed.
 */
export function CommanderPanel() {
  const commander = useStore((s) => s.agents.find((a) => a.isCommander));
  const tab = useStore((s) => s.commanderTab);
  const setTab = useStore((s) => s.setCommanderTab);

  if (!commander) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      {/* header */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--cv-ink-100)',
        background: 'var(--cv-paper-100)',
        display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <div style={{
          width: 42, height: 50,
          background: 'var(--cv-cream-300)',
          boxShadow: 'var(--cv-panel-border-inset)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <CallSignBadge callSign={commander.callSign} accent={commander.accent} size={32} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <h2 style={{
              margin: 0,
              fontFamily: 'var(--cv-font-display)',
              fontSize: 'var(--cv-text-display-md)',
              fontWeight: 700,
              lineHeight: 'var(--cv-lh-display-md)',
              color: 'var(--cv-ink-900)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{commander.name}</h2>
            <span style={{
              fontFamily: 'var(--cv-font-mono)', fontSize: 9,
              letterSpacing: '0.08em',
              background: 'var(--cv-violet-deep)', color: '#fff',
              padding: '2px 6px', whiteSpace: 'nowrap',
            }}>COMMANDER</span>
          </div>
          <div style={{
            fontSize: 11, color: 'var(--cv-ink-500)', marginTop: 2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {commander.project} — orchestrates the formation
          </div>
        </div>
        <PixelBadge status={commander.status} style={{ flexShrink: 0 }} />
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', flexShrink: 0, background: 'var(--cv-cream-200)' }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, height: 38, padding: 0, border: 'none', cursor: 'pointer',
                background: active ? 'var(--cv-paper-100)' : 'transparent',
                boxShadow: active ? 'inset 0 -2px 0 var(--cv-cyan)' : 'inset 0 -1px 0 var(--cv-ink-100)',
                fontFamily: 'var(--cv-font-display)', fontSize: 'var(--cv-text-display-sm)',
                color: active ? 'var(--cv-cyan)' : 'var(--cv-ink-500)',
                whiteSpace: 'nowrap',
              }}
            >{t.label}</button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 'monitor' && <MonitorBody />}
        {tab === 'tasks' && <TasksKanban />}
        {tab === 'memory' && <MemoryPanel />}
        {tab === 'activity' && <ActivityBody />}
      </div>
    </div>
  );
}

function MonitorBody() {
  const agents = useStore((s) => s.agents);
  const backend = useStore((s) => s.backend);
  const tasks = useStore((s) => s.tasks);
  const select = useStore((s) => s.select);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setFullscreen = useStore((s) => s.setFullscreen);
  const commander = agents.find((a) => a.isCommander);

  const byStatus: Record<string, number> = {};
  for (const a of agents) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;

  const openTasks = tasks.filter((t) => t.status === 'queued' || t.status === 'running').length;
  const blockedTasks = tasks.filter((t) => t.status === 'failed').length;
  const doneTasks = tasks.filter((t) => t.status === 'completed').length;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* formation stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {[
          { label: 'formation', value: String(agents.length), color: 'var(--cv-ink-900)' },
          { label: 'open tasks', value: String(openTasks), color: 'var(--cv-status-working)' },
          { label: 'blocked', value: String(blockedTasks), color: 'var(--cv-status-blocked)' },
          { label: 'done', value: String(doneTasks), color: 'var(--cv-status-success)' },
        ].map((s) => (
          <div key={s.label} style={{
            background: 'var(--cv-paper-100)',
            boxShadow: 'var(--cv-panel-border-inset)',
            padding: '8px 10px', textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'var(--cv-font-display)', fontSize: 17, lineHeight: '22px', color: s.color, fontWeight: 700 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--cv-ink-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* status legend */}
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        fontSize: 10.5, color: 'var(--cv-ink-500)', fontFamily: 'var(--cv-font-mono)',
      }}>
        {Object.entries(byStatus).map(([st, n]) => (
          <span key={st} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(st) }} />
            {st} {n}
          </span>
        ))}
      </div>

      {/* engine + integrations */}
      <div style={{
        background: 'var(--cv-paper-100)',
        boxShadow: 'var(--cv-panel-border-inset)',
        padding: '8px 10px', fontSize: 11, lineHeight: '17px', color: 'var(--cv-ink-700)',
        fontFamily: 'var(--cv-font-mono)',
      }}>
        <div>
          orchestrator:{' '}
          <b style={{ color: backend.online ? 'var(--cv-status-success)' : 'var(--cv-status-blocked)' }}>
            {backend.online ? 'online' : 'offline'}
          </b>
          {' · '}v{backend.version || '—'} · {backend.routerMode} router
        </div>
        <div>
          ollama <b style={{ color: backend.ollamaConnected ? 'var(--cv-status-success)' : 'var(--cv-status-working)' }}>
            {backend.ollamaConnected ? 'connected' : 'not connected'}
          </b>
          {' · '}{backend.modelsInstalled} models · memory {backend.memoryTotal} entries
        </div>
        <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
          <button
            onClick={() => setSettingsOpen(true, 'integrations')}
            style={linkStyle}
          >integrations…</button>
          <button
            onClick={() => setSettingsOpen(true, 'memory')}
            style={linkStyle}
          >memory…</button>
        </div>
      </div>

      {/* roster */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {agents.map((a) => (
          <div
            key={a.id}
            onClick={() => select(a.id)}
            title={`${a.name} — ${a.project}`}
            style={{
              display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer',
              background: 'var(--cv-paper-100)',
              boxShadow: 'var(--cv-panel-border-inset)',
              padding: '5px 8px',
            }}
          >
            <span style={{
              width: 9, height: 9, flexShrink: 0, borderRadius: '50%',
              background: statusColor(a.status),
            }} />
            <span style={{
              flex: 1, fontSize: 12, color: 'var(--cv-ink-900)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {a.name}{a.isCommander ? ' ★' : ''}
            </span>
            <span style={{
              fontSize: 10, color: 'var(--cv-ink-500)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140,
              fontFamily: 'var(--cv-font-mono)',
            }}>{a.action !== 'awaiting' ? a.action : a.model}</span>
            {commander && a.id === commander.id && (
              <button
                onClick={(e) => { e.stopPropagation(); setFullscreen(a.id); }}
                title="Maximize commander session"
                style={iconBtnStyle}
              >⤢</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityBody() {
  const feeds = useStore((s) => s.feeds);
  const agents = useStore((s) => s.agents);

  const lines: Array<{ agent: string; line: string }> = [];
  for (const a of agents) {
    for (const l of feeds[a.id] ?? []) lines.push({ agent: a.name, line: l });
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 10, fontFamily: 'var(--cv-font-mono)', fontSize: 11, lineHeight: '18px' }}>
      {lines.length === 0 && (
        <span style={{ color: 'var(--cv-ink-500)', fontFamily: 'var(--cv-font-ui)' }}>
          no activity yet — prompt an agent to get the formation moving.
        </span>
      )}
      {lines.map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, color: 'var(--cv-ink-700)' }}>
          <span style={{ flexShrink: 0, color: 'var(--cv-violet-soft)' }}>[{l.agent}]</span>
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', minWidth: 0 }}>
            {l.line.replace(/\x1b\[[0-9;]*m/g, '')}
          </span>
        </div>
      ))}
    </div>
  );
}

const linkStyle: CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
  fontSize: 11, color: 'var(--cv-cyan)', textDecoration: 'underline',
  fontFamily: 'var(--cv-font-ui)',
};

const iconBtnStyle: CSSProperties = {
  width: 22, height: 20, border: 'none', cursor: 'pointer',
  background: 'var(--cv-cream-100)',
  boxShadow: 'var(--cv-panel-border-inset)',
  color: 'var(--cv-ink-500)', fontSize: 11, lineHeight: 1, flexShrink: 0,
};