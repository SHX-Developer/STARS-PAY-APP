import { TOKENS } from '../lib/tokens';
import { Icon } from './Icon';
import { useT } from '../lib/i18n-context';
import { hapticTap } from '../lib/telegram';
import type { TKey } from '../lib/i18n';

export type Screen = 'home' | 'referrals' | 'tasks' | 'orders' | 'profile' | 'admin';

interface NavTab {
  id: Screen;
  icon: string;
  labelKey: TKey;
}

const TABS: NavTab[] = [
  { id: 'referrals', icon: 'referrals', labelKey: 'nav_referrals' },
  { id: 'tasks', icon: 'tasks', labelKey: 'nav_tasks' },
  { id: 'home', icon: 'home', labelKey: 'nav_home' },
  { id: 'orders', icon: 'orders', labelKey: 'nav_orders' },
  { id: 'profile', icon: 'profile', labelKey: 'nav_profile' },
];

export function BottomNav({
  active,
  onChange,
  isAdmin,
}: {
  active: Screen;
  onChange: (s: Screen) => void;
  isAdmin?: boolean;
}) {
  const tr = useT();
  const tabs = isAdmin
    ? [...TABS, { id: 'admin' as const, icon: 'trophy', labelKey: 'nav_admin' as const }]
    : TABS;
  const activeIdx = tabs.findIndex((t) => t.id === active);

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
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
          minHeight: 76,
          background: 'rgba(15,9,32,0.7)',
          backdropFilter: 'blur(28px) saturate(200%)',
          WebkitBackdropFilter: 'blur(28px) saturate(200%)',
          border: `1px solid ${TOKENS.glassBorderStrong}`,
          borderRadius: 28,
          boxShadow: '0 12px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'stretch',
          padding: '8px 6px 8px',
          pointerEvents: 'auto',
          position: 'relative',
        }}
      >
        {/* движущийся фон-индикатор активной вкладки */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 6,
            bottom: 6,
            // ширина в процентах от 5 равных колонок
            width: `calc((100% - 12px) / ${tabs.length})`,
            left: `calc(6px + ((100% - 12px) / ${tabs.length}) * ${activeIdx})`,
            borderRadius: 20,
            background: 'rgba(155,123,255,0.16)',
            border: '1px solid rgba(155,123,255,0.28)',
            transition:
              'left 360ms cubic-bezier(0.34,1.3,0.64,1), background 220ms ease',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            pointerEvents: 'none',
          }}
        />
        {/* top shine */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 24,
            right: 24,
            height: 1,
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
            pointerEvents: 'none',
          }}
        />
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                hapticTap();
                onChange(t.id);
              }}
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '4px 2px',
                position: 'relative',
                zIndex: 1,
                fontFamily: 'inherit',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                transition: 'color 220ms ease, transform 240ms cubic-bezier(0.34,1.6,0.64,1)',
                transform: isActive ? 'translateY(-1px)' : 'translateY(0)',
              }}
            >
              <Icon
                name={t.icon}
                size={22}
                color={isActive ? '#fff' : 'rgba(255,255,255,0.55)'}
                strokeWidth={isActive ? 2 : 1.7}
              />
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: isActive ? 700 : 600,
                  letterSpacing: 0.1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                  transition: 'color 220ms ease',
                }}
              >
                {tr(t.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
