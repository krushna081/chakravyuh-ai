/**
 * Agent turn engine — the web equivalent of typing into an agent's terminal.
 * A turn delivers one queued message to an agent: it marks the agent working,
 * ships the prompt to the real backend (POST /api/v1/chat/agent), surfaces
 * the agent's real response or its honest error, then returns it to idle and
 * drains the next queued message. There is no simulated path: if the backend
 * is unreachable the turn fails visibly.
 */
import { useStore } from '../store/store';
import { chatWithAgent } from './api';

const inTurn = new Set<string>();

/** Run one real turn for an agent with the given prompt text. */
export async function runTurn(agentId: string, text: string): Promise<void> {
  if (inTurn.has(agentId)) return;
  const store = useStore.getState();
  const agent = store.agents.find((a) => a.id === agentId);
  if (!agent) return;

  inTurn.add(agentId);
  store.updateAgent(agentId, {
    status: 'working',
    action: 'on mission',
    currentStation: 'terminal',
    lastPrompt: text,
    progress: Math.min((agent.progress ?? 0) + 1, 8),
  });
  store.pushFeed(agentId, `● prompt ${text}`);

  const reply = await chatWithAgent(agentId, text);

  if (reply !== null) {
    store.updateAgent(agentId, {
      status: 'success',
      action: 'mission complete',
      recentAssistantText: reply.slice(0, 600),
      recentTextTs: Date.now(),
    });
    const lines = reply.split('\n').filter((l) => l.trim());
    for (const l of lines) store.pushFeed(agentId, l);
  } else {
    store.updateAgent(agentId, {
      status: 'blocked',
      action: 'backend unreachable',
      recentAssistantText: 'Orchestrator unreachable — the turn was not executed.',
      recentTextTs: Date.now(),
    });
    store.pushFeed(agentId, '✖ orchestrator unreachable — nothing was executed');
  }

  window.setTimeout(() => {
    const s = useStore.getState();
    const current = s.agents.find((a) => a.id === agentId);
    const status = s.backend.online ? 'idle' : 'blocked';
    s.updateAgent(agentId, {
      status,
      action: current?.status === 'blocked' ? 'awaiting backend' : 'awaiting',
      currentStation: 'desk',
    });
    inTurn.delete(agentId);
    drain(agentId);
  }, 900);
}

/** Deliver one queued message per call for an idle, not-in-turn agent. */
function drain(agentId: string): void {
  const store = useStore.getState();
  const queue = store.messageQueues[agentId] ?? [];
  const agent = store.agents.find((a) => a.id === agentId);
  if (!agent || queue.length === 0 || inTurn.has(agentId)) return;
  if (agent.status !== 'idle' && agent.status !== 'success') return;
  const next = queue[0];
  store.removeQueuedMessage(agentId, next.id);
  void runTurn(agentId, next.text);
}

/** App-level queue drain loop — watches all agents, delivers when free. */
export function useQueueDrain(): void {
  window.setInterval(() => {
    const { agents } = useStore.getState();
    for (const a of agents) drain(a.id);
  }, 1600);
}

export function stripAnsiForFeed(line: string): string {
  return line.replace(/\x1b\[[0-9;]*m/g, '');
}