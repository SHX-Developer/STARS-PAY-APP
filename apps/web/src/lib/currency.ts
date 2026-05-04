// =====================================================
// Цены и форматирование UZS
// =====================================================

// Курс: 1 star = 230 UZS
export const STAR_TO_UZS = 230;

// Premium-пакеты в UZS (фикс, не зависят от STAR_TO_UZS)
export const PREMIUM_UZS = {
  3: 165_000,
  6: 290_000,
  12: 500_000,
} as const;

export function starsToUzs(stars: number): number {
  return Math.max(0, Math.round(stars * STAR_TO_UZS));
}

/**
 * Форматирует UZS: "23 000" / "1 250 000". Без копеек.
 * Пробел-разделитель тысяч (как принято в Узбекистане).
 */
export function formatUzs(amount: number): string {
  const safe = Math.max(0, Math.round(amount));
  // Узкий неразрывный пробел между разрядами для аккуратного рендера
  return safe.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** "23 000 UZS" */
export function formatUzsWithCurrency(amount: number): string {
  return `${formatUzs(amount)} UZS`;
}
