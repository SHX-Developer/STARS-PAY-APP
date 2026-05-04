import { useState, type CSSProperties, type ReactNode } from 'react';
import { TOKENS } from '../lib/tokens';

interface GlassProps {
  children?: ReactNode;
  style?: CSSProperties;
  radius?: number;
  padding?: number | string;
  intense?: boolean;
  hover?: boolean;
  onClick?: () => void;
}

export function Glass({
  children,
  style = {},
  radius = 20,
  padding = 16,
  intense = false,
  hover = false,
  onClick,
}: GlassProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        position: 'relative',
        borderRadius: radius,
        padding,
        background: intense ? TOKENS.glassBgStrong : TOKENS.glassBg,
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: `1px solid ${intense ? TOKENS.glassBorderStrong : TOKENS.glassBorder}`,
        boxShadow:
          hovered && hover
            ? '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)'
            : '0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
        transform: pressed && hover ? 'scale(0.985)' : 'scale(1)',
        transition: 'transform 180ms ease, box-shadow 220ms ease, background 220ms ease',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 12,
          right: 12,
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
          borderRadius: 1,
          pointerEvents: 'none',
        }}
      />
      {children}
    </div>
  );
}
