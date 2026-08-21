import { useEffect, useRef, useState } from 'react';

export interface SidebarSplitterProps {
  width: number;
  onChange: (px: number) => void;
  viewportWidth: number;
  min?: number;
  max?: number;
}

export function SidebarSplitter({
  width,
  onChange,
  viewportWidth,
  min = 320,
  max = 1200,
}: SidebarSplitterProps) {
  const [active, setActive] = useState(false);
  const dragRef = useRef<{ clientX: number; width: number } | null>(null);

  useEffect(() => {
    if (!dragRef.current) return;
    const onMove = (e: MouseEvent) => {
      const start = dragRef.current;
      if (!start) return;
      const delta = e.clientX - start.clientX;
      const next = Math.min(max, Math.max(min, start.width + delta));
      onChange(next);
    };
    const onUp = () => {
      dragRef.current = null;
      setActive(false);
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [min, max, onChange]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize agent panel"
      title="Drag to resize · double-click to reset"
      onMouseDown={(e) => {
        dragRef.current = { clientX: e.clientX, width };
        setActive(true);
        document.body.style.cursor = 'ew-resize';
      }}
      onDoubleClick={() => onChange(440)}
      style={{
        width: 10,
        flexShrink: 0,
        cursor: 'ew-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
      }}
    >
      <div
        style={{
          width: active ? 3 : 2,
          height: '100%',
          background: active ? 'var(--cv-ink-900)' : 'var(--cv-ink-300)',
          transition: 'width 60ms steps(2), background 60ms steps(2)',
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          width: 6,
          height: 24,
          background: 'repeating-linear-gradient(90deg, var(--cv-ink-500) 0 1px, transparent 1px 2px)',
          opacity: 0.8,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}