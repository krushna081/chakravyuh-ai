import type { CSSProperties } from 'react';

export type StatusKind =
  | 'idle' | 'thinking' | 'working' | 'waiting' | 'blocked' | 'success' | 'ghost'
  | 'compacting' | 'looping' | 'typing';

export interface PixelBadgeProps {
  status: StatusKind;
  label?: string;
  style?: CSSProperties;
}

const colorByStatus: Record<StatusKind, string> = {
  idle: 'var(--cv-status-idle)',
  thinking: 'var(--cv-status-thinking)',
  working: 'var(--cv-status-working)',
  waiting: 'var(--cv-status-waiting)',
  blocked: 'var(--cv-status-blocked)',
  success: 'var(--cv-status-success)',
  ghost: 'var(--cv-status-ghost)',
  compacting: 'var(--cv-status-compacting)',
  looping: 'var(--cv-status-looping)',
  typing: 'var(--cv-status-typing)',
};

const labelByStatus: Record<StatusKind, string> = {
  idle: 'idle',
  thinking: 'working',
  working: 'working',
  waiting: 'waiting',
  blocked: 'needs you',
  success: 'done',
  ghost: 'gone',
  compacting: 'compacting',
  looping: 'looping',
  typing: 'your draft',
};

export function PixelBadge({ status, label, style }: PixelBadgeProps) {
  const text = label ?? labelByStatus[status] ?? status;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px 0',
        background: 'var(--cv-cream-100)',
        boxShadow: `inset 0 0 0 1px ${colorByStatus[status]}`,
        fontFamily: 'var(--cv-font-ui)',
        fontSize: 'var(--cv-text-body-sm)',
        lineHeight: '18px',
        color: 'var(--cv-ink-900)',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          background: colorByStatus[status],
          boxShadow: 'inset 0 0 0 1px var(--cv-ink-300)',
        }}
      />
      {text}
    </span>
  );
}