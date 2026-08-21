import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, type Agent } from '../store/store';
import { statusColor, type AccentColorName } from '../design/tokens';
import { CallSignBadge } from './CallSignBadge';

/**
 * The Formation Floor — the visual centerpiece (the web equivalent of the
 * reference's animated office floor). Agents stand in formation around a
 * command post; they move to station pads while working, stream thought
 * bubbles, and hand off message envelopes to each other.
 */

const STATIONS: Array<{ id: string; label: string; x: number; y: number }> = [
  { id: 'terminal', label: 'TERMINAL', x: 80, y: 34 },
  { id: 'web', label: 'WEB', x: 20, y: 34 },
  { id: 'board', label: 'BOARD', x: 50, y: 10 },
  { id: 'shelf', label: 'ARCHIVE', x: 50, y: 90 },
  { id: 'mcp', label: 'MCP', x: 82, y: 62 },
  { id: 'mailbox', label: 'MAIL', x: 18, y: 62 },
];

interface Slot {
  x: number;
  y: number;
}

function slotFor(agent: Agent, index: number, total: number): Slot {
  if (agent.currentStation && agent.currentStation !== 'desk') {
    const st = STATIONS.find((s) => s.id === agent.currentStation);
    if (st) return { x: st.x, y: st.y };
  }
  // Home position: spaced around the ring, starting at the top.
  if (total <= 1) return { x: 50, y: 28 };
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  return {
    x: 50 + Math.cos(angle) * 31,
    y: 50 + Math.sin(angle) * 33,
  };
}

interface Envelope {
  key: number;
  from: string;
  to: string;
  fromPos: Slot;
  toPos: Slot;
}

const STATUS_LABEL: Record<string, string> = {
  idle: 'standing by',
  thinking: 'moving out',
  working: 'on mission',
  blocked: 'needs you',
  waiting: 'waiting',
  success: 'objective complete',
  ghost: 'off duty',
  compacting: 'packing context',
  looping: 'loop guard armed',
};

export function FormationFloor() {
  const agents = useStore((s) => s.agents);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const commander = agents.find((a) => a.isCommander);
  const workers = agents.filter((a) => !a.isCommander && !a.archived);

  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const envSeq = useRef(0);
  const lastPositions = useRef<Record<string, Slot>>({});

  const positions = useMemo(() => {
    const map: Record<string, Slot> = {};
    const total = workers.length;
    workers.forEach((a, i) => {
      map[a.id] = slotFor(a, i, total);
    });
    if (commander) map[commander.id] = { x: 50, y: 50 };
    lastPositions.current = map;
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents.map((a) => `${a.id}:${a.currentStation ?? 'desk'}:${a.archived}`).join('|'), workers.length, commander?.id]);

  // Demo handoffs + delivery animation
  useEffect(() => {
    const onHandoff = (e: Event) => {
      const { from, to } = (e as CustomEvent<{ from: string; to: string }>).detail;
      const pos = lastPositions.current;
      if (!pos[from] || !pos[to]) return;
      envSeq.current += 1;
      setEnvelopes((es) => [
        ...es,
        { key: envSeq.current, from, to, fromPos: pos[from], toPos: pos[to] },
      ]);
    };
    window.addEventListener('cv:demo-handoff', onHandoff);
    return () => window.removeEventListener('cv:demo-handoff', onHandoff);
  }, []);

  const onEnvelopeDone = (key: number) => {
    setEnvelopes((es) => es.filter((e) => e.key !== key));
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: 'var(--cv-cream-100)',
      }}
    >
      {/* Background grid + formation rings */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0 }}
        aria-hidden
      >
        <defs>
          <pattern id="cv-grid" width="6.25" height="6.25" patternUnits="userSpaceOnUse">
            <path d="M6.25 0H0V6.25" fill="none" stroke="var(--cv-ink-100)" strokeWidth="0.12" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#cv-grid)" />
        <g shapeRendering="crispEdges">
          {[14, 24, 34, 44].map((r) => (
            <circle
              key={r}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="var(--cv-ink-300)"
              strokeWidth="0.35"
              strokeDasharray="2 1.4"
            />
          ))}
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return (
              <line
                key={i}
                x1={50 + Math.cos(a) * 14}
                y1={50 + Math.sin(a) * 14}
                x2={50 + Math.cos(a) * 44}
                y2={50 + Math.sin(a) * 44}
                stroke="var(--cv-ink-100)"
                strokeWidth="0.22"
                strokeDasharray="1.2 1.6"
              />
            );
          })}
        </g>
        {STATIONS.map((st) => (
          <g key={st.id} shapeRendering="crispEdges">
            <rect
              x={st.x - 5.5}
              y={st.y - 4.5}
              width="11"
              height="9"
              fill="var(--cv-cream-200)"
              stroke="var(--cv-ink-300)"
              strokeWidth="0.3"
              strokeDasharray="1 0.8"
            />
            <text
              x={st.x}
              y={st.y - 6.6}
              textAnchor="middle"
              fontFamily="var(--cv-font-display)"
              fontSize="2.1"
              fill="var(--cv-ink-500)"
            >
              {st.label}
            </text>
          </g>
        ))}
        {/* Command post */}
        <g shapeRendering="crispEdges">
          <rect x="44" y="42" width="12" height="16" fill="var(--cv-lemon-light)" stroke="var(--cv-ink-500)" strokeWidth="0.4" />
          <rect x="42.6" y="39.6" width="14.8" height="3.4" fill="var(--cv-lemon)" stroke="var(--cv-ink-900)" strokeWidth="0.3" />
          <text x="50" y="64" textAnchor="middle" fontFamily="var(--cv-font-display)" fontSize="2.4" fill="var(--cv-ink-500)">
            COMMAND POST
          </text>
        </g>
      </svg>

      {/* Envelopes */}
      {envelopes.map((env) => (
        <EnvelopeSprite key={env.key} env={env} onDone={() => onEnvelopeDone(env.key)} />
      ))}

      {/* Commander token */}
      {commander && (
        <FloorToken
          agent={commander}
          x={50}
          y={50}
          selected={selectedId === commander.id}
          onSelect={() => select(commander.id)}
          commander
        />
      )}

      {/* Worker tokens */}
      {workers.map((a, i) => {
        const pos = positions[a.id] ?? slotFor(a, i, workers.length);
        return (
          <FloorToken
            key={a.id}
            agent={a}
            x={pos.x}
            y={pos.y}
            selected={selectedId === a.id}
            onSelect={() => select(a.id)}
          />
        );
      })}
    </div>
  );
}

/* ── Token ──────────────────────────────────────────────────────────────── */

interface FloorTokenProps {
  agent: Agent;
  x: number;
  y: number;
  selected: boolean;
  onSelect: () => void;
  commander?: boolean;
}

function FloorToken({ agent, x, y, selected, onSelect, commander }: FloorTokenProps) {
  const [hover, setHover] = useState(false);
  const busy = agent.status === 'working' || agent.status === 'thinking';
  const bubble = agent.action && agent.action !== 'awaiting' ? agent.action : agent.recentAssistantText;

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={`${agent.name} — ${STATUS_LABEL[agent.status] ?? agent.status}`}
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        transition: 'left 650ms ease-in-out, top 650ms ease-in-out',
        zIndex: selected ? 5 : hover ? 4 : 3,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        userSelect: 'none',
      }}
    >
      {/* Thought bubble */}
      {bubble && busy && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            width: 170,
            maxWidth: '34vw',
            background: 'var(--cv-paper-100)',
            boxShadow: 'inset 0 0 0 1px var(--cv-ink-300), 2px 2px 0 rgba(26,19,32,0.12)',
            padding: '5px 8px 4px',
            fontFamily: 'var(--cv-font-ui)',
            fontSize: 11,
            lineHeight: '15px',
            color: 'var(--cv-ink-900)',
            textAlign: 'center',
            pointerEvents: 'none',
            animation: 'cv-bubble-in 140ms steps(2) both',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {bubble}
          <span
            style={{
              position: 'absolute',
              left: '50%',
              bottom: -5,
              width: 8,
              height: 8,
              background: 'var(--cv-paper-100)',
              boxShadow: '1px 1px 0 var(--cv-ink-300)',
              transform: 'translateX(-50%) rotate(45deg)',
            }}
          />
        </div>
      )}

      {/* Token */}
      <div style={{ position: 'relative' }}>
        {/* Status ring */}
        <span
          style={{
            position: 'absolute',
            inset: -3,
            borderRadius: 0,
            boxShadow: `0 0 0 2px ${statusColor(agent.status)}`,
            animation: agent.status === 'working' ? 'cv-pulse 1.2s steps(2) infinite' : 'none',
          }}
        />
        {selected && (
          <span
            style={{
              position: 'absolute',
              inset: -7,
              boxShadow: '0 0 0 2px var(--cv-ink-900)',
            }}
          />
        )}
        <span style={{ display: 'block', transform: hover ? 'translateY(-2px)' : 'none', transition: 'transform 90ms steps(2)' }}>
          <CallSignBadge callSign={agent.callSign} accent={agent.accent as AccentColorName} size={commander ? 52 : 42} />
        </span>
      </div>

      {/* Name plate */}
      <div
        style={{
          marginTop: 3,
          background: 'var(--cv-cream-200)',
          boxShadow: 'inset 0 0 0 1px var(--cv-ink-100)',
          padding: '1px 6px 0',
          fontFamily: 'var(--cv-font-display)',
          fontSize: 7,
          lineHeight: '11px',
          color: 'var(--cv-ink-900)',
          whiteSpace: 'nowrap',
        }}
      >
        {agent.name.toUpperCase()}
        {commander ? ' ★' : ''}
      </div>
    </div>
  );
}

/* ── Envelope ───────────────────────────────────────────────────────────── */

interface EnvelopeSpriteProps {
  env: Envelope;
  onDone: () => void;
}

function EnvelopeSprite({ env, onDone }: EnvelopeSpriteProps) {
  const [phase, setPhase] = useState<'start' | 'flying' | 'arrived'>('start');
  const from = { left: `${env.fromPos.x}%`, top: `${env.fromPos.y}%` };
  const to = { left: `${env.toPos.x}%`, top: `${env.toPos.y}%` };

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase('flying'), 30);
    const t2 = window.setTimeout(() => setPhase('arrived'), 850);
    const t3 = window.setTimeout(onDone, 1300);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); window.clearTimeout(t3); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = phase === 'start' ? from : phase === 'flying' ? to : to;
  return (
    <div
      style={{
        position: 'absolute',
        left: pos.left,
        top: pos.top,
        transform: 'translate(-50%, -50%)',
        zIndex: 20,
        width: 26,
        height: 18,
        background: phase === 'arrived' ? 'var(--cv-mint)' : 'var(--cv-lemon)',
        boxShadow: 'inset 0 0 0 1px var(--cv-ink-900), 2px 2px 0 rgba(26,19,32,0.2)',
        transition: 'left 800ms steps(24), top 800ms steps(24)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          width: 12,
          height: 8,
          border: '1px solid var(--cv-ink-900)',
          borderTop: 'none',
          borderBottom: 'none',
          opacity: phase === 'arrived' ? 0.4 : 1,
        }}
      />
    </div>
  );
}