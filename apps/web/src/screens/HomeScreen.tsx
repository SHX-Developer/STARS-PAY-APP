import { useEffect, useState, type ReactNode } from 'react';
import { TOKENS } from '../lib/tokens';
import { Glass } from '../components/Glass';
import { Icon, StarIcon, GemIcon } from '../components/Icon';
import { PrimaryButton } from '../components/PrimaryButton';
import type { AppUser } from '../types';

interface HomeProps {
  user: AppUser;
  onCheckout: (order: {
    kind: 'stars' | 'premium';
    username: string;
    amount: number;
    price: string;
  }) => void;
  brand: string;
}

export function HomeScreen({ user, onCheckout, brand }: HomeProps) {
  const [tab, setTab] = useState<'stars' | 'premium'>('stars');
  const [username, setUsername] = useState(user.username ?? '');
  const [amount, setAmount] = useState(100);
  const [premiumMonths, setPremiumMonths] = useState<3 | 6 | 12>(3);
  const [bannerIdx, setBannerIdx] = useState(0);

  const banners = [
    {
      id: 'stars',
      title: 'Send sparkles\ninstantly',
      sub: 'Top up any account in seconds',
      gradient:
        'linear-gradient(135deg, rgba(242,198,107,0.35) 0%, rgba(155,123,255,0.4) 100%)',
      icon: 'sparkle',
      iconColor: TOKENS.gold,
    },
    {
      id: 'premium',
      title: `${brand}\nPremium`,
      sub: 'Unlock pro features for friends',
      gradient: 'linear-gradient(135deg, rgba(155,123,255,0.5) 0%, rgba(91,61,204,0.5) 100%)',
      icon: 'sparkle',
      iconColor: TOKENS.violet,
    },
  ];

  useEffect(() => {
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % banners.length), 4500);
    return () => clearInterval(t);
  }, [banners.length]);

  const price =
    tab === 'stars'
      ? (amount * 0.014).toFixed(2)
      : ({ 3: '12.99', 6: '22.99', 12: '39.99' } as const)[premiumMonths];

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
            WELCOME BACK
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
            {user.sparkleBalance.toLocaleString()}
          </span>
        </Glass>
      </div>

      {/* banner */}
      <div>
        <div style={{ position: 'relative', height: 152, borderRadius: 24, overflow: 'hidden' }}>
          {banners.map((b, i) => (
            <div
              key={b.id}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: i === bannerIdx ? 1 : 0,
                transform: `translateX(${(i - bannerIdx) * 8}%) scale(${i === bannerIdx ? 1 : 0.97})`,
                transition: 'opacity 600ms ease, transform 600ms ease',
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
                  {b.title}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.75)',
                    marginTop: 6,
                    fontWeight: 500,
                  }}
                >
                  {b.sub}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12 }}>
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setBannerIdx(i)}
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
            { id: 'stars', label: 'Sparkles' },
            { id: 'premium', label: 'Premium' },
          ] as const
        ).map((o) => (
          <button
            key={o.id}
            onClick={() => setTab(o.id)}
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
          Recipient
        </div>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="@username"
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
        {tab === 'stars' && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginTop: 18,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: TOKENS.textMute,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                Amount
              </div>
              <div style={{ fontSize: 13, color: TOKENS.textDim, fontWeight: 600 }}>
                ≈ ${(amount * 0.014).toFixed(2)}
              </div>
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
          {tab === 'stars' ? 'Quick amount' : 'Duration'}
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
                  <StarIcon size={14} glow={false} />
                  <span>{v}</span>
                </Chip>
              ))
            : monthOptions.map((o) => (
                <Chip
                  key={o.v}
                  active={premiumMonths === o.v}
                  onClick={() => setPremiumMonths(o.v)}
                >
                  <span style={{ fontSize: 18, fontWeight: 800 }}>{o.v}</span>
                  <span style={{ fontSize: 11, opacity: 0.8, fontWeight: 600 }}>months</span>
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
            TOTAL
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: '#fff',
                letterSpacing: -0.4,
              }}
            >
              ${price}
            </span>
            <span style={{ fontSize: 12, color: TOKENS.textDim }}>USD</span>
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
              price: String(price),
            })
          }
          style={{ minWidth: 150, height: 52, fontSize: 15 }}
        >
          Checkout →
        </PrimaryButton>
      </Glass>
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
      onClick={onClick}
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
