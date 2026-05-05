import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { TOKENS } from '../lib/tokens';
import { Icon } from './Icon';
import { hapticTap } from '../lib/telegram';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  // Высота в процентах (например '92%'). По умолчанию заполняет почти всё.
  maxHeight?: string;
}

/**
 * Полупрозрачный bottom-sheet с blur-backdrop и slide-up анимацией.
 *
 * Рендерится через createPortal в document.body — это вытаскивает sheet
 * из stacking-context'а родителя (Profile / любого экрана) и гарантирует,
 * что он окажется поверх BottomNav и не попадёт под clip от safe-area.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
  maxHeight = '92%',
}: BottomSheetProps) {
  // Закрытие по Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Блокируем скролл body, пока открыт
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  // dvh лучше vh в Telegram WebApp — учитывает клавиатуру.
  const heightCss = `min(${maxHeight}, ${maxHeight.replace('%', 'dvh')})`;

  const sheet = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        animation: 'fadeIn 220ms ease',
      }}
    >
      {/* backdrop */}
      <div
        onClick={() => {
          hapticTap();
          onClose();
        }}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(8,4,18,0.62)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />

      {/* sheet */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: heightCss,
          background: 'linear-gradient(180deg, rgba(35,22,68,0.98), rgba(20,12,40,0.99))',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          border: `1px solid ${TOKENS.glassBorderStrong}`,
          borderBottom: 'none',
          boxShadow:
            '0 -20px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1)',
          padding: '14px 18px max(env(safe-area-inset-bottom), 24px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          animation: 'slideUp 320ms cubic-bezier(0.34,1.2,0.64,1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* drag handle */}
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 4,
            background: 'rgba(255,255,255,0.18)',
            margin: '0 auto 12px',
            flexShrink: 0,
          }}
        />

        {/* header */}
        {(title || eyebrow) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 18,
              gap: 12,
              flexShrink: 0,
            }}
          >
            <div style={{ minWidth: 0 }}>
              {eyebrow && (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1.4,
                    color: TOKENS.textMute,
                    textTransform: 'uppercase',
                  }}
                >
                  {eyebrow}
                </div>
              )}
              {title && (
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: '#fff',
                    letterSpacing: -0.4,
                    marginTop: eyebrow ? 4 : 0,
                  }}
                >
                  {title}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                hapticTap();
                onClose();
              }}
              aria-label="Close"
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.08)',
                border: `1px solid ${TOKENS.glassBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                fontFamily: 'inherit',
              }}
            >
              <Icon name="close" size={16} color="#fff" strokeWidth={2} />
            </button>
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
