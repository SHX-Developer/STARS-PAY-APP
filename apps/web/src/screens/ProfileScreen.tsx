import { TOKENS } from '../lib/tokens';
import { Glass } from '../components/Glass';
import { Icon, StarIcon } from '../components/Icon';
import type { AppUser } from '../types';

interface ProfileProps {
  user: AppUser;
  referralsCount?: number;
  lang: string;
  onLang: (l: string) => void;
}

export function ProfileScreen({ user, referralsCount = 0, lang, onLang }: ProfileProps) {
  const langs = [
    { code: 'uz', flag: 'UZ', label: 'Uzbek' },
    { code: 'ru', flag: 'RU', label: 'Русский' },
    { code: 'en', flag: 'EN', label: 'English' },
  ];

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  const since = new Date(user.createdAt).toLocaleString('en', {
    month: 'short',
    year: 'numeric',
  });
  const tierLabel = user.tier.charAt(0).toUpperCase() + user.tier.slice(1);

  return (
    <div style={{ padding: '8px 16px 110px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* user header */}
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
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 6,
              padding: '3px 8px',
              borderRadius: 6,
              background: 'rgba(242,198,107,0.14)',
              border: '1px solid rgba(242,198,107,0.3)',
            }}
          >
            <Icon name="trophy" size={11} color={TOKENS.gold} />
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: TOKENS.gold,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              {tierLabel} tier
            </span>
          </div>
        </div>
      </div>

      {/* balance */}
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
            Sparkle balance
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
              {user.sparkleBalance.toLocaleString()}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: TOKENS.textDim, marginTop: 6 }}>
            ≈ ${(user.sparkleBalance * 0.014).toFixed(2)} USD
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button style={balanceBtnStyle(false)}>
              <Icon name="history" size={16} color="#fff" />
              History
            </button>
            <button style={balanceBtnStyle(true)}>
              <Icon name="send" size={16} color="#3A2A0A" />
              Withdraw
            </button>
          </div>
        </div>
      </Glass>

      {/* referrals + referralCode */}
      <Glass radius={18} padding={16}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: TOKENS.textMute, fontWeight: 600, letterSpacing: 0.6 }}>
              YOUR REF CODE
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: '#fff',
                letterSpacing: 0.4,
                marginTop: 4,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              {user.referralCode}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: TOKENS.textMute, fontWeight: 600, letterSpacing: 0.6 }}>
              INVITED
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginTop: 2 }}>
              {referralsCount}
            </div>
          </div>
        </div>
      </Glass>

      {/* language */}
      <div>
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
          Language
        </div>
        <Glass radius={18} padding={4} style={{ display: 'flex', position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: `calc(${langs.findIndex((l) => l.code === lang) * 33.33}% + 4px)`,
              width: 'calc(33.33% - 8px)',
              borderRadius: 14,
              background:
                'linear-gradient(135deg, rgba(155,123,255,0.3), rgba(123,92,230,0.4))',
              border: '1px solid rgba(155,123,255,0.4)',
              transition: 'left 300ms cubic-bezier(0.65,0,0.35,1)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          />
          {langs.map((l) => (
            <button
              key={l.code}
              onClick={() => onLang(l.code)}
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
              <span style={{ fontSize: 13, fontWeight: 800 }}>{l.flag}</span>
              {l.label}
            </button>
          ))}
        </Glass>
      </div>

      {/* links */}
      <div>
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
          Links & support
        </div>
        <Glass radius={18} padding={0} style={{ overflow: 'hidden' }}>
          {(
            [
              { icon: 'tg', label: 'Our channel', sub: '@sparkles_news', color: '#5B9DEE' },
              { icon: 'instagram', label: 'Instagram', sub: '@sparkles.app', color: '#D6336C' },
              { icon: 'globe', label: 'Website', sub: 'sparkles.app', color: '#7BD89B' },
              {
                icon: 'support',
                label: 'Tech support',
                sub: 'avg reply 2 min',
                color: TOKENS.gold,
              },
            ] as const
          ).map((l, i, arr) => (
            <div key={l.label}>
              <button
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
                  }}
                >
                  <Icon name={l.icon} size={19} color={l.color} strokeWidth={1.7} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: '#fff' }}>{l.label}</div>
                  <div style={{ fontSize: 11.5, color: TOKENS.textMute, marginTop: 1 }}>
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
        v 0.1.0 · {fullName} since {since}
      </div>
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
