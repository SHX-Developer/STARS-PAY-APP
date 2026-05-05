import { useEffect, useState, useRef, type ReactNode, type TouchEvent } from 'react';
import { TOKENS } from '../lib/tokens';
import { Glass } from '../components/Glass';
import { Icon, StarIcon, GemIcon } from '../components/Icon';
import { PrimaryButton } from '../components/PrimaryButton';
import { useT } from '../lib/i18n-context';
import { hapticTap } from '../lib/telegram';
import { starsToUzs, PREMIUM_UZS, formatUzs } from '../lib/currency';
import { api } from '../lib/api';
import type { AppUser } from '../types';

interface LookupState {
  status: 'idle' | 'loading' | 'found' | 'not_found' | 'error';
  name?: string | null;
  isPremium?: boolean;
}

interface HomeProps {
  user: AppUser;
  onCheckout: (order: {
    kind: 'stars' | 'premium';
    username: string;
    amount: number;
    priceUzs: number;
  }) => void;
}

export function HomeScreen({ user, onCheckout }: HomeProps) {
  const tr = useT();
  const [tab, setTab] = useState<'stars' | 'premium'>('stars');
  const [username, setUsername] = useState(user.username ?? '');
  const [amount, setAmount] = useState(100);
  const [premiumMonths, setPremiumMonths] = useState<3 | 6 | 12>(3);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' });

  // debounced username lookup
  useEffect(() => {
    const u = username.trim().replace(/^@/, '');
    if (u.length < 3) {
      setLookup({ status: 'idle' });
      return;
    }
    setLookup({ status: 'loading' });
    const t = setTimeout(async () => {
      try {
        const res = await api.lookupUsername(u);
        if (res.found) {
          setLookup({ status: 'found', name: res.name ?? null, isPremium: res.isPremium ?? false });
        } else {
          setLookup({ status: 'not_found' });
        }
      } catch (err) {
        // 404 от Buypin — не ошибка, просто не нашли
        const status = (err as { status?: number }).status;
        setLookup({ status: status === 404 ? 'not_found' : 'error' });
      }
    }, 500);
    return () => clearTimeout(t);
  }, [username]);

  const banners = [
    {
      id: 'stars',
      titleKey: 'home_banner_stars_title' as const,
      subKey: 'home_banner_stars_sub' as const,
      gradient:
        'linear-gradient(135deg, rgba(242,198,107,0.35) 0%, rgba(155,123,255,0.4) 100%)',
      icon: 'sparkle',
      iconColor: TOKENS.gold,
    },
    {
      id: 'premium',
      titleKey: 'home_banner_premium_title' as const,
      subKey: 'home_banner_premium_sub' as const,
      gradient: 'linear-gradient(135deg, rgba(155,123,255,0.5) 0%, rgba(91,61,204,0.5) 100%)',
      icon: 'sparkle',
      iconColor: TOKENS.violet,
    },
  ];

  // авто-листание
  useEffect(() => {
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % banners.length), 4500);
    return () => clearInterval(t);
  }, [banners.length]);

  // touch-свайп для баннера
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (Math.abs(dx) > 40) {
      hapticTap();
      setBannerIdx((i) => {
        const len = banners.length;
        // свайп влево → следующий, вправо → предыдущий
        return (i + (dx < 0 ? 1 : -1) + len) % len;
      });
    }
    touchStartX.current = null;
  };

  const priceUzs = tab === 'stars' ? starsToUzs(amount) : PREMIUM_UZS[premiumMonths];

  const starOptions = [50, 100, 250, 500];
  const monthOptions = [
    { v: 3 as const, label: '3 months' },
    { v: 6 as const, label: '6 months' },
    { v: 12 as const, label: '12 months' },
  ];

  const canCheckout = username.trim().length > 0 && (tab === 'premium' || amount > 0);
  const greeting = user.firstName || 'Friend';

  return (
    <div
      style={{
        padding: '8px 16px 110px',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
      }}
    >
      {/* greeting */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 4px 0',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              color: TOKENS.textMute,
              fontWeight: 600,
              letterSpacing: 0.6,
            }}
          >
            {tr('home_welcome').toUpperCase()}
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: TOKENS.text,
              letterSpacing: -0.4,
            }}
          >
            {greeting}
          </div>
        </div>
        <Glass
          radius={999}
          padding="8px 14px"
          intense
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <StarIcon size={16} />
          <span style={{ color: TOKENS.text, fontWeight: 700, fontSize: 14 }}>
            {user.starBalance.toLocaleString()}
          </span>
        </Glass>
      </div>

      {/* banner */}
      <div>
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{
            position: 'relative',
            height: 152,
            borderRadius: 24,
            overflow: 'hidden',
            touchAction: 'pan-y',
          }}
        >
          {banners.map((b, i) => (
            <div
              key={b.id}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: i === bannerIdx ? 1 : 0,
                transform: `translateX(${(i - bannerIdx) * 8}%) scale(${i === bannerIdx ? 1 : 0.97})`,
                transition: 'opacity 500ms ease, transform 500ms ease',
                background: b.gradient,
                border: `1px solid ${TOKENS.glassBorderStrong}`,
                borderRadius: 24,
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                backdropFilter: 'blur(8px)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.18), 0 12px 28px rgba(0,0,0,0.3)',
                pointerEvents: i === bannerIdx ? 'auto' : 'none',
              }}
            >
              <Icon name={b.icon} size={34} color={b.iconColor} strokeWidth={1.4} />
              <div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: '#fff',
                    letterSpacing: -0.4,
                    lineHeight: 1.1,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {tr(b.titleKey)}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.75)',
                    marginTop: 6,
                    fontWeight: 500,
                  }}
                >
                  {tr(b.subKey)}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12 }}>
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                hapticTap();
                setBannerIdx(i);
              }}
              style={{
                width: i === bannerIdx ? 22 : 6,
                height: 6,
                borderRadius: 6,
                background: i === bannerIdx ? TOKENS.violet : 'rgba(255,255,255,0.2)',
                border: 'none',
                cursor: 'pointer',
                transition: 'width 320ms ease, background 320ms ease',
                boxShadow: i === bannerIdx ? `0 0 10px ${TOKENS.violet}aa` : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* tabs */}
      <Glass radius={18} padding={4} style={{ display: 'flex', position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: 4,
            bottom: 4,
            left: tab === 'stars' ? 4 : '50%',
            width: 'calc(50% - 4px)',
            borderRadius: 14,
            background:
              tab === 'stars'
                ? 'linear-gradient(135deg, rgba(242,198,107,0.85), rgba(232,178,82,0.95))'
                : 'linear-gradient(135deg, rgba(155,123,255,0.85), rgba(123,92,230,0.95))',
            boxShadow:
              tab === 'stars'
                ? '0 6px 18px rgba(242,198,107,0.4), inset 0 1px 0 rgba(255,255,255,0.4)'
                : '0 6px 18px rgba(123,92,230,0.45), inset 0 1px 0 rgba(255,255,255,0.3)',
            transition:
              'left 320ms cubic-bezier(0.65,0,0.35,1), background 320ms ease, box-shadow 320ms ease',
          }}
        />
        {(
          [
            { id: 'stars', label: tr('home_tab_stars') },
            { id: 'premium', label: tr('home_tab_premium') },
          ] as const
        ).map((o) => (
          <button
            key={o.id}
            onClick={() => {
              hapticTap();
              setTab(o.id);
            }}
            style={{
              flex: 1,
              height: 46,
              border: 'none',
              background: 'transparent',
              color:
                tab === o.id ? (o.id === 'stars' ? '#3A2A0A' : '#fff') : TOKENS.textDim,
              fontSize: 14.5,
              fontWeight: 700,
              letterSpacing: 0.2,
              cursor: 'pointer',
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'color 200ms ease',
              fontFamily: 'inherit',
            }}
          >
            {o.id === 'stars' ? (
              <StarIcon
                size={16}
                glow={false}
                color={tab === 'stars' ? '#3A2A0A' : TOKENS.gold}
              />
            ) : (
              <GemIcon size={16} color={tab === 'premium' ? '#fff' : TOKENS.violet} />
            )}
            {o.label}
          </button>
        ))}
      </Glass>

      {/* form */}
      <Glass radius={22} padding={20} intense>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: TOKENS.textMute,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          {tr('home_recipient')}
        </div>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={tr('home_username_placeholder')}
          style={{
            width: '100%',
            height: 52,
            borderRadius: 14,
            padding: '0 16px',
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${TOKENS.glassBorder}`,
            color: TOKENS.text,
            fontSize: 15,
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <LookupHint state={lookup} />
        {tab === 'stars' && (
          <>
            <div
              style={{
                marginTop: 18,
                marginBottom: 8,
                fontSize: 13,
                fontWeight: 700,
                color: TOKENS.textMute,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              {tr('home_amount')}
            </div>
            <input
              value={amount}
              onChange={(e) =>
                setAmount(Math.max(0, parseInt(e.target.value.replace(/\D/g, '') || '0', 10)))
              }
              placeholder="100"
              style={{
                width: '100%',
                height: 52,
                borderRadius: 14,
                padding: '0 16px',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${TOKENS.glassBorder}`,
                color: TOKENS.text,
                fontSize: 15,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </>
        )}
      </Glass>

      {/* quick chips */}
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: TOKENS.textMute,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginBottom: 12,
            padding: '0 4px',
          }}
        >
          {tab === 'stars' ? tr('home_quick_amount') : tr('home_duration')}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: tab === 'stars' ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
            gap: 10,
          }}
        >
          {tab === 'stars'
            ? starOptions.map((v) => (
                <Chip key={v} active={amount === v} onClick={() => setAmount(v)}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>{v}</span>
                    <StarIcon size={14} glow={false} />
                  </span>
                </Chip>
              ))
            : monthOptions.map((o) => (
                <Chip
                  key={o.v}
                  active={premiumMonths === o.v}
                  onClick={() => setPremiumMonths(o.v)}
                >
                  <span style={{ fontSize: 18, fontWeight: 800 }}>{o.v}</span>
                  <span style={{ fontSize: 11, opacity: 0.8, fontWeight: 600 }}>{tr('home_months')}</span>
                </Chip>
              ))}
        </div>
      </div>

      {/* total */}
      <Glass
        radius={20}
        padding={18}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              color: TOKENS.textMute,
              fontWeight: 600,
              letterSpacing: 0.6,
              marginBottom: 2,
            }}
          >
            {tr('home_total').toUpperCase()}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: '#fff',
                letterSpacing: -0.4,
                lineHeight: 1.05,
              }}
            >
              {formatUzs(priceUzs)}
            </span>
            <span style={{ fontSize: 12, color: TOKENS.textDim, fontWeight: 700 }}>UZS</span>
          </div>
        </div>
        <PrimaryButton
          fullWidth={false}
          disabled={!canCheckout}
          onClick={() =>
            onCheckout({
              kind: tab,
              username,
              amount: tab === 'stars' ? amount : premiumMonths,
              priceUzs,
            })
          }
          style={{ minWidth: 150, height: 52, fontSize: 15 }}
        >
          {tr('home_checkout')} →
        </PrimaryButton>
      </Glass>
    </div>
  );
}

function LookupHint({ state }: { state: LookupState }) {
  if (state.status === 'idle') return null;
  const tone =
    state.status === 'found'
      ? { bg: 'rgba(75,200,150,0.10)', border: 'rgba(75,200,150,0.35)', color: '#7BD89B' }
      : state.status === 'not_found'
        ? { bg: 'rgba(255,123,123,0.08)', border: 'rgba(255,123,123,0.30)', color: '#FF9E9E' }
        : state.status === 'loading'
          ? { bg: 'rgba(155,123,255,0.10)', border: 'rgba(155,123,255,0.30)', color: TOKENS.textDim }
          : { bg: 'rgba(255,255,255,0.04)', border: TOKENS.glassBorder, color: TOKENS.textMute };

  return (
    <div
      style={{
        marginTop: 10,
        padding: '10px 14px',
        borderRadius: 12,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 13,
        color: tone.color,
        fontWeight: 600,
        minHeight: 38,
      }}
    >
      {state.status === 'loading' && (
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.18)',
            borderTopColor: TOKENS.violet,
            animation: 'spin 0.85s linear infinite',
            flexShrink: 0,
          }}
        />
      )}
      {state.status === 'loading' && <span>Checking…</span>}
      {state.status === 'not_found' && <span>User not found</span>}
      {state.status === 'error' && <span>Lookup unavailable</span>}
      {state.status === 'found' && (
        <>
          <Icon name="check" size={14} color={tone.color} strokeWidth={2.4} />
          <span style={{ color: TOKENS.text, fontWeight: 700 }}>{state.name ?? 'Found'}</span>
          {state.isPremium && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 999,
                background: 'rgba(155,123,255,0.18)',
                border: '1px solid rgba(155,123,255,0.35)',
                color: '#C9B4FF',
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              💎 Premium
            </span>
          )}
        </>
      )}
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={() => {
        hapticTap();
        onClick();
      }}
      style={{
        height: 56,
        borderRadius: 14,
        border: `1px solid ${active ? 'rgba(155,123,255,0.5)' : TOKENS.glassBorder}`,
        background: active
          ? 'linear-gradient(135deg, rgba(155,123,255,0.22), rgba(123,92,230,0.18))'
          : 'rgba(255,255,255,0.04)',
        color: active ? '#fff' : TOKENS.textDim,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        fontSize: 16,
        fontWeight: 700,
        fontFamily: 'inherit',
        transition: 'all 220ms ease',
        backdropFilter: 'blur(12px)',
        boxShadow: active
          ? '0 6px 18px rgba(123,92,230,0.3), inset 0 1px 0 rgba(255,255,255,0.15)'
          : 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {children}
    </button>
  );
}
