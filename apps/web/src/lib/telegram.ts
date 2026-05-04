// Хелперы для работы с Telegram WebApp SDK

export function getTelegramWebApp() {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
}

export function getInitData(): string | null {
  const tg = getTelegramWebApp();
  if (!tg) return null;
  // initData может быть пустой строкой если страница открыта вне Telegram
  return tg.initData || null;
}

export function getStartParam(): string | undefined {
  return getTelegramWebApp()?.initDataUnsafe?.start_param;
}

export function applyTelegramTheme() {
  const tg = getTelegramWebApp();
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    // фиксируем тёмные тона хедера/фона телеграма под наш дизайн
    tg.setHeaderColor?.('#08040E');
    tg.setBackgroundColor?.('#08040E');
  } catch {
    /* noop */
  }
}

export function hapticTap() {
  try {
    getTelegramWebApp()?.HapticFeedback?.impactOccurred('light');
  } catch {
    /* noop */
  }
}
