/**
 * App theme — the premium dark aesthetic is the single theme.
 * Kept as a tiny API so existing consumers keep working; the toggle is a
 * no-op (dark-only per design directive).
 */
import { useSyncExternalStore } from 'react';

export type AppTheme = 'dark';

const LS_KEY = 'cv.theme';
const THEME: AppTheme = 'dark';

function apply(): void {
  try { document.documentElement.dataset.cvTheme = THEME; } catch { /* noop */ }
}
apply();

export function appTheme(): AppTheme {
  return THEME;
}

export function setAppTheme(_next: AppTheme): void {
  apply();
}

export function toggleAppTheme(): AppTheme {
  return THEME;
}

export function useAppTheme(): AppTheme {
  return useSyncExternalStore(
    () => () => {},
    () => THEME
  );
}