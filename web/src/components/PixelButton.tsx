import { useState, type CSSProperties, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

export interface PixelButtonProps {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: CSSProperties;
  title?: string;
  type?: 'button' | 'submit';
}

const heightBySize: Record<Size, number> = { sm: 24, md: 32, lg: 40 };
const padBySize: Record<Size, string> = { sm: '0 8px', md: '0 12px', lg: '0 16px' };

export function PixelButton({
  variant = 'primary',
  size = 'md',
  children,
  onClick,
  disabled = false,
  fullWidth = false,
  style,
  title,
  type = 'button',
}: PixelButtonProps) {
  const [pressed, setPressed] = useState(false);
  const [hover, setHover] = useState(false);

  const disabledText = 'var(--cv-ink-500)';

  const palette = (() => {
    switch (variant) {
      case 'primary':
        return {
          fill: disabled ? 'var(--cv-cream-300)' : (hover ? 'var(--cv-ink-700)' : 'var(--cv-ink-900)'),
          text: disabled ? disabledText : 'var(--cv-cream-50)',
          border: 'var(--cv-ink-900)',
          shadow: 'var(--cv-ink-900)',
        };
      case 'secondary':
        return {
          fill: disabled ? 'var(--cv-cream-300)' : (hover ? 'var(--cv-cream-200)' : 'var(--cv-cream-100)'),
          text: disabled ? disabledText : 'var(--cv-ink-900)',
          border: 'var(--cv-ink-300)',
          shadow: 'var(--cv-ink-100)',
        };
      case 'ghost':
        return {
          fill: hover ? 'var(--cv-cream-200)' : 'transparent',
          text: disabled ? disabledText : 'var(--cv-ink-700)',
          border: 'var(--cv-ink-300)',
          shadow: 'var(--cv-ink-100)',
        };
      case 'destructive':
        return {
          fill: disabled ? 'var(--cv-cream-300)' : (hover ? 'var(--cv-coral-light)' : 'var(--cv-coral)'),
          text: disabled ? disabledText : 'var(--cv-ink-900)',
          border: 'var(--cv-ink-500)',
          shadow: 'var(--cv-ink-300)',
        };
    }
  })();

  return (
    <button
      type={type}
      title={title}
      onClick={disabled ? undefined : onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => { setPressed(false); setHover(false); }}
      onMouseEnter={() => setHover(true)}
      disabled={disabled}
      style={{
        height: heightBySize[size],
        padding: padBySize[size],
        background: palette.fill,
        color: palette.text,
        border: 'none',
        boxShadow: pressed && !disabled
          ? `inset 0 0 0 1px ${palette.border}`
          : `inset 0 0 0 1px ${palette.border}, 0 1px 0 ${palette.shadow}`,
        transform: pressed && !disabled ? 'translateY(1px)' : 'none',
        fontFamily: 'var(--cv-font-ui)',
        fontSize: size === 'lg' ? 'var(--cv-text-body-md)' : 'var(--cv-text-body-sm)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: fullWidth ? '100%' : 'auto',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        ...style,
      }}
    >
      {children}
    </button>
  );
}