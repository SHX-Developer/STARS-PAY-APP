import { request } from 'undici';
import { config } from '../config.js';

// =====================================================
// Buypin lookup — возвращает имя и premium-статус по @username.
//
// ⚠️ Точная схема ответа Buypin может отличаться. Если их API возвращает
//    другую форму, поправьте парсинг в normalizeResponse().
//
// Гипотезы (если что-то не работает — попробуйте другую):
//   1. GET {BASE}/users/{username}                 Authorization: Bearer KEY
//   2. GET {BASE}/lookup?username={username}       X-API-Key: KEY
//   3. POST {BASE}/lookup body={username}          Authorization: KEY
//
// По умолчанию используем (1). Внутри normalizeResponse() пытаемся вытащить
// поля name/firstName/first_name/full_name + isPremium/is_premium/premium.
// =====================================================

export interface UserLookup {
  username: string;
  name: string | null;
  isPremium: boolean;
  raw?: unknown; // raw response для отладки в dev
}

const cache = new Map<string, { ts: number; value: UserLookup | null }>();
const CACHE_TTL_MS = 5 * 60_000; // 5 минут

export async function lookupTelegramUser(rawUsername: string): Promise<UserLookup | null> {
  if (!config.EXTERNAL_API_BASE_URL || !config.EXTERNAL_API_KEY) {
    return null;
  }
  const username = rawUsername.replace(/^@/, '').trim();
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) return null;

  const cached = cache.get(username);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const url = `${config.EXTERNAL_API_BASE_URL.replace(/\/$/, '')}/users/${encodeURIComponent(
      username,
    )}`;
    const res = await request(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${config.EXTERNAL_API_KEY}`,
      },
      headersTimeout: config.TELEGRAM_API_TIMEOUT_MS,
      bodyTimeout: config.TELEGRAM_API_TIMEOUT_MS,
    });
    if (res.statusCode < 200 || res.statusCode >= 300) {
      cache.set(username, { ts: Date.now(), value: null });
      return null;
    }
    const json = (await res.body.json()) as Record<string, unknown>;
    const value = normalizeResponse(username, json);
    cache.set(username, { ts: Date.now(), value });
    return value;
  } catch {
    return null;
  }
}

/**
 * Извлекает {name, isPremium} из произвольной формы ответа.
 * Поддерживает разные варианты ключей чтобы быть устойчивым.
 */
function normalizeResponse(username: string, body: Record<string, unknown>): UserLookup | null {
  // если ответ обёрнут (например {data: {...}, ok: true}) — заходим внутрь
  let root: Record<string, unknown> = body;
  for (const k of ['data', 'result', 'user']) {
    const v = root[k];
    if (v && typeof v === 'object') {
      root = v as Record<string, unknown>;
      break;
    }
  }

  // имя
  const name =
    pickString(root, [
      'full_name',
      'fullName',
      'display_name',
      'displayName',
      'name',
      'first_name',
      'firstName',
    ]) ??
    [pickString(root, ['first_name', 'firstName']), pickString(root, ['last_name', 'lastName'])]
      .filter(Boolean)
      .join(' ') ??
    null;

  const isPremium =
    pickBool(root, ['is_premium', 'isPremium', 'premium', 'has_premium', 'hasPremium']) ?? false;

  return {
    username,
    name: name && name.length > 0 ? name : null,
    isPremium,
    raw: undefined,
  };
}

function pickString(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function pickBool(o: Record<string, unknown>, keys: string[]): boolean | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string' && (v === 'true' || v === 'false')) return v === 'true';
  }
  return null;
}
