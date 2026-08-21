// Formation call-signs — the roster identity system for Chakravyuh AI agents.
// Procedural 16x16 SVG glyphs (no external art), one per call-sign.

export interface CallSign {
  id: string;
  displayName: string;
  blurb: string;
  /** SVG path(s) drawn on a 16×16 grid, filled with the agent's accent. */
  glyph: string;
}

export const CALL_SIGNS: CallSign[] = [
  { id: 'commander', displayName: 'Commander', blurb: 'Calls the formation', glyph: 'M2 4h3l3-2 3 2h3v2h-2v6H4V6H2V4zm2 2v5h8V6H9l-1-1-1 1H4z' },
  { id: 'sentinel', displayName: 'Sentinel', blurb: 'Guards the perimeter', glyph: 'M7 1h2v1h4v2h1v4h-1v4h-1v2h-2v1H6v-1H4v-2H3v-4H2V4h1V2h4V1zm0 2H4v1H3v4h1v3h1v2h2v1h2v-1h2v-2h1v-3h1V4h-1V3H7zM5 5h2v2H5zM9 5h2v2H9zM5 8h6v1H5z' },
  { id: 'falcon', displayName: 'Falcon', blurb: 'Strikes fast', glyph: 'M2 8h4V4l4 4h4v2h-4l-4 4v-4H2V8zm6 1V6l-2 2 2 2V9z' },
  { id: 'viper', displayName: 'Viper', blurb: 'Precise, quiet, decisive', glyph: 'M2 3h3l2 4 2-4h3l-3 5 3 5h-3l-2-4-2 4H2l3-5z' },
  { id: 'hawk', displayName: 'Hawk', blurb: 'Sees everything', glyph: 'M7 1h2v2h-2V1zm0 12h2v2h-2v-2zM1 7h2v2H1V7zm12 0h2v2h-2V7zM6 5h4v4H6V5zm2 1v2h2V6H8z' },
  { id: 'kestrel', displayName: 'Kestrel', blurb: 'Watches the feeds', glyph: 'M1 8h2v2h2v1h6v-1h2V8h2v2h-2v2H7v1H5v-1H3v-2H1V8zm4 0h2v2h2V8h2v2h-2v2H9V9H7v1H5V8z' },
  { id: 'osprey', displayName: 'Osprey', blurb: 'Sweeps wide arcs', glyph: 'M2 8a6 6 0 0 1 12 0h-2a4 4 0 0 0-8 0H2zm4 0a2 2 0 0 1 4 0H6zm3 5h2v2H9v-2zM7 13h2v2H7v-2z' },
  { id: 'lynx', displayName: 'Lynx', blurb: 'Tracks trails', glyph: 'M7 1h2v3h3v2H9v3H7V6H4V4h3V1zm0 6h2v2H7V7zm-4 4h3v2H3v-2zm8 0h3v2h-3v-2z' },
  { id: 'wolf', displayName: 'Wolf', blurb: 'Packs take down larger prey', glyph: 'M2 5h3v2h2v2H5V9H3v2H2V5zm12 0h-3v2H9v2h2V9h2v2h1V5zM5 2h6v2H5V2z' },
  { id: 'panther', displayName: 'Panther', blurb: 'Moves in the dark', glyph: 'M3 3h2v2H3V3zm3 2h2v2H6V5zm4 0h2v2h-2V5zm-7 3h2v2H3V8zm4 1h2v2H7V9zm4-1h2v2h-2V8zm-5 3h2v2H6v-2zm4 0h2v2h-2v-2z' },
  { id: 'owl', displayName: 'Owl', blurb: 'Keeps the archives', glyph: 'M7 3h2v1h2v2h1v6H4V6h1V4h2V3zm0 3v1h2V6H7zM5 8v3h6V8H5zm3 4h2v2H8v-2z' },
  { id: 'raven', displayName: 'Raven', blurb: 'Opens locked doors', glyph: 'M2 6a3 3 0 0 1 4 3v1h2v2h2v2h2v2h2v-2h-2v-2h-2V9H6v-1a3 3 0 0 1-4-2zm3-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2z' },
  { id: 'talon', displayName: 'Talon', blurb: 'Grips the objective', glyph: 'M2 12h4V8h4V4h4v4h-4v4h-4v4H2v-4zm2 2v-2h4V8h2v4h4v-4h-2V6h-2V4H8v2H6v2H4v2H2v-2h2v2h2v4H4z' },
  { id: 'vanguard', displayName: 'Vanguard', blurb: 'Leads the advance', glyph: 'M3 7h6V4l5 4-5 4v-3H3V7z' },
  { id: 'ghost', displayName: 'Ghost', blurb: 'Runs invisible ops', glyph: 'M6 2h4v1h1v3H9V5H7v1h2v3H7V8H6V5V3h0V2zM7 11h2v2H7v-2z' },
];

export const CALL_SIGN_BY_ID: Record<string, CallSign> =
  Object.fromEntries(CALL_SIGNS.map((c) => [c.id, c])) as Record<string, CallSign>;

export const DEFAULT_CALL_SIGN = 'vanguard';

/** SVG glyph for a call-sign id (used in cards, the floor and the picker). */
export function callSignGlyph(id: string): CallSign {
  return CALL_SIGN_BY_ID[id] ?? CALL_SIGN_BY_ID[DEFAULT_CALL_SIGN];
}