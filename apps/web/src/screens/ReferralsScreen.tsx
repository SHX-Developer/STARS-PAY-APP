import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { TOKENS } from '../lib/tokens';
import { Glass } from '../components/Glass';
import { Icon, StarIcon } from '../components/Icon';
import { api } from '../lib/api';
import { hapticTap } from '../lib/telegram';
import type { ReferralsResponse, ReferralItem } from '../types';

interface ReferralsProps {
  onToast: (msg: string) => void;
}

export function ReferralsScreen({ onToast }: ReferralsProps) {
  const [data, setData] = useState<ReferralsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.referrals();
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div
      style={{
        padding: '0 18px 110px',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
      }}
    >
      {/* Заголовок */}
      <Header bonus={data?.bonusPerReferral ?? 10} />

      {loading && !data ? (
        <SkeletonBlock />
      ) : error && !data ? (
        <Glass radius={18} padding={16}>
          <div style={{ color: '#FF8B8B', fontSize: 14, fontWeight: 600 }}>
            Failed to load referrals
          </div>
          <div style={{ color: TOKENS.textMute, fontSize: 12, marginTop: 6 }}>{error}</div>
          <button onClick={() => void load()} style={retryBtnStyle}>
            Retry
          </button>
        </Glass>
      ) : data ? (
        <>
          <ReferralLinkCard link={data.link} onToast={onToast} />
          <HowItWorksCard bonus={data.bonusPerReferral} />
          <StatsRow count={data.count} thisMonth={data.countThisMonth} earned={data.earnedStars} />
          <InvitedList items={data.items} count={data.count} />
        </>
      ) : null}
    </div>
  );
}

// =====================================================
// Инфо-блок «How it works»
// =====================================================
function HowItWorksCard({ bonus }: { bonus: number }) {
  const steps = [
    { n: '1', text: 'Share your referral link with a friend' },
    { n: '2', text: 'They join StarsPay through your link' },
    { n: '3', text: `On their first order — you get +${bonus} stars` },
  ];
  return (
    <Glass
      radius={18}
      padding={16}
      style={{
        background:
          'linear-gradient(135deg, rgba(242,198,107,0.08), rgba(155,123,255,0.04))',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.2,
          color: TOKENS.textMute,
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        How it works
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map((s) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 7,
                background: 'rgba(155,123,255,0.18)',
                border: `1px solid ${TOKENS.glassBorderStrong}`,
                color: TOKENS.violet,
                fontSize: 11.5,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              {s.n}
            </div>
            <div
              style={{
                fontSize: 13.5,
                color: TOKENS.text,
                fontWeight: 500,
                lineHeight: 1.45,
              }}
            >
              {s.text}
            </div>
          </div>
        ))}
      </div>
    </Glass>
  );
}

// =====================================================
// Header — REFERRALS / Earn from friends / +N stars per first order
// =====================================================
function Header({ bonus }: { bonus: number }) {
  return (
    <div style={{ marginTop: 4 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.6,
          color: TOKENS.textMute,
          textTransform: 'uppercase',
        }}
      >
        Referrals
      </div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 800,
          color: TOKENS.text,
          letterSpacing: -0.8,
          lineHeight: 1.05,
          marginTop: 4,
        }}
      >
        Earn from friends
      </div>
      <div
        style={{
          fontSize: 14.5,
          color: TOKENS.textDim,
          lineHeight: 1.45,
          marginTop: 10,
        }}
      >
        Get{' '}
        <span style={{ color: TOKENS.gold, fontWeight: 700 }}>+{bonus} stars</span>{' '}
        for every referral's first order. Credited automatically.
      </div>
    </div>
  );
}

// =====================================================
// Карточка реферальной ссылки + Copy / QR / Share
// =====================================================
function ReferralLinkCard({
  link,
  onToast,
}: {
  link: string;
  onToast: (msg: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    hapticTap();
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = link;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* noop */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    onToast('Link copied');
    setTimeout(() => setCopied(false), 1600);
  };

  const handleShare = () => {
    hapticTap();
    const text = `Join me on StarsPay`;
    const tg = window.Telegram?.WebApp;
    // Telegram нативный share — открывает выбор чата
    if (tg?.openTelegramLink) {
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
      try {
        tg.openTelegramLink(shareUrl);
        return;
      } catch {
        /* noop */
      }
    }
    if (navigator.share) {
      void navigator.share({ url: link, text });
      return;
    }
    void handleCopy();
  };

  const handleQr = () => {
    hapticTap();
    onToast('QR code coming soon');
  };

  return (
    <Glass
      radius={22}
      padding={18}
      intense
      style={{
        background:
          'linear-gradient(135deg, rgba(155,123,255,0.18), rgba(123,92,230,0.06))',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* фоновый блик */}
      <div
        style={{
          position: 'absolute',
          top: -50,
          right: -40,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(155,123,255,0.28), transparent 65%)',
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.2,
            color: TOKENS.textMute,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Your referral link
        </div>

        {/* link input + copy button */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              height: 50,
              borderRadius: 13,
              padding: '0 14px',
              background: 'rgba(0,0,0,0.25)',
              border: `1px solid ${TOKENS.glassBorder}`,
              boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
          >
            <input
              value={link}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              style={{
                flex: 1,
                minWidth: 0,
                height: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: TOKENS.text,
                fontSize: 15,
                fontFamily:
                  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                fontWeight: 600,
                letterSpacing: -0.2,
                textOverflow: 'ellipsis',
              }}
            />
          </div>
          <button
            onClick={() => void handleCopy()}
            aria-label="Copy referral link"
            style={{
              width: 50,
              height: 50,
              flexShrink: 0,
              borderRadius: 13,
              border: 'none',
              cursor: 'pointer',
              background: copied
                ? 'linear-gradient(135deg, rgba(75,200,150,0.9), rgba(40,120,90,0.95))'
                : 'linear-gradient(135deg, #9B7BFF 0%, #7B5CE6 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 220ms ease, transform 160ms ease',
              boxShadow: copied
                ? '0 6px 18px rgba(75,200,150,0.35), inset 0 1px 0 rgba(255,255,255,0.3)'
                : '0 6px 18px rgba(123,92,230,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}
          >
            <Icon name={copied ? 'check' : 'copy'} size={20} color="#fff" strokeWidth={2} />
          </button>
        </div>

        {/* QR / Share */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          <SubAction icon="qr" label="QR code" onClick={handleQr} />
          <SubAction icon="share" label="Share" onClick={handleShare} />
        </div>
      </div>
    </Glass>
  );
}

function SubAction({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 46,
        borderRadius: 13,
        border: `1px solid ${TOKENS.glassBorder}`,
        background: 'rgba(0,0,0,0.22)',
        color: TOKENS.text,
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontFamily: 'inherit',
        transition: 'background 200ms ease',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <Icon name={icon} size={16} color={TOKENS.text} strokeWidth={1.8} />
      {label}
    </button>
  );
}

// =====================================================
// Двухколоночная статистика — TOTAL INVITED + EARNED
// =====================================================
function StatsRow({
  count,
  thisMonth,
  earned,
}: {
  count: number;
  thisMonth: number;
  earned: number;
}) {
  const earnedUsd = (earned * 0.014).toFixed(2);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {/* Total invited */}
      <Glass radius={18} padding={16}>
        <StatLabel>Total invited</StatLabel>
        <div
          style={{
            fontSize: 36,
            fontWeight: 800,
            color: TOKENS.text,
            letterSpacing: -1,
            lineHeight: 1,
            marginTop: 8,
          }}
        >
          {count.toLocaleString()}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 10,
            color: thisMonth > 0 ? '#7BD89B' : TOKENS.textMute,
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          <Icon
            name="arrow-up"
            size={12}
            color={thisMonth > 0 ? '#7BD89B' : TOKENS.textMute}
            strokeWidth={2.4}
          />
          <span>{thisMonth} this month</span>
        </div>
      </Glass>

      {/* Earned */}
      <Glass
        radius={18}
        padding={16}
        intense
        style={{
          background:
            'linear-gradient(135deg, rgba(242,198,107,0.16), rgba(123,92,230,0.08))',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -30,
            right: -30,
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(242,198,107,0.25), transparent 65%)',
            filter: 'blur(14px)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative' }}>
          <StatLabel>Earned</StatLabel>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 6,
              marginTop: 8,
            }}
          >
            <StarIcon size={22} />
            <span
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: TOKENS.gold,
                letterSpacing: -0.8,
                lineHeight: 1,
              }}
            >
              {earned.toLocaleString()}
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: TOKENS.textDim,
              fontWeight: 500,
              marginTop: 10,
            }}
          >
            ≈ ${earnedUsd} USD
          </div>
        </div>
      </Glass>
    </div>
  );
}

function StatLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 1.2,
        color: TOKENS.textMute,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}

// =====================================================
// Список приглашённых — YOUR INVITES / N friends / cards
// =====================================================
function InvitedList({ items, count }: { items: ReferralItem[]; count: number }) {
  return (
    <div>
      <div style={{ padding: '0 4px', marginBottom: 12 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.4,
            color: TOKENS.textMute,
            textTransform: 'uppercase',
          }}
        >
          Your invites
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: TOKENS.text,
            letterSpacing: -0.4,
            marginTop: 4,
          }}
        >
          {count} {count === 1 ? 'friend' : 'friends'}
        </div>
      </div>

      {items.length === 0 ? (
        <Glass radius={16} padding="20px 16px">
          <div
            style={{
              fontSize: 13.5,
              color: TOKENS.textDim,
              textAlign: 'center',
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            No friends yet. Share your link above — invitees will show up here.
          </div>
        </Glass>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((it, idx) => (
            <ReferralCard key={it.id} item={it} idx={idx} />
          ))}
        </div>
      )}
    </div>
  );
}

// Палитра для аватарок-инициалов (когда нет photo)
const AVATAR_PALETTE = [
  ['#3CC8B6', '#0F8C7E'], // teal
  ['#5B9DEE', '#2E6BC8'], // blue
  ['#3CC8B6', '#0F8C7E'], // teal repeat
  ['#9B7BFF', '#5B3DCC'], // violet
  ['#F2C66B', '#B47A1A'], // gold
  ['#FF7BAA', '#B43C78'], // rose
];

function ReferralCard({ item, idx }: { item: ReferralItem; idx: number }) {
  const fullName = [item.firstName, item.lastName].filter(Boolean).join(' ');
  const handle = item.username ? `@${item.username}` : fullName || `id ${item.id.slice(0, 6)}`;
  const initial = (item.firstName || item.username || '?').charAt(0).toUpperCase();
  const palette = AVATAR_PALETTE[idx % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[0]!;

  return (
    <Glass
      radius={16}
      padding="12px 14px"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {item.avatarUrl ? (
        <img
          src={item.avatarUrl}
          alt={handle}
          style={{
            width: 40,
            height: 40,
            borderRadius: 40,
            objectFit: 'cover',
            border: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 40,
            background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            flexShrink: 0,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
          }}
        >
          {initial}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: TOKENS.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {handle}
        </div>
        <div
          style={{
            fontSize: 12,
            color: TOKENS.textMute,
            fontWeight: 500,
            marginTop: 2,
          }}
        >
          joined {timeAgo(item.joinedAt)}
        </div>
      </div>

      {/* orders pill — золотая если бонус уже зачислен, фиолетовая иначе */}
      <div
        style={{
          flexShrink: 0,
          padding: '6px 12px',
          borderRadius: 999,
          background: item.bonusGiven
            ? 'rgba(242,198,107,0.18)'
            : 'rgba(155,123,255,0.18)',
          border: item.bonusGiven
            ? '1px solid rgba(242,198,107,0.4)'
            : '1px solid rgba(155,123,255,0.32)',
          color: item.bonusGiven ? TOKENS.gold : '#fff',
          fontSize: 12.5,
          fontWeight: 700,
          letterSpacing: 0.1,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
        title={item.bonusGiven ? 'Bonus credited' : 'No paid order yet'}
      >
        {item.bonusGiven && <StarIcon size={11} glow={false} />}
        {item.ordersCount} {item.ordersCount === 1 ? 'order' : 'orders'}
      </div>
    </Glass>
  );
}

// =====================================================
// Helpers
// =====================================================
function timeAgo(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 'recently';
  const diffSec = Math.max(0, (Date.now() - ts) / 1000);
  if (diffSec < 60) return 'just now';
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(d / 365);
  return `${y}y ago`;
}

function SkeletonBlock() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Skel h={130} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Skel h={100} />
        <Skel h={100} />
      </div>
      <Skel h={64} />
      <Skel h={64} />
    </div>
  );
}

function Skel({ h }: { h: number }) {
  return (
    <div
      style={{
        height: h,
        borderRadius: 14,
        background:
          'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
        backgroundSize: '200% 100%',
        animation: 'pulse 1.6s ease infinite',
      }}
    />
  );
}

const retryBtnStyle = {
  marginTop: 12,
  height: 36,
  padding: '0 16px',
  borderRadius: 10,
  border: '1px solid rgba(155,123,255,0.4)',
  background: 'rgba(155,123,255,0.18)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const;
