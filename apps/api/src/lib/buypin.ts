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
  avatarUrl: string | null;
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

  // Один вызов telegram-stars: ответ содержит имя, premium и аватарку.
  // Параллельно фолбек к Telegram Bot API для аватарки (если её нет в Buypin).
  const [primary, tg] = await Promise.all([
    callValidatePlayer(config.BUYPIN_GAME_KEY, username, opts),
    fetchTelegramChatInfo(username, opts.log).catch(() => null),
  ]);

  if (!primary || !primary.success) {
    cache.set(cacheKey, { ts: Date.now(), value: null });
    return null;
  }

  const value: UserLookup = {
    username,
    name: primary.name ?? tg?.name ?? null,
    isPremium: primary.isPremium,
    avatarUrl: primary.avatarUrl ?? tg?.avatarUrl ?? null,
    raw: { primary: primary.raw, tg: tg ?? null },
  };

  cache.set(cacheKey, { ts: Date.now(), value });
  return value;
}

interface ValidatePlayerResult {
  success: boolean;
  name: string | null;
  isPremium: boolean;
  avatarUrl: string | null;
  raw: unknown;
}

async function callValidatePlayer(
  gameKey: string,
  username: string,
  opts: LookupOptions,
): Promise<ValidatePlayerResult | null> {
  try {
    const url = `${config.EXTERNAL_API_BASE_URL!.replace(/\/$/, '')}/games/${encodeURIComponent(
      gameKey,
    )}/validate-player`;
    const res = await request(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'X-API-Key': config.EXTERNAL_API_KEY!,
      },
      body: JSON.stringify({ player_id: username }),
      headersTimeout: config.TELEGRAM_API_TIMEOUT_MS,
      bodyTimeout: config.TELEGRAM_API_TIMEOUT_MS,
    });

    let json: unknown = null;
    try {
      json = await res.body.json();
    } catch {
      try {
        const txt = await res.body.text();
        json = { _raw: txt };
      } catch {
        /* ignore */
      }
    }
    opts.log?.(`buypin ${gameKey}: ${res.statusCode}`, json);

    if (res.statusCode >= 200 && res.statusCode < 300) {
      const parsed = parseDeep(username, (json ?? {}) as Record<string, unknown>);
      return {
        success: true,
        name: parsed.name,
        isPremium: parsed.isPremium,
        avatarUrl: parsed.avatarUrl,
        raw: json,
      };
    }
    if (res.statusCode >= 500) return null;
    return { success: false, name: null, isPremium: false, avatarUrl: null, raw: json };
  } catch (err) {
    opts.log?.(`buypin ${gameKey}: network error`, { err: (err as Error).message });
    return null;
  }
}

// =====================================================
// Рекурсивный парсер — ищет ключи на ЛЮБОЙ глубине вложенности.
// Buypin может класть premium/avatar в data.user.is_premium / data.profile.photo / ...
// мы обходим всё дерево и берём первое попавшееся значение.
// =====================================================

const NAME_KEYS = new Set([
  'nickname',
  'player_name',
  'playername',
  'full_name',
  'fullname',
  'display_name',
  'displayname',
  'name',
  'first_name',
  'firstname',
  'username',
  'user_name',
  'login',
  'title',
]);

const PREMIUM_KEYS = new Set([
  'is_premium',
  'ispremium',
  'premium',
  'has_premium',
  'haspremium',
  'premium_user',
  'premiumuser',
  'tg_premium',
  'telegram_premium',
  'is_premium_user',
  'premium_status',
  'has_telegram_premium',
]);

const AVATAR_KEYS = new Set([
  'avatar_url',
  'avatarurl',
  'avatar',
  'photo_url',
  'photourl',
  'photo',
  'picture',
  'pictureurl',
  'picture_url',
  'profile_photo',
  'profilephoto',
  'image',
  'image_url',
  'imageurl',
  'profile_picture',
  'profilepicture',
]);

interface ParseResult {
  name: string | null;
  isPremium: boolean;
  avatarUrl: string | null;
}

function parseDeep(_username: string, body: Record<string, unknown>): ParseResult {
  let name: string | null = null;
  let isPremium = false;
  let avatarUrl: string | null = null;

  const visit = (node: unknown, depth = 0): void => {
    if (!node || typeof node !== 'object' || depth > 6) return;
    if (Array.isArray(node)) {
      for (const v of node) visit(v, depth + 1);
      return;
    }
    for (const [rawKey, value] of Object.entries(node as Record<string, unknown>)) {
      const key = rawKey.toLowerCase().replace(/[-\s]/g, '_');
      // Имя — берём первое
      if (!name && NAME_KEYS.has(key)) {
        const s = coerceString(value);
        if (s) name = s;
      }
      // Premium — true перебивает false
      if (!isPremium && PREMIUM_KEYS.has(key)) {
        const b = coerceBool(value);
        if (b === true) isPremium = true;
      }
      // Аватар — берём первое строковое значение, выглядящее как URL
      if (!avatarUrl && AVATAR_KEYS.has(key)) {
        const s = coerceString(value);
        if (s && /^https?:\/\//.test(s)) avatarUrl = s;
        // photo иногда объект с file_id — игнорируем, обработается через Telegram fallback
      }
      // Углубляемся
      if (value && typeof value === 'object') visit(value, depth + 1);
    }
  };

  visit(body);

  // Если first_name найдено, но full name нет — попробуем собрать
  if (!name) {
    const fn = findFirstStringKey(body, 'first_name');
    const ln = findFirstStringKey(body, 'last_name');
    const composed = [fn, ln].filter(Boolean).join(' ').trim();
    if (composed) name = composed;
  }

  return { name, isPremium, avatarUrl };
}

function findFirstStringKey(node: unknown, key: string): string | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const v of node) {
      const r = findFirstStringKey(v, key);
      if (r) return r;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    if (k.toLowerCase() === key && typeof v === 'string' && v.trim()) return v.trim();
    if (v && typeof v === 'object') {
      const r = findFirstStringKey(v, key);
      if (r) return r;
    }
  }
  return null;
}

function coerceString(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim();
  return null;
}

function coerceBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes' || s === 'active') return true;
    if (s === 'false' || s === '0' || s === 'no' || s === 'inactive') return false;
  }
  return null;
}

// =====================================================
// Telegram Bot API: getChat(@username) → возвращает фото и базовую инфу
// =====================================================
//
// Работает только для:
//   - публичных @username каналов/групп/ботов
//   - юзеров, которые когда-либо взаимодействовали с нашим ботом
//     (Telegram считает их "known" для бота).
//
// `is_premium` через getChat НЕ возвращается — премиум-флаг есть только в
// User-объекте который приходит вместе с Message. Поэтому здесь не доступен.
// =====================================================

interface TgChatInfo {
  name: string | null;
  avatarUrl: string | null;
}

async function fetchTelegramChatInfo(
  username: string,
  log?: (msg: string, data: unknown) => void,
): Promise<TgChatInfo | null> {
  const token = config.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    // 1. getChat
    const chatRes = await request(`https://api.telegram.org/bot${token}/getChat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: `@${username}` }),
      headersTimeout: config.TELEGRAM_API_TIMEOUT_MS,
      bodyTimeout: config.TELEGRAM_API_TIMEOUT_MS,
    });
    const chatJson = (await chatRes.body.json()) as {
      ok: boolean;
      result?: {
        first_name?: string;
        last_name?: string;
        title?: string;
        photo?: { big_file_id?: string; small_file_id?: string };
      };
      description?: string;
    };
    log?.('tg getChat', chatJson);
    if (!chatJson.ok || !chatJson.result) return null;
    const r = chatJson.result;

    const name =
      [r.first_name, r.last_name].filter(Boolean).join(' ').trim() ||
      r.title?.trim() ||
      null;

    // 2. Если есть фото — берём через getFile + строим публичный file-URL
    let avatarUrl: string | null = null;
    const fileId = r.photo?.big_file_id ?? r.photo?.small_file_id;
    if (fileId) {
      const fileRes = await request(`https://api.telegram.org/bot${token}/getFile`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file_id: fileId }),
        headersTimeout: config.TELEGRAM_API_TIMEOUT_MS,
        bodyTimeout: config.TELEGRAM_API_TIMEOUT_MS,
      });
      const fileJson = (await fileRes.body.json()) as {
        ok: boolean;
        result?: { file_path?: string };
      };
      if (fileJson.ok && fileJson.result?.file_path) {
        avatarUrl = `https://api.telegram.org/file/bot${token}/${fileJson.result.file_path}`;
      }
    }

    return { name, avatarUrl };
  } catch (err) {
    log?.('tg getChat error', { err: (err as Error).message });
    return null;
  }
}

