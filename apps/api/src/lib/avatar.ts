import { mkdir, writeFile, access } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { request } from 'undici';
import { config } from '../config.js';

// =====================================================
// Скачивание и кэширование аватарок Telegram
// =====================================================
//
// initData содержит photo_url — это ссылка на CDN telegram (cdn?.telesco.pe/...).
// Ссылка может протухнуть, поэтому при первом входе мы скачиваем картинку
// и сохраняем локально на диск (volume), а в БД пишем относительный путь.
//
// Дополнительно, если photo_url пустой (у юзера нет аватарки или скрыт), можно
// дёрнуть Bot API getUserProfilePhotos -> getFile -> file_path.
// =====================================================

let dirInited = false;

async function ensureDir() {
  if (dirInited) return;
  await mkdir(config.AVATAR_DIR, { recursive: true });
  dirInited = true;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Стабильное имя файла на основе telegramId (одна аватарка на юзера, перезаписываем при обновлении).
 */
function avatarFileName(telegramId: bigint | number, sourceUrl: string): string {
  const ext = (extname(new URL(sourceUrl).pathname) || '.jpg').toLowerCase().slice(0, 6);
  return `${telegramId.toString()}${ext}`;
}

/**
 * Скачивает картинку по URL и сохраняет в AVATAR_DIR.
 * Возвращает публичный путь (например, /avatars/123.jpg) или null при ошибке.
 */
export async function downloadAvatar(
  telegramId: bigint | number,
  photoUrl: string | undefined | null,
): Promise<string | null> {
  if (!photoUrl) return null;
  try {
    await ensureDir();
    const fileName = avatarFileName(telegramId, photoUrl);
    const fullPath = join(config.AVATAR_DIR, fileName);

    // Если уже есть и файл свежий (<24ч) — пропустим. Простоты ради всегда переписываем.
    const res = await request(photoUrl, {
      method: 'GET',
      headersTimeout: 5_000,
      bodyTimeout: 10_000,
    });
    if (res.statusCode < 200 || res.statusCode >= 300) {
      return null;
    }
    const buf = Buffer.from(await res.body.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > 5 * 1024 * 1024) {
      // Пустой или слишком большой файл — не сохраняем
      return null;
    }
    await writeFile(fullPath, buf);
    return `${config.AVATAR_PUBLIC_PREFIX}/${fileName}`;
  } catch (err) {
    // Логируется выше по стеку
    return null;
  }
}

/**
 * Резервный путь: тянет аватарку через Bot API.
 * Используется, если photo_url отсутствует в initData.
 */
export async function fetchAvatarViaBot(
  telegramId: bigint | number,
  botToken: string,
): Promise<string | null> {
  try {
    const tgId = telegramId.toString();
    // 1. Получаем фото профиля
    const photosRes = await request(
      `https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${tgId}&limit=1`,
    );
    const photosJson = (await photosRes.body.json()) as {
      ok: boolean;
      result?: { total_count: number; photos: Array<Array<{ file_id: string }>> };
    };
    if (!photosJson.ok || !photosJson.result?.photos?.length) return null;
    const photo = photosJson.result.photos[0];
    if (!photo?.length) return null;
    // Берём картинку максимального размера (последний элемент)
    const fileId = photo[photo.length - 1]!.file_id;

    // 2. Получаем file_path
    const fileRes = await request(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`,
    );
    const fileJson = (await fileRes.body.json()) as {
      ok: boolean;
      result?: { file_path: string };
    };
    if (!fileJson.ok || !fileJson.result?.file_path) return null;

    // 3. Скачиваем
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileJson.result.file_path}`;
    return await downloadAvatar(telegramId, fileUrl);
  } catch {
    return null;
  }
}

export function deterministicReferralCode(telegramId: bigint | number): string {
  return createHash('sha1')
    .update(`stars-pay:${telegramId.toString()}`)
    .digest('base64url')
    .slice(0, 10);
}
