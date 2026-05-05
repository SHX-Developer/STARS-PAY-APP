import { useState, useRef, useEffect, type ChangeEvent, type ReactNode } from 'react';
import { TOKENS } from '../lib/tokens';
import { Glass } from '../components/Glass';
import { Icon } from '../components/Icon';
import { BottomSheet } from '../components/BottomSheet';
import { hapticTap } from '../lib/telegram';
import { useT } from '../lib/i18n-context';
import { formatUzs } from '../lib/currency';

// =====================================================
// PaymentModal — оформление заказа: показываем bank-details,
// просим загрузить чек, по нажатию confirm дёргаем onConfirm.
// =====================================================
//
// Карта/получатель в MVP захардкожены (см. CARD/HOLDER). Когда подключите
// реальный платёжный провайдер — приходите сюда и подменяйте на динамические
// значения (или вообще убирайте этот modal в пользу платёжной формы).
// =====================================================

// Реквизиты для оплаты — две карты узбекских платёжных систем.
const CARDS = [
  { network: 'UZCARD', number: '8600 1404 4227 6730' },
  { network: 'HUMO', number: '9860 1601 0451 6572' },
] as const;

interface OrderDraft {
  kind: 'stars' | 'premium';
  username: string;
  amount: number;
  priceUzs: number;
}

interface PaymentModalProps {
  open: boolean;
  order: OrderDraft | null;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  onToast: (msg: string) => void;
}

export function PaymentModal({ open, order, onClose, onConfirm, onToast }: PaymentModalProps) {
  const tr = useT();
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Сбрасываем стейт при каждом открытии
  useEffect(() => {
    if (open) {
      setReceiptName(null);
      setSubmitting(false);
    }
  }, [open]);

  if (!order) {
    return (
      <BottomSheet open={open} onClose={onClose}>
        <div />
      </BottomSheet>
    );
  }

  const isStars = order.kind === 'stars';
  const orderTitle = isStars
    ? `${order.amount} ${tr('common_stars')}`
    : `Premium · ${order.amount}${tr('home_months')}`;

  const copy = async (text: string, label: string) => {
    hapticTap();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
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
    onToast(`${label}: ${tr('common_copied').toLowerCase()}`);
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    hapticTap();
    const f = e.target.files?.[0];
    if (!f) {
      setReceiptName(null);
      return;
    }
    if (!/^image\//.test(f.type)) {
      onToast(tr('payment_only_images'));
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      onToast(tr('payment_too_large'));
      return;
    }
    setReceiptName(f.name);
  };

  const handleSubmit = async () => {
    if (!receiptName || submitting) return;
    hapticTap();
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      eyebrow={tr('payment_eyebrow')}
      title={tr('payment_title')}
      maxHeight="92%"
    >
      {/* Order summary */}
      <Glass
        radius={16}
        padding={14}
        intense
        style={{
          background: 'linear-gradient(135deg, rgba(155,123,255,0.18), rgba(123,92,230,0.06))',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              flexShrink: 0,
              background: isStars
                ? 'linear-gradient(135deg, rgba(242,198,107,0.25), rgba(242,198,107,0.08))'
                : 'linear-gradient(135deg, rgba(155,123,255,0.25), rgba(155,123,255,0.08))',
              border: `1px solid ${isStars ? 'rgba(242,198,107,0.32)' : 'rgba(155,123,255,0.32)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 20 }} role="img" aria-label={isStars ? 'stars' : 'premium'}>
              {isStars ? '⭐️' : '💎'}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: TOKENS.text,
                letterSpacing: -0.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {orderTitle}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1,
                color: TOKENS.textMute,
                textTransform: 'uppercase',
              }}
            >
              {tr('payment_amount')}
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: TOKENS.text,
                letterSpacing: -0.3,
                marginTop: 2,
              }}
            >
              {formatUzs(order.priceUzs)}{' '}
              <span style={{ fontSize: 11, color: TOKENS.textDim, fontWeight: 700 }}>UZS</span>
            </div>
          </div>
        </div>
      </Glass>

      {/* TRANSFER DETAILS */}
      <SectionLabel>{tr('payment_transfer_details')}</SectionLabel>
      <Glass radius={14} padding={0} style={{ overflow: 'hidden', marginBottom: 16 }}>
        {CARDS.map((c) => (
          <div key={c.network}>
            <DetailRow
              label={c.network}
              value={c.number}
              mono
              onCopy={() => void copy(c.number.replace(/\s/g, ''), c.network)}
            />
            <Divider />
          </div>
        ))}
        <DetailRow
          label={tr('payment_amount')}
          value={`${formatUzs(order.priceUzs)} UZS`}
          onCopy={() => void copy(String(order.priceUzs), tr('payment_amount'))}
        />
      </Glass>

      {/* Upload receipt */}
      <button
        onClick={() => inputRef.current?.click()}
        style={{
          width: '100%',
          padding: 16,
          borderRadius: 14,
          border: `1.5px dashed ${
            receiptName ? 'rgba(75,200,150,0.5)' : 'rgba(155,123,255,0.4)'
          }`,
          background: receiptName ? 'rgba(75,200,150,0.06)' : 'rgba(155,123,255,0.04)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: 'inherit',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          textAlign: 'left',
          marginBottom: 14,
          transition: 'all 220ms ease',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            flexShrink: 0,
            background: receiptName ? 'rgba(75,200,150,0.16)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${
              receiptName ? 'rgba(75,200,150,0.35)' : TOKENS.glassBorder
            }`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            name={receiptName ? 'check' : 'upload'}
            size={20}
            color={receiptName ? '#7BD89B' : '#fff'}
            strokeWidth={2}
          />
        </div>
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
            {receiptName ?? tr('payment_upload_title')}
          </div>
          <div style={{ fontSize: 12, color: TOKENS.textMute, fontWeight: 500, marginTop: 2 }}>
            {tr('payment_upload_sub')}
          </div>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      {/* Submit */}
      <button
        onClick={() => void handleSubmit()}
        disabled={!receiptName || submitting}
        style={{
          width: '100%',
          height: 54,
          borderRadius: 16,
          border: 'none',
          background:
            receiptName && !submitting
              ? 'linear-gradient(135deg, #9B7BFF 0%, #7B5CE6 100%)'
              : 'rgba(255,255,255,0.06)',
          color: receiptName && !submitting ? '#fff' : TOKENS.textDim,
          fontSize: 15.5,
          fontWeight: 800,
          cursor: receiptName && !submitting ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit',
          boxShadow:
            receiptName && !submitting
              ? '0 8px 24px rgba(123,92,230,0.4), inset 0 1px 0 rgba(255,255,255,0.25)'
              : 'none',
          transition: 'all 220ms ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        {submitting && (
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.25)',
              borderTopColor: '#fff',
              animation: 'spin 0.85s linear infinite',
              display: 'inline-block',
            }}
          />
        )}
        {tr('payment_confirm')}
      </button>

      {/* Helper note */}
      <div
        style={{
          fontSize: 12,
          color: TOKENS.textMute,
          fontWeight: 500,
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        {tr('payment_helper')}
      </div>
    </BottomSheet>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1.4,
        color: TOKENS.textMute,
        textTransform: 'uppercase',
        marginBottom: 10,
        padding: '0 4px',
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 14px' }} />;
}

function DetailRow({
  label,
  value,
  mono,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy: () => void;
}) {
  const tr = useT();
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 14px',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.2,
            color: TOKENS.textMute,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: TOKENS.text,
            letterSpacing: -0.1,
            marginTop: 4,
            fontFamily: mono
              ? 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'
              : 'inherit',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </div>
      </div>
      <button
        onClick={handleCopy}
        style={{
          flexShrink: 0,
          height: 36,
          padding: '0 12px',
          borderRadius: 10,
          border: `1px solid ${TOKENS.glassBorder}`,
          background: 'rgba(255,255,255,0.04)',
          color: TOKENS.text,
          fontSize: 12.5,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          transition: 'background 200ms ease',
        }}
      >
        <Icon
          name={copied ? 'check' : 'copy'}
          size={14}
          color={copied ? '#7BD89B' : TOKENS.text}
          strokeWidth={2}
        />
        {copied ? tr('common_copied') : tr('payment_copy')}
      </button>
    </div>
  );
}
