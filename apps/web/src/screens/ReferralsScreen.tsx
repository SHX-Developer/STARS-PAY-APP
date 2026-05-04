import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { TOKENS } from '../lib/tokens';
import { Glass } from '../components/Glass';
import { Icon } from '../components/Icon';
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
        padding: '8px 16px 110px',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
      }}
    >
      {/* Заголовок */}
      <div style={{ paddingTop: 8 }}>
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: TOKENS.text,
            letterSpacing: -0.5,
            lineHeight: 1.15,
          }}
        >
          О системе
        </div>
        <div
          style={{
            fontSize: 14,
            color: TOKENS.textDim,
            marginTop: 6,
            lineHeight: 1.5,
          }}
        >
          Делитесь ссылкой с друзьями. Когда они открывают приложение по вашей
          ссылке и совершают заказы — вы получаете бонусные sparkles.
        </div>
      </div>

      {loading && !data ? (
        <SkeletonBlock />
      ) : error && !data ? (
        <Glass radius={18} padding={16}>
          <div style={{ color: '#FF8B8B', fontSize: 14, fontWeight: 600 }}>
            Не удалось загрузить рефералов
          </div>
          <div style={{ color: TOKENS.textMute, fontSize: 12, marginTop: 6 }}>{error}</div>
          <button onClick={() => void load()} style={retryBtnStyle}>
            Повторить
          </button>
        </Glass>
      ) : data ? (
        <>
          {/* Блок 1: Реферальная ссылка */}
          <ReferralLinkBlock link={data.link} onToast={onToast} />

          {/* Блок 2: Статистика */}
          <StatsBlock count={data.count} />

          {/* Блок 3: Список приглашённых */}
          <InvitedList items={data.items} />
        </>
      ) : null}
    </div>
  );
}

// =====================================================
// Блок 1 — реферальная ссылка
// =====================================================
function ReferralLinkBlock({
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
      // Telegram WebView и современные браузеры поддерживают navigator.clipboard
      await navigator.clipboard.writeText(link);
    } catch {
      // Фолбек через скрытый textarea
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
    onToast('Ссылка скопирована');
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div>
      <SectionLabel>Ваша ссылка</SectionLabel>
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'stretch',
        }}
      >
        {/* readonly glass input */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            height: 52,
            borderRadius: 14,
            padding: '0 16px',
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${TOKENS.glassBorder}`,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
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
              fontSize: 14,
              fontFamily:
                'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
              fontWeight: 500,
              letterSpacing: -0.1,
              textOverflow: 'ellipsis',
            }}
          />
        </div>

        {/* кнопка копирования */}
        <button
          onClick={() => void handleCopy()}
          aria-label="Скопировать ссылку"
          style={{
            width: 52,
            height: 52,
            flexShrink: 0,
            borderRadius: 14,
            border: 'none',
            cursor: 'pointer',
            background: copied
              ? 'linear-gradient(135deg, rgba(75,200,150,0.85), rgba(40,120,90,0.95))'
              : 'linear-gradient(135deg, #9B7BFF 0%, #7B5CE6 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 220ms ease, transform 160ms ease',
            boxShadow: copied
              ? '0 6px 18px rgba(75,200,150,0.35), inset 0 1px 0 rgba(255,255,255,0.3)'
              : '0 6px 18px rgba(123,92,230,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
          }}
        >
          <Icon name={copied ? 'check' : 'copy'} size={20} color="#fff" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// =====================================================
// Блок 2 — статистика (крупное число)
// =====================================================
function StatsBlock({ count }: { count: number }) {
  return (
    <Glass
      radius={22}
      padding={22}
      intense
      style={{
        background: 'linear-gradient(135deg, rgba(155,123,255,0.18), rgba(123,92,230,0.06))',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* мягкий блик */}
      <div
        style={{
          position: 'absolute',
          top: -40,
          right: -30,
          width: 160,
          height: 160,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(155,123,255,0.35), transparent 65%)',
          filter: 'blur(14px)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'rgba(155,123,255,0.18)',
            border: `1px solid ${TOKENS.glassBorderStrong}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="referrals" size={26} color={TOKENS.violet} strokeWidth={1.6} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
              color: '#fff',
              letterSpacing: -1.5,
              lineHeight: 1,
            }}
          >
            {count.toLocaleString()}
          </div>
          <div
            style={{
              fontSize: 12,
              color: TOKENS.textMute,
              fontWeight: 600,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              marginTop: 6,
            }}
          >
            Всего приглашено
          </div>
        </div>
      </div>
    </Glass>
  );
}

// =====================================================
// Блок 3 — список приглашённых
// =====================================================
function InvitedList({ items }: { items: ReferralItem[] }) {
  return (
    <div>
      <SectionLabel>Приглашённые</SectionLabel>
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
            Пока никого. Поделитесь ссылкой выше — приглашённые появятся здесь.
          </div>
        </Glass>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it) => (
            <ReferralCard key={it.id} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReferralCard({ item }: { item: ReferralItem }) {
  const fullName = [item.firstName, item.lastName].filter(Boolean).join(' ');
  const handle = item.username ? `@${item.username}` : fullName || `id ${item.id.slice(0, 6)}`;
  const initial = (item.firstName || item.username || '?').charAt(0).toUpperCase();

  return (
    <Glass
      radius={14}
      padding="10px 14px"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {/* avatar */}
      {item.avatarUrl ? (
        <img
          src={item.avatarUrl}
          alt={handle}
          style={{
            width: 36,
            height: 36,
            borderRadius: 36,
            objectFit: 'cover',
            border: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 36,
            background: 'linear-gradient(135deg, #9B7BFF, #5B3DCC)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
      )}

      {/* handle */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 14,
          fontWeight: 600,
          color: TOKENS.text,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {handle}
      </div>

      {/* orders count */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 4,
          flexShrink: 0,
          padding: '4px 10px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${TOKENS.glassBorder}`,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: TOKENS.text }}>
          {item.ordersCount}
        </span>
        <span style={{ fontSize: 11, color: TOKENS.textMute, fontWeight: 500 }}>
          {item.ordersCount === 1 ? 'заказ' : pluralOrders(item.ordersCount)}
        </span>
      </div>
    </Glass>
  );
}

// =====================================================
// Helpers
// =====================================================
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: TOKENS.textMute,
        fontWeight: 600,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginBottom: 10,
        padding: '0 4px',
      }}
    >
      {children}
    </div>
  );
}

function SkeletonBlock() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Skel h={52} />
      <Skel h={92} />
      <Skel h={56} />
      <Skel h={56} />
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

// Простая русская плюрализация для "заказ"
function pluralOrders(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'заказ';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'заказа';
  return 'заказов';
}
