import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useStore } from '../store/store';
import { ACCENT_NAMES, type AccentColorName } from '../design/tokens';
import { CALL_SIGNS, DEFAULT_CALL_SIGN } from '../scene/callSigns';
import { PixelButton } from './PixelButton';

/**
 * Add an agent to the formation: name, call-sign insignia, accent, role
 * description, project, optional commander designation.
 */
export function AddAgentModal() {
  const open = useStore((s) => s.addAgentOpen);
  const setOpen = useStore((s) => s.setAddAgentOpen);
  const addAgent = useStore((s) => s.addAgent);
  const hasCommander = useStore((s) => s.agents.some((a) => a.isCommander));

  const [name, setName] = useState('');
  const [callSignId, setCallSignId] = useState(DEFAULT_CALL_SIGN);
  const [accent, setAccent] = useState<AccentColorName>('mint');
  const [description, setDescription] = useState('');
  const [project, setProject] = useState('new project');
  const [asCommander, setAsCommander] = useState(false);

  const nameSlug = useMemo(() => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'), [name]);

  if (!open) return null;

  const save = () => {
    if (!name.trim()) return;
    const id = nameSlug || `agent-${Date.now().toString(36)}`;
    addAgent({
      id,
      name: name.trim(),
      callSign: callSignId,
      accent,
      description: description.trim() || 'new to the formation',
      project: project.trim() || 'new project',
      status: 'idle',
      action: 'awaiting',
      progress: 0,
      isCommander: asCommander,
      isAssistant: !asCommander,
      local: true,
      capabilities: ['WebFetch', 'WebSearch', 'Read', 'Edit', 'Write', 'Bash', 'Grep', 'Glob', 'TodoWrite', 'MCP'],
      model: '',
      provider: '',
      contextTokens: 0,
      contextLimit: 32000,
    });
    setName('');
    setDescription('');
    setCallSignId(DEFAULT_CALL_SIGN);
    setAccent('mint');
    setAsCommander(false);
    setOpen(false);
  };

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(26,19,32,0.4)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add agent"
        style={{
          position: 'fixed', zIndex: 901,
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(560px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          background: 'var(--cv-cream-50)',
          boxShadow: '0 0 0 2px var(--cv-ink-900), 6px 8px 0 0 rgba(26,19,32,0.25)',
          padding: 16,
          fontFamily: 'var(--cv-font-ui)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <span style={{
            fontFamily: 'var(--cv-font-display)', fontSize: 'var(--cv-text-display-sm)',
            color: 'var(--cv-ink-900)', flex: 1,
          }}>ENLIST AN AGENT</span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{
              width: 26, height: 26, border: 'none', cursor: 'pointer',
              background: 'var(--cv-cream-200)',
              boxShadow: 'inset 0 0 0 1px var(--cv-ink-300)',
              color: 'var(--cv-ink-700)', fontSize: 13, lineHeight: 1,
            }}
          >✕</button>
        </div>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={labelStyle}>CALL SIGN (NAME)</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            placeholder="e.g. falcon-six"
            style={inputStyle}
          />
          {nameSlug && (
            <span style={{ fontSize: 10, color: 'var(--cv-ink-500)' }}>
              id: {nameSlug} · {nameSlug === name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') ? '' : '(simplified)'}
            </span>
          )}
        </label>

        <div style={{ marginBottom: 10 }}>
          <span style={labelStyle}>INSIGNIA</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(58px, 1fr))', gap: 6 }}>
            {CALL_SIGNS.map((c) => {
              const active = c.id === callSignId;
              return (
                <button
                  key={c.id}
                  onClick={() => setCallSignId(c.id)}
                  title={`${c.displayName} — ${c.blurb}`}
                  style={{
                    height: 58, padding: 4, border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: 3,
                    background: active ? `var(--cv-${accent}-light)` : 'var(--cv-cream-200)',
                    boxShadow: active
                      ? `inset 0 0 0 2px var(--cv-ink-900)`
                      : 'inset 0 0 0 1px var(--cv-ink-300)',
                  }}
                >
                  <span style={{ color: `var(--cv-${accent})` }}>
                    <Insignia glyph={c.glyph} size={22} />
                  </span>
                  <span style={{
                    fontFamily: 'var(--cv-font-display)', fontSize: 6.5,
                    color: active ? 'var(--cv-ink-900)' : 'var(--cv-ink-500)',
                  }}>{c.displayName.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <span style={labelStyle}>ACCENT</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {ACCENT_NAMES.map((a) => (
              <button
                key={a}
                onClick={() => setAccent(a)}
                title={a}
                aria-label={`accent ${a}`}
                style={{
                  width: 30, height: 30, padding: 0, border: 'none', cursor: 'pointer',
                  background: `var(--cv-${a})`,
                  boxShadow: accent === a
                    ? '0 0 0 2px var(--cv-ink-900)'
                    : 'inset 0 0 0 1px var(--cv-ink-300)',
                }}
              />
            ))}
          </div>
        </div>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={labelStyle}>ROLE DESCRIPTION</span>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="one line — what does this agent do?"
            style={{ ...inputStyle, resize: 'none', fontFamily: 'var(--cv-font-ui)' }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={labelStyle}>PROJECT</span>
          <input
            value={project}
            onChange={(e) => setProject(e.target.value)}
            style={inputStyle}
          />
        </label>

        {!hasCommander && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={asCommander}
              onChange={(e) => setAsCommander(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--cv-ink-900)' }}
            />
            <span style={{ fontSize: 12, color: 'var(--cv-ink-900)' }}>
              design as <b>Commander</b> — the formation's orchestrator (gets the commander panel)
            </span>
          </label>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <PixelButton variant="ghost" onClick={() => setOpen(false)}>cancel</PixelButton>
          <PixelButton variant="primary" disabled={!name.trim()} onClick={save}>
            enlist {name.trim() ? name.trim().toUpperCase() : 'agent'}
          </PixelButton>
        </div>
      </div>
    </>
  );
}

export function Insignia({ glyph, size = 22, color }: { glyph: string; size?: number; color?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      style={{ display: 'block' }}
      aria-hidden
    >
      <path d={glyph} fill={color ?? 'currentColor'} fillRule="evenodd" />
    </svg>
  );
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontFamily: 'var(--cv-font-display)',
  fontSize: 8,
  lineHeight: '12px',
  color: 'var(--cv-ink-500)',
  marginBottom: 4,
};

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '7px 9px',
  background: 'var(--cv-paper-100)',
  boxShadow: 'inset 0 0 0 1px var(--cv-ink-300)',
  border: 'none',
  outline: 'none',
  fontFamily: 'var(--cv-font-mono)',
  fontSize: 'var(--cv-text-mono-sm)',
  lineHeight: 'var(--cv-lh-mono)',
  color: 'var(--cv-ink-900)',
};