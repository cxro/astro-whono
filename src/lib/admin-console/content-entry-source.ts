import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { access, open, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import {
  contentSourceEntryIdToPublicEntryId,
  flattenEntryIdToSlug
} from '../../utils/slug-rules';
import {
  parseMarkdownFrontmatterDocument,
  splitMarkdownFrontmatter
} from './frontmatter';
import {
  getAdminContentCollectionCapability,
  getAdminContentFixedPageCapability,
  type AdminContentCollectionKey
} from './content-collections';
import { isRecord } from './content-entry-utils';

export type AdminContentEntryResolutionErrorCode = 'invalid-entry-id' | 'source-not-found';

export class AdminContentEntryResolutionError extends Error {
  readonly code: AdminContentEntryResolutionErrorCode;

  constructor(code: AdminContentEntryResolutionErrorCode, message: string) {
    super(message);
    this.name = 'AdminContentEntryResolutionError';
    this.code = code;
  }
}

type FrontmatterTextReadResult =
  | { status: 'done'; frontmatterText: string | null }
  | { status: 'none' }
  | { status: 'pending' };

export type AdminContentSourceState = {
  collection: AdminContentCollectionKey;
  entryId: string;
  publicEntryId: string;
  defaultPublicSlug: string;
  sourcePath: string;
  relativePath: string;
  revision: string;
  sourceText: string;
  bodyText: string;
  frontmatterDocument: ReturnType<typeof parseMarkdownFrontmatterDocument>;
  rawFrontmatter: Record<string, unknown>;
};

const getProjectRoot = (): string => process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT?.trim() || process.cwd();
const getContentRoot = (): string => path.join(getProjectRoot(), 'src', 'content');
const getCollectionRoot = (collection: AdminContentCollectionKey): string => path.join(getContentRoot(), collection);

export const toAdminContentAbsoluteProjectPath = (filePath: string): string =>
  path.isAbsolute(filePath)
    ? filePath
    : path.join(getProjectRoot(), ...filePath.replace(/\\/g, '/').split('/').filter(Boolean));

export const toAdminContentRelativeProjectPath = (filePath: string): string =>
  path.relative(getProjectRoot(), toAdminContentAbsoluteProjectPath(filePath)).replace(/\\/g, '/');

const hashSourceText = (sourceText: string): string =>
  createHash('sha1').update(sourceText).digest('hex');

const FRONTMATTER_READ_CHUNK_SIZE = 4096;
const FRONTMATTER_OPENING_MARKERS = ['---\n', '---\r\n'] as const;
const CANONICAL_MARKDOWN_SOURCE_EXT_RE = /\.md$/i;
const LEGACY_MARKDOWN_SOURCE_EXT_RE = /\.(?:md|mdx)$/i;

const trimFrontmatterLineEnding = (value: string): string =>
  value.endsWith('\r') ? value.slice(0, -1) : value;

const parseFrontmatterTextFromPrefix = (
  sourcePrefix: string,
  reachedEof: boolean
): FrontmatterTextReadResult => {
  const openingMarker = FRONTMATTER_OPENING_MARKERS.find((marker) => sourcePrefix.startsWith(marker));

  if (!openingMarker) {
    const mayStillBeOpeningMarker = FRONTMATTER_OPENING_MARKERS.some((marker) => marker.startsWith(sourcePrefix));
    if (!reachedEof && mayStillBeOpeningMarker) return { status: 'pending' };
    if (reachedEof && sourcePrefix === '---') {
      throw new Error('Markdown frontmatter 缺少关闭标记');
    }
    return { status: 'none' };
  }

  let index = openingMarker.length;

  while (index <= sourcePrefix.length) {
    const lineEnd = sourcePrefix.indexOf('\n', index);
    const sliceEnd = lineEnd === -1 ? sourcePrefix.length : lineEnd;
    const line = trimFrontmatterLineEnding(sourcePrefix.slice(index, sliceEnd));

    if (lineEnd !== -1 && (line === '---' || line === '...')) {
      return {
        status: 'done',
        frontmatterText: sourcePrefix.slice(openingMarker.length, index)
      };
    }

    if (lineEnd === -1) {
      if (reachedEof && (line === '---' || line === '...')) {
        return {
          status: 'done',
          frontmatterText: sourcePrefix.slice(openingMarker.length, index)
        };
      }
      if (reachedEof) {
        throw new Error('Markdown frontmatter 缺少关闭标记');
      }
      return { status: 'pending' };
    }

    index = lineEnd + 1;
  }

  if (reachedEof) {
    throw new Error('Markdown frontmatter 缺少关闭标记');
  }
  return { status: 'pending' };
};

const readMarkdownFrontmatterText = async (filePath: string): Promise<string | null> => {
  const file = await open(filePath, 'r');
  const decoder = new StringDecoder('utf8');
  const buffer = Buffer.alloc(FRONTMATTER_READ_CHUNK_SIZE);
  let sourcePrefix = '';

  try {
    while (true) {
      const { bytesRead } = await file.read(buffer, 0, buffer.length, null);
      const reachedEof = bytesRead === 0;
      sourcePrefix += reachedEof ? decoder.end() : decoder.write(buffer.subarray(0, bytesRead));

      const result = parseFrontmatterTextFromPrefix(sourcePrefix, reachedEof);
      if (result.status === 'done') return result.frontmatterText;
      if (result.status === 'none') return null;
      if (reachedEof) return null;
    }
  } finally {
    await file.close();
  }
};

const parseFrontmatterRecord = (frontmatterText: string | null): Record<string, unknown> => {
  const document = parseMarkdownFrontmatterDocument(frontmatterText);
  const rawFrontmatter = document.toJS();
  return isRecord(rawFrontmatter) ? rawFrontmatter : {};
};

const normalizeEntryId = (entryId: string): string => {
  const normalized = entryId.trim().replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('//')) {
    throw new AdminContentEntryResolutionError('invalid-entry-id', `不支持的 content entryId：${entryId}`);
  }

  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new AdminContentEntryResolutionError('invalid-entry-id', `不支持的 content entryId：${entryId}`);
  }

  return normalized;
};

export const getAdminContentEntrySourcePathCandidates = (
  collection: AdminContentCollectionKey,
  entryId: string
): string[] => {
  const normalizedEntryId = normalizeEntryId(entryId);
  const fixedPage = getAdminContentFixedPageCapability(collection);
  if (fixedPage) {
    if (normalizedEntryId !== fixedPage.entryId) {
      throw new AdminContentEntryResolutionError(
        'invalid-entry-id',
        `${collection} 仅支持固定源文件：${fixedPage.sourcePath}`
      );
    }
    return [toAdminContentAbsoluteProjectPath(fixedPage.sourcePath)];
  }

  const basePath = path.join(getContentRoot(), collection, ...normalizedEntryId.split('/'));
  return CANONICAL_MARKDOWN_SOURCE_EXT_RE.test(normalizedEntryId)
    ? [basePath]
    : [`${basePath}.md`, path.join(basePath, 'index.md')];
};

export const resolveAdminContentEntrySourcePath = (
  collection: AdminContentCollectionKey,
  entryId: string
): string => {
  const normalizedEntryId = normalizeEntryId(entryId);
  const candidates = getAdminContentEntrySourcePathCandidates(collection, normalizedEntryId);
  const fixedPage = getAdminContentFixedPageCapability(collection);
  const resolved = candidates.find((candidate) => existsSync(candidate));

  if (fixedPage) {
    if (resolved) return resolved;
    throw new AdminContentEntryResolutionError(
      'source-not-found',
      `${collection} 固定源文件不存在：${fixedPage.sourcePath}`
    );
  }

  if (!resolved) {
    throw new AdminContentEntryResolutionError(
      'source-not-found',
      `未找到 content 源文件：${collection}/${normalizedEntryId}`
    );
  }

  return resolved;
};

export const resolveAdminContentEntryLegacySourcePath = (
  collection: AdminContentCollectionKey,
  entryId: string
): string => {
  const normalizedEntryId = normalizeEntryId(entryId);
  if (getAdminContentFixedPageCapability(collection)) {
    return resolveAdminContentEntrySourcePath(collection, normalizedEntryId);
  }

  const basePath = path.join(getContentRoot(), collection, ...normalizedEntryId.split('/'));
  const candidates = LEGACY_MARKDOWN_SOURCE_EXT_RE.test(normalizedEntryId)
    ? [basePath]
    : [`${basePath}.md`, path.join(basePath, 'index.md'), `${basePath}.mdx`, path.join(basePath, 'index.mdx')];
  const resolved = candidates.find((candidate) => existsSync(candidate));
  if (!resolved) {
    throw new AdminContentEntryResolutionError(
      'source-not-found',
      `未找到 content 源文件：${collection}/${normalizedEntryId}`
    );
  }

  return resolved;
};

export const resolveAdminContentEntryIdFromSourcePath = (
  collection: AdminContentCollectionKey,
  filePath: string
): string => {
  const absoluteFilePath = toAdminContentAbsoluteProjectPath(filePath);
  const relative = path.relative(getCollectionRoot(collection), absoluteFilePath).replace(/\\/g, '/');
  if (relative.startsWith('../') || relative === '..' || path.isAbsolute(relative)) {
    throw new AdminContentEntryResolutionError(
      'invalid-entry-id',
      `content 源文件不在 ${collection} 集合目录下：${toAdminContentRelativeProjectPath(absoluteFilePath)}`
    );
  }
  if (relative.endsWith('/index.md')) {
    return relative.slice(0, -'/index.md'.length);
  }
  if (relative.endsWith('/index.mdx')) {
    return relative.slice(0, -'/index.mdx'.length);
  }
  return relative.replace(/\.(md|mdx)$/i, '');
};

export const listAdminCollectionSourceFiles = async (
  collection: AdminContentCollectionKey
): Promise<string[]> => {
  const root = getCollectionRoot(collection);
  if (!existsSync(root)) return [];

  const fixedPage = getAdminContentFixedPageCapability(collection);
  if (fixedPage) {
    const candidates = [toAdminContentAbsoluteProjectPath(fixedPage.sourcePath)];
    const files: string[] = [];
    for (const filePath of candidates) {
      try {
        await access(filePath);
        files.push(filePath);
      } catch {
        // 固定页面源不存在时保持空 manifest。
      }
    }
    return files;
  }

  const walk = async (dirPath: string): Promise<string[]> => {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          return walk(fullPath);
        }
        return entry.isFile() && CANONICAL_MARKDOWN_SOURCE_EXT_RE.test(entry.name) ? [fullPath] : [];
      })
    );
    return nested.flat();
  };

  return walk(root);
};

export const readAdminSourceFrontmatterRecord = async (
  filePath: string
): Promise<Record<string, unknown>> => {
  const frontmatterText = await readMarkdownFrontmatterText(filePath);
  return parseFrontmatterRecord(frontmatterText);
};

const resolveDefaultPublicEntryId = (sourceEntryId: string): string => {
  const publicEntryId = contentSourceEntryIdToPublicEntryId(sourceEntryId);
  return publicEntryId || sourceEntryId;
};

export const loadAdminContentSourceState = async (
  collection: AdminContentCollectionKey,
  entryId: string
): Promise<AdminContentSourceState> => {
  const sourcePath = resolveAdminContentEntrySourcePath(collection, entryId);
  // 以实际源文件路径回算 entryId，避免把公开 id 当作磁盘文件名使用。
  const sourceEntryId = resolveAdminContentEntryIdFromSourcePath(collection, sourcePath);
  const publicEntryId = resolveDefaultPublicEntryId(sourceEntryId);
  const sourceText = await readFile(sourcePath, 'utf8');
  const section = splitMarkdownFrontmatter(sourceText);
  const frontmatterDocument = parseMarkdownFrontmatterDocument(section.frontmatterText);
  const rawFrontmatter = frontmatterDocument.toJS();

  return {
    collection,
    entryId: sourceEntryId,
    publicEntryId,
    defaultPublicSlug: flattenEntryIdToSlug(publicEntryId),
    sourcePath,
    relativePath: toAdminContentRelativeProjectPath(sourcePath),
    revision: hashSourceText(sourceText),
    sourceText,
    bodyText: section.bodyText,
    frontmatterDocument,
    rawFrontmatter: isRecord(rawFrontmatter) ? rawFrontmatter : {}
  };
};

export const getAdminContentReadOnlyReason = (collection: AdminContentCollectionKey): string | null =>
  getAdminContentCollectionCapability(collection).readonlyReason;
