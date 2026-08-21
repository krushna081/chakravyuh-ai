import { useStore } from '../store/store';
import { SessionStream } from './SessionStream';
import { Composer } from './Composer';
import { CallSignBadge } from './CallSignBadge';

/**
 * Fullscreen session for one agent — the single-task "focus" view.
 * (Web equivalent of a maximized terminal window.)
 */
export function FullscreenSession() {
  const agentId = useStore((s) => s.fullscreenAgentId);
  const setFullscreen = useStore((s) => s.setFullscreen);
  const agent = useStore((s) => s.agents.find((a) => a.id === s.fullscreenAgentId));

  if (!agentId || !agent) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 950,
        background: 'var(--cv-cream-200)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--cv-font-ui)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px',
        background: 'var(--cv-ink-900)',
        color: 'var(--cv-cream-50)',
      }}>
        <CallSignBadge callSign={agent.callSign} accent={agent.accent} size={26} />
        <span style={{ fontFamily: 'var(--cv-font-display)', fontSize: 'var(--cv-text-display-sm)' }}>
          {agent.name.toUpperCase()} — SESSION
        </span>
        <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>
          {agent.project}
        </span>
        <button
          onClick={() => setFullscreen(null)}
          title="Minimize"
          aria-label="Minimize session"
          style={{
            marginLeft: 'auto', width: 28, height: 24, border: 'none', cursor: 'pointer',
            background: 'var(--cv-cream-100)', color: 'var(--cv-ink-900)',
            fontFamily: 'var(--cv-font-ui)', fontSize: 12, lineHeight: 1,
          }}
        >—</button>
      </div>
      <SessionStream agentId={agent.id} />
      <Composer agentId={agent.id} />
    </div>
  );
}