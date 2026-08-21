/**
 * Chakravyuh AI backend client. Talks to the FastAPI orchestrator at the
 * configured origin (dev: vite proxy → 127.0.0.1:3001). Every call degrades
 * honestly: the UI shows real errors / offline states, never fabricated data.
 */

export interface BackendAgent {
  id: string;
  name: string;
  role: string;
  status: string;
  capabilities: string[];
  model: string;
  provider: string;
  uptime: string;
  tools?: string[];
  session?: string[];
}

export interface BackendTask {
  id: string;
  description: string;
  priority: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  error?: string | null;
  steps: Array<{
    step_id: string;
    status: string;
    agent: string;
    response?: string;
    error?: string;
    steps?: unknown[];
  }>;
  result?: unknown;
}

export interface IntegrationStatus {
  name: string;
  purpose: string;
  required: boolean;
  free: boolean;
  status: string;
  reason: string;
  config_var: string;
  alternative: string;
  models?: string[];
}

export interface MemoryEntry {
  id: string;
  agent_id: string;
  type: string;
  content: string;
  timestamp: string;
}

async function getJSON<T>(url: string, timeoutMs = 6000): Promise<T> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } finally {
    window.clearTimeout(t);
  }
}

async function postJSON<T>(url: string, body: unknown, timeoutMs = 15000): Promise<T> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } finally {
    window.clearTimeout(t);
  }
}

export async function fetchHealth(): Promise<{
  status: string;
  version: string;
  ollama_connected: boolean;
  models_installed: number;
  agents_registered: number;
  router_mode: string;
} | null> {
  try {
    return await getJSON('/health');
  } catch {
    return null;
  }
}

export async function fetchBackendAgents(): Promise<BackendAgent[]> {
  try {
    const data = await getJSON<{ agents: BackendAgent[] }>('/api/v1/agents');
    return data.agents ?? [];
  } catch {
    return [];
  }
}

export async function fetchAgentSession(agentId: string): Promise<string[] | null> {
  try {
    const data = await getJSON<{ lines: string[] }>(`/api/v1/agents/${encodeURIComponent(agentId)}/session`);
    return data.lines ?? null;
  } catch {
    return null;
  }
}

export async function fetchIntegrations(): Promise<{
  integrations: IntegrationStatus[];
  tasks: BackendTask[];
  sessions_sample: Record<string, string[]>;
} | null> {
  try {
    return await getJSON('/api/v1/integrations');
  } catch {
    return null;
  }
}

export async function fetchMemoryStats(): Promise<{ counts: Record<string, number>; total: number } | null> {
  try {
    return await getJSON('/api/v1/memory/stats');
  } catch {
    return null;
  }
}

export async function queryMemory(q: string, limit = 10): Promise<MemoryEntry[]> {
  try {
    const data = await postJSON<{ results: MemoryEntry[] }>('/api/v1/memory/query', { query: q, limit });
    return data.results ?? [];
  } catch {
    return [];
  }
}

export async function storeMemory(agentId: string, content: string, type = 'episodic'): Promise<boolean> {
  try {
    await postJSON('/api/v1/memory/store', { agent_id: agentId, type, content });
    return true;
  } catch {
    return false;
  }
}

export async function fetchModels(): Promise<{ models: Array<{ name: string; size?: number }>; recommended: string[] } | null> {
  try {
    return await getJSON('/api/v1/models');
  } catch {
    return null;
  }
}

export async function pullModel(name: string): Promise<boolean> {
  try {
    await postJSON('/api/v1/models/pull', { name }, 8000);
    return true;
  } catch {
    return false;
  }
}

export async function deleteModel(name: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(`/api/v1/models/${encodeURIComponent(name)}`, { method: 'DELETE', signal: ctrl.signal });
      return r.ok;
    } finally {
      window.clearTimeout(t);
    }
  } catch {
    return false;
  }
}

export interface TaskSubmitResult {
  task_id?: string;
  status?: string;
  description?: string;
  error?: string;
}

/** Queue a task through the orchestrator — it runs for real in the background. */
export async function submitTask(description: string, priority = 'medium'): Promise<TaskSubmitResult | null> {
  try {
    return await postJSON<TaskSubmitResult>('/api/v1/tasks', { description, priority }, 8000);
  } catch {
    return null;
  }
}

export async function fetchTasks(): Promise<BackendTask[]> {
  try {
    const data = await getJSON<{ tasks: BackendTask[] }>('/api/v1/tasks');
    return data.tasks ?? [];
  } catch {
    return [];
  }
}

/** Send one message to a specific agent — the agent executes a real turn. */
export async function chatWithAgent(agentId: string, text: string): Promise<string | null> {
  try {
    const data = await postJSON<{
      result?: { status?: string; response?: string; error?: string; steps?: unknown[] } | string;
    }>('/api/v1/chat/agent', {
      agent_id: agentId,
      messages: [{ role: 'user', content: text }],
      stream: false,
    });
    const r = data?.result;
    if (typeof r === 'string') return r;
    if (r && typeof r === 'object') {
      if (r.status === 'error') return `✖ ${r.error ?? 'agent error'}`;
      const resp = (r as { response?: string }).response;
      if (resp) return resp;
      const steps = (r as { steps?: unknown[] }).steps;
      if (steps && steps.length > 0) {
        const parts = steps.map((s) => {
          const st = s as { tool?: string; success?: boolean; output?: string };
          return `${st.success ? '✓' : '✖'} ${st.tool ?? 'step'} → ${String(st.output ?? '').slice(0, 200)}`;
        });
        return `${resp ?? ''}\n${parts.join('\n')}`.trim();
      }
      return JSON.stringify(r, null, 2).slice(0, 4000);
    }
    return 'No response from agent.';
  } catch {
    return null;
  }
}

export async function fetchStatus(): Promise<Record<string, unknown> | null> {
  try {
    return await getJSON('/api/v1/status');
  } catch {
    return null;
  }
}