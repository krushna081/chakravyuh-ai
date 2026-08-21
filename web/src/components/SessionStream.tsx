import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { stripAnsiForFeed } from '../lib/agentTurn';

/**
 * The agent's live session pane — the web equivalent of the reference's
 * terminal view. Renders the agent's activity feed (tool calls, prompts,
 * reports) as a read-only terminal-styled stream.
 */
export function SessionStream({ agentId }: { agentId: string }) {
  const feed = useStore((s) => s.feeds[agentId] ?? []);
  const recentText = useStore((s) => s.agents.find((a) => a.id === agentId)?.recentAssistantText);
  const recentTextTs = useStore((s) => s.agents.find((a) => a.id === agentId)?.recentTextTs);
  const status = useStore((s) => s.agents.find((a) => a.id === agentId)?.status);

  const scrollRef = useRef<HTMLDivElement>(null);

  const visibleLines = feed.slice(Math.max(0, feed.length - 400));

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visibleLines.length, recentTextTs]);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--cv-paper-100)',
        boxShadow: 'var(--cv-panel-border-terminal)',
        margin: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '4px 10px 2px',
          borderBottom: '1px dashed var(--cv-ink-300)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'var(--cv-font-ui)',
          fontSize: 11,
          color: 'var(--cv-ink-500)',
          userSelect: 'none',
        }}
      >
        <span style={{ width: 7, height: 7, background: 'var(--cv-coral)' }} />
        live · mission feed
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--cv-font-mono)', fontSize: 10 }}>
          {status === 'idle' ? 'standing by' : status}
        </span>
      </div>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 10px',
          fontFamily: 'var(--cv-font-mono)',
          fontSize: 'var(--cv-text-mono-sm)',
          lineHeight: 'var(--cv-lh-mono)',
          color: 'var(--cv-ink-900)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {visibleLines.length === 0 && !recentText && (
          <span style={{ color: 'var(--cv-ink-500)' }}>
            The session feed is quiet. Send a prompt below to start a mission.
          </span>
        )}
        {visibleLines.map((line, i) => (
          <div key={i} style={{ minHeight: 20 }}>
            {stripAnsiForFeed(line)}
          </div>
        ))}
        {recentText && status !== 'idle' && (
          <div>
            <span style={{ color: 'var(--cv-status-thinking)' }}>▌</span>
            <TypewriterText text={recentText} ts={recentTextTs ?? 0} />
          </div>
        )}
        {status === 'working' && (
          <span style={{ animation: 'cv-blink 1s steps(2) infinite' }}>█</span>
        )}
      </div>
    </div>
  );
}

function TypewriterText({ text, ts }: { text: string; ts: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    const iv = window.setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          window.clearInterval(iv);
          return n;
        }
        return n + 1;
      });
    }, 12);
    return () => window.clearInterval(iv);
  }, [text, ts]);
  return <span>{text.slice(0, shown)}</span>;
}