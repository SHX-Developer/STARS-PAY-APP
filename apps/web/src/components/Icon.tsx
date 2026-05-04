import type { CSSProperties } from 'react';
import { TOKENS } from '../lib/tokens';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  filled?: boolean;
  strokeWidth?: number;
  style?: CSSProperties;
}

export function Icon({
  name,
  size = 22,
  color = 'currentColor',
  filled = false,
  strokeWidth = 1.7,
  style,
}: IconProps) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: filled ? color : 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style,
  };
  switch (name) {
    case 'referrals':
      return (
        <svg {...props}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          <circle cx="17" cy="6" r="2.2" />
          <path d="M21 14c0-2.2-1.8-4-4-4" />
        </svg>
      );
    case 'tasks':
      return (
        <svg {...props}>
          <rect x="4" y="4" width="16" height="16" rx="3.5" />
          <path d="M8.5 12.5l2.2 2.2L15.8 9.5" />
        </svg>
      );
    case 'home':
      return (
        <svg {...props}>
          <path d="M12 2.5 L14 9 L20.5 11 L14.5 13 L12 21 L9.5 13 L3.5 11 L10 9 Z" />
        </svg>
      );
    case 'orders':
      return (
        <svg {...props}>
          <path d="M5 7h14l-1.5 11.5a2 2 0 0 1-2 1.7H8.5a2 2 0 0 1-2-1.7L5 7z" />
          <path d="M9 7V5a3 3 0 0 1 6 0v2" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="3.6" />
          <path d="M4.5 20c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5" />
        </svg>
      );
    case 'history':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'send':
      return (
        <svg {...props}>
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      );
    case 'support':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5" />
          <circle cx="12" cy="17" r="0.5" fill={color} stroke="none" />
        </svg>
      );
    case 'tg':
      return (
        <svg {...props}>
          <path d="M3.5 11.5l16-6.3c.7-.3 1.3.4 1 1.1l-3 14c-.2.7-1 .9-1.5.4l-4.2-3.4-2.3 2.2c-.3.3-.7.1-.7-.3v-3.7l8.5-7.7-10.4 6.5-3.7-1.2c-.7-.2-.7-1.2.3-1.6z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg {...props}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
          <circle cx="12" cy="12" r="3.6" />
          <circle cx="17" cy="7" r="0.6" fill={color} stroke="none" />
        </svg>
      );
    case 'globe':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
        </svg>
      );
    case 'sparkle':
      return (
        <svg {...props}>
          <path d="M12 4 L13.4 9.5 L19 11 L13.4 12.5 L12 18 L10.6 12.5 L5 11 L10.6 9.5 Z" />
          <path d="M19 17l.7 1.6L21 19l-1.3.4L19 21l-.7-1.6L17 19l1.3-.4z" />
        </svg>
      );
    case 'trophy':
      return (
        <svg {...props}>
          <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
          <path d="M17 5h2.5a1 1 0 0 1 1 1.5C20 9 18 10 17 10M7 5H4.5a1 1 0 0 0-1 1.5C4 9 6 10 7 10" />
          <path d="M9 13h6v3H9zM8 19h8" />
        </svg>
      );
    case 'chevron-right':
      return (
        <svg {...props}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
    case 'copy':
      return (
        <svg {...props}>
          <rect x="8" y="8" width="12" height="12" rx="2.5" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </svg>
      );
    case 'check':
      return (
        <svg {...props}>
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      );
    case 'qr':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3M14 19h3M19 14v7M14 21h7" />
        </svg>
      );
    case 'share':
      return (
        <svg {...props}>
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      );
    case 'arrow-up':
      return (
        <svg {...props}>
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </svg>
      );
    case 'close':
      return (
        <svg {...props}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    default:
      return null;
  }
}

/**
 * StarIcon — теперь просто эмодзи ⭐️.
 * Сохраняем сигнатуру (size/color/glow) ради обратной совместимости — но color
 * и glow игнорируются, т.к. цвет эмодзи задаёт сам шрифт системы.
 */
export function StarIcon({
  size = 18,
}: {
  size?: number;
  color?: string;
  glow?: boolean;
}) {
  return (
    <span
      style={{
        fontSize: size,
        lineHeight: 1,
        display: 'inline-block',
        // эмодзи в Safari/iOS могут вертикально съезжать — приподнимаем чуть-чуть
        verticalAlign: 'middle',
        // сглаживаем pixel-edges на маленьких размерах
        WebkitFontSmoothing: 'antialiased',
      }}
      aria-label="star"
      role="img"
    >
      ⭐️
    </span>
  );
}

export function GemIcon({ size = 18, color = TOKENS.violet }: { size?: number; color?: string }) {
  const id = `gg-${color.replace('#', '')}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ filter: `drop-shadow(0 0 8px ${color}99)` }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C9B4FF" />
          <stop offset="60%" stopColor={color} />
          <stop offset="100%" stopColor="#5B3DCC" />
        </linearGradient>
      </defs>
      <path
        d="M6 4 H18 L22 10 L12 22 L2 10 Z"
        fill={`url(#${id})`}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="0.6"
      />
      <path
        d="M6 4 L9 10 L2 10 M18 4 L15 10 L22 10 M9 10 L12 22 L15 10 M9 10 L15 10"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="0.6"
        fill="none"
      />
    </svg>
  );
}
