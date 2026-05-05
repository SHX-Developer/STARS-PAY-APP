import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { TOKENS } from '../lib/tokens';
import { Glass } from '../components/Glass';
import { Icon, StarIcon } from '../components/Icon';
import { BottomSheet } from '../components/BottomSheet';
import { api } from '../lib/api';
import { hapticTap, openExternal } from '../lib/telegram';
import { useLang } from '../lib/i18n-context';
import { LANGS, type Lang } from '../lib/i18n';
import type { AppUser, TransactionItem } from '../types';

const MIN_WITHDRAWAL = 50;

// Реальные ссылки (соответствуют тому, что в DEFAULT_TASKS).
const LINKS = {
  channel: 'https://t.me/StarsPayChannel',
  instagram: 'https://www.instagram.com/starspayofficial/',
  website: 'https://starspay.uz',
  support: 'https://t.me/SHXDev',
} as const;

interface ProfileProps {
  user: AppUser;
  onBalanceUpdate?: (balance: number) => void;
  onToast: (msg: string) => void;
}

export function ProfileScreen({ user, onBalanceUpdate, onToast }: ProfileProps) {
  const { lang, setLang, t } = useLang();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [transactions, setTransactions] = useState<TransactionItem[] | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [balance, setBalance] = useState(user.starBalance);

  // синхронизируем баланс с пропсом, если родитель его обновил
  useEffect(() => setBalance(user.starBalance), [user.starBalance]);

  // первичная подгрузка истории
  const loadTx = useCallback(async () => {
    setTxLoading(true);
    try {
      const res = await api.transactions();
      setTransactions(res.items);
    } catch {
      /* noop */
    } finally {
      setTxLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTx();
  }, [loadTx]);

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  const since = new Date(user.createdAt).toLocaleString(lang, {
    month: 'short',
    year: 'numeric',
  });

  const handleWithdrawSuccess = (newBalance: number, txn: TransactionItem) => {
    setBalance(newBalance);
    onBalanceUpdate?.(newBalance);
    setTransactions((prev) => (prev ? [txn, ...prev] : [txn]));
    onToast(t('withdraw_success'));
  };

  return (
    <div style={{ padding: '8px 16px 110px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* User header (без Bronze tier) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 8 }}>
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={fullName}
            style={{
              width: 76,
              height: 76,
              borderRadius: 76,
              objectFit: 'cover',
              boxShadow:
                '0 8px 24px rgba(123,92,230,0.4), inset 0 2px 0 rgba(255,255,255,0.3)',
              border: '2px solid rgba(255,255,255,0.1)',
            }}
          />
        ) : (
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 76,
              background: 'linear-gradient(135deg, #9B7BFF, #5B3DCC)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 30,
              fontWeight: 700,
              boxShadow:
                '0 8px 24px rgba(123,92,230,0.4), inset 0 2px 0 rgba(255,255,255,0.3)',
              border: '2px solid rgba(255,255,255,0.1)',
            }}
          >
            {initials || '?'}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#fff',
              letterSpacing: -0.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {fullName || 'Anonymous'}
          </div>
          <div style={{ fontSize: 13.5, color: TOKENS.textDim, marginTop: 2 }}>
            {user.username ? `@${user.username}` : `id: ${user.telegramId}`}
          </div>
        </div>
      </div>

      {/* Balance */}
      <Glass
        radius={24}
        padding={20}
        intense
        style={{
          background: 'linear-gradient(135deg, rgba(155,123,255,0.22), rgba(123,92,230,0.08))',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -30,
            right: -30,
            width: 140,
            height: 140,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(242,198,107,0.3), transparent 65%)',
            filter: 'blur(8px)',
          }}
        />
        <div style={{ position: 'relative' }}>
          <div
            style={{
              fontSize: 11,
              color: TOKENS.textMute,
              fontWeight: 600,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            {t('profile_star_balance')}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
            <StarIcon size={32} />
            <span
              style={{
                fontSize: 44,
                fontWeight: 800,
                color: '#fff',
                letterSpacing: -1.5,
                lineHeight: 1,
              }}
            >
              {balance.toLocaleString()}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button
              style={balanceBtnStyle(false)}
              onClick={() => {
                hapticTap();
                setHistoryOpen(true);
              }}
            >
              <Icon name="history" size={16} color="#fff" />
              {t('profile_history')}
            </button>
            <button
              style={balanceBtnStyle(true)}
              onClick={() => {
                hapticTap();
                setWithdrawOpen(true);
              }}
            >
              <Icon name="send" size={16} color="#3A2A0A" />
              {t('profile_withdraw')}
            </button>
          </div>
        </div>
      </Glass>

      {/* Recent activity (история) */}
      <RecentActivity transactions={transactions} loading={txLoading} />

      {/* Language switcher */}
      <div>
        <SectionLabel>{t('profile_language')}</SectionLabel>
        <Glass radius={18} padding={4} style={{ display: 'flex', position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: `calc(${LANGS.findIndex((l) => l.code === lang) * 33.33}% + 4px)`,
              width: 'calc(33.33% - 8px)',
              borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(155,123,255,0.3), rgba(123,92,230,0.4))',
              border: '1px solid rgba(155,123,255,0.4)',
              transition: 'left 300ms cubic-bezier(0.65,0,0.35,1)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          />
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                hapticTap();
                setLang(l.code as Lang);
              }}
              style={{
                flex: 1,
                height: 50,
                border: 'none',
                background: 'transparent',
                color: lang === l.code ? '#fff' : TOKENS.textDim,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontFamily: 'inherit',
                transition: 'color 200ms ease',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 800 }}>{l.flag}</span>
              {l.label}
            </button>
          ))}
        </Glass>
      </div>

      {/* Links */}
      <div>
        <SectionLabel>{t('profile_links')}</SectionLabel>
        <Glass radius={18} padding={0} style={{ overflow: 'hidden' }}>
          {(
            [
              {
                icon: 'tg',
                label: t('profile_link_channel'),
                sub: '@StarsPayChannel',
                color: '#5B9DEE',
                url: LINKS.channel,
              },
              {
                icon: 'instagram',
                label: t('profile_link_instagram'),
                sub: '@starspayofficial',
                color: '#D6336C',
                url: LINKS.instagram,
              },
              {
                icon: 'globe',
                label: t('profile_link_website'),
                sub: 'starspay.uz',
                color: '#7BD89B',
                url: LINKS.website,
              },
              {
                icon: 'support',
                label: t('profile_link_support'),
                sub: t('profile_link_support_sub'),
                color: TOKENS.gold,
                url: LINKS.support,
              },
            ] as const
          ).map((l, i, arr) => (
            <div key={l.label}>
              <button
                onClick={() => openExternal(l.url)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  transition: 'background 200ms ease',
                  color: 'inherit',
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    background: l.color + '20',
                    border: `1px solid ${l.color}40`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name={l.icon} size={19} color={l.color} strokeWidth={1.7} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14.5,
                      fontWeight: 600,
                      color: '#fff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {l.label}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: TOKENS.textMute,
                      marginTop: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {l.sub}
                  </div>
                </div>
                <Icon name="chevron-right" size={16} color={TOKENS.textMute} />
              </button>
              {i < arr.length - 1 && (
                <div
                  style={{
                    height: 1,
                    background: 'rgba(255,255,255,0.05)',
                    margin: '0 16px 0 68px',
                  }}
                />
              )}
            </div>
          ))}
        </Glass>
      </div>

      <div
        style={{
          textAlign: 'center',
          fontSize: 11,
          color: TOKENS.textMute,
          fontWeight: 500,
          marginTop: 6,
        }}
      >
        v 0.1.0 · {fullName} {t('profile_member_since')} {since}
      </div>

      {/* Withdraw modal */}
      <WithdrawSheet
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        balance={balance}
        username={user.username ?? user.firstName}
        onSuccess={handleWithdrawSuccess}
        onErrorToast={onToast}
      />

      {/* Full history modal */}
      <BottomSheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        eyebrow={t('profile_history')}
        title={t('profile_recent_activity')}
        maxHeight="80%"
      >
        <TransactionsList items={transactions ?? []} loading={txLoading} />
      </BottomSheet>
    </div>
  );
}

// =====================================================
// Withdraw bottom-sheet
// =====================================================
function WithdrawSheet({
  open,
  onClose,
  balance,
  username,
  onSuccess,
  onErrorToast,
}: {
  open: boolean;
  onClose: () => void;
  balance: number;
  username: string;
  onSuccess: (balance: number, txn: TransactionItem) => void;
  onErrorToast: (msg: string) => void;
}) {
  const { t } = useLang();
  const [amount, setAmount] = useState<number>(MIN_WITHDRAWAL);
  const [submitting, setSubmitting] = useState(false);

  // сбрасываем сумму при открытии
  useEffect(() => {
    if (open) setAmount(Math.min(MIN_WITHDRAWAL, Math.max(0, balance)));
  }, [open, balance]);

  const valid = amount >= MIN_WITHDRAWAL && amount <= balance;
  const tooSmall = amount > 0 && amount < MIN_WITHDRAWAL;
  const tooBig = amount > balance;

  const setQuick = (n: number) => setAmount(Math.min(n, balance));

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    hapticTap();
    setSubmitting(true);
    try {
      const res = await api.withdraw(amount);
      if (res.ok && res.starBalance !== undefined && res.transaction) {
        onSuccess(res.starBalance, res.transaction);
        onClose();
      } else if (res.error === 'insufficient_funds') {
        onErrorToast(t('withdraw_error_balance'));
      } else if (res.error === 'min_amount') {
        onErrorToast(t('withdraw_error_min', { min: res.min ?? MIN_WITHDRAWAL }));
      } else {
        onErrorToast(res.error ?? 'Failed');
      }
    } catch (e) {
      const err = e as Error & { body?: { error?: string; min?: number } };
      const code = err.body?.error;
      if (code === 'insufficient_funds') onErrorToast(t('withdraw_error_balance'));
      else if (code === 'min_amount')
        onErrorToast(t('withdraw_error_min', { min: err.body?.min ?? MIN_WITHDRAWAL }));
      else onErrorToast(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const presets = [50, 100, 250].filter((v) => v <= balance);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      eyebrow="WALLET"
      title={t('withdraw_title')}
      maxHeight="80%"
    >
      {/* Recipient (own account) — readonly */}
      <Glass radius={14} padding={14} intense style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.2,
            color: TOKENS.textMute,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          {t('withdraw_to')}
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: TOKENS.text,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          @{username}
          <Icon name="check" size={14} color="#7BD89B" strokeWidth={2.4} />
        </div>
        <div style={{ fontSize: 12, color: TOKENS.textMute, marginTop: 6, lineHeight: 1.45 }}>
          {t('withdraw_helper')}
        </div>
      </Glass>

      {/* Amount input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.2,
            color: TOKENS.textMute,
            textTransform: 'uppercase',
          }}
        >
          {t('withdraw_amount')}
        </div>
        <div style={{ fontSize: 12, color: TOKENS.textDim, fontWeight: 600 }}>
          {t('withdraw_balance')}: {balance.toLocaleString()}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 60,
          borderRadius: 14,
          padding: '0 16px',
          background: 'rgba(0,0,0,0.25)',
          border: `1.5px solid ${
            tooSmall || tooBig ? 'rgba(255,123,123,0.5)' : 'rgba(155,123,255,0.4)'
          }`,
          transition: 'border-color 220ms ease',
          marginBottom: 8,
        }}
      >
        <StarIcon size={22} />
        <input
          type="text"
          inputMode="numeric"
          pattern="\\d*"
          value={amount === 0 ? '' : String(amount)}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            setAmount(Math.min(99_999_999, parseInt(v || '0', 10)));
          }}
          placeholder={String(MIN_WITHDRAWAL)}
          style={{
            flex: 1,
            height: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: TOKENS.text,
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: -0.4,
            marginLeft: 10,
            fontFamily: 'inherit',
          }}
        />
      </div>
      <div
        style={{
          fontSize: 12,
          color: tooBig ? '#FF8B8B' : tooSmall ? '#FF8B8B' : TOKENS.textMute,
          fontWeight: 500,
          minHeight: 16,
          marginBottom: 12,
        }}
      >
        {tooBig
          ? t('withdraw_error_balance')
          : tooSmall
            ? t('withdraw_error_min', { min: MIN_WITHDRAWAL })
            : t('withdraw_min_hint', { min: MIN_WITHDRAWAL })}
      </div>

      {/* Quick chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {presets.map((v) => (
          <QuickChip key={v} active={amount === v} onClick={() => setQuick(v)}>
            {v}
          </QuickChip>
        ))}
        {balance >= MIN_WITHDRAWAL && (
          <QuickChip active={amount === balance} onClick={() => setAmount(balance)}>
            {t('withdraw_quick_all')}
          </QuickChip>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={() => void handleSubmit()}
        disabled={!valid || submitting}
        style={{
          width: '100%',
          height: 54,
          borderRadius: 16,
          border: 'none',
          background:
            valid && !submitting
              ? 'linear-gradient(135deg, #F2C66B 0%, #E8B252 100%)'
              : 'rgba(255,255,255,0.06)',
          color: valid && !submitting ? '#3A2A0A' : TOKENS.textDim,
          fontSize: 16,
          fontWeight: 800,
          cursor: valid && !submitting ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit',
          boxShadow:
            valid && !submitting
              ? '0 8px 24px rgba(242,198,107,0.4), inset 0 1px 0 rgba(255,255,255,0.4)'
              : 'none',
          transition: 'all 220ms ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {submitting ? (
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              border: '2px solid rgba(58,42,10,0.3)',
              borderTopColor: '#3A2A0A',
              animation: 'spin 0.85s linear infinite',
              display: 'inline-block',
            }}
          />
        ) : (
          <StarIcon size={18} />
        )}
        {t('withdraw_button')}
      </button>
    </BottomSheet>
  );
}

function QuickChip({
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
        flex: '1 1 0',
        minWidth: 64,
        height: 40,
        borderRadius: 12,
        border: `1px solid ${active ? 'rgba(155,123,255,0.5)' : TOKENS.glassBorder}`,
        background: active
          ? 'rgba(155,123,255,0.18)'
          : 'rgba(255,255,255,0.04)',
        color: active ? '#fff' : TOKENS.textDim,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 700,
        fontFamily: 'inherit',
        transition: 'all 200ms ease',
      }}
    >
      {children}
    </button>
  );
}

// =====================================================
// Recent activity (inline list of last 8)
// =====================================================
function RecentActivity({
  transactions,
  loading,
}: {
  transactions: TransactionItem[] | null;
  loading: boolean;
}) {
  const { t } = useLang();
  const items = (transactions ?? []).slice(0, 8);

  return (
    <div>
      <SectionLabel>{t('profile_recent_activity')}</SectionLabel>
      {loading && !transactions ? (
        <Glass radius={14} padding="12px 14px">
          <div style={{ height: 48, animation: 'pulse 1.6s ease infinite' }} />
        </Glass>
      ) : items.length === 0 ? (
        <Glass radius={14} padding="16px 14px">
          <div
            style={{
              fontSize: 13,
              color: TOKENS.textDim,
              textAlign: 'center',
              fontWeight: 500,
            }}
          >
            {t('profile_no_activity')}
          </div>
        </Glass>
      ) : (
        <Glass radius={14} padding={0} style={{ overflow: 'hidden' }}>
          {items.map((tx, i) => (
            <div key={tx.id}>
              <TransactionRow item={tx} />
              {i < items.length - 1 && (
                <div
                  style={{
                    height: 1,
                    background: 'rgba(255,255,255,0.04)',
                    margin: '0 14px',
                  }}
                />
              )}
            </div>
          ))}
        </Glass>
      )}
    </div>
  );
}

function TransactionsList({
  items,
  loading,
}: {
  items: TransactionItem[];
  loading: boolean;
}) {
  const { t } = useLang();
  if (loading && items.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: TOKENS.textMute }}>
        {t('common_loading')}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: TOKENS.textMute }}>
        {t('profile_no_activity')}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((tx, i) => (
        <div key={tx.id}>
          <TransactionRow item={tx} />
          {i < items.length - 1 && (
            <div
              style={{
                height: 1,
                background: 'rgba(255,255,255,0.05)',
                margin: '0 4px',
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function TransactionRow({ item }: { item: TransactionItem }) {
  const { t, lang } = useLang();
  const isCredit = item.amount > 0;
  const date = new Date(item.createdAt);
  const dateStr = date.toLocaleString(lang, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const typeLabel = ((): string => {
    switch (item.type) {
      case 'task':
        return t('tx_task');
      case 'referral':
        return t('tx_referral');
      case 'withdrawal':
        return t('tx_withdrawal');
      default:
        return t('tx_admin');
    }
  })();
  const note = item.note && item.note !== typeLabel ? item.note : null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: isCredit
            ? 'rgba(75,200,150,0.16)'
            : 'rgba(255,123,123,0.16)',
          border: isCredit
            ? '1px solid rgba(75,200,150,0.32)'
            : '1px solid rgba(255,123,123,0.32)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: isCredit ? '#7BD89B' : '#FF9E9E',
            lineHeight: 1,
          }}
        >
          {isCredit ? '+' : '−'}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: TOKENS.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {note ?? typeLabel}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: TOKENS.textMute,
            fontWeight: 500,
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {note ? typeLabel + ' · ' : ''}
          {dateStr}
        </div>
      </div>
      <div
        style={{
          flexShrink: 0,
          fontSize: 15,
          fontWeight: 800,
          color: isCredit ? '#7BD89B' : '#FF9E9E',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {isCredit ? '+' : '−'}
        {Math.abs(item.amount).toLocaleString()}
        <StarIcon size={14} />
      </div>
    </div>
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

function balanceBtnStyle(primary: boolean) {
  return {
    flex: 1,
    height: 44,
    borderRadius: 13,
    background: primary
      ? 'linear-gradient(135deg, #F2C66B, #E8B252)'
      : 'rgba(255,255,255,0.06)',
    color: primary ? '#3A2A0A' : '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    boxShadow: primary
      ? '0 6px 18px rgba(242,198,107,0.4), inset 0 1px 0 rgba(255,255,255,0.4)'
      : 'inset 0 1px 0 rgba(255,255,255,0.06)',
    border: primary ? 'none' : '1px solid rgba(255,255,255,0.10)',
    transition: 'all 200ms ease',
  } as const;
}

