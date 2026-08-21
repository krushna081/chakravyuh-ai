import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from './store/store';
import { useQueueDrain } from './lib/agentTurn';
import { fetchHealth, fetchBackendAgents, fetchIntegrations, fetchTasks, fetchMemoryStats, fetchAgentSession } from './lib/api';
import { FormationFloor } from './components/FormationFloor';
import { AgentStrip } from './components/AgentStrip';
import { AgentDetailPanel } from './components/AgentDetailPanel';
import { CommanderPanel } from './components/CommanderPanel';
import { SidebarSplitter } from './components/SidebarSplitter';
import { AddAgentModal } from './components/AddAgentModal';
import { SettingsModal } from './components/SettingsModal';
import { OnboardingWizard } from './components/OnboardingWizard';
import { ReadinessScreen } from './components/ReadinessScreen';
import { TaskDetailOverlay } from './components/TaskDetailOverlay';
import { FullscreenSession } from './components/FullscreenSession';
import { Icon } from './components/Icon';

/**
 * The Chakravyuh AI command center — the single-screen control room:
 * formation floor (left), commander/agent panel (right), roster dock
 * (bottom), and the fullscreen session + modals layered on top.
 *
 * Everything on screen is real: agents/tasks/sessions/integrations come
 * from the orchestrator. No simulated loop exists.
 */
export default function App() {
  const location = useLocation();
  const setCommanderTab = useStore((s) => s.setCommanderTab);
  const select = useStore((s) => s.select);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const sidebarWidth = useStore((s) => s.sidebarWidth);
  const setSidebarWidth = useStore((s) => s.setSidebarWidth);
  const backend = useStore((s) => s.backend);
  const setBackend = useStore((s) => s.setBackend);
  const reconcileBackendAgents = useStore((s) => s.reconcileBackendAgents);
  const syncTasks = useStore((s) => s.syncTasks);
  const agents = useStore((s) => s.agents);
  const selectedId = useStore((s) => s.selectedId);

  useQueueDrain();
  const commander = agents.find((a) => a.isCommander);
  const selected = agents.find((a) => a.id === selectedId);
  const showCommanderPanel = selected?.isCommander === true;

  // Health + roster + tasks + integrations sync from the orchestrator.
  useEffect(() => {
    let cancelled = false;
    let timer: number;
    const ping = () => {
      void fetchHealth().then((h) => {
        if (cancelled) return;
        const store = useStore.getState();
        if (h) {
          store.setBackend({
            online: true,
            checking: false,
            version: String(h.version ?? ''),
            routerMode: String(h.router_mode ?? 'local'),
            ollamaConnected: Boolean(h.ollama_connected),
            modelsInstalled: Number(h.models_installed ?? 0),
          });
          void fetchBackendAgents().then((list) => {
            if (!cancelled && list.length > 0) {
              store.reconcileBackendAgents(list as unknown as Array<Record<string, unknown>>);
            }
          });
          void fetchTasks().then((tasks) => {
            if (!cancelled && tasks.length > 0) store.syncTasks(tasks);
          });
          void fetchIntegrations().then((data) => {
            if (!cancelled && data) {
              store.setBackend({ integrations: data.integrations, integrationsLoaded: true });
            }
          });
          void fetchMemoryStats().then((m) => {
            if (!cancelled && m) store.setBackend({ memoryTotal: m.total });
          });
        } else {
          store.setBackend({ online: false, checking: false });
        }
      });
    };
    ping();
    timer = window.setInterval(ping, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  // Live session lines: poll the selected agent's session (and the roster
  // on a slower cadence) — real work log from the backend.
  useEffect(() => {
    if (!backend.online) return;
    let cancelled = false;
    let timer: number;
    const poll = () => {
      const store = useStore.getState();
      const ids = new Set<string>([store.selectedId ?? '', ...store.agents.map((a) => a.id)]);
      for (const id of ids) {
        if (!id) continue;
        void fetchAgentSession(id).then((lines) => {
          if (!cancelled && lines) store.setFeeds(id, lines);
        });
      }
    };
    poll();
    timer = window.setInterval(poll, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [backend.online]);

  // Deep links: /tasks opens the commander's board, /models opens models.
  const appliedRoute = useRef('');
  useEffect(() => {
    if (appliedRoute.current === location.pathname) return;
    appliedRoute.current = location.pathname;
    const store = useStore.getState();
    if (location.pathname === '/tasks') {
      const c = store.agents.find((a) => a.isCommander);
      if (c) {
        store.select(c.id);
        store.setCommanderTab('tasks');
      }
    } else if (location.pathname === '/models') {
      store.setSettingsOpen(true, 'agents');
    }
  }, [location.pathname]);

  // Dispatch seeds (from the commander panel) land in the commander's queue.
  useEffect(() => {
    const text = useStore.getState().consumeDispatchSeed();
    if (!text) return;
    const store = useStore.getState();
    const c = store.agents.find((a) => a.isCommander);
    if (!c) return;
    store.select(c.id);
    store.setSidebarTab('terminal');
    store.enqueueMessage(c.id, text);
  }, []);

  const memoryLabel = `${backend.memoryTotal || 0}`;
  const engineStatus = !backend.online ? 'offline' : backend.ollamaConnected ? 'engine ready' : 'engine degraded (ollama offline)';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--cv-cream-200)',
      color: 'var(--cv-ink-900)',
      fontFamily: 'var(--cv-font-ui)',
      overflow: 'hidden',
    }}>
      {/* Title bar */}
      <div style={titleBar}>
        <img src="/favicon.svg" alt="" width={20} height={20} />
        <span style={brand}>CHAKRAVYUH AI</span>
        <span style={brandSub}>formation://command-center</span>

        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span title={engineStatus} style={pillStyle}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: backend.online
                ? (backend.ollamaConnected ? 'var(--cv-status-success)' : 'var(--cv-status-working)')
                : 'var(--cv-status-blocked)',
              display: 'inline-block',
            }} />
            {engineStatus}
          </span>
          <span title="Router mode" style={pillStyle}>{backend.routerMode} router</span>
          <span title="Installed models" style={pillStyle}>{backend.modelsInstalled} models</span>
          <span title="Memory entries" style={pillStyle}>mem {memoryLabel}</span>
          <span title={`formation of ${agents.length} agent${agents.length === 1 ? '' : 's'}`} style={pillStyle}>
            {agents.length} agents
          </span>

          <button
            title="Commander memory & board"
            aria-label="Open commander panel"
            onClick={() => {
              if (commander) {
                select(commander.id);
                setCommanderTab('memory');
              }
            }}
            style={titleBtn}
          >
            <Icon name="ledger" size={0.8} />
          </button>
          <button
            title="Engine readiness & integrations"
            aria-label="Readiness"
            onClick={() => setSettingsOpen(true, 'integrations')}
            style={titleBtn}
          >
            <Icon name="shield" size={0.8} />
          </button>
          <button
            title="Settings"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
            style={titleBtn}
          >
            <Icon name="gear" size={0.8} />
          </button>
        </span>
      </div>

      {!backend.online && !backend.checking ? (
        <ReadinessScreen onReady={() => setBackend({ checking: true })} />
      ) : backend.checking ? (
        <ReadinessScreen onReady={() => setBackend({ checking: true })} />
      ) : (
        <>
          {/* Main row: floor + splitter + panel */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
            <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
              <FormationFloor />
            </div>
            <SidebarSplitter
              width={sidebarWidth}
              onChange={setSidebarWidth}
              viewportWidth={window.innerWidth}
            />
            <div style={{
              width: sidebarWidth,
              flexShrink: 0,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--cv-cream-200)',
              borderLeft: '1px solid var(--cv-ink-100)',
            }}>
              {showCommanderPanel && commander ? <CommanderPanel /> : <AgentDetailPanel />}
            </div>
          </div>

          {/* Roster dock */}
          <AgentStrip />
        </>
      )}

      {/* Layered screens */}
      <OnboardingWizard />
      <AddAgentModal />
      <SettingsModal />
      <TaskDetailOverlay />
      <FullscreenSession />
    </div>
  );
}

const titleBar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '0 14px',
  height: 46,
  flexShrink: 0,
  background: 'var(--cv-grad-header)',
  borderBottom: '1px solid var(--cv-ink-100)',
  color: 'var(--cv-ink-900)',
};

const brand: CSSProperties = {
  fontFamily: 'var(--cv-font-display)',
  fontSize: 'var(--cv-text-display-md)',
  letterSpacing: '0.1em',
  fontWeight: 700,
  color: 'var(--cv-ink-900)',
};

const brandSub: CSSProperties = {
  fontSize: 10.5,
  opacity: 0.55,
  fontFamily: 'var(--cv-font-mono)',
  color: 'var(--cv-ink-500)',
};

const pillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 22,
  padding: '0 8px',
  background: 'var(--cv-paper-200)',
  boxShadow: 'var(--cv-panel-border-inset)',
  fontFamily: 'var(--cv-font-mono)',
  fontSize: 10.5,
  lineHeight: '22px',
  color: 'var(--cv-ink-500)',
  whiteSpace: 'nowrap',
};

const titleBtn: CSSProperties = {
  width: 28,
  height: 24,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--cv-paper-200)',
  boxShadow: 'var(--cv-panel-border-inset)',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--cv-ink-500)',
};