import { request } from 'undici';
import { config } from '../config.js';

// =====================================================
// Buypin: POST /games/{game}/validate-player
//
// В body передаём только {player_id: <username без @>}.
// server_id НЕ передаём.
//
// Парсер очень лояльный — пробует кучу ключей и не отбрасывает result
// если нашлось хоть что-то полезное. Также наружу отдаёт raw-ответ для
// фронта/дебага.
// =====================================================

export interface UserLookup {
  username: string;
  name: string | null;
  isPremium: boolean;
  raw?: unknown;
}

interface CacheEntry {
  ts: number;
  value: UserLookup | null;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60_000;

export interface LookupOptions {
  // лог raw-ответа в pino (info-уровень) — нужен для отладки несовпадений
  log?: (msg: string, data: unknown) => void;
}

export async function lookupTelegramUser(
  rawUsername: string,
  opts: LookupOptions = {},
): Promise<UserLookup | null> {
  if (!config.EXTERNAL_API_BASE_URL || !config.EXTERNAL_API_KEY || !config.BUYPIN_GAME_KEY) {
    opts.log?.('buypin: not configured', {
      hasBase: Boolean(config.EXTERNAL_API_BASE_URL),
      hasKey: Boolean(config.EXTERNAL_API_KEY),
      hasGame: Boolean(config.BUYPIN_GAME_KEY),
    });
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
    // Buypin использует X-API-Key (НЕ Authorization: Bearer — см. документацию,
    // ответ 401 "Missing or invalid X-API-Key" если шлём другой заголовок).
    const res = await request(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'X-API-Key': config.EXTERNAL_API_KEY,
      },
      body: JSON.stringify({ player_id: username }),
      headersTimeout: config.TELEGRAM_API_TIMEOUT_MS,
      bodyTimeout: config.TELEGRAM_API_TIMEOUT_MS,
    });

    let json: unknown = null;
    try {
      json = await res.body.json();
    } catch {
      // некоторые apis отдают text/plain — попробуем достать сырой текст
      try {
        const txt = await res.body.text();
        json = { _raw: txt };
      } catch {
        /* ignore */
      }
    }

    opts.log?.(`buypin: ${res.statusCode}`, json);

    if (res.statusCode >= 500) {
      return null;
    }
    if (res.statusCode >= 400) {
      cache.set(cacheKey, { ts: Date.now(), value: null });
      return null;
    }

    if (!json || typeof json !== 'object') {
      cache.set(cacheKey, { ts: Date.now(), value: null });
      return null;
    }

    const value = normalizeResponse(username, json as Record<string, unknown>);
    cache.set(cacheKey, { ts: Date.now(), value });
    return value;
  } catch (err) {
    opts.log?.('buypin: network error', { err: (err as Error).message });
    return null;
  }
}

/**
 * Берёт всё что может из ответа. ЛЮБОЙ 2xx-ответ считаем "found":
 * даже если имени нет — UI просто покажет "Found" без имени.
 *
 * Возвращает null только если success явно false.
 */
function normalizeResponse(username: string, body: Record<string, unknown>): UserLookup | null {
  // Развернём обёртку до внутреннего объекта
  let root: Record<string, unknown> = body;
  for (const k of ['data', 'result', 'player', 'user', 'response', 'payload']) {
    const v = root[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      root = v as Record<string, unknown>;
      break;
    }
  }

  // Если success/valid явно false — это not-found
  const explicitFalse =
    pickBool(body, ['success', 'valid', 'ok', 'is_valid']) === false ||
    pickBool(root, ['success', 'valid', 'ok', 'is_valid']) === false;
  if (explicitFalse) return null;

  // Имя из множества полей
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
    'user_name',
    'login',
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
    pickBool(root, [
      'is_premium',
      'isPremium',
      'premium',
      'has_premium',
      'hasPremium',
      'premium_user',
    ]) ?? false;

  // Считаем "found" если что-то ОК → возвращаем хотя бы username + raw
  return { username, name, isPremium, raw: body };
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
