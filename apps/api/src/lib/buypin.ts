import { request } from 'undici';
import { config } from '../config.js';

// =====================================================
// Buypin: POST /games/{game}/validate-player
//
// Используется чтобы по @username получить имя пользователя и premium-статус.
// game-ключ задаётся через env BUYPIN_GAME_KEY (например 'telegram-premium').
//
// Документация: https://buypin.net/api/documentation
//
// Запрос:
//   POST {EXTERNAL_API_BASE_URL}/games/{game}/validate-player
//   Authorization: Bearer {EXTERNAL_API_KEY}
//   Content-Type: application/json
//   Body: { "player_id": "<username без @>" }
//
// Ответ (поля могут варьироваться — парсер устойчив к разным схемам):
//   { success: true, data: { nickname / name / username, is_premium / premium } }
//   или { name, is_premium }
// =====================================================

export interface UserLookup {
  username: string;
  name: string | null;
  isPremium: boolean;
}

interface CacheEntry {
  ts: number;
  value: UserLookup | null;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60_000; // 5 минут

export async function lookupTelegramUser(rawUsername: string): Promise<UserLookup | null> {
  if (!config.EXTERNAL_API_BASE_URL || !config.EXTERNAL_API_KEY || !config.BUYPIN_GAME_KEY) {
    return null;
  }
  const username = rawUsername.replace(/^@/, '').trim();
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) return null;

  const cacheKey = `${config.BUYPIN_GAME_KEY}:${username}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const url = `${config.EXTERNAL_API_BASE_URL.replace(/\/$/, '')}/games/${encodeURIComponent(
      config.BUYPIN_GAME_KEY,
    )}/validate-player`;
    const res = await request(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${config.EXTERNAL_API_KEY}`,
      },
      body: JSON.stringify({ player_id: username }),
      headersTimeout: config.TELEGRAM_API_TIMEOUT_MS,
      bodyTimeout: config.TELEGRAM_API_TIMEOUT_MS,
    });

    // 4xx (например 404 = не найден, 422 = invalid) → not_found
    if (res.statusCode >= 400 && res.statusCode < 500) {
      cache.set(cacheKey, { ts: Date.now(), value: null });
      return null;
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      // 5xx — не кэшируем, чтобы повторить позже
      return null;
    }

    const json = (await res.body.json()) as Record<string, unknown>;
    const value = normalizeResponse(username, json);
    cache.set(cacheKey, { ts: Date.now(), value });
    return value;
  } catch {
    return null;
  }
}

/**
 * Извлекает {name, isPremium} из ответа Buypin.
 *
 * Поддерживает разные обёртки и наборы ключей — на случай если их API
 * вернёт что-то отличное от ожидаемого.
 */
function normalizeResponse(username: string, body: Record<string, unknown>): UserLookup | null {
  // Buypin может обернуть ответ в success/data/result/player.
  let root: Record<string, unknown> = body;
  for (const k of ['data', 'result', 'player', 'user', 'response']) {
    const v = root[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      root = v as Record<string, unknown>;
      break;
    }
  }

  // success-флаг — если явно false, считаем not-found
  const successFlag = pickBool(root, ['success', 'valid', 'ok', 'is_valid']);
  if (successFlag === false) return null;
  // часто success лежит на корне body, а данные — в data
  if (body !== root) {
    const rootSuccess = pickBool(body, ['success', 'valid', 'ok', 'is_valid']);
    if (rootSuccess === false) return null;
  }

  // Имя — пробуем кучу ключей
  const direct = pickString(root, [
    'nickname',
    'player_name',
    'playerName',
    'full_name',
    'fullName',
    'display_name',
    'displayName',
    'name',
    'first_name',
    'firstName',
    'username',
  ]);
  const composed = [
    pickString(root, ['first_name', 'firstName']),
    pickString(root, ['last_name', 'lastName']),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const name = direct ?? (composed.length > 0 ? composed : null);

  const isPremium =
    pickBool(root, ['is_premium', 'isPremium', 'premium', 'has_premium', 'hasPremium']) ?? false;

  // Если ничего полезного не вытащили — считаем not-found
  if (!name && !isPremium) {
    // успех был, но без полей — например `{success:true, data:{}}` для несуществующего юзера
    return null;
  }

  return { username, name, isPremium };
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
    if (typeof v === 'string') {
      const s = v.toLowerCase();
      if (s === 'true' || s === '1' || s === 'yes') return true;
      if (s === 'false' || s === '0' || s === 'no') return false;
    }
    if (typeof v === 'number') return v !== 0;
  }
  return null;
}
