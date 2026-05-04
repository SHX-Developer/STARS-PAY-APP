import { TOKENS } from '../lib/tokens';
import { Glass } from '../components/Glass';
import { Icon } from '../components/Icon';

interface PlaceholderProps {
  title: string;
  subtitle: string;
  icon: string;
}

// Лёгкий плейсхолдер для Tasks / Orders / Referrals.
// MVP-скоуп — авторизация + профиль. Эти экраны можно расширить позже,
// прикрутив /api/orders, /api/tasks и т.д. Модели уже есть в schema.prisma.
export function Placeholder({ title, subtitle, icon }: PlaceholderProps) {
  return (
    <div
      style={{
        padding: '8px 16px 110px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
      }}
    >
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: 28,
          background: 'rgba(155,123,255,0.18)',
          border: `1px solid ${TOKENS.glassBorderStrong}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 16,
        }}
      >
        <Icon name={icon} size={42} color={TOKENS.violet} strokeWidth={1.4} />
      </div>
      <div style={{ textAlign: 'center', padding: '0 24px' }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: TOKENS.text,
            letterSpacing: -0.3,
            marginBottom: 8,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 14, color: TOKENS.textDim, lineHeight: 1.5 }}>{subtitle}</div>
      </div>
      <Glass
        radius={16}
        padding="12px 16px"
        style={{ marginTop: 4, fontSize: 12, color: TOKENS.textMute, fontWeight: 600 }}
      >
        Coming soon · /api endpoint not wired yet
      </Glass>
    </div>
  );
}
