import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  resolveAdminContentEntrySourcePath,
  type AdminContentCollectionKey
} from './content-shared';

export type AdminContentSourceDownload = {
  collection: AdminContentCollectionKey;
  entryId: string;
  sourcePath: string;
  relativePath: string;
  fileName: string;
  contentType: string;
  sourceText: string;
};

const getProjectRoot = (): string => process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT?.trim() || process.cwd();

const toRelativeProjectPath = (filePath: string): string =>
  path.relative(getProjectRoot(), filePath).replace(/\\/g, '/');

const getContentSourceContentType = (fileName: string): string =>
  fileName.toLowerCase().endsWith('.mdx')
    ? 'text/plain; charset=utf-8'
    : 'text/markdown; charset=utf-8';

const toAsciiHeaderFileName = (value: string): string => {
  const normalized = value
    .replace(/["\\]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_')
    .trim();
  return normalized || 'content.md';
};

const encodeContentDispositionFileName = (value: string): string =>
  encodeURIComponent(value).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );

const getEntryDownloadStem = (collection: AdminContentCollectionKey, entryId: string): string => {
  const normalizedEntryId = entryId.trim().replace(/\\/g, '/').replace(/\/+$/, '');
  const segments = normalizedEntryId.split('/').filter(Boolean);
  const lastSegment = segments.at(-1) ?? '';
  return collection === 'memo' && lastSegment.toLowerCase() === 'index'
    ? collection
    : lastSegment || collection;
};

export const getAdminContentSourceDownloadName = (
  collection: AdminContentCollectionKey,
  entryId: string,
  sourcePath: string
): string => {
  const sourceFileName = path.basename(sourcePath);
  const parsed = path.parse(sourceFileName);
  // 目录型条目磁盘上使用 index.md；下载时按条目末段命名，memo 单页保持 memo.md。
  return parsed.name.toLowerCase() === 'index'
    ? `${getEntryDownloadStem(collection, entryId)}${parsed.ext.toLowerCase()}`
    : sourceFileName;
};

export const createAdminContentSourceDownloadHeaders = (
  fileName: string,
  contentType: string
): HeadersInit => ({
  'content-type': contentType,
  'cache-control': 'no-store',
  // filename 作为 ASCII 兜底；真实文件名保留在 filename*。
  'content-disposition': `attachment; filename="${toAsciiHeaderFileName(fileName)}"; filename*=UTF-8''${encodeContentDispositionFileName(fileName)}`
});

export const readAdminContentSourceDownload = async (
  collection: AdminContentCollectionKey,
  entryId: string
): Promise<AdminContentSourceDownload> => {
  const sourcePath = resolveAdminContentEntrySourcePath(collection, entryId);
  const fileName = getAdminContentSourceDownloadName(collection, entryId, sourcePath);
  const sourceText = await readFile(sourcePath, 'utf8');

  return {
    collection,
    entryId,
    sourcePath,
    relativePath: toRelativeProjectPath(sourcePath),
    fileName,
    contentType: getContentSourceContentType(fileName),
    sourceText
  };
};
