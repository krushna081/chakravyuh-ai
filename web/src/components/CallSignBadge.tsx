import type { CSSProperties } from 'react';
import type { AccentColorName } from '../design/tokens';
import { callSignGlyph } from '../scene/callSigns';

export interface CallSignBadgeProps {
  callSign: string;
  accent: AccentColorName;
  size?: number;
  style?: CSSProperties;
}

/** Procedural call-sign glyph in an accent-tinted tile — the card/floor
 *  identity mark (equivalent of the reference's character portraits). */
export function CallSignBadge({ callSign, accent, size = 36, style }: CallSignBadgeProps) {
  const sign = callSignGlyph(callSign);
  return (
    <span
      title={sign.displayName}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `var(--cv-${accent}-light)`,
        boxShadow: `inset 0 0 0 1px var(--cv-${accent})`,
        flexShrink: 0,
        ...style,
      }}
    >
      <svg
        viewBox="0 0 16 16"
        width={Math.round(size * 0.62)}
        height={Math.round(size * 0.62)}
        shapeRendering="crispEdges"
        aria-hidden
      >
        <path d={sign.glyph} fill={`var(--cv-${accent})`} fillRule="evenodd" />
      </svg>
    </span>
  );
}