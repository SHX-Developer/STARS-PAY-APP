import { TOKENS } from '../lib/tokens';

export function Toast({ message, visible }: { message: string | null; visible: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 110,
        transform: `translateX(-50%) translateY(${visible ? 0 : 20}px)`,
        opacity: visible ? 1 : 0,
        transition: 'opacity 240ms ease, transform 240ms ease',
        pointerEvents: 'none',
        padding: '10px 18px',
        borderRadius: 999,
        background: 'rgba(20,12,40,0.85)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${TOKENS.glassBorderStrong}`,
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        zIndex: 200,
        whiteSpace: 'nowrap',
      }}
    >
      {message}
    </div>
  );
}
