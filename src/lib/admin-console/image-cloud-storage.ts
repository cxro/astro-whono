import { createHash, createHmac, randomUUID } from 'node:crypto';
import path from 'node:path';
import { AdminImageUploadError } from './image-upload-error';

type AdminImageCloudUploadInput = {
  collection: 'essay' | 'bits' | 'memo';
  entryId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string | null;
};

type AdminImageCloudStorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  prefix: string;
};

type AdminImageCloudUploadResult = {
  url: string;
  key: string;
};

export type AdminImageCloudListItem = {
  key: string;
  url: string;
  fileName: string;
  size: number | null;
  mimeType: string | null;
  lastModified: string | null;
};

const AWS_SERVICE = 's3';
const SHA256_EMPTY_PAYLOAD = 'UNSIGNED-PAYLOAD';
const XML_TEXT_ENTITY_RE = /&(amp|lt|gt|quot|apos);/g;

const MIME_BY_EXT: Record<string, string> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, '');

const normalizeCloudPrefix = (value: string | undefined): string => trimSlashes(value?.trim() ?? '');

const encodeS3PathSegment = (segment: string): string =>
  encodeURIComponent(segment).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );

const encodeS3Path = (value: string): string =>
  value.split('/').map(encodeS3PathSegment).join('/');

const encodeS3Query = (value: string): string =>
  encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );

const toSafeKeyPart = (value: string): string =>
  value
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .map((segment) =>
      segment
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
    )
    .filter(Boolean)
    .join('/');

const hmac = (key: Buffer | string, value: string): Buffer =>
  createHmac('sha256', key).update(value).digest();

const hashHex = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

const toAmzDate = (date: Date): { amzDate: string; dateStamp: string } => {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8)
  };
};

const getSigningKey = (
  secretAccessKey: string,
  dateStamp: string,
  region: string
): Buffer => {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const dateRegionKey = hmac(dateKey, region);
  const dateRegionServiceKey = hmac(dateRegionKey, AWS_SERVICE);
  return hmac(dateRegionServiceKey, 'aws4_request');
};

const readImportMetaEnv = (key: string): string => {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return env?.[key]?.trim() ?? '';
};

const readEnv = (key: string): string => readImportMetaEnv(key) || process.env[key]?.trim() || '';

export const isAdminImageCloudStorageEnabled = (): boolean =>
  readEnv('ASTRO_WHONO_IMAGE_STORAGE').toLowerCase() === 's3';

const getAdminImageCloudStorageConfig = (): AdminImageCloudStorageConfig => {
  const config = {
    endpoint: readEnv('ASTRO_WHONO_S3_ENDPOINT'),
    region: readEnv('ASTRO_WHONO_S3_REGION') || 'auto',
    bucket: readEnv('ASTRO_WHONO_S3_BUCKET'),
    accessKeyId: readEnv('ASTRO_WHONO_S3_ACCESS_KEY_ID'),
    secretAccessKey: readEnv('ASTRO_WHONO_S3_SECRET_ACCESS_KEY'),
    publicBaseUrl: readEnv('ASTRO_WHONO_S3_PUBLIC_BASE_URL'),
    prefix: normalizeCloudPrefix(readEnv('ASTRO_WHONO_S3_PREFIX'))
  };

  const missing = Object.entries(config)
    .filter(([key, value]) => key !== 'prefix' && !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new AdminImageUploadError(`云端图片存储配置缺失：${missing.join(', ')}`, 500);
  }

  return config;
};

const getMimeTypeFromFileName = (fileName: string): string | null =>
  MIME_BY_EXT[path.extname(fileName).toLowerCase()] ?? null;

const createCloudObjectKey = ({
  collection,
  entryId,
  fileName
}: Pick<AdminImageCloudUploadInput, 'collection' | 'entryId' | 'fileName'>): string => {
  const extension = path.extname(fileName).toLowerCase();
  const baseName = path.basename(fileName, extension);
  const entryPart = toSafeKeyPart(entryId) || 'entry';
  const uniqueName = `${baseName}-${randomUUID()}${extension}`;
  return [collection, entryPart, uniqueName].map(trimSlashes).filter(Boolean).join('/');
};

const createPublicUrl = (publicBaseUrl: string, key: string): string => {
  const baseUrl = publicBaseUrl.replace(/\/+$/, '');
  return `${baseUrl}/${encodeS3Path(key)}`;
};

const createAuthorizationHeader = ({
  method,
  pathname,
  query,
  headers,
  config,
  date
}: {
  method: 'DELETE' | 'GET' | 'PUT';
  pathname: string;
  query: string;
  headers: Record<string, string>;
  config: Pick<AdminImageCloudStorageConfig, 'accessKeyId' | 'secretAccessKey' | 'region'>;
  date: Date;
}): string => {
  const { amzDate, dateStamp } = toAmzDate(date);
  const credentialScope = `${dateStamp}/${config.region}/${AWS_SERVICE}/aws4_request`;
  headers['x-amz-date'] = amzDate;

  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((header) => `${header}:${headers[header]}\n`)
    .join('');
  const canonicalRequest = [
    method,
    pathname,
    query,
    canonicalHeaders,
    signedHeaders,
    headers['x-amz-content-sha256'] ?? SHA256_EMPTY_PAYLOAD
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hashHex(canonicalRequest)
  ].join('\n');
  const signature = createHmac('sha256', getSigningKey(config.secretAccessKey, dateStamp, config.region))
    .update(stringToSign)
    .digest('hex');

  return [
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(', ');
};

const decodeXmlText = (value: string): string =>
  value.replace(XML_TEXT_ENTITY_RE, (_match, entity: string) => {
    if (entity === 'amp') return '&';
    if (entity === 'lt') return '<';
    if (entity === 'gt') return '>';
    if (entity === 'quot') return '"';
    return "'";
  });

const getXmlTagText = (source: string, tagName: string): string | null => {
  const match = source.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`));
  return match?.[1] ? decodeXmlText(match[1]) : null;
};

const parseCloudImageListEntryXml = (
  source: string,
  publicBaseUrl: string
): AdminImageCloudListItem | null => {
  const key = getXmlTagText(source, 'Key') ?? '';
  if (!key || key.endsWith('/')) return null;
  const fileName = path.posix.basename(key);
  const mimeType = getMimeTypeFromFileName(fileName);
  if (!mimeType) return null;
  const rawSize = Number.parseInt(getXmlTagText(source, 'Size') ?? '', 10);

  return {
    key,
    url: createPublicUrl(publicBaseUrl, key),
    fileName,
    size: Number.isFinite(rawSize) && rawSize >= 0 ? rawSize : null,
    mimeType,
    lastModified: getXmlTagText(source, 'LastModified')
  };
};

const parseCloudImageListXml = (xml: string, publicBaseUrl: string): AdminImageCloudListItem[] =>
  Array.from(xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g), (match) =>
    parseCloudImageListEntryXml(match[1] ?? '', publicBaseUrl)
  ).filter((item): item is AdminImageCloudListItem => item !== null);

export const uploadAdminImageToCloudStorage = async (
  input: AdminImageCloudUploadInput
): Promise<AdminImageCloudUploadResult> => {
  const config = getAdminImageCloudStorageConfig();
  const objectKey = [config.prefix, createCloudObjectKey(input)].filter(Boolean).join('/');
  const endpoint = new URL(config.endpoint);
  const canonicalUri = `/${encodeS3Path(config.bucket)}/${encodeS3Path(objectKey)}`;
  const uploadUrl = new URL(canonicalUri, `${endpoint.protocol}//${endpoint.host}`);
  const contentType = input.mimeType || 'application/octet-stream';
  const headers = {
    'content-type': contentType,
    host: uploadUrl.host,
    'x-amz-content-sha256': SHA256_EMPTY_PAYLOAD,
    'x-amz-date': ''
  };
  const authorization = createAuthorizationHeader({
    method: 'PUT',
    pathname: uploadUrl.pathname,
    query: '',
    headers,
    config,
    date: new Date()
  });

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      ...headers,
      authorization
    },
    body: new Uint8Array(input.buffer)
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    throw new AdminImageUploadError(
      `云端图片上传失败：${response.status}${responseText ? ` ${responseText.slice(0, 160)}` : ''}`,
      502
    );
  }

  return {
    key: objectKey,
    url: createPublicUrl(config.publicBaseUrl, objectKey)
  };
};

export const listAdminCloudStorageImages = async (): Promise<AdminImageCloudListItem[]> => {
  if (!isAdminImageCloudStorageEnabled()) return [];

  const config = getAdminImageCloudStorageConfig();
  const endpoint = new URL(config.endpoint);
  const listUrl = new URL(`/${encodeS3Path(config.bucket)}`, `${endpoint.protocol}//${endpoint.host}`);
  const queryParams = new URLSearchParams({
    'list-type': '2',
    'max-keys': '1000'
  });
  if (config.prefix) {
    queryParams.set('prefix', `${config.prefix}/`);
  }
  const query = Array.from(queryParams.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeS3Query(key)}=${encodeS3Query(value)}`)
    .join('&');
  listUrl.search = query;

  const headers = {
    host: listUrl.host,
    'x-amz-content-sha256': SHA256_EMPTY_PAYLOAD,
    'x-amz-date': ''
  };
  const authorization = createAuthorizationHeader({
    method: 'GET',
    pathname: listUrl.pathname,
    query,
    headers,
    config,
    date: new Date()
  });

  const response = await fetch(listUrl, {
    method: 'GET',
    headers: {
      ...headers,
      authorization
    }
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    throw new AdminImageUploadError(
      `云端图片列表读取失败：${response.status}${responseText ? ` ${responseText.slice(0, 160)}` : ''}`,
      502
    );
  }

  return parseCloudImageListXml(await response.text(), config.publicBaseUrl);
};

export const deleteAdminCloudStorageImage = async (key: string): Promise<void> => {
  const normalizedKey = key.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalizedKey || normalizedKey.endsWith('/') || /(^|\/)\.\.(?:\/|$)/.test(normalizedKey)) {
    throw new AdminImageUploadError('云端图片 key 非法，无法删除');
  }

  const config = getAdminImageCloudStorageConfig();
  const endpoint = new URL(config.endpoint);
  const deleteUrl = new URL(
    `/${encodeS3Path(config.bucket)}/${encodeS3Path(normalizedKey)}`,
    `${endpoint.protocol}//${endpoint.host}`
  );
  const headers = {
    host: deleteUrl.host,
    'x-amz-content-sha256': SHA256_EMPTY_PAYLOAD,
    'x-amz-date': ''
  };
  const authorization = createAuthorizationHeader({
    method: 'DELETE',
    pathname: deleteUrl.pathname,
    query: '',
    headers,
    config,
    date: new Date()
  });

  const response = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      ...headers,
      authorization
    }
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    throw new AdminImageUploadError(
      `云端图片删除失败：${response.status}${responseText ? ` ${responseText.slice(0, 160)}` : ''}`,
      502
    );
  }
};
