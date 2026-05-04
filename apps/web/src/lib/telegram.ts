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

const TG_LINK_RE = /^https?:\/\/(?:t|telegram)\.me\//i;

/**
 * Универсальный "открыть ссылку" для Mini App.
 * - t.me и telegram.me → openTelegramLink (нативная навигация в Telegram)
 * - всё остальное      → openLink (in-app браузер) или window.open
 *
 * openTelegramLink/openLink не выбрасывают ошибки и ничего не возвращают,
 * поэтому try/catch вокруг них не нужен.
 */
export function openExternal(url: string) {
  hapticTap();
  if (!url) return;
  const tg = getTelegramWebApp();
  if (!tg) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  if (TG_LINK_RE.test(url) && tg.openTelegramLink) {
    tg.openTelegramLink(url);
    return;
  }
  if (tg.openLink) {
    tg.openLink(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
