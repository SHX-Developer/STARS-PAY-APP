import { useState, type CSSProperties, type ReactNode } from 'react';
import { TOKENS } from '../lib/tokens';

type Variant = 'violet' | 'gold' | 'dark';

interface PrimaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
  fullWidth?: boolean;
  variant?: Variant;
}

const gradients: Record<Variant, string> = {
  violet: 'linear-gradient(135deg, #9B7BFF 0%, #7B5CE6 100%)',
  gold: 'linear-gradient(135deg, #F2C66B 0%, #E8B252 100%)',
  dark: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
};
const glow: Record<Variant, string> = {
  violet: '0 8px 24px rgba(123,92,230,0.45), inset 0 1px 0 rgba(255,255,255,0.3)',
  gold: '0 8px 24px rgba(242,198,107,0.4), inset 0 1px 0 rgba(255,255,255,0.4)',
  dark: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
};

export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  style = {},
  fullWidth = true,
  variant = 'violet',
}: PrimaryButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        width: fullWidth ? '100%' : 'auto',
        height: 54,
        borderRadius: 16,
        border: variant === 'dark' ? `1px solid ${TOKENS.glassBorderStrong}` : 'none',
        background: gradients[variant],
        color: variant === 'gold' ? '#3A2A0A' : '#fff',
        fontSize: 16,
        fontWeight: 600,
        letterSpacing: 0.1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        boxShadow: hovered ? glow[variant] : glow[variant],
        transform: pressed ? 'scale(0.98)' : 'scale(1)',
        transition: 'transform 160ms ease, box-shadow 220ms ease, filter 220ms ease',
        filter: hovered && !disabled ? 'brightness(1.06)' : 'brightness(1)',
        fontFamily: 'inherit',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
