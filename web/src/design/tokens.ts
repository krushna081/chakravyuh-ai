/** Design tokens for TS consumers (accent names, type scale). */

export type AccentColorName = 'coral' | 'mint' | 'sky' | 'lemon' | 'lilac' | 'peach';

export const ACCENT_NAMES: AccentColorName[] = ['coral', 'mint', 'sky', 'lemon', 'lilac', 'peach'];

/** Soft "light" fills double as chip/selection backgrounds in both themes. */
export function accentLight(accent: AccentColorName): string {
  return `var(--cv-${accent}-light)`;
}

export function accent(accent: AccentColorName): string {
  return `var(--cv-${accent})`;
}

const STATUS_COLORS: Record<string, string> = {
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

export function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? 'var(--cv-status-idle)';
}