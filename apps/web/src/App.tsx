import { useState, type ReactNode } from 'react';
import { TOKENS } from './lib/tokens';
import { useAuth } from './hooks/useAuth';
import { api } from './lib/api';
import { useT } from './lib/i18n-context';
import { AppBackground } from './components/AppBackground';
import { BottomNav, type Screen } from './components/BottomNav';
import { Toast } from './components/Toast';
import { HomeScreen } from './screens/HomeScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { ReferralsScreen } from './screens/ReferralsScreen';
import { TasksScreen } from './screens/TasksScreen';
import { OrdersScreen } from './screens/OrdersScreen';
import { PaymentModal } from './components/PaymentModal';

export default function App() {
  const t = useT();
  const { state, refresh } = useAuth();
  const [screen, setScreen] = useState<Screen>('home');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const [pendingOrder, setPendingOrder] = useState<null | {
    kind: 'stars' | 'premium';
    username: string;
    amount: number;
    priceUzs: number;
  }>(null);

  const handleCheckout = (o: {
    kind: 'stars' | 'premium';
    username: string;
    amount: number;
    priceUzs: number;
  }) => {
    setPendingOrder(o);
  };

  const handlePaymentConfirm = async (receipt: File) => {
    if (!pendingOrder) return;
    try {
      const res = await api.createOrder({
        kind: pendingOrder.kind,
        recipientUsername: pendingOrder.username,
        amount: pendingOrder.amount,
        priceUsd: pendingOrder.priceUzs, // поле в БД исторически priceUsd, но кладём UZS
        receipt,
      });
      setPendingOrder(null);
      if (res.referralBonus) {
        showToast(t('order_placed_with_bonus', { n: res.referralBonus.amount }));
      } else {
        showToast(t('order_placed'));
      }
      void refresh();
    } catch (e) {
      const err = e as Error & { body?: { error?: string } };
      showToast(err.body?.error ?? err.message ?? t('order_failed'));
    }
  };

  if (state.status === 'loading') {
    return (
      <FullscreenWrap>
        <Loader label={t('common_loading')} />
      </FullscreenWrap>
    );
  }

  if (state.status === 'no-telegram') {
    return (
      <FullscreenWrap>
        <Centered title={t('open_in_tg_title')} body={t('open_in_tg_body')} />
      </FullscreenWrap>
    );
  }

  if (state.status === 'error') {
    return (
      <FullscreenWrap>
        <Centered
          title={t('auth_failed_title')}
          body={state.message || t('auth_failed_body')}
        />
      </FullscreenWrap>
    );
  }

  const user = state.user;

  const screens: Record<Screen, ReactNode> = {
    home: (
      <HomeScreen
        user={user}
        onCheckout={(o) => void handleCheckout(o)}
      />
    ),
    profile: <ProfileScreen user={user} onToast={showToast} onBalanceUpdate={() => void refresh()} />,
    referrals: <ReferralsScreen onToast={showToast} />,
    tasks: <TasksScreen onToast={showToast} />,
    orders: <OrdersScreen />,
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
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 48px)',
        }}
      >
        <div key={screen} style={{ animation: 'fadeIn 280ms ease' }}>
          {screens[screen]}
        </div>
      </div>
      <BottomNav active={screen} onChange={setScreen} />
      <Toast message={toast} visible={!!toast} />

      <PaymentModal
        open={pendingOrder !== null}
        order={pendingOrder}
        onClose={() => setPendingOrder(null)}
        onConfirm={(receipt) => void handlePaymentConfirm(receipt)}
        onToast={showToast}
      />
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
