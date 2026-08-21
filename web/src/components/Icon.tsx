// 16×16 pixel icons. 2 colors max. Integer paths only.

import type { CSSProperties } from 'react';

export type IconName =
  | 'gear' | 'plus' | 'x' | 'check' | 'arrow-right' | 'pause' | 'play'
  | 'bell' | 'folder' | 'terminal' | 'code' | 'web' | 'mcp' | 'sparkle'
  | 'expand' | 'minimize' | 'clock' | 'mic' | 'ledger' | 'info' | 'sidebar'
  | 'image' | 'shield' | 'eye';

interface IconDef {
  ink: string;
  accent?: string;
  accentColor: string;
}

const paths: Record<IconName, IconDef> = {
  gear: {
    accentColor: 'var(--cv-ink-300)',
    ink: 'M6 1h4v3h2v2h3v4h-3v2h-2v3h-4v-3h-2v-2h-3v-4h3v-2h2v-3zM6 6h4v4h-4z',
  },
  plus: {
    accentColor: 'var(--cv-mint)',
    ink: 'M7 2h2v5h5v2H9v5H7V9H2V7h5V2z',
  },
  x: {
    accentColor: 'var(--cv-coral)',
    ink: 'M3 3h2v2h2v2h2V5h2V3h2v2h-2v2h-2v2h2v2h2v2h-2v-2h-2V9H7v2H5v2H3v-2h2v-2h2V7H5V5H3V3z',
  },
  check: {
    accentColor: 'var(--cv-mint)',
    ink: 'M13 4h2v2h-2v2h-2v2H9v2H7v2H5v-2H3v-2H1V8h2v2h2v2h2v-2h2V8h2V6h2V4z',
  },
  'arrow-right': {
    accentColor: 'var(--cv-sky)',
    ink: 'M8 3h2v2h2v2h2v2h-2v2h-2v2H8v-2h2V9H2V7h8V5H8V3z',
  },
  pause: {
    accentColor: 'var(--cv-lemon)',
    ink: 'M4 3h3v10H4V3zm5 0h3v10H9V3z',
  },
  play: {
    accentColor: 'var(--cv-mint)',
    ink: 'M4 3h2v2h2v2h2v2H8v2H6v2H4V3z',
  },
  bell: {
    accentColor: 'var(--cv-peach)',
    ink: 'M7 1h2v1h1v1h1v6h1v2H3V9h1V3h1V2h1V1h1zm0 12h2v2H7v-2z',
  },
  folder: {
    accentColor: 'var(--cv-lemon)',
    ink: 'M1 3h6v1h8v9H1V3zm1 1v8h12V5H6V4H2z',
  },
  image: {
    accentColor: 'var(--cv-lemon)',
    accent: 'M4 5h2v2H4V5z',
    ink: 'M1 2h14v12H1V2zm1 1v10h12V3H2zM8 6h2v1H8zM7 7h4v1H7zM6 8h6v1H6zM5 9h8v1H5zM4 10h9v2H4z',
  },
  terminal: {
    accentColor: 'var(--cv-mint)',
    ink: 'M1 2h14v12H1V2zm1 1v10h12V3H2zm1 2h1v1h1v1h1v1H5v1H4v1H3V9h1V8h1V7H4V6H3V5zm5 5h4v1H8v-1z',
  },
  code: {
    accentColor: 'var(--cv-sky)',
    ink: 'M5 3h1v1H5v1H4v1H3v1H2v1h1v1h1v1h1v1h1v1H5v-1H4v-1H3v-1H2v-1H1V7h1V6h1V5h1V4h1V3zm5 0h1v1h1v1h1v1h1v1h1v1h-1v1h-1v1h-1v1h-1v1h-1v-1h1v-1h1v-1h1V9h1V7h-1V6h-1V5h-1V4h-1V3z',
  },
  web: {
    accentColor: 'var(--cv-lilac)',
    ink: 'M7 1h2v1h2v1h1v1h1v2h1v2h-1v2h-1v1h-1v1H9v1H7v-1H5v-1H4v-1H3V9H2V7h1V5h1V4h1V3h2V2h0V1zm0 2v1H5v1H4v1H3v2h2V8h0V7h2V6h0V5h2V4h0V3H7zm2 1h1v1h1v1h1v2h-1v1H9V8h1V7h0V6h0V5h-1V4z',
  },
  mcp: {
    accentColor: 'var(--cv-lilac)',
    ink: 'M8 1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h-1v1h-1v1h-1v1h-1v1h-1v1H8v1H7v-1H6v-1H5v-1H4v-1H3v-1H2V9H1V8h1V7h1V6h1V5h1V4h1V3h1V2h1V1zm0 2v1H7v1H6v1H5v1H4v1H3v1h1v1h1v1h1v1h1v1h1v1h1v-1h1v-1h1v-1h1v-1h1V9h1V8h-1V7h-1V6h-1V5h-1V4h-1V3h-1V2H8z',
  },
  sparkle: {
    accentColor: 'var(--cv-lemon)',
    ink: 'M8 1h1v3h3v1H9v3H8V5H5V4h3V1zm-4 8h1v2h2v1H5v2H4v-2H2v-1h2V9zm8-1h1v2h2v1h-2v2h-1v-2H10v-1h2V8z',
  },
  expand: {
    accentColor: 'var(--cv-sky)',
    ink: 'M1 1h6v2H3v4H1V1zm14 0v6h-2V3H9V1h6zM1 9h2v4h4v2H1V9zm14 0v6H9v-2h4V9h2z',
  },
  minimize: {
    accentColor: 'var(--cv-sky)',
    ink: 'M5 1h2v6H1V5h4V1zm4 0h2v4h4v2H9V1zM1 9h6v6H5v-4H1V9zm8 0h6v2h-4v4H9V9z',
  },
  clock: {
    accentColor: 'var(--cv-lemon)',
    ink: 'M5 1h6v1h2v2h1v2h1v4h-1v2h-1v2h-2v1H5v-1H3v-2H2V8H1V6h1V4h1V2h2V1zm0 2H4v1H3v2H2v4h1v2h1v1h1v1h6v-1h1v-1h1v-2h1V6h-1V4h-1V3h-1V2H5v1zm2 1h2v4h2v1h1v1h-1v1h-1v-1H9v1H7V4z',
  },
  ledger: {
    accentColor: 'var(--cv-lemon)',
    ink: 'M2 1h12v14H2V1zM3 2v12h10V2H3zM5 4h6v1H5zM5 7h6v1H5zM5 10h4v1H5z',
  },
  mic: {
    accentColor: 'var(--cv-coral)',
    ink: 'M6 2h4v7H6V2z M4 9h1v2H4z M11 9h1v2h-1z M4 11h8v1H4z M7 12h2v2H7z M5 14h6v1H5z',
  },
  info: {
    accentColor: 'var(--cv-sky)',
    ink: 'M5 1h6v1h2v1h1v2h1v6h-1v2h-1v1h-2v1H5v-1H3v-1H2v-2H1V5h1V3h1V2h2V1z M7 4h2v2H7z M7 7h2v5H7z',
  },
  sidebar: {
    accentColor: 'var(--cv-ink-300)',
    ink: 'M1 3h14v10H1z M2 4h12v8H2z M2 4h4v8H2z',
  },
  shield: {
    accentColor: 'var(--cv-mint)',
    ink: 'M7 1h2v1h4v2h1v4h-1v4h-1v2h-2v1H6v-1H4v-2H3v-4H2V4h1V2h4V1zm0 2H4v1H3v4h1v3h1v2h2v1h2v-1h2v-2h1v-3h1V4h-1V3H7z M5 5h2v2H5zM9 5h2v2H9zM5 8h6v1H5z',
  },
  eye: {
    accentColor: 'var(--cv-sky)',
    ink: 'M1 8h2v2h2v1h6v-1h2V8h2v2h-2v2H7v1H5v-1H3v-2H1V8zm4 0h2v2h2V8h2v2h-2v2H9V9H7v1H5V8z',
  },
};

export interface IconProps {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}

export function Icon({ name, size = 1, style }: IconProps) {
  const def = paths[name];
  const dim = 16 * size;
  return (
    <svg
      viewBox="0 0 16 16"
      width={dim}
      height={dim}
      shapeRendering="crispEdges"
      style={{ display: 'inline-block', ...style }}
      aria-hidden
    >
      {def.accent && <path d={def.accent} fill={def.accentColor} fillRule="evenodd" />}
      <path d={def.ink} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}