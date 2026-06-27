import { useCallback, useEffect, useState } from 'react';
import { TOKENS } from '../lib/tokens';
import { Glass } from '../components/Glass';
import { Icon, StarIcon } from '../components/Icon';
import { api } from '../lib/api';
import { formatUzs } from '../lib/currency';
import { hapticTap } from '../lib/telegram';
import type { AdminStatsResponse, WithdrawalItem } from '../types';

interface AdminScreenProps {
  onToast: (msg: string) => void;
}

export function AdminScreen({ onToast }: AdminScreenProps) {
  const [data, setData] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminStats();
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateWithdrawal = (updated: WithdrawalItem) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            withdrawals: prev.withdrawals.map((w) => (w.id === updated.id ? updated : w)),
          }
        : prev,
    );
  };

  const act = async (w: WithdrawalItem, action: 'complete' | 'cancel') => {
    if (busyId) return;
    hapticTap();
    setBusyId(w.id);
    try {
      const res =
        action === 'complete'
          ? await api.completeWithdrawal(w.id)
          : await api.cancelWithdrawal(w.id);
      updateWithdrawal(res.withdrawal);
      onToast(action === 'complete' ? 'Вывод завершён' : 'Вывод отменён, stars возвращены');
      void load();
    } catch (e) {
      const err = e as Error & { body?: { error?: string } };
      onToast(err.body?.error ?? err.message ?? 'Ошибка');
    } finally {
      setBusyId(null);
    }
  };

  const pending = (data?.withdrawals ?? []).filter((w) => w.status === 'pending');

  return (
    <div style={{ padding: '0 16px 110px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 30, fontWeight: 850, color: TOKENS.text, lineHeight: 1.05 }}>
          Админ-панель
        </div>
        <div style={{ color: TOKENS.textDim, fontSize: 13.5, marginTop: 8, lineHeight: 1.45 }}>
          Статистика бота, заказы и безопасные заявки на вывод.
        </div>
      </div>

      {loading && !data ? (
        <Skeleton />
      ) : error && !data ? (
        <Glass radius={16} padding={16}>
          <div style={{ color: '#FF8B8B', fontWeight: 700 }}>Не удалось загрузить</div>
          <div style={{ color: TOKENS.textMute, fontSize: 12, marginTop: 6 }}>{error}</div>
          <button onClick={() => void load()} style={smallButtonStyle(false)}>Повторить</button>
        </Glass>
      ) : data ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <StatCard label="Пользователи" value={data.stats.users.total} sub={`+${data.stats.users.today} сегодня`} />
            <StatCard label="Заказы" value={data.stats.orders.total} sub={`${data.stats.orders.active} активных`} />
            <StatCard label="Выручка" value={formatUzs(data.stats.revenue.totalUzs)} sub={`${formatUzs(data.stats.revenue.todayUzs)} сегодня`} />
            <StatCard label="Stars продано" value={data.stats.products.starsSold} sub={`${data.stats.products.premiumOrders} Premium`} star />
            <StatCard label="Баланс юзеров" value={data.stats.wallet.userBalanceStars} sub="stars в приложении" star />
            <StatCard label="Выводы" value={data.stats.wallet.pendingWithdrawalStars} sub={`${data.stats.wallet.pendingWithdrawals} ожидает`} star />
          </div>

          <Glass radius={16} padding={14} intense>
            <SectionTitle>Настройки выдачи</SectionTitle>
            <StatusLine label="API заказов" ok={data.delivery.orderApiConfigured} />
            <StatusLine label="API выводов" ok={data.delivery.withdrawalApiConfigured} />
          </Glass>

          <div>
            <SectionTitle>Заявки на вывод</SectionTitle>
            {pending.length === 0 ? (
              <Empty text="Нет ожидающих выводов" />
            ) : (
              <Glass radius={16} padding={0} style={{ overflow: 'hidden' }}>
                {pending.map((w, i) => (
                  <div key={w.id}>
                    <WithdrawalRow
                      item={w}
                      busy={busyId === w.id}
                      onComplete={() => void act(w, 'complete')}
                      onCancel={() => void act(w, 'cancel')}
                    />
                    {i < pending.length - 1 && <Divider />}
                  </div>
                ))}
              </Glass>
            )}
          </div>

          <div>
            <SectionTitle>Последние заказы</SectionTitle>
            <Glass radius={16} padding={0} style={{ overflow: 'hidden' }}>
              {data.recentOrders.map((o, i) => (
                <div key={o.id}>
                  <OrderRow order={o} />
                  {i < data.recentOrders.length - 1 && <Divider />}
                </div>
              ))}
            </Glass>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  star,
}: {
  label: string;
  value: string | number;
  sub: string;
  star?: boolean;
}) {
  return (
    <Glass radius={16} padding={14} intense>
      <div style={{ color: TOKENS.textMute, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <span style={{ color: '#fff', fontSize: 22, fontWeight: 850, lineHeight: 1 }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {star && <StarIcon size={16} />}
      </div>
      <div style={{ color: TOKENS.textDim, fontSize: 12, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {sub}
      </div>
    </Glass>
  );
}

function StatusLine({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
      <span style={{ color: TOKENS.textDim, fontSize: 13, fontWeight: 650 }}>{label}</span>
      <span style={{ color: ok ? '#7BD89B' : TOKENS.gold, fontSize: 12, fontWeight: 800 }}>
        {ok ? 'настроен' : 'ручной режим'}
      </span>
    </div>
  );
}

function WithdrawalRow({
  item,
  busy,
  onComplete,
  onCancel,
}: {
  item: WithdrawalItem;
  busy: boolean;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const name = item.recipientUsername ? `@${item.recipientUsername}` : `id ${item.recipientTelegramId}`;
  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={iconBoxStyle('#F2C66B')}>
          <StarIcon size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: TOKENS.text, fontSize: 14.5, fontWeight: 800 }}>
            Вывод #{item.number}: {item.amount.toLocaleString()} stars
          </div>
          <div style={{ color: TOKENS.textMute, fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name} · {formatDate(item.createdAt)}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button disabled={busy} onClick={onComplete} style={smallButtonStyle(true)}>
          {busy ? '...' : 'Завершить'}
        </button>
        <button disabled={busy} onClick={onCancel} style={smallButtonStyle(false)}>
          Отменить
        </button>
      </div>
    </div>
  );
}

function OrderRow({ order }: { order: AdminStatsResponse['recentOrders'][number] }) {
  const isStars = order.kind === 'stars';
  return (
    <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={iconBoxStyle(isStars ? TOKENS.gold : TOKENS.violet)}>
        {isStars ? <StarIcon size={18} /> : <Icon name="sparkle" size={18} color={TOKENS.violet} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: TOKENS.text, fontSize: 14.5, fontWeight: 800 }}>
          #{order.number} · {isStars ? `${order.amount} stars` : `Premium ${order.amount} мес`}
        </div>
        <div style={{ color: TOKENS.textMute, fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          @{order.recipientUsername} · {order.status}
        </div>
      </div>
      <div style={{ color: TOKENS.text, fontSize: 13, fontWeight: 800 }}>{formatUzs(order.priceUzs)}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div style={{ color: TOKENS.textMute, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 10, padding: '0 4px' }}>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Glass radius={16} padding={16}>
      <div style={{ textAlign: 'center', color: TOKENS.textDim, fontSize: 13 }}>{text}</div>
    </Glass>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 14px' }} />;
}

function Skeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <div key={n} style={{ height: 98, borderRadius: 16, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.6s ease infinite' }} />
      ))}
    </div>
  );
}

function iconBoxStyle(color: string) {
  return {
    width: 38,
    height: 38,
    borderRadius: 11,
    background: `${color}20`,
    border: `1px solid ${color}44`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as const;
}

function smallButtonStyle(primary: boolean) {
  return {
    flex: 1,
    height: 38,
    borderRadius: 11,
    border: primary ? 'none' : '1px solid rgba(255,255,255,0.12)',
    background: primary
      ? 'linear-gradient(135deg, #9B7BFF, #7B5CE6)'
      : 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 800,
    fontFamily: 'inherit',
    cursor: 'pointer',
  } as const;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
