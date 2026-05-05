import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { TOKENS } from '../lib/tokens';
import { Glass } from '../components/Glass';
import { Icon, StarIcon } from '../components/Icon';
import { api } from '../lib/api';
import { hapticTap } from '../lib/telegram';
import { useT } from '../lib/i18n-context';
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
          <StatsRow count={data.count} earned={data.earnedStars} />
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
  const tr = useT();
  const steps = [
    { n: '1', text: tr('referrals_step_1') },
    { n: '2', text: tr('referrals_step_2') },
    { n: '3', text: tr('referrals_step_3', { bonus }) },
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
        {tr('referrals_how_it_works')}
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
  const tr = useT();
  // переведённый шаблон с {bonus} — выделяем "+N stars" жирным золотым через split
  const sub = tr('referrals_subtitle_html', { bonus });
  const accent = `+${bonus} stars`;
  const idx = sub.indexOf(accent);
  return (
    <div style={{ marginTop: 4 }}>
      <div
        style={{
          fontSize: 32,
          fontWeight: 800,
          color: TOKENS.text,
          letterSpacing: -0.8,
          lineHeight: 1.05,
        }}
      >
        {tr('referrals_title')}
      </div>
      <div
        style={{
          fontSize: 14.5,
          color: TOKENS.textDim,
          lineHeight: 1.45,
          marginTop: 10,
        }}
      >
        {idx >= 0 ? (
          <>
            {sub.slice(0, idx)}
            <span style={{ color: TOKENS.gold, fontWeight: 700 }}>{accent}</span>
            {sub.slice(idx + accent.length)}
          </>
        ) : (
          sub
        )}
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
  const tr = useT();
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
    onToast(tr('common_link_copied'));
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
          {tr('referrals_your_link')}
        </div>

        {/* link input — full width */}
        <div
          style={{
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

        {/* Copy (violet) + Share (gold) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          <SubAction
            icon={copied ? 'check' : 'copy'}
            label={copied ? tr('common_copied') : tr('referrals_copy')}
            onClick={() => void handleCopy()}
            tone="violet"
            highlight={copied}
          />
          <SubAction
            icon="share"
            label={tr('referrals_share')}
            onClick={handleShare}
            tone="gold"
          />
        </div>
      </div>
    </Glass>
  );
}

type SubActionTone = 'violet' | 'gold' | 'success';

function SubAction({
  icon,
  label,
  onClick,
  tone = 'violet',
  highlight = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  tone?: SubActionTone;
  highlight?: boolean;
}) {
  // highlight = state "copied" → перекрывает tone и красит зелёным
  const palette =
    highlight || tone === 'success'
      ? {
          background:
            'linear-gradient(135deg, rgba(75,200,150,0.95), rgba(40,120,90,1))',
          border: 'rgba(75,200,150,0.55)',
          color: '#fff',
          shadow: '0 6px 18px rgba(75,200,150,0.35), inset 0 1px 0 rgba(255,255,255,0.25)',
        }
      : tone === 'gold'
        ? {
            background: 'linear-gradient(135deg, #F2C66B 0%, #E8B252 100%)',
            border: 'rgba(242,198,107,0.55)',
            color: '#3A2A0A',
            shadow:
              '0 6px 18px rgba(242,198,107,0.4), inset 0 1px 0 rgba(255,255,255,0.4)',
          }
        : {
            background: 'linear-gradient(135deg, #9B7BFF 0%, #7B5CE6 100%)',
            border: 'rgba(155,123,255,0.55)',
            color: '#fff',
            shadow:
              '0 6px 18px rgba(123,92,230,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
          };

  return (
    <button
      onClick={() => {
        hapticTap();
        onClick();
      }}
      style={{
        width: '100%',
        height: 46,
        borderRadius: 13,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.color,
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontFamily: 'inherit',
        transition: 'background 220ms ease, color 220ms ease, border-color 220ms ease',
        boxShadow: palette.shadow,
      }}
    >
      <Icon
        name={icon}
        size={16}
        color={palette.color}
        strokeWidth={1.8}
      />
      {label}
    </button>
  );
}

// =====================================================
// Двухколоночная статистика — TOTAL INVITED + EARNED
// =====================================================
function StatsRow({
  count,
  earned,
}: {
  count: number;
  earned: number;
}) {
  const tr = useT();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {/* Total invited — только число, без +N this month */}
      <Glass radius={18} padding={16}>
        <StatLabel>{tr('referrals_total_invited')}</StatLabel>
        <div
          style={{
            fontSize: 40,
            fontWeight: 800,
            color: TOKENS.text,
            letterSpacing: -1,
            lineHeight: 1,
            marginTop: 12,
          }}
        >
          {count.toLocaleString()}
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
          <StatLabel>{tr('referrals_earned')}</StatLabel>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              marginTop: 12,
            }}
          >
            <span
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: TOKENS.text,
                letterSpacing: -1,
                lineHeight: 1,
              }}
            >
              {earned.toLocaleString()}
            </span>
            <StarIcon size={22} />
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
  const tr = useT();
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
          {tr('referrals_invites')}
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
          {tr(count === 1 ? 'referrals_friends_one' : 'referrals_friends_many', { n: count })}
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
            {tr('referrals_empty')}
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
