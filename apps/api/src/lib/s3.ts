import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomBytes } from 'node:crypto';
import { config } from '../config.js';

// =====================================================
// S3 клиент (Yandex Cloud Object Storage / любой S3-совместимый).
// Если нужные env-переменные не заданы — клиент null, методы возвращают null.
// =====================================================

let _client: S3Client | null = null;

export function getS3Client(): S3Client | null {
  if (_client) return _client;
  if (
    !config.AWS_REGION ||
    !config.AWS_ACCESS_KEY_ID ||
    !config.AWS_SECRET_ACCESS_KEY ||
    !config.AWS_S3_ENDPOINT
  ) {
    return null;
  }
  _client = new S3Client({
    region: config.AWS_REGION,
    endpoint: config.AWS_S3_ENDPOINT,
    forcePathStyle: config.AWS_S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

export interface UploadResult {
  key: string;
  url: string;
}

/**
 * Загружает байты в S3 и возвращает публичный URL.
 * Если S3 не сконфигурён — возвращает null.
 */
export async function uploadToS3(
  buffer: Buffer,
  contentType: string,
  prefix = 'receipts',
): Promise<UploadResult | null> {
  const client = getS3Client();
  if (!client || !config.AWS_S3_BUCKET) return null;

  const ext = inferExt(contentType);
  const key = `${prefix}/${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket: config.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // публичное чтение — для канала и админов
      ACL: 'public-read',
    }),
  );

  const base = (config.AWS_S3_PUBLIC_BASE ?? `${config.AWS_S3_ENDPOINT}/${config.AWS_S3_BUCKET}`).replace(
    /\/$/,
    '',
  );
  return { key, url: `${base}/${key}` };
}

function inferExt(ct: string): string {
  const t = ct.toLowerCase();
  if (t.includes('jpeg') || t.includes('jpg')) return '.jpg';
  if (t.includes('png')) return '.png';
  if (t.includes('webp')) return '.webp';
  if (t.includes('gif')) return '.gif';
  if (t.includes('pdf')) return '.pdf';
  return '';
}
