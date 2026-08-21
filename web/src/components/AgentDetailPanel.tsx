import { useEffect, useState } from 'react';
import { useStore } from '../store/store';
import { PixelBadge, type StatusKind } from './PixelBadge';
import { PixelButton } from './PixelButton';
import { Icon } from './Icon';
import { SessionStream } from './SessionStream';
import { Composer } from './Composer';
import { SidebarTabs } from './SidebarTabs';
import type { SidebarTab } from '../store/store';
import { SidebarSplitter } from './SidebarSplitter';
import { CallSignBadge } from './CallSignBadge';

const SKILL_KEYS: Array<[string, string]> = [
  ['web', 'WebFetch'], ['search', 'WebSearch'], ['grep', 'Grep'], ['glob', 'Glob'],
  ['read', 'Read'], ['edit', 'Edit'], ['write', 'Write'], ['bash', 'Bash'],
  ['todo', 'TodoWrite'], ['mcp', 'MCP'],
];

/**
 * Right-hand detail panel for the selected agent: identity header, control
 * strip (focus / cc / maximize), and the four sidebar tabs (terminal feed,
 * workflows, messages, traces).
 */
export function AgentDetailPanel() {
  const agent = useStore((s) => s.agents.find((a) => a.id === s.selectedId));
  const select = useStore((s) => s.select);
  const setSidebarTab = useStore((s) => s.setSidebarTab);
  const sidebarTab = useStore((s) => s.sidebarTab);
  const sidebarWidth = useStore((s) => s.sidebarWidth);
  const setSidebarWidth = useStore((s) => s.setSidebarWidth);
  const setFullscreen = useStore((s) => s.setFullscreen);
  const ccTabRequest = useStore((s) => s.ccTabRequest);
  const consumeCcTabRequest = useStore((s) => s.consumeCcTabRequest);
  const requestCommandCenterTab = useStore((s) => s.requestCommandCenterTab);
  const enqueueMessage = useStore((s) => s.enqueueMessage);
  const releaseQueuedMessage = useStore((s) => s.releaseQueuedMessage);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const agents = useStore((s) => s.agents);
  const tasks = useStore((s) => s.tasks);

  const [showQueue, setShowQueue] = useState(false);

  useEffect(() => {
    const req = consumeCcTabRequest();
    if (req) {
      const t = req as SidebarTab;
      if (['terminal', 'workflows', 'messages', 'traces'].includes(t)) {
        setSidebarTab(t);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ccTabRequest?.seq]);

  if (!agent) {
    return (
      <div style={{ padding: 24, fontSize: 12, color: 'var(--cv-ink-500)', fontFamily: 'var(--cv-font-ui)' }}>
        no agent selected — click a token on the floor or a card in the roster.
      </div>
    );
  }

  const taskCount = tasks.filter((t) => t.status === 'queued' || t.status === 'running').length;
  const queue = useStore.getState().messageQueues[agent.id] ?? [];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--cv-cream-200)',
        borderLeft: '1px solid var(--cv-ink-300)',
        minWidth: 0,
      }}
    >
      {/* Identity header */}
      <div
        style={{
          padding: '10px 12px 8px',
          borderBottom: '1px dashed var(--cv-ink-300)',
          background: 'var(--cv-cream-100)',
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{
            width: 46, height: 56,
            background: agent.isCommander ? 'var(--cv-paper-100)' : `var(--cv-${agent.accent}-light)`,
            boxShadow: 'inset 0 0 0 1px var(--cv-ink-300)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <CallSignBadge callSign={agent.callSign} accent={agent.accent} size={36} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h2 style={{
                margin: 0,
                fontFamily: 'var(--cv-font-display)',
                fontSize: 'var(--cv-text-display-md)',
                lineHeight: 'var(--cv-lh-display-md)',
                color: 'var(--cv-ink-900)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{agent.name}</h2>
              {agent.isCommander && (
                <span style={{
                  fontFamily: 'var(--cv-font-display)', fontSize: 8,
                  background: `var(--cv-${agent.accent})`, color: 'var(--cv-ink-900)',
                  padding: '1px 5px 0', whiteSpace: 'nowrap',
                }}>COMMANDER</span>
              )}
              <PixelBadge status={agent.status as StatusKind} style={{ flexShrink: 0 }} />
            </div>
            <div style={{
              fontSize: 11, color: 'var(--cv-ink-500)', marginTop: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {agent.project}
            </div>
            <div style={{
              fontSize: 10.5, color: 'var(--cv-ink-500)', marginTop: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              fontStyle: 'italic',
            }}>
              {agent.description || 'no description set'}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
            <button
              onClick={() => setFullscreen(agent.id)}
              title="Maximize session"
              aria-label="Maximize session"
              style={{
                width: 26, height: 22,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--cv-cream-100)', border: 'none', cursor: 'pointer',
                boxShadow: 'inset 0 0 0 1px var(--cv-ink-300)',
                color: 'var(--cv-ink-700)',
              }}
            >
              <Icon name="expand" size={0.8} />
            </button>
            <button
              onClick={() => { setSettingsOpen(true, 'agents'); }}
              title="Agent settings"
              aria-label="Agent settings"
              style={{
                width: 26, height: 22,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--cv-cream-100)', border: 'none', cursor: 'pointer',
                boxShadow: 'inset 0 0 0 1px var(--cv-ink-300)',
                color: 'var(--cv-ink-700)',
              }}
            >
              <Icon name="gear" size={0.8} />
            </button>
          </div>
        </div>

        {/* control strip */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
          <PixelButton variant="secondary" size="sm" onClick={() => setShowQueue((v) => !v)}>
            <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', whiteSpace: 'nowrap' }}>
              <Icon name="bell" size={0.7} />
              {queue.length > 0 ? `${queue.length} queued` : 'queue'}
            </span>
          </PixelButton>
          <PixelButton variant="secondary" size="sm" onClick={() => { requestCommandCenterTab('workflows'); }}>
            <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', whiteSpace: 'nowrap' }}>
              <Icon name="code" size={0.7} /> cc
            </span>
          </PixelButton>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {SKILL_KEYS.map(([key, skill]) => (
              <span
                key={key}
                title={skill}
                style={{
                  fontFamily: 'var(--cv-font-mono)', fontSize: 9,
                  color: agent.capabilities?.includes(skill) || agent.capabilities == null
                    ? 'var(--cv-ink-900)' : 'var(--cv-ink-500)',
                  background: agent.capabilities?.includes(skill) || agent.capabilities == null
                    ? `var(--cv-${agent.accent}-light)` : 'var(--cv-cream-200)',
                  boxShadow: 'inset 0 0 0 1px var(--cv-ink-100)',
                  padding: '0 4px', lineHeight: '15px',
                }}
              >
                {key}
              </span>
            ))}
          </span>
        </div>

        {showQueue && (
          <div style={{
            marginTop: 8, padding: 6, background: 'var(--cv-paper-100)',
            boxShadow: 'inset 0 0 0 1px var(--cv-ink-300)',
            display: 'flex', flexDirection: 'column', gap: 4,
            maxHeight: 140, overflowY: 'auto',
          }}>
            {queue.length === 0 && (
              <span style={{ fontSize: 11, color: 'var(--cv-ink-500)' }}>queue empty — prompts go here while the agent is busy.</span>
            )}
            {queue.map((m) => (
              <div key={m.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11 }}>
                <span style={{
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: 'var(--cv-ink-900)', fontFamily: 'var(--cv-font-mono)', fontSize: 10.5,
                }}>{m.text}</span>
                {m.manual && <span style={{ color: 'var(--cv-status-blocked)', fontSize: 9 }}>●</span>}
                <button
                  onClick={() => releaseQueuedMessage(agent.id, m.id)}
                  title="Move to front (auto-send)"
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--cv-font-ui)', fontSize: 10, color: 'var(--cv-ink-500)',
                    textDecoration: 'underline', padding: 0,
                  }}
                >send now</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* tabs */}
      <SidebarTabs
        active={sidebarTab}
        onSelect={(t) => setSidebarTab(t)}
        queues={Object.entries(useStore.getState().messageQueues).reduce<Record<string, number>>((acc, [k, v]) => {
          acc[k] = v.length;
          return acc;
        }, {})}
      />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {sidebarTab === 'terminal' && (
          <SessionStream agentId={agent.id} />
        )}
        {sidebarTab === 'workflows' && (
          <WorkflowList agent={agent} tasks={tasks} openTaskDetail={useStore.getState().openTaskDetail} />
        )}
        {sidebarTab === 'messages' && (
          <MessageList agentId={agent.id} />
        )}
        {sidebarTab === 'traces' && (
          <TraceList agentId={agent.id} />
        )}
      </div>
      {sidebarTab === 'terminal' && <Composer agentId={agent.id} />}
    </div>
  );
}

function WorkflowList({ agent, tasks, openTaskDetail }: {
  agent: { id: string };
  tasks: Array<{ id: string; description: string; status: string; steps: Array<{ agent: string; status: string }> }>;
  openTaskDetail: (id: string) => void;
}) {
  const mine = tasks.filter((t) => (t.steps ?? []).some((s) => s.agent === agent.id));
  return (
    <div style={{ padding: 8, overflowY: 'auto', height: '100%' }}>
      {mine.length === 0 && (
        <span style={{ fontSize: 11, color: 'var(--cv-ink-500)' }}>
          no workflows assigned — queue a task from the kanban (commander panel) or the composer's task mode.
        </span>
      )}
      {mine.map((t) => (
        <button
          key={t.id}
          onClick={() => openTaskDetail(t.id)}
          style={{
            width: '100%', textAlign: 'left', padding: '6px 8px', marginBottom: 6,
            background: 'var(--cv-paper-100)',
            boxShadow: 'var(--cv-panel-border-inset)',
            border: 'none', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center',
          }}
        >
          <span style={{
            width: 8, height: 8, flexShrink: 0, borderRadius: '50%',
            background: t.status === 'completed' ? 'var(--cv-status-success)'
              : t.status === 'failed' ? 'var(--cv-status-blocked)'
                : t.status === 'running' ? 'var(--cv-status-working)' : 'var(--cv-status-idle)',
          }} />
          <span style={{
            flex: 1, fontSize: 12, color: 'var(--cv-ink-900)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{t.description}</span>
          <span style={{ fontSize: 10, color: 'var(--cv-ink-500)', fontFamily: 'var(--cv-font-mono)' }}>{t.status}</span>
        </button>
      ))}
    </div>
  );
}

function MessageList({ agentId }: { agentId: string }) {
  const queue = useStore((s) => s.messageQueues[agentId] ?? []);
  const feeds = useStore((s) => s.feeds[agentId] ?? []);
  return (
    <div style={{ padding: 8, overflowY: 'auto', height: '100%', fontFamily: 'var(--cv-font-ui)' }}>
      <div style={{ fontSize: 11, color: 'var(--cv-ink-500)', marginBottom: 6 }}>
        queued ({queue.length})
      </div>
      {queue.map((m) => (
        <div key={m.id} style={{
          fontSize: 12, color: 'var(--cv-ink-900)', marginBottom: 4,
          background: 'var(--cv-paper-100)',
          boxShadow: 'inset 0 0 0 1px var(--cv-ink-100)',
          padding: '4px 8px',
        }}>{m.text}</div>
      ))}
      <div style={{ fontSize: 11, color: 'var(--cv-ink-500)', margin: '10px 0 6px' }}>
        recent feed ({feeds.length})
      </div>
      {feeds.slice(-12).map((l, i) => (
        <div key={i} style={{
          fontSize: 11, color: 'var(--cv-ink-700)', marginBottom: 2,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          fontFamily: 'var(--cv-font-mono)',
        }}>{l}</div>
      ))}
    </div>
  );
}

function TraceList({ agentId }: { agentId: string }) {
  const feed = useStore((s) => s.feeds[agentId] ?? []);
  const events = feed.filter((l) => l.includes('●') || l.includes('tool'));
  return (
    <div style={{ padding: 8, overflowY: 'auto', height: '100%', fontFamily: 'var(--cv-font-mono)', fontSize: 11 }}>
      {events.length === 0 && (
        <span style={{ color: 'var(--cv-ink-500)', fontFamily: 'var(--cv-font-ui)' }}>
          no trace events yet — send a prompt to generate activity.
        </span>
      )}
      {events.slice(-30).map((l, i) => (
        <div key={i} style={{ color: 'var(--cv-ink-700)', marginBottom: 3, whiteSpace: 'pre-wrap' }}>{l}</div>
      ))}
    </div>
  );
}