import { create } from 'zustand';
import type { AccentColorName } from '../design/tokens';
import type { BackendTask, IntegrationStatus } from '../lib/api';

export type ToolKind =
  | 'Read' | 'Edit' | 'Write' | 'Bash' | 'WebFetch' | 'WebSearch'
  | 'Grep' | 'Glob' | 'TodoWrite' | 'MCP';

export type StationKind =
  | 'desk' | 'terminal' | 'web' | 'board' | 'shelf' | 'mailbox' | 'mcp';

export type StatusKind =
  | 'idle' | 'thinking' | 'working' | 'waiting' | 'blocked'
  | 'success' | 'ghost' | 'compacting' | 'looping' | 'typing';

export interface BlockReason {
  summary: string;
  detail: string;
  command?: string;
  actions: Array<{
    label: string;
    kind: 'approve' | 'deny' | 'neutral';
    send?: string;
  }>;
}

export interface Agent {
  id: string;
  name: string;
  /** Procedural insignia / call-sign rendered on cards and the floor */
  callSign: string;
  accent: AccentColorName;
  description: string;
  project: string;
  status: StatusKind;
  action: string;
  progress: number;
  currentStation?: StationKind;
  carrying?: ToolKind;
  recentAssistantText?: string;
  recentTextTs?: number;
  /** The commander agent — the formation's orchestrator. Gets the Commander panel. */
  isCommander?: boolean;
  isAssistant?: boolean;
  model?: string;
  provider?: string;
  role?: string;
  capabilities?: string[];
  uptime?: string;
  tools?: string[];
  contextTokens?: number;
  contextLimit?: number;
  lastPrompt?: string;
  note?: string;
  archived?: boolean;
  /** Created in the UI (Add Agent), not reported by the backend */
  local?: boolean;
  /** Pending task count shown as a sticky note on the card */
  doingCount?: number;
}

export interface QueuedMessage {
  id: string;
  text: string;
  ts: number;
  manual?: boolean;
}

export type TaskPriority = 1 | 2 | 3 | 4 | 5;

/** Real task from the backend ledger (control agent owns writes; UI reads). */
export interface Task extends BackendTask {
  assignee?: string;
  qa?: Array<{ q: string; a?: string; ts: number }>;
  waitsOnHuman?: boolean;
  dependsOn?: string[];
}

export type SidebarTab = 'terminal' | 'workflows' | 'messages' | 'traces';

export interface BackendState {
  online: boolean;
  checking: boolean;
  version: string;
  routerMode: string;
  ollamaConnected: boolean;
  modelsInstalled: number;
  memoryTotal: number;
  integrations: IntegrationStatus[];
  integrationsLoaded: boolean;
}

const LS_AGENTS = 'cv.agents';
const LS_ARCHIVED = 'cv.archivedAgents';
const LS_RESTORABLE = 'cv.restorableAgents';
const LS_SELECTED = 'cv.selectedId';
const LS_QUEUES = 'cv.messageQueues';
const LS_ONBOARDING = 'cv.onboardingComplete';
const LS_AUTOMODE = 'cv.autoMode';
const LS_SIDEBAR_WIDTH = 'cv.sidebarWidth';
const LS_SIDEBAR_TAB = 'cv.sidebarTab';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

export function loadOnboardingComplete(): boolean {
  try {
    const v = window.localStorage.getItem(LS_ONBOARDING);
    if (v === '1') return true;
  } catch { /* noop */ }
  return false;
}

export function loadAutoMode(): boolean {
  try {
    const v = window.localStorage.getItem(LS_AUTOMODE);
    if (v === '1') return true;
  } catch { /* noop */ }
  return true;
}

/** Map backend agent statuses to formation statuses. */
export function mapBackendStatus(s: string): StatusKind {
  switch (s) {
    case 'free': case 'idle': return 'idle';
    case 'busy': case 'active': return 'working';
    case 'processing': return 'thinking';
    case 'error': return 'blocked';
    case 'sleeping': return 'ghost';
    default: return 'idle';
  }
}

let queuedSeq = 0;
function newQueuedId(): string {
  queuedSeq += 1;
  return `q-${Date.now()}-${queuedSeq}`;
}

function persistAgents(agents: Agent[], selectedId: string | null): void {
  const slim = agents.map(({ recentAssistantText, recentTextTs, doingCount, ...rest }) => {
    void recentAssistantText; void recentTextTs; void doingCount;
    return rest;
  });
  writeJSON(LS_AGENTS, slim);
  writeJSON(LS_SELECTED, selectedId ?? '');
}

interface State {
  agents: Agent[];
  archivedAgents: Agent[];
  restorableAgents: Agent[];
  selectedId: string | null;
  feeds: Record<string, string[]>;
  messageQueues: Record<string, QueuedMessage[]>;
  tasks: Task[];
  taskDetailId: string | null;
  addAgentOpen: boolean;
  settingsOpen: boolean;
  settingsSection: string | null;
  fullscreenAgentId: string | null;
  sidebarWidth: number;
  sidebarTab: SidebarTab;
  commanderTab: string;
  backend: BackendState;
  onboardingComplete: boolean;
  autoMode: boolean;
  ccTabRequest: { tab: string; seq: number } | null;
  dispatchSeedRequest: { text: string; seq: number } | null;
  answerDrafts: Record<string, string>;
  drafts: Record<string, string>;
  fleetStats: { tokens: number; inputTokens: number; cacheHit: number; tokPerMin: number };

  select: (id: string) => void;
  updateAgent: (id: string, patch: Partial<Agent>) => void;
  setAgentNote: (id: string, note: string) => void;
  pushFeed: (id: string, line: string) => void;
  setFeeds: (id: string, lines: string[]) => void;
  addAgent: (agent: Agent) => void;
  removeAgent: (id: string) => void;
  archiveAgent: (id: string) => void;
  removeArchivedAgent: (id: string) => void;
  removeRestorableAgent: (id: string) => void;
  reorderAgents: (fromId: string, toId: string) => void;
  enqueueMessage: (agentId: string, text: string) => void;
  removeQueuedMessage: (agentId: string, messageId: string) => void;
  releaseQueuedMessage: (agentId: string, messageId: string) => void;
  clearQueue: (agentId: string) => void;
  setAddAgentOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean, section?: string) => void;
  setFullscreen: (id: string | null) => void;
  setSidebarWidth: (px: number) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setCommanderTab: (tab: string) => void;
  setBackend: (patch: Partial<BackendState>) => void;
  setOnboardingComplete: (done: boolean) => void;
  setAutoMode: (on: boolean) => void;
  setFleetStats: (patch: Partial<State['fleetStats']>) => void;
  requestCommandCenterTab: (tab: string) => void;
  requestDispatchSeed: (text: string) => void;
  consumeCcTabRequest: () => string | null;
  consumeDispatchSeed: () => string | null;
  setAnswerDraft: (taskId: string, text: string) => void;
  setDraft: (agentId: string, text: string) => void;
  openTaskDetail: (id: string) => void;
  closeTaskDetail: () => void;
  /** Replace the task ledger with the backend's real records. */
  syncTasks: (tasks: BackendTask[]) => void;
  /** Merge the backend roster into the local one (backend agents win on
   *  identity; local extras are kept; missing backend agents are marked gone). */
  reconcileBackendAgents: (backendAgents: Array<Record<string, unknown>>) => void;
  /** Re-spawn last session's agents with their original ids. */
  restoreTeam: () => void;
  /** Resolve an id to an agent (active or archived). */
  resolveName: (id: string) => string | undefined;
}

const initialAgents = readJSON<Agent[]>(LS_AGENTS, []);
const initialArchived = readJSON<Agent[]>(LS_ARCHIVED, []);
const initialRestorable = readJSON<Agent[]>(LS_RESTORABLE, []);
const initialSelected = (() => {
  const id = readJSON<string | null>(LS_SELECTED, null);
  return id && initialAgents.some((a) => a.id === id) ? id : (initialAgents[0]?.id ?? null);
})();
const initialQueues = readJSON<Record<string, QueuedMessage[]>>(LS_QUEUES, {});

const initialSidebarWidth = (() => {
  try {
    const v = window.localStorage.getItem(LS_SIDEBAR_WIDTH);
    const n = v ? parseInt(v, 10) : NaN;
    if (!Number.isNaN(n) && n >= 320 && n <= 1200) return n;
  } catch { /* noop */ }
  return 440;
})();
const initialSidebarTab: SidebarTab = (() => {
  try {
    const v = window.localStorage.getItem(LS_SIDEBAR_TAB);
    if (v === 'terminal' || v === 'workflows' || v === 'messages' || v === 'traces') return v;
  } catch { /* noop */ }
  return 'terminal';
})();

export const useStore = create<State>((set, get) => ({
  agents: initialAgents,
  archivedAgents: initialArchived,
  restorableAgents: initialRestorable,
  selectedId: initialSelected,
  feeds: {},
  messageQueues: initialQueues,
  tasks: [],
  taskDetailId: null,
  addAgentOpen: false,
  settingsOpen: false,
  settingsSection: null,
  fullscreenAgentId: null,
  sidebarWidth: initialSidebarWidth,
  sidebarTab: initialSidebarTab,
  commanderTab: 'monitor',
  backend: {
    online: false,
    checking: true,
    version: '',
    routerMode: 'local',
    ollamaConnected: false,
    modelsInstalled: 0,
    memoryTotal: 0,
    integrations: [],
    integrationsLoaded: false,
  },
  onboardingComplete: loadOnboardingComplete(),
  autoMode: loadAutoMode(),
  ccTabRequest: null,
  dispatchSeedRequest: null,
  answerDrafts: {},
  drafts: {},
  fleetStats: { tokens: 0, inputTokens: 0, cacheHit: 0, tokPerMin: 0 },

  select: (id) => set((s) => {
    persistAgents(s.agents, id);
    return { selectedId: id, ccTabRequest: null };
  }),

  updateAgent: (id, patch) => set((s) => {
    const agents = s.agents.map((a) => (a.id === id ? { ...a, ...patch } : a));
    return { agents };
  }),

  setAgentNote: (id, note) => set((s) => {
    const agents = s.agents.map((a) => (a.id === id ? { ...a, note } : a));
    persistAgents(agents, s.selectedId);
    return { agents };
  }),

  pushFeed: (id, line) => set((s) => ({
    feeds: { ...s.feeds, [id]: [...(s.feeds[id] ?? []), line] },
  })),

  setFeeds: (id, lines) => set((s) => ({ feeds: { ...s.feeds, [id]: lines } })),

  addAgent: (agent) => set((s) => {
    if (s.agents.some((a) => a.id === agent.id)) return s;
    const agents = agent.isCommander ? [agent, ...s.agents] : [...s.agents, agent];
    const archivedAgents = s.archivedAgents.filter((a) => a.id !== agent.id);
    const restorableAgents = s.restorableAgents.filter((a) => a.id !== agent.id);
    persistAgents(agents, agent.id);
    writeJSON(LS_ARCHIVED, archivedAgents);
    if (restorableAgents.length !== s.restorableAgents.length) writeJSON(LS_RESTORABLE, restorableAgents);
    return {
      agents,
      archivedAgents,
      restorableAgents,
      selectedId: agent.id,
      feeds: { ...s.feeds, [agent.id]: s.feeds[agent.id] ?? [] },
    };
  }),

  removeAgent: (id) => set((s) => {
    const agents = s.agents.filter((a) => a.id !== id);
    const { [id]: _feedGone, ...feeds } = s.feeds;
    const { [id]: _queueGone, ...messageQueues } = s.messageQueues;
    const selectedId = s.selectedId === id ? (agents[0]?.id ?? null) : s.selectedId;
    persistAgents(agents, selectedId);
    writeJSON(LS_QUEUES, messageQueues);
    return { agents, feeds, selectedId, messageQueues };
  }),

  archiveAgent: (id) => set((s) => {
    const target = s.agents.find((a) => a.id === id);
    if (!target) return s;
    const agents = s.agents.filter((a) => a.id !== id);
    const archivedEntry: Agent = {
      ...target,
      archived: true,
      status: 'idle',
      action: 'archived',
      carrying: undefined,
      currentStation: undefined,
    };
    const archivedAgents = [...s.archivedAgents.filter((a) => a.id !== id), archivedEntry];
    const { [id]: _feedGone, ...feeds } = s.feeds;
    const { [id]: _queueGone, ...messageQueues } = s.messageQueues;
    const selectedId = s.selectedId === id ? (agents[0]?.id ?? null) : s.selectedId;
    persistAgents(agents, selectedId);
    writeJSON(LS_ARCHIVED, archivedAgents);
    if (_queueGone) writeJSON(LS_QUEUES, messageQueues);
    return { agents, archivedAgents, feeds, selectedId, messageQueues };
  }),

  removeArchivedAgent: (id) => set((s) => {
    if (!s.archivedAgents.some((a) => a.id === id)) return s;
    const archivedAgents = s.archivedAgents.filter((a) => a.id !== id);
    writeJSON(LS_ARCHIVED, archivedAgents);
    return { archivedAgents };
  }),

  removeRestorableAgent: (id) => set((s) => {
    if (!s.restorableAgents.some((a) => a.id === id)) return s;
    const restorableAgents = s.restorableAgents.filter((a) => a.id !== id);
    writeJSON(LS_RESTORABLE, restorableAgents);
    return { restorableAgents };
  }),

  reorderAgents: (fromId, toId) => set((s) => {
    if (fromId === toId) return s;
    const from = s.agents.findIndex((a) => a.id === fromId);
    const to = s.agents.findIndex((a) => a.id === toId);
    if (from === -1 || to === -1) return s;
    const agents = [...s.agents];
    const [moved] = agents.splice(from, 1);
    agents.splice(to, 0, moved);
    persistAgents(agents, s.selectedId);
    return { agents };
  }),

  enqueueMessage: (agentId, text) => set((s) => {
    const trimmed = text.trim();
    if (!trimmed) return s;
    const msg: QueuedMessage = { id: newQueuedId(), text: trimmed, ts: Date.now() };
    const messageQueues = { ...s.messageQueues, [agentId]: [...(s.messageQueues[agentId] ?? []), msg] };
    writeJSON(LS_QUEUES, messageQueues);
    return { messageQueues };
  }),

  removeQueuedMessage: (agentId, messageId) => set((s) => {
    const current = s.messageQueues[agentId];
    if (!current) return s;
    const next = current.filter((m) => m.id !== messageId);
    const messageQueues = { ...s.messageQueues, [agentId]: next };
    writeJSON(LS_QUEUES, messageQueues);
    return { messageQueues };
  }),

  releaseQueuedMessage: (agentId, messageId) => set((s) => {
    const current = s.messageQueues[agentId];
    const target = current?.find((m) => m.id === messageId);
    if (!current || !target) return s;
    const next = [{ ...target, manual: true }, ...current.filter((m) => m.id !== messageId)];
    const messageQueues = { ...s.messageQueues, [agentId]: next };
    writeJSON(LS_QUEUES, messageQueues);
    return { messageQueues };
  }),

  clearQueue: (agentId) => set((s) => {
    if (!s.messageQueues[agentId]?.length) return s;
    const messageQueues = { ...s.messageQueues, [agentId]: [] };
    writeJSON(LS_QUEUES, messageQueues);
    return { messageQueues };
  }),

  setAddAgentOpen: (open) => set({ addAgentOpen: open }),
  setSettingsOpen: (open, section) => set({ settingsOpen: open, settingsSection: section ?? null }),
  setFullscreen: (id) => set({ fullscreenAgentId: id }),
  setSidebarWidth: (px) => {
    const clamped = Math.min(1200, Math.max(320, Math.round(px)));
    try { window.localStorage.setItem(LS_SIDEBAR_WIDTH, String(clamped)); } catch { /* noop */ }
    set({ sidebarWidth: clamped });
  },
  setSidebarTab: (tab) => {
    try { window.localStorage.setItem(LS_SIDEBAR_TAB, tab); } catch { /* noop */ }
    set({ sidebarTab: tab });
  },
  setCommanderTab: (tab) => set({ commanderTab: tab }),
  setBackend: (patch) => set((s) => ({ backend: { ...s.backend, ...patch } })),
  setOnboardingComplete: (done) => {
    try { window.localStorage.setItem(LS_ONBOARDING, done ? '1' : '0'); } catch { /* noop */ }
    set({ onboardingComplete: done });
  },
  setAutoMode: (on) => {
    try { window.localStorage.setItem(LS_AUTOMODE, on ? '1' : '0'); } catch { /* noop */ }
    set({ autoMode: on });
  },
  setFleetStats: (patch) => set((s) => ({ fleetStats: { ...s.fleetStats, ...patch } })),

  requestCommandCenterTab: (tab) =>
    set((s) => ({ ccTabRequest: { tab, seq: (s.ccTabRequest?.seq ?? 0) + 1 } })),
  requestDispatchSeed: (text) =>
    set((s) => ({ dispatchSeedRequest: { text, seq: (s.dispatchSeedRequest?.seq ?? 0) + 1 } })),

  consumeCcTabRequest: () => {
    const req = get().ccTabRequest;
    if (req) set({ ccTabRequest: null });
    return req?.tab ?? null;
  },
  consumeDispatchSeed: () => {
    const req = get().dispatchSeedRequest;
    if (req) set({ dispatchSeedRequest: null });
    return req?.text ?? null;
  },

  setAnswerDraft: (taskId, text) =>
    set((s) => ({ answerDrafts: { ...s.answerDrafts, [taskId]: text } })),
  setDraft: (agentId, text) =>
    set((s) => ({ drafts: { ...s.drafts, [agentId]: text } })),

  openTaskDetail: (id) => set({ taskDetailId: id }),
  closeTaskDetail: () => set({ taskDetailId: null }),

  syncTasks: (tasks) => set((s) => {
    const byId = new Map(s.tasks.map((t) => [t.id, t]));
    const merged = tasks.map((b) => {
      const prev = byId.get(b.id);
      return prev ? { ...prev, ...b } : (b as Task);
    });
    return { tasks: merged };
  }),

  reconcileBackendAgents: (backendAgents) => set((s) => {
    const byId = new Map(backendAgents.map((b) => [String(b.id), b]));
    const agents = s.agents.map((a) => {
      const b = byId.get(a.id);
      if (!b) return a;
      byId.delete(a.id);
      const status = mapBackendStatus(String(b.status ?? 'idle'));
      return {
        ...a,
        name: String(b.name ?? a.name),
        role: String(b.role ?? a.role ?? ''),
        status,
        model: String(b.model ?? a.model ?? ''),
        provider: String(b.provider ?? a.provider ?? ''),
        capabilities: Array.isArray(b.capabilities) ? (b.capabilities as string[]) : a.capabilities,
        uptime: String(b.uptime ?? a.uptime ?? ''),
        tools: Array.isArray(b.tools) ? (b.tools as string[]) : a.tools,
        local: false,
      };
    });
    for (const b of byId.values()) {
      const id = String(b.id);
      agents.push({
        id,
        name: String(b.name ?? id),
        callSign: 'vanguard',
        accent: 'lilac',
        description: String(b.role ?? ''),
        project: 'orchestrator',
        status: mapBackendStatus(String(b.status ?? 'idle')),
        action: 'awaiting',
        progress: 0,
        role: String(b.role ?? ''),
        model: String(b.model ?? ''),
        provider: String(b.provider ?? ''),
        capabilities: Array.isArray(b.capabilities) ? (b.capabilities as string[]) : [],
        tools: Array.isArray(b.tools) ? (b.tools as string[]) : [],
        uptime: String(b.uptime ?? ''),
        local: false,
        currentStation: 'desk',
      });
    }
    persistAgents(agents, s.selectedId);
    return { agents };
  }),

  restoreTeam: () => {
    const { restorableAgents, agents, addAgent } = get();
    for (const r of restorableAgents) {
      if (agents.some((a) => a.id === r.id)) continue;
      addAgent({ ...r, archived: false, status: 'idle', action: 'rejoining the formation…' });
    }
    set({ restorableAgents: [] });
    writeJSON(LS_RESTORABLE, []);
  },

  resolveName: (id) => {
    const { agents, archivedAgents, restorableAgents } = get();
    return agents.find((a) => a.id === id)?.name
      ?? archivedAgents.find((a) => a.id === id)?.name
      ?? restorableAgents.find((a) => a.id === id)?.name;
  },
}));

export function selectedAgent(s: State): Agent | undefined {
  return s.agents.find((a) => a.id === s.selectedId);
}

export function commanderAgent(s: State): Agent | undefined {
  return s.agents.find((a) => a.isCommander);
}