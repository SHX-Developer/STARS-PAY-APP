import { TOKENS } from '../lib/tokens';
import { Icon } from './Icon';

export type Screen = 'home' | 'referrals' | 'tasks' | 'orders' | 'profile';

export function BottomNav({
  active,
  onChange,
}: {
  active: Screen;
  onChange: (s: Screen) => void;
}) {
  const tabs: { id: Screen; icon: string }[] = [
    { id: 'referrals', icon: 'referrals' },
    { id: 'tasks', icon: 'tasks' },
    { id: 'home', icon: 'home' },
    { id: 'orders', icon: 'orders' },
    { id: 'profile', icon: 'profile' },
  ];
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          margin: '0 12px 8px',
          flex: 1,
          height: 70,
          background: 'rgba(15,9,32,0.65)',
          backdropFilter: 'blur(28px) saturate(200%)',
          WebkitBackdropFilter: 'blur(28px) saturate(200%)',
          border: `1px solid ${TOKENS.glassBorderStrong}`,
          borderRadius: 28,
          boxShadow: '0 12px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 6px',
          pointerEvents: 'auto',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 24,
            right: 24,
            height: 1,
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
          }}
        />
        {tabs.map((t) => {
          const isActive = active === t.id;
          const isHome = t.id === 'home';
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              style={{
                width: isHome ? 60 : 52,
                height: 52,
                borderRadius: isHome ? 18 : 14,
                border: 'none',
                cursor: 'pointer',
                background: isActive
                  ? isHome
                    ? 'linear-gradient(135deg, #9B7BFF 0%, #7B5CE6 100%)'
                    : 'rgba(155,123,255,0.18)'
                  : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                transition: 'all 220ms cubic-bezier(0.34,1.56,0.64,1)',
                boxShadow: isActive
                  ? isHome
                    ? '0 8px 22px rgba(123,92,230,0.55), inset 0 1px 0 rgba(255,255,255,0.3)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.08)'
                  : 'none',
                transform:
                  isActive && isHome ? 'translateY(-4px) scale(1.05)' : 'translateY(0) scale(1)',
              }}
            >
              <Icon
                name={t.icon}
                size={isHome ? 26 : 23}
                color={isActive ? '#fff' : 'rgba(255,255,255,0.55)'}
                strokeWidth={isActive ? 2 : 1.7}
              />
              {isActive && !isHome && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4,
                    height: 4,
                    borderRadius: 4,
                    background: TOKENS.violet,
                    boxShadow: `0 0 8px ${TOKENS.violet}`,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
