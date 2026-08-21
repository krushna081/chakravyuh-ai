import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { submitTask, fetchTasks } from '../lib/api';
import { Icon } from './Icon';

/**
 * The command composer — the web equivalent of typing at an agent's terminal.
 * Three modes:
 *  - free: a normal prompt, queued for the agent's next free moment.
 *  - task: queues a task through the control agent (real pipeline).
 *  - quick: one-tap canned prompts.
 */
export function Composer({ agentId }: { agentId: string }) {
  const agent = useStore((s) => s.agents.find((a) => a.id === agentId));
  const draft = useStore((s) => s.drafts[agentId] ?? '');
  const setDraft = useStore((s) => s.setDraft);
  const enqueueMessage = useStore((s) => s.enqueueMessage);
  const openTaskDetail = useStore((s) => s.openTaskDetail);
  const syncTasks = useStore((s) => s.syncTasks);
  const setCommanderTab = useStore((s) => s.setCommanderTab);
  const commanderTab = useStore((s) => s.commanderTab);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const backend = useStore((s) => s.backend);

  const [mode, setMode] = useState<'free' | 'task' | 'quick'>('free');
  const busy = agent?.status === 'working' || agent?.status === 'thinking' || agent?.status === 'compacting';
  const queue = useStore((s) => s.messageQueues[agentId] ?? []);
  const clearQueue = useStore((s) => s.clearQueue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(140, Math.max(40, el.scrollHeight))}px`;
  }, [draft]);

  const sendFree = () => {
    const text = draft.trim();
    if (!text) return;
    enqueueMessage(agentId, text);
    setDraft(agentId, '');
    if (mode !== 'free') setMode('free');
  };

  const createTask = async () => {
    const text = draft.trim();
    if (!text) return;
    const res = await submitTask(text, 'medium');
    setDraft(agentId, '');
    setCommanderTab('tasks');
    void commanderTab;
    if (res?.task_id) {
      const tasks = await fetchTasks();
      if (tasks.length > 0) syncTasks(tasks);
      openTaskDetail(res.task_id);
    }
  };

  const quickSend = (text: string) => {
    enqueueMessage(agentId, text);
    setMode('free');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (mode === 'task') void createTask();
      else sendFree();
    }
  };

  const modeTabs: Array<{ id: 'free' | 'task' | 'quick'; label: string }> = [
    { id: 'free', label: 'free' },
    { id: 'task', label: 'task' },
    { id: 'quick', label: 'quick' },
  ];

  return (
    <div
      style={{
        margin: '0 8px 8px',
        background: 'var(--cv-cream-50)',
        boxShadow: 'var(--cv-panel-border)',
      }}
    >
      {/* mode tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          padding: '4px 6px 0',
          borderBottom: '1px dashed var(--cv-ink-300)',
        }}
      >
        {modeTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            title={
              t.id === 'free'
                ? 'Queue a normal prompt for this agent'
                : t.id === 'task'
                  ? 'Turn the input into a kanban task assigned to this agent'
                  : 'One-tap canned prompts'
            }
            style={{
              background: mode === t.id ? 'var(--cv-cream-100)' : 'transparent',
              border: 'none',
              borderRight: '1px solid var(--cv-ink-100)',
              padding: '4px 10px 4px',
              fontFamily: 'var(--cv-font-display)',
              fontSize: 8,
              lineHeight: '12px',
              color: mode === t.id ? 'var(--cv-ink-900)' : 'var(--cv-ink-500)',
              cursor: 'pointer',
              transform: mode === t.id ? 'translateY(0)' : 'none',
              boxShadow: mode === t.id ? 'inset 0 2px 0 var(--cv-ink-500)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--cv-ink-500)', paddingRight: 4 }}>
          {mode === 'free' ? 'prompt → queue → next free moment'
            : mode === 'task' ? 'input → kanban task (assigned)'
              : 'tap to send a canned prompt'}
        </span>
      </div>

      {mode === 'quick' ? (
        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            'What are you working on?',
            'Run a quick status check and report back.',
            'Give me a one-line summary of your last mission.',
            'Anything blocked or waiting on me?',
          ].map((q) => (
            <button
              key={q}
              onClick={() => quickSend(q)}
              style={{
                textAlign: 'left',
                padding: '6px 8px',
                background: 'var(--cv-paper-100)',
                boxShadow: 'inset 0 0 0 1px var(--cv-ink-100)',
                border: 'none',
                fontFamily: 'var(--cv-font-ui)',
                fontSize: 12,
                color: 'var(--cv-ink-900)',
                cursor: 'pointer',
              }}
            >
              » {q}
            </button>
          ))}
        </div>
      ) : (
        <>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(agentId, e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              mode === 'task'
                ? 'describe the task to assign…'
                : busy
                  ? `${agent?.name ?? 'agent'} is on a mission — prompt will queue until free…`
                  : `prompt ${agent?.name ?? 'agent'}…`
            }
            rows={1}
            aria-label={mode === 'task' ? 'New task description' : 'Prompt'}
            style={{
              width: '100%',
              padding: '8px 10px',
              border: 'none',
              outline: 'none',
              resize: 'none',
              boxSizing: 'border-box',
              background: 'transparent',
              fontFamily: 'var(--cv-font-mono)',
              fontSize: 'var(--cv-text-mono-sm)',
              lineHeight: 'var(--cv-lh-mono)',
              color: 'var(--cv-ink-900)',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 8px 6px',
            }}
          >
            {busy && (
              <span style={{ fontSize: 10, color: 'var(--cv-status-thinking)', fontFamily: 'var(--cv-font-ui)' }}>
                ● on mission — messages queue until free
              </span>
            )}
            {queue.length > 0 && (
              <button
                onClick={() => clearQueue(agentId)}
                title="Clear the queued messages"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--cv-font-ui)', fontSize: 10,
                  color: 'var(--cv-ink-500)', textDecoration: 'underline',
                  padding: 0,
                }}
              >
                {queue.length} queued — clear
              </button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--cv-ink-500)' }}>
              ⏎ to {mode === 'task' ? 'create task' : 'send'}
            </span>
            <button
              onClick={mode === 'task' ? () => void createTask() : sendFree}
              disabled={!draft.trim()}
              title={mode === 'task' ? 'Create task' : 'Send prompt'}
              aria-label={mode === 'task' ? 'Create task' : 'Send prompt'}
              style={{
                width: 32, height: 32,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: draft.trim() ? 'var(--cv-ink-900)' : 'var(--cv-cream-300)',
                color: draft.trim() ? 'var(--cv-cream-50)' : 'var(--cv-ink-500)',
                border: 'none', cursor: draft.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              <Icon name="arrow-right" size={1.2} />
            </button>
          </div>
        </>
      )}

      {mode === 'quick' && agent?.isCommander && (
        <div style={{ padding: '0 8px 8px', fontSize: 10, color: 'var(--cv-ink-500)' }}>
          commander channel open · <button
            onClick={() => setSettingsOpen(true, 'autonomy')}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontSize: 10, color: 'var(--cv-ink-500)', textDecoration: 'underline' }}
          >tune autonomy in settings</button>
        </div>
      )}
    </div>
  );
}