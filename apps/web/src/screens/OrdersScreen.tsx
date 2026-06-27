import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { TOKENS } from '../lib/tokens';
import { Glass } from '../components/Glass';
import { Icon, StarIcon } from '../components/Icon';
import { api } from '../lib/api';
import { useT, useLang } from '../lib/i18n-context';
import { hapticTap } from '../lib/telegram';
import { formatUzs } from '../lib/currency';
import type { OrderItem, OrderStatus } from '../types';

export function OrdersScreen() {
  const [orders, setOrders] = useState<OrderItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.orders();
      setOrders(res.items);
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
        gap: 18,
      }}
    >
      <Header />

      {loading && !orders ? (
        <SkeletonBlock />
      ) : error && !orders ? (
        <Glass radius={18} padding={16}>
          <div style={{ color: '#FF8B8B', fontSize: 14, fontWeight: 600 }}>
            Failed to load orders
          </div>
          <div style={{ color: TOKENS.textMute, fontSize: 12, marginTop: 6 }}>{error}</div>
          <button onClick={() => void load()} style={retryBtnStyle}>
            Retry
          </button>
        </Glass>
      ) : orders && orders.length === 0 ? (
        <EmptyState />
      ) : orders ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {orders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              expanded={expandedId === o.id}
              onToggle={() => setExpandedId((prev) => (prev === o.id ? null : o.id))}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// =====================================================
// Header
// =====================================================
function Header() {
  const tr = useT();
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
        {tr('orders_title')}
      </div>
    </div>
  );
}

// =====================================================
// Карточка заказа (collapsible)
// =====================================================
function OrderCard({
  order,
  expanded,
  onToggle,
}: {
  order: OrderItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const tr = useT();
  const { lang } = useLang();
  const isStars = order.kind === 'stars';
  const title = isStars ? `${order.amount} ${tr('common_stars')}` : `Premium · ${order.amount}${tr('home_months')}`;
  const recipient = `@${order.recipientUsername}`;

  // Анимация раскрытия через max-height. Замеряем нативную высоту и используем
  // её как target — чище любого фиксированного значения.
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [innerHeight, setInnerHeight] = useState(0);
  useEffect(() => {
    if (innerRef.current) {
      setInnerHeight(innerRef.current.scrollHeight);
    }
  }, [expanded, order]);

  return (
    <Glass radius={18} padding={0} style={{ overflow: 'hidden' }}>
      {/* верхняя строка — кликабельная для toggle */}
      <button
        onClick={() => {
          hapticTap();
          onToggle();
        }}
        style={{
          width: '100%',
          padding: '14px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: 'inherit',
          color: 'inherit',
          textAlign: 'left',
        }}
      >
        <KindIcon kind={order.kind} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: TOKENS.text,
              letterSpacing: -0.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: TOKENS.textMute,
              fontWeight: 500,
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {recipient} · {formatOrderDate(order.createdAt, tr, lang)}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: TOKENS.text,
              letterSpacing: -0.2,
              whiteSpace: 'nowrap',
            }}
          >
            {formatUzs(Number(order.priceUsd))}{' '}
            <span style={{ fontSize: 10, color: TOKENS.textDim, fontWeight: 700 }}>UZS</span>
          </div>
          <StatusPill status={order.status} />
        </div>

        <div
          style={{
            marginLeft: 4,
            transform: expanded ? 'rotate(-90deg)' : 'rotate(90deg)',
            transition: 'transform 220ms ease',
            color: TOKENS.textMute,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Icon name="chevron-right" size={16} color={TOKENS.textMute} strokeWidth={2} />
        </div>
      </button>

      {/* раскрываемая часть со smooth animation */}
      <div
        style={{
          maxHeight: expanded ? innerHeight : 0,
          opacity: expanded ? 1 : 0,
          overflow: 'hidden',
          transition:
            'max-height 360ms cubic-bezier(0.4,0,0.2,1), opacity 280ms ease',
          willChange: 'max-height, opacity',
        }}
      >
        <div ref={innerRef} style={{ padding: '4px 14px 16px' }}>
          <div
            style={{
              height: 1,
              background: 'rgba(255,255,255,0.06)',
              margin: '4px 0 14px',
            }}
          />
          <Timeline order={order} />
          <DetailsBox order={order} />
        </div>
      </div>
    </Glass>
  );
}

// =====================================================
// KindIcon — большая плитка слева (звезда / гем)
// =====================================================
function KindIcon({ kind }: { kind: string }) {
  const isStars = kind === 'stars';
  return (
    <div
      style={{
        width: 46,
        height: 46,
        borderRadius: 13,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isStars
          ? 'linear-gradient(135deg, rgba(242,198,107,0.25), rgba(242,198,107,0.08))'
          : 'linear-gradient(135deg, rgba(155,123,255,0.25), rgba(155,123,255,0.08))',
        border: `1px solid ${isStars ? 'rgba(242,198,107,0.32)' : 'rgba(155,123,255,0.32)'}`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }} role="img" aria-label={isStars ? 'stars' : 'premium'}>
        {isStars ? '⭐️' : '💎'}
      </span>
    </div>
  );
}

// =====================================================
// Статус-пилюля
// =====================================================
function StatusPill({ status }: { status: OrderStatus }) {
  const tr = useT();
  const cfg = STATUS_STYLE[status] ?? STATUS_STYLE.created;
  const labelKey = STATUS_LABEL_KEY[status] ?? STATUS_LABEL_KEY.created;
  return (
    <div
      style={{
        padding: '3px 10px',
        borderRadius: 999,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {tr(labelKey)}
    </div>
  );
}

const STATUS_STYLE: Record<
  OrderStatus,
  { bg: string; border: string; color: string }
> = {
  created: {
    bg: 'rgba(91,157,238,0.15)',
    border: 'rgba(91,157,238,0.35)',
    color: '#8DBBF1',
  },
  paid: {
    bg: 'rgba(75,200,150,0.15)',
    border: 'rgba(75,200,150,0.4)',
    color: '#7BD89B',
  },
  delivering: {
    bg: 'rgba(242,198,107,0.14)',
    border: 'rgba(242,198,107,0.4)',
    color: TOKENS.gold,
  },
  delivered: {
    bg: 'rgba(155,123,255,0.18)',
    border: 'rgba(155,123,255,0.42)',
    color: '#C9B4FF',
  },
  failed: {
    bg: 'rgba(255,123,123,0.16)',
    border: 'rgba(255,123,123,0.4)',
    color: '#FF8B8B',
  },
  cancelled: {
    bg: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.15)',
    color: TOKENS.textDim,
  },
};

const STATUS_LABEL_KEY: Record<
  OrderStatus,
  | 'orders_status_created'
  | 'orders_status_paid'
  | 'orders_status_delivering'
  | 'orders_status_delivered'
  | 'orders_status_failed'
  | 'orders_status_cancelled'
> = {
  created: 'orders_status_created',
  paid: 'orders_status_paid',
  delivering: 'orders_status_delivering',
  delivered: 'orders_status_delivered',
  failed: 'orders_status_failed',
  cancelled: 'orders_status_cancelled',
};

// =====================================================
// Timeline (Created → Paid → Delivering → Delivered)
// =====================================================
function Timeline({ order }: { order: OrderItem }) {
  const tr = useT();
  const { lang } = useLang();
  const stages: { key: string; title: string; at: string | null }[] = [
    { key: 'created', title: tr('orders_step_created'), at: order.createdAt },
    { key: 'paid', title: tr('orders_step_paid'), at: order.paidAt },
    { key: 'delivering', title: tr('orders_step_delivering'), at: order.deliveringAt },
    { key: 'delivered', title: tr('orders_step_delivered'), at: order.deliveredAt },
  ];
  // Текущий шаг = последний с timestamp.
  let lastFilled = -1;
  for (let i = stages.length - 1; i >= 0; i--) {
    if (stages[i]!.at) {
      lastFilled = i;
      break;
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {stages.map((s, i) => {
        let state: 'done' | 'current' | 'pending';
        if (i < lastFilled) state = 'done';
        else if (i === lastFilled) state = 'current';
        else state = 'pending';
        return (
          <TimelineRow
            key={s.key}
            title={s.title}
            time={
              s.at
                ? i === 0
                  ? formatOrderDate(s.at, tr, lang)
                  : formatRelativeFromCreated(s.at, order.createdAt, tr, lang)
                : '—'
            }
            state={state}
            isLast={i === stages.length - 1}
          />
        );
      })}
    </div>
  );
}

function TimelineRow({
  title,
  time,
  state,
  isLast,
}: {
  title: string;
  time: string;
  state: 'done' | 'current' | 'pending';
  isLast: boolean;
}) {
  const dim = state === 'pending';
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: 24,
          flexShrink: 0,
        }}
      >
        <TimelineDot state={state} />
        {!isLast && (
          <div
            style={{
              flex: 1,
              width: 2,
              minHeight: 14,
              background:
                state === 'pending'
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(155,123,255,0.45)',
              borderRadius: 1,
              marginTop: 2,
              marginBottom: 2,
            }}
          />
        )}
      </div>
      <div style={{ paddingBottom: isLast ? 0 : 12, flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: dim ? TOKENS.textDim : TOKENS.text,
            letterSpacing: -0.1,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: TOKENS.textMute,
            fontWeight: 500,
            marginTop: 2,
          }}
        >
          {time}
        </div>
      </div>
    </div>
  );
}

function TimelineDot({ state }: { state: 'done' | 'current' | 'pending' }) {
  if (state === 'done') {
    return (
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #9B7BFF, #7B5CE6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 10px rgba(123,92,230,0.35)',
        }}
      >
        <Icon name="check" size={12} color="#fff" strokeWidth={2.6} />
      </div>
    );
  }
  if (state === 'current') {
    return (
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #9B7BFF, #7B5CE6)',
          flexShrink: 0,
          boxShadow:
            '0 0 0 4px rgba(155,123,255,0.18), 0 4px 14px rgba(123,92,230,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#fff',
          }}
        />
      </div>
    );
  }
  return (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        border: '1.5px solid rgba(255,255,255,0.16)',
        background: 'rgba(255,255,255,0.02)',
        flexShrink: 0,
      }}
    />
  );
}

// =====================================================
// Details box — RECIPIENT / ORDER ID / AMOUNT / TOTAL
// =====================================================
function DetailsBox({ order }: { order: OrderItem }) {
  const tr = useT();
  const isStars = order.kind === 'stars';
  return (
    <div
      style={{
        marginTop: 14,
        padding: 16,
        borderRadius: 14,
        background: 'rgba(0,0,0,0.22)',
        border: `1px solid ${TOKENS.glassBorder}`,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px 12px',
      }}
    >
      <DetailField label={tr('orders_recipient')} value={`@${order.recipientUsername}`} mono />
      <DetailField label={tr('orders_id')} value={`#${order.number}`} mono />
      <DetailField
        label={tr('orders_amount')}
        valueNode={
          isStars ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: TOKENS.text }}>
                {order.amount}
              </span>
              <StarIcon size={14} />
            </div>
          ) : (
            <span style={{ fontSize: 16, fontWeight: 800, color: TOKENS.text }}>
              {order.amount} {tr('orders_months')}
            </span>
          )
        }
      />
      <DetailField
        label={tr('orders_total')}
        value={`${formatUzs(Number(order.priceUsd))} UZS`}
      />
    </div>
  );
}

function DetailField({
  label,
  value,
  valueNode,
  mono,
}: {
  label: string;
  value?: string;
  valueNode?: ReactNode;
  mono?: boolean;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.2,
          color: TOKENS.textMute,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {valueNode ?? (
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: TOKENS.text,
            letterSpacing: -0.1,
            fontFamily: mono
              ? 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace'
              : 'inherit',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </div>
      )}
    </div>
  );
}

// =====================================================
// Empty state
// =====================================================
function EmptyState() {
  const tr = useT();
  return (
    <Glass radius={18} padding="32px 16px" style={{ textAlign: 'center' }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          background: 'rgba(155,123,255,0.16)',
          border: `1px solid ${TOKENS.glassBorderStrong}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px',
        }}
      >
        <Icon name="orders" size={28} color={TOKENS.violet} strokeWidth={1.6} />
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: TOKENS.text,
          marginBottom: 6,
        }}
      >
        {tr('orders_empty_title')}
      </div>
      <div style={{ fontSize: 13, color: TOKENS.textDim, fontWeight: 500, lineHeight: 1.5 }}>
        {tr('orders_empty_sub')}
      </div>
    </Glass>
  );
}

// =====================================================
// Date helpers
// =====================================================
// helpers получают tr() из caller — формируем локализованные «Сегодня/Yesterday»
function formatOrderDate(iso: string, tr: (k: 'date_today' | 'date_yesterday') => string, lang: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d >= today) return `${tr('date_today')}, ${time}`;
  if (d >= yesterday) return `${tr('date_yesterday')}, ${time}`;
  const month = d.toLocaleString(lang, { month: 'short' });
  return `${month} ${d.getDate()}, ${time}`;
}

// Для шагов после Created — показываем реальное локальное время
// (например "Today, 14:23"), а не относительный offset. Так понятнее.
function formatRelativeFromCreated(
  iso: string,
  _createdIso: string,
  tr: (k: 'date_today' | 'date_yesterday') => string,
  lang: string,
): string {
  return formatOrderDate(iso, tr, lang);
}


function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// =====================================================
// Skeleton + retry
// =====================================================
function SkeletonBlock() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skel h={84} />
      <Skel h={68} />
      <Skel h={68} />
      <Skel h={68} />
    </div>
  );
}

function Skel({ h }: { h: number }) {
  return (
    <div
      style={{
        height: h,
        borderRadius: 16,
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
