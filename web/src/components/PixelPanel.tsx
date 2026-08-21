import type { CSSProperties, ReactNode } from 'react';
import type { AccentColorName } from '../design/tokens';

type Variant = 'default' | 'inset' | 'active' | 'terminal' | 'dialog';

export interface PixelPanelProps {
  variant?: Variant;
  title?: string;
  accent?: AccentColorName;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  noPadding?: boolean;
}

const borderByVariant: Record<Variant, string> = {
  default: 'var(--cv-panel-border)',
  inset: 'var(--cv-panel-border-inset)',
  active: 'var(--cv-panel-border)',
  terminal: 'var(--cv-panel-border-terminal)',
  dialog: 'var(--cv-panel-border-dialog)',
};

const fillByVariant: Record<Variant, string> = {
  default: 'var(--cv-cream-100)',
  inset: 'var(--cv-cream-200)',
  active: 'var(--cv-cream-100)',
  terminal: 'var(--cv-paper-100)',
  dialog: 'var(--cv-cream-50)',
};

export function PixelPanel({
  variant = 'default',
  title,
  accent,
  children,
  style,
  className,
  noPadding = false,
}: PixelPanelProps) {
  const baseStyle: CSSProperties = {
    background: fillByVariant[variant],
    boxShadow: borderByVariant[variant],
    padding: noPadding ? 0 : 'var(--cv-space-3)',
    position: 'relative',
    ...style,
  };

  if (variant === 'active' && accent) {
    baseStyle.boxShadow = `
      inset 0 0 0 1px var(--cv-ink-100),
      inset 0 0 0 3px var(--cv-${accent}),
      inset 0 0 0 5px var(--cv-ink-900)`;
  }

  return (
    <div className={className} style={baseStyle}>
      {title && (
        <div
          style={{
            margin: noPadding ? 0 : '-12px -12px 12px',
            padding: '6px 12px 4px',
            background: accent ? `var(--cv-${accent})` : 'var(--cv-cream-200)',
            color: 'var(--cv-ink-900)',
            fontFamily: 'var(--cv-font-display)',
            fontSize: 'var(--cv-text-display-md)',
            lineHeight: 'var(--cv-lh-display-md)',
            boxShadow: 'inset 0 -1px 0 var(--cv-ink-900)',
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}