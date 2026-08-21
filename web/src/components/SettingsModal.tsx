import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../store/store';
import { PixelButton } from './PixelButton';
import { appTheme } from '../design/theme';
import { fetchHealth, fetchMemoryStats, fetchModels, fetchStatus, fetchIntegrations, deleteModel } from '../lib/api';
import { statusColor } from '../design/tokens';

type Section = 'general' | 'agents' | 'autonomy' | 'integrations' | 'memory' | 'about';

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'general', label: 'general' },
  { id: 'agents', label: 'agents & models' },
  { id: 'autonomy', label: 'autonomy' },
  { id: 'integrations', label: 'integrations' },
  { id: 'memory', label: 'memory' },
  { id: 'about', label: 'about' },
];

/**
 * The settings dialog — dark theme, roster management, autonomy toggles,
 * real integration status (env var names only, never values), memory stats.
 */
export function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const section = useStore((s) => s.settingsSection);
  const [active, setActive] = useState<Section>('general');

  useEffect(() => {
    if (open && section) {
      const s = section as Section;
      if (SECTIONS.some((x) => x.id === s)) setActive(s);
    }
  }, [open, section]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 940, background: 'rgba(4,6,9,0.6)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        style={{
          position: 'fixed', zIndex: 941,
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(720px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 48px)',
          display: 'flex',
          background: 'var(--cv-cream-100)',
          boxShadow: 'var(--cv-shadow-hard)',
          fontFamily: 'var(--cv-font-ui)',
        }}
      >
        {/* nav */}
        <div style={{
          width: 170, flexShrink: 0, borderRight: '1px solid var(--cv-ink-100)',
          padding: '14px 0', background: 'var(--cv-cream-200)',
        }}>
          <div style={{
            fontFamily: 'var(--cv-font-display)', fontSize: 'var(--cv-text-display-sm)',
            letterSpacing: '0.08em',
            color: 'var(--cv-ink-900)', padding: '0 14px 10px',
          }}>SETTINGS</div>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 14px', border: 'none', cursor: 'pointer',
                background: active === s.id ? 'var(--cv-paper-100)' : 'transparent',
                boxShadow: active === s.id ? 'inset 2px 0 0 var(--cv-cyan)' : 'none',
                fontFamily: 'var(--cv-font-display)', fontSize: 'var(--cv-text-display-sm)',
                color: active === s.id ? 'var(--cv-cyan)' : 'var(--cv-ink-500)',
                textTransform: 'uppercase',
              }}
            >{s.label}</button>
          ))}
          <button
            onClick={() => setOpen(false)}
            style={{
              display: 'block', margin: '14px 14px 0', width: 'calc(100% - 28px)',
              padding: '7px 0', border: 'none', cursor: 'pointer',
              background: 'var(--cv-paper-100)',
              boxShadow: 'var(--cv-panel-border-inset)',
              fontFamily: 'var(--cv-font-display)', fontSize: 'var(--cv-text-display-sm)',
              color: 'var(--cv-ink-700)', textTransform: 'uppercase',
            }}
          >✕ close</button>
        </div>

        {/* body */}
        <div style={{ flex: 1, minWidth: 0, padding: 16, overflowY: 'auto', maxHeight: 'calc(100vh - 48px)' }}>
          {active === 'general' && <GeneralSection />}
          {active === 'agents' && <AgentsSection />}
          {active === 'autonomy' && <AutonomySection />}
          {active === 'integrations' && <IntegrationsSection />}
          {active === 'memory' && <MemorySection />}
          {active === 'about' && <AboutSection />}
        </div>
      </div>
    </>
  );
}

function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--cv-ink-900)', fontWeight: 600 }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--cv-ink-500)', margin: '2px 0 6px' }}>{hint}</div>}
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      title={label}
      style={{
        width: 44, height: 22, padding: 0, border: 'none', cursor: 'pointer',
        background: on ? 'var(--cv-cyan)' : 'var(--cv-cream-300)',
        boxShadow: 'var(--cv-panel-border-inset)',
        position: 'relative',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 23 : 3,
        width: 16, height: 16,
        background: on ? 'var(--cv-on-accent)' : 'var(--cv-ink-500)',
        transition: 'left 120ms ease',
      }} />
    </button>
  );
}

function GeneralSection() {
  return (
    <>
      <SectionTitle>general</SectionTitle>
      <Row label="Theme" hint="Chakravyuh AI ships a single premium dark theme — deep charcoal with cyan/violet accents.">
        <span style={{ fontSize: 12, color: 'var(--cv-ink-500)', fontFamily: 'var(--cv-font-mono)' }}>
          {appTheme()} · tokens: --cv-cyan primary / --cv-violet secondary
        </span>
      </Row>
      <Row label="Reset local data" hint="Clears command-center UI state (roster, queues, selection) stored in this browser. Backend data (tasks, memory, sessions) is untouched.">
        <PixelButton
          variant="destructive"
          onClick={() => {
            if (!window.confirm('Reset ALL command-center data in this browser? This cannot be undone.')) return;
            const keys = Object.keys(window.localStorage).filter((k) => k.startsWith('cv.'));
            keys.forEach((k) => window.localStorage.removeItem(k));
            window.location.reload();
          }}
        >reset everything</PixelButton>
      </Row>
    </>
  );
}

function AgentsSection() {
  const agents = useStore((s) => s.agents);
  const archivedAgents = useStore((s) => s.archivedAgents);
  const archiveAgent = useStore((s) => s.archiveAgent);
  const removeAgent = useStore((s) => s.removeAgent);
  const removeArchivedAgent = useStore((s) => s.removeArchivedAgent);
  const setAddAgentOpen = useStore((s) => s.setAddAgentOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const [models, setModels] = useState<Array<{ name: string; size?: number }> | null>(null);

  const refreshModels = () => {
    void fetchModels().then((m) => setModels(m?.models ?? []));
  };
  useEffect(refreshModels, []);

  return (
    <>
      <SectionTitle>agents & models</SectionTitle>
      <Row label="Roster" hint="Agents registered with the orchestrator. Archive keeps them in the archive; remove deletes permanently.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {agents.map((a) => (
            <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{
                flex: 1, fontSize: 12, color: 'var(--cv-ink-900)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {a.name}{a.isCommander ? ' ★' : ''}
                <span style={{ color: 'var(--cv-ink-500)', marginLeft: 6, fontFamily: 'var(--cv-font-mono)' }}>
                  {a.callSign} · {a.model || 'local'}
                </span>
              </span>
              <PixelButton variant="ghost" size="sm" onClick={() => { setSettingsOpen(false); setAddAgentOpen(true); }}>
                add
              </PixelButton>
              <PixelButton
                variant="ghost" size="sm"
                onClick={() => { if (window.confirm(`Archive ${a.name}?`)) archiveAgent(a.id); }}
              >archive</PixelButton>
              <PixelButton
                variant="ghost" size="sm"
                disabled={a.isCommander}
                title={a.isCommander ? 'The commander cannot be removed while it is active' : undefined}
                onClick={() => { if (window.confirm(`Remove ${a.name} permanently?`)) removeAgent(a.id); }}
              >remove</PixelButton>
            </div>
          ))}
          {archivedAgents.map((a) => (
            <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: 0.7 }}>
              <span style={{
                flex: 1, fontSize: 12, color: 'var(--cv-ink-500)', fontStyle: 'italic',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{a.name} (archived)</span>
              <PixelButton
                variant="ghost" size="sm"
                onClick={() => { if (window.confirm(`Delete ${a.name} from the archive?`)) removeArchivedAgent(a.id); }}
              >delete</PixelButton>
            </div>
          ))}
        </div>
      </Row>
      <Row label="Local models" hint="Installed models reported by the orchestrator (Ollama). Pulling happens on the backend.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {models === null ? (
            <span style={{ fontSize: 11, color: 'var(--cv-ink-500)' }}>
              backend offline — no model list available.
            </span>
          ) : models.length === 0 ? (
            <span style={{ fontSize: 11, color: 'var(--cv-ink-500)' }}>no models installed yet.</span>
          ) : models.map((m) => (
            <div key={m.name} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{
                flex: 1, fontSize: 12, color: 'var(--cv-ink-900)',
                fontFamily: 'var(--cv-font-mono)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{m.name}</span>
              <span style={{ fontSize: 10, color: 'var(--cv-ink-500)' }}>
                {m.size ? `${(m.size / 1e9).toFixed(1)} GB` : ''}
              </span>
              <PixelButton
                variant="ghost" size="sm"
                onClick={() => { void deleteModel(m.name).then(refreshModels); }}
              >delete</PixelButton>
            </div>
          ))}
          <PixelButton variant="secondary" size="sm" onClick={refreshModels} style={{ alignSelf: 'flex-start' }}>
            refresh
          </PixelButton>
        </div>
      </Row>
    </>
  );
}

function AutonomySection() {
  const autoMode = useStore((s) => s.autoMode);
  const setAutoMode = useStore((s) => s.setAutoMode);
  return (
    <>
      <SectionTitle>autonomy</SectionTitle>
      <Row label="Auto mode" hint="When on, queued prompts are dispatched to agents as soon as they are free.">
        <Toggle on={autoMode} onChange={setAutoMode} label="Auto mode" />
      </Row>
      <Row label="Queue behavior" hint="Prompts always queue per agent. Manual 'send now' in the queue panel jumps the line.">
        <span style={{ fontSize: 11, color: 'var(--cv-ink-500)' }}>first-in, first-out · manual release supported</span>
      </Row>
    </>
  );
}

function IntegrationsSection() {
  const backend = useStore((s) => s.backend);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    setBusy(true);
    void Promise.all([fetchHealth(), fetchStatus(), fetchIntegrations()]).then(([h, st, ints]) => {
      if (h) {
        useStore.getState().setBackend({
          online: true,
          version: String(h.version ?? ''),
          routerMode: String(h.router_mode ?? 'local'),
          ollamaConnected: Boolean(h.ollama_connected),
          modelsInstalled: Number(h.models_installed ?? 0),
        });
      }
      if (ints) useStore.getState().setBackend({ integrations: ints.integrations, integrationsLoaded: true });
      void st;
      setBusy(false);
    });
  };
  useEffect(() => { void refresh(); }, []);

  const integrations = backend.integrations;

  return (
    <>
      <SectionTitle>integrations</SectionTitle>
      <Row label="Engine" hint="The FastAPI backend this command center talks to (dev: vite proxy → 127.0.0.1:3001).">
        <div style={{
          padding: '10px 12px', background: 'var(--cv-paper-100)',
          boxShadow: 'var(--cv-panel-border-inset)',
          fontSize: 12, color: 'var(--cv-ink-900)', lineHeight: '20px',
          fontFamily: 'var(--cv-font-mono)',
        }}>
          <div>
            status: <b style={{ color: backend.online ? 'var(--cv-status-success)' : 'var(--cv-status-blocked)' }}>
              {backend.online ? 'online' : 'offline'}
            </b>
            {' '}· version: <b>{backend.version || '—'}</b>
          </div>
          <div>router mode: {backend.routerMode} · ollama: {backend.ollamaConnected ? 'connected' : 'not connected'}</div>
          <div>models installed: {backend.modelsInstalled}</div>
          <div style={{ marginTop: 8 }}>
            <PixelButton variant="secondary" size="sm" disabled={busy} onClick={refresh}>
              {busy ? 'checking…' : 're-check'}
            </PixelButton>
          </div>
        </div>
      </Row>

      <Row label="Integration status" hint="Every external service the formation can use, probed live. Config is via environment variables on the backend — names shown, values never displayed.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {!backend.integrationsLoaded && (
            <span style={{ fontSize: 11, color: 'var(--cv-ink-500)' }}>probing…</span>
          )}
          {integrations.map((i) => {
            const ok = i.status === 'connected' || i.status === 'available';
            const soft = i.status === 'not_configured';
            return (
              <div key={i.name} style={{
                padding: '8px 10px', background: 'var(--cv-paper-100)',
                boxShadow: 'var(--cv-panel-border-inset)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: ok ? 'var(--cv-status-success)'
                      : soft ? 'var(--cv-status-waiting)' : 'var(--cv-status-blocked)',
                  }} />
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--cv-ink-900)', fontWeight: 600 }}>
                    {i.name}
                    {i.required ? ' · required' : ''}
                    {i.free ? ' · free' : ''}
                  </span>
                  <span style={{
                    fontSize: 10, fontFamily: 'var(--cv-font-mono)', color: statusColor(
                      ok ? 'success' : soft ? 'waiting' : 'blocked'
                    ),
                  }}>
                    {i.status}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--cv-ink-500)', marginTop: 4, lineHeight: '16px' }}>
                  {i.reason || i.purpose}
                  {i.models && i.models.length > 0 && ` — ${i.models.join(', ')}`}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--cv-ink-500)', marginTop: 3, fontFamily: 'var(--cv-font-mono)' }}>
                  env: {i.config_var}
                </div>
                {!ok && (
                  <div style={{ fontSize: 10.5, color: 'var(--cv-ink-300)', marginTop: 3, lineHeight: '15px' }}>
                    → {i.alternative}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Row>
    </>
  );
}

function MemorySection() {
  const [stats, setStats] = useState<{ counts: Record<string, number>; total: number } | null>(null);
  useEffect(() => {
    void fetchMemoryStats().then((s) => setStats(s));
  }, []);
  return (
    <>
      <SectionTitle>memory</SectionTitle>
      <Row label="Store" hint="Episodic and semantic memory kept by the orchestrator (FastAPI /api/v1/memory, SQLite).">
        <div style={{
          padding: '10px 12px', background: 'var(--cv-paper-100)',
          boxShadow: 'var(--cv-panel-border-inset)',
          fontSize: 12, color: 'var(--cv-ink-900)', lineHeight: '20px',
          fontFamily: 'var(--cv-font-mono)',
        }}>
          {stats === null ? (
            <span style={{ color: 'var(--cv-ink-500)' }}>backend offline — memory stats unavailable.</span>
          ) : (
            <>
              <div>total entries: <b>{stats.total}</b></div>
              {Object.entries(stats.counts).map(([k, v]) => (
                <div key={k} style={{ fontSize: 11, color: 'var(--cv-ink-500)' }}>
                  {k}: {v}
                </div>
              ))}
            </>
          )}
          <div style={{ marginTop: 8 }}>
            <PixelButton
              variant="secondary" size="sm"
              onClick={() => { void fetchMemoryStats().then((s) => setStats(s)); }}
            >refresh</PixelButton>
          </div>
        </div>
      </Row>
    </>
  );
}

function AboutSection() {
  return (
    <>
      <SectionTitle>about</SectionTitle>
      <div style={{ fontSize: 12, color: 'var(--cv-ink-900)', lineHeight: '20px' }}>
        <p style={{ margin: '0 0 8px' }}>
          <b>Chakravyuh AI — Command Center</b>
        </p>
        <p style={{ margin: '0 0 8px', color: 'var(--cv-ink-500)' }}>
          A formation of specialized agents under a commander orchestrator. Prompts queue per agent and execute real
          turns through the backend (LLM via Ollama, sandboxed tools). Tasks run through the control agent's pipeline
          with a real ledger, and memory persists in SQLite. Nothing on this screen is simulated: when the engine is
          down it says so.
        </p>
        <p style={{ margin: 0, color: 'var(--cv-ink-500)' }}>
          Theme: {appTheme()} · backend endpoints: /health, /api/v1/* (agents, chat, tasks, models, memory, integrations).
        </p>
      </div>
    </>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--cv-font-display)', fontSize: 'var(--cv-text-display-sm)',
      color: 'var(--cv-ink-900)',
      borderBottom: '1px solid var(--cv-ink-100)',
      paddingBottom: 6, marginBottom: 14, textTransform: 'uppercase',
      letterSpacing: '0.06em',
    }}>{children}</div>
  );
}