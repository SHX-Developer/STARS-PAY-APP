import { useState, type ReactNode } from 'react';
import { TOKENS } from './lib/tokens';
import { useAuth } from './hooks/useAuth';
import { AppBackground } from './components/AppBackground';
import { BottomNav, type Screen } from './components/BottomNav';
import { Toast } from './components/Toast';
import { HomeScreen } from './screens/HomeScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { ReferralsScreen } from './screens/ReferralsScreen';
import { TasksScreen } from './screens/TasksScreen';
import { Placeholder } from './screens/Placeholder';

const BRAND = 'StarsPay';

export default function App() {
  const { state } = useAuth();
  const [screen, setScreen] = useState<Screen>('home');
  const [toast, setToast] = useState<string | null>(null);
  const [lang, setLang] = useState<string>('en');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  if (state.status === 'loading') {
    return (
      <FullscreenWrap>
        <Loader label="Connecting…" />
      </FullscreenWrap>
    );
  }

  if (state.status === 'no-telegram') {
    return (
      <FullscreenWrap>
        <Centered
          title="Open inside Telegram"
          body="This Mini App needs to be launched from Telegram. Open the bot and tap the Web App button."
        />
      </FullscreenWrap>
    );
  }

  if (state.status === 'error') {
    return (
      <FullscreenWrap>
        <Centered
          title="Authorization failed"
          body={state.message || 'Could not validate your Telegram session. Try reopening the app.'}
        />
      </FullscreenWrap>
    );
  }

  const user = state.user;

  const screens: Record<Screen, ReactNode> = {
    home: (
      <HomeScreen
        user={user}
        brand={BRAND}
        onCheckout={(o) => showToast(`Order draft: ${o.kind} → ${o.username}`)}
      />
    ),
    profile: <ProfileScreen user={user} lang={lang} onLang={setLang} />,
    referrals: <ReferralsScreen onToast={showToast} />,
    tasks: <TasksScreen onToast={showToast} />,
    orders: (
      <Placeholder
        icon="orders"
        title="Orders"
        subtitle="Your purchase history will show up here once you check out."
      />
    ),
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: TOKENS.bg0,
      }}
    >
      <AppBackground />
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          zIndex: 2,
          // Глобальный отступ сверху для всех экранов: safe-area iOS + воздух под
          // камерой/notch и кнопками Telegram (close, settings).
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 36px)',
        }}
      >
        <div key={screen} style={{ animation: 'fadeIn 280ms ease' }}>
          {screens[screen]}
        </div>
      </div>
      <BottomNav active={screen} onChange={setScreen} />
      <Toast message={toast} visible={!!toast} />
    </div>
  );
}

function FullscreenWrap({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: TOKENS.bg0,
      }}
    >
      <AppBackground />
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Loader({ label }: { label: string }) {
  return (
    <div style={{ textAlign: 'center', color: TOKENS.text }}>
      <div
        style={{
          width: 48,
          height: 48,
          margin: '0 auto 14px',
          borderRadius: '50%',
          border: `3px solid ${TOKENS.glassBorderStrong}`,
          borderTopColor: TOKENS.violet,
          animation: 'spin 0.9s linear infinite',
        }}
      />
      <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.textDim }}>{label}</div>
    </div>
  );
}

function Centered({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ textAlign: 'center', maxWidth: 320 }}>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: TOKENS.text,
          letterSpacing: -0.4,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 14, color: TOKENS.textDim, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}
