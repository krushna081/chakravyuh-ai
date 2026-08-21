import { Icon, type IconName } from './Icon';
import type { SidebarTab } from '../store/store';

export interface SidebarTabsProps {
  active: SidebarTab;
  onSelect: (tab: SidebarTab) => void;
  /** Queued-message counts per agent, shown as badges on the messages tab. */
  queues?: Record<string, number>;
  accent?: string;
}

const TABS: Array<{ id: SidebarTab; icon: IconName; label: string }> = [
  { id: 'terminal', icon: 'terminal', label: 'session' },
  { id: 'workflows', icon: 'code', label: 'workflows' },
  { id: 'messages', icon: 'bell', label: 'messages' },
  { id: 'traces', icon: 'web', label: 'traces' },
];

export function SidebarTabs({ active, onSelect, queues = {}, accent = 'lilac' }: SidebarTabsProps) {
  const totalQueued = Object.values(queues).reduce((a, b) => a + b, 0);
  return (
    <div
      style={{
        display: 'flex',
        flexShrink: 0,
        background: 'var(--cv-cream-200)',
        boxShadow: 'inset 0 -2px 0 var(--cv-ink-900)',
        overflowX: 'auto',
      }}
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        const badge = tab.id === 'messages' && totalQueued > 0 ? totalQueued : 0;
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            title={tab.label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              flex: 1,
              minWidth: 0,
              height: 36,
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              border: 'none',
              background: isActive ? 'var(--cv-cream-100)' : 'transparent',
              boxShadow: isActive
                ? `inset -1px 0 0 var(--cv-ink-300), inset 1px 0 0 var(--cv-ink-300), inset 0 -3px 0 var(--cv-${accent})`
                : 'none',
              fontFamily: 'var(--cv-font-display)',
              fontSize: 8,
              lineHeight: '12px',
              color: 'var(--cv-ink-900)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Icon name={tab.icon} size={1} />
            {tab.label}
            {badge > 0 && (
              <span style={{
                minWidth: 14, height: 14, padding: '0 3px', boxSizing: 'border-box',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--cv-coral)', color: 'var(--cv-ink-900)',
                fontFamily: 'var(--cv-font-display)', fontSize: 7, lineHeight: '14px',
              }}>{badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}