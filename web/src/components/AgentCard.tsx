import { useState } from 'react';
import { PixelPanel } from './PixelPanel';
import { PixelBadge, type StatusKind } from './PixelBadge';
import { CallSignBadge } from './CallSignBadge';
import type { AccentColorName } from '../design/tokens';

export interface AgentCardProps {
  name: string;
  callSign: string;
  accent: AccentColorName;
  status: StatusKind;
  project: string;
  action?: string;
  progress?: number;
  contextTokens?: number;
  contextLimit?: number;
  selected?: boolean;
  isCommander?: boolean;
  onClick?: () => void;
  doingCount?: number;
  onTaskNoteClick?: () => void;
  draggable?: boolean;
  note?: string;
  onEditNote?: () => void;
}

const fmtK = (n: number): string => `${Math.round(n / 1000)}k`;

/** Compact roster card — identity row, one context line, one note row, and a
 *  slim context gauge pinned to the bottom edge. */
export function AgentCard({
  name, callSign, accent, status, project, action, progress = 0,
  contextTokens, contextLimit, selected, isCommander, onClick,
  doingCount = 0, onTaskNoteClick, draggable, note, onEditNote,
}: AgentCardProps) {
  const [hover, setHover] = useState(false);

  const selectionRing = selected ? '0 0 0 2px var(--cv-ink-900)' : '';

  const pct = Math.min(8, Math.max(0, progress)) / 8 * 100;
  const gaugeColor = progress >= 7 ? 'var(--cv-coral)'
    : progress >= 6 ? 'var(--cv-lemon)'
      : `var(--cv-${accent})`;
  const gaugeTitle = contextTokens !== undefined && contextLimit
    ? `Context: ${fmtK(contextTokens)} / ${fmtK(contextLimit)} tokens (${Math.round((contextTokens / contextLimit) * 100)}%)`
    : 'Context gauge — fills once the agent reports activity';

  const width = 220;
  const height = 78;
  const lift = (isCommander ? -2 : 0) - (hover ? 1 : 0) - (selected ? 1 : 0);
  const commanderSurface: React.CSSProperties = isCommander
    ? {
        background: `var(--cv-${accent}-light)`,
        boxShadow: `inset 0 0 0 1px var(--cv-${accent})`,
      }
    : {};
  const dropShadow = isCommander
    ? `2px 3px 0 0 rgba(26,19,32,${hover ? 0.2 : 0.14})`
    : (hover ? '1px 2px 0 0 rgba(26,19,32,0.12)' : 'none');
  const outerShadow = [selectionRing, dropShadow === 'none' ? '' : dropShadow]
    .filter(Boolean).join(', ') || 'none';

  const infoLine = (status !== 'idle' && action) ? action : project;
  const noteFirstLine = (note ?? '').split('\n').find((l) => l.trim()) ?? '';

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      draggable={draggable}
      aria-current={selected ? 'true' : undefined}
      style={{
        width, minWidth: width, height,
        padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
        position: 'relative',
        transform: lift ? `translateY(${lift}px)` : 'none',
        boxShadow: outerShadow,
        transition: 'transform 90ms steps(2, end), box-shadow 90ms steps(2, end)',
      }}
    >
      {doingCount > 0 && (
        <span
          title={`actively working ${doingCount} task${doingCount === 1 ? '' : 's'} — click to open`}
          onClick={(e) => { e.stopPropagation(); onTaskNoteClick?.(); }}
          style={{
            position: 'absolute', right: -4, bottom: -5, zIndex: 2,
            width: 20, height: 18,
            background: 'var(--cv-sky)',
            boxShadow: 'inset 0 0 0 1px var(--cv-ink-300), 1px 2px 0 rgba(26,19,32,0.18)',
            transform: 'rotate(4deg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--cv-font-display)', fontSize: 8, color: 'var(--cv-ink-900)',
            cursor: 'pointer',
          }}
        >
          {doingCount > 1 ? doingCount : '✎'}
        </span>
      )}
      <PixelPanel
        variant="default"
        style={{ height: '100%', padding: '6px 8px', ...commanderSurface }}
        noPadding
      >
        <div style={{ display: 'flex', gap: 8, height: '100%' }}>
          <div style={{
            width: 36, height: isCommander ? 50 : 46, alignSelf: 'center',
            background: isCommander ? 'var(--cv-paper-100)' : `var(--cv-${accent}-light)`,
            boxShadow: `inset 0 0 0 1px var(--cv-ink-${isCommander ? '300' : '100'})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <CallSignBadge callSign={callSign} accent={accent} size={32} />
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between', minWidth: 0 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                <span style={{
                  fontFamily: 'var(--cv-font-display)',
                  fontSize: 'var(--cv-text-display-sm)',
                  lineHeight: 'var(--cv-lh-display-sm)',
                  color: 'var(--cv-ink-900)',
                  flex: 1, minWidth: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{name.toUpperCase()}</span>
                {isCommander && (
                  <span style={{
                    fontFamily: 'var(--cv-font-display)', fontSize: 7, lineHeight: '11px',
                    background: `var(--cv-${accent})`, color: 'var(--cv-ink-900)',
                    padding: '1px 4px 0', flexShrink: 0,
                  }}>CMDR</span>
                )}
              </span>
              <PixelBadge status={status} style={{ flexShrink: 0 }} />
            </div>

            <div
              title={`${project}${action && status !== 'idle' ? ` — ${action}` : ''}`}
              style={{
                fontSize: 11, lineHeight: '14px',
                color: 'var(--cv-ink-500)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >{infoLine}</div>

            <div
              onClick={(e) => e.stopPropagation()}
              style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, minHeight: 14 }}
            >
              {noteFirstLine ? (
                <span
                  title={note}
                  style={{
                    flex: 1, minWidth: 0, fontSize: 10.5, lineHeight: '14px',
                    color: 'var(--cv-ink-500)', fontStyle: 'italic',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >{noteFirstLine}</span>
              ) : <span style={{ flex: 1 }} />}
              {onEditNote && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onEditNote(); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onEditNote(); }
                  }}
                  title={note ? 'Edit private note' : 'Add private note'}
                  aria-label={`Edit note for ${name}`}
                  style={{
                    flexShrink: 0, width: 15, height: 14,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, lineHeight: 1, cursor: 'pointer',
                    color: hover ? 'var(--cv-ink-500)' : 'var(--cv-ink-300)',
                  }}
                >✎</span>
              )}
            </div>

            <div style={{ marginTop: 'auto' }} title={gaugeTitle}>
              <div style={{
                height: 4, width: '100%',
                background: 'var(--cv-cream-200)',
                boxShadow: 'inset 0 0 0 1px var(--cv-ink-100)',
                overflow: 'hidden',
              }}>
                <div style={{ width: `${pct}%`, height: '100%', background: gaugeColor }} />
              </div>
            </div>
          </div>
        </div>
      </PixelPanel>
    </button>
  );
}