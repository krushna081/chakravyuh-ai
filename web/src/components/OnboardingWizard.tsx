import { useState } from 'react';
import { useStore } from '../store/store';
import { PixelButton } from './PixelButton';
import { CALL_SIGNS } from '../scene/callSigns';
import { Insignia } from './AddAgentModal';

/**
 * First-run wizard: welcome, enlist the commander, enter the command center.
 * No demo mode — the formation connects to the real orchestrator or says so.
 * Shown once per browser (until the user completes it or opts out).
 */
export function OnboardingWizard() {
  const onboardingComplete = useStore((s) => s.onboardingComplete);
  const setOnboardingComplete = useStore((s) => s.setOnboardingComplete);
  const addAgent = useStore((s) => s.addAgent);
  const hasCommander = useStore((s) => s.agents.some((a) => a.isCommander));

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [commanderName, setCommanderName] = useState('');
  const [commanderSign, setCommanderSign] = useState('commander');
  const [busy, setBusy] = useState(false);

  if (onboardingComplete || hasCommander) return null;

  const finish = () => {
    setBusy(true);
    const slug = commanderName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    addAgent({
      id: slug || `commander-${Date.now().toString(36)}`,
      name: commanderName.trim() || 'Commander',
      callSign: commanderSign,
      accent: 'lilac',
      description: 'orchestrates the formation, keeps the board, guards the memory',
      project: 'command post',
      status: 'idle',
      action: 'awaiting',
      progress: 0,
      isCommander: true,
      local: true,
      capabilities: [],
      model: '',
      provider: '',
      contextTokens: 0,
      contextLimit: 64000,
    });
    window.setTimeout(() => {
      setOnboardingComplete(true);
      setBusy(false);
    }, 500);
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 980, background: 'rgba(4,6,9,0.6)' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to Chakravyuh AI"
        style={{
          position: 'fixed', zIndex: 981,
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(560px, calc(100vw - 32px))',
          background: 'var(--cv-cream-100)',
          boxShadow: 'var(--cv-shadow-hard)',
          padding: 22,
          fontFamily: 'var(--cv-font-ui)',
        }}
      >
        {/* progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                flex: 1, height: 4,
                background: i <= step ? 'var(--cv-cyan)' : 'var(--cv-ink-100)',
              }}
            />
          ))}
        </div>

        {step === 0 && (
          <>
            <h1 style={{
              margin: 0, fontFamily: 'var(--cv-font-display)',
              fontSize: 'var(--cv-text-display-lg)', lineHeight: 'var(--cv-lh-display-lg)',
              fontWeight: 700,
              color: 'var(--cv-ink-900)',
            }}>CHAKRAVYUH AI</h1>
            <p style={{ fontSize: 13, color: 'var(--cv-ink-700)', lineHeight: '20px', margin: '10px 0 16px' }}>
              The command center for your agent formation. Enlist specialized agents, queue prompts, run tasks
              through the control agent, and keep memory in one place — all executed for real by your orchestrator
              backend. No simulated activity, ever.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <PixelButton variant="ghost" onClick={() => { setOnboardingComplete(true); }}>
                skip
              </PixelButton>
              <PixelButton variant="primary" onClick={() => setStep(1)}>begin →</PixelButton>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 style={{
              margin: 0, fontFamily: 'var(--cv-font-display)',
              fontSize: 'var(--cv-text-display-lg)', lineHeight: 'var(--cv-lh-display-lg)',
              fontWeight: 700,
              color: 'var(--cv-ink-900)',
            }}>ENLIST THE COMMANDER</h1>
            <p style={{ fontSize: 13, color: 'var(--cv-ink-700)', lineHeight: '20px', margin: '10px 0 14px' }}>
              Every formation needs one orchestrator — the agent that keeps the board, delegates missions, and
              guards memory. Name yours.
            </p>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{
                display: 'block', fontFamily: 'var(--cv-font-mono)', fontSize: 10,
                letterSpacing: '0.06em',
                color: 'var(--cv-ink-500)', marginBottom: 4,
              }}>COMMANDER NAME</span>
              <input
                autoFocus
                value={commanderName}
                onChange={(e) => setCommanderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setStep(2); }}
                placeholder="e.g. mila"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '8px 10px',
                  background: 'var(--cv-paper-100)',
                  boxShadow: 'var(--cv-panel-border-inset)',
                  border: 'none', outline: 'none',
                  fontFamily: 'var(--cv-font-mono)', fontSize: 13,
                  color: 'var(--cv-ink-900)',
                }}
              />
            </label>
            <div style={{ marginBottom: 14 }}>
              <span style={{
                display: 'block', fontFamily: 'var(--cv-font-mono)', fontSize: 10,
                letterSpacing: '0.06em',
                color: 'var(--cv-ink-500)', marginBottom: 4,
              }}>INSIGNIA</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {CALL_SIGNS.filter((c) => ['commander', 'sentinel', 'falcon', 'owl', 'vanguard'].includes(c.id)).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCommanderSign(c.id)}
                    title={`${c.displayName} — ${c.blurb}`}
                    style={{
                      width: 54, height: 54, padding: 4, border: 'none', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', gap: 2,
                      background: commanderSign === c.id ? 'var(--cv-violet-glow)' : 'var(--cv-cream-200)',
                      boxShadow: commanderSign === c.id
                        ? 'inset 0 0 0 2px var(--cv-violet)'
                        : 'var(--cv-panel-border-inset)',
                    }}
                  >
                    <span style={{ color: 'var(--cv-violet)' }}><Insignia glyph={c.glyph} size={24} /></span>
                    <span style={{ fontFamily: 'var(--cv-font-mono)', fontSize: 7.5, color: 'var(--cv-ink-500)' }}>
                      {c.displayName.toUpperCase()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <PixelButton variant="ghost" onClick={() => setStep(0)}>← back</PixelButton>
              <PixelButton variant="primary" onClick={() => setStep(2)}>continue →</PixelButton>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 style={{
              margin: 0, fontFamily: 'var(--cv-font-display)',
              fontSize: 'var(--cv-text-display-lg)', lineHeight: 'var(--cv-lh-display-lg)',
              fontWeight: 700,
              color: 'var(--cv-ink-900)',
            }}>
              {commanderName.trim() || 'COMMANDER'} ON STATION
            </h1>
            <p style={{ fontSize: 13, color: 'var(--cv-ink-700)', lineHeight: '20px', margin: '10px 0 4px' }}>
              The formation is ready. What you can do right now:
            </p>
            <ul style={{
              fontSize: 12, color: 'var(--cv-ink-700)', lineHeight: '20px',
              paddingLeft: 18, margin: '6px 0 16px',
            }}>
              <li>queue prompts to any agent (session tab) — real turns run on the orchestrator</li>
              <li>enlist more agents with the <b>+ add agent</b> button in the roster dock</li>
              <li>queue tasks from the commander panel's kanban — they route through the control agent</li>
              <li>check the integrations tab for Ollama and tool status; the engine reports its own state</li>
            </ul>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <PixelButton variant="ghost" onClick={() => setStep(1)}>← back</PixelButton>
              <PixelButton variant="primary" disabled={busy} onClick={finish}>
                {busy ? 'standing up…' : 'enter the command center →'}
              </PixelButton>
            </div>
          </>
        )}
      </div>
    </>
  );
}