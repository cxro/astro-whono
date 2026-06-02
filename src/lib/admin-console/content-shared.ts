import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { open, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { normalizeBitsAvatarPath } from '../../utils/format';
import {
  parseEssayDateInput,
  parseEssayPublishedAtInput
} from '../../utils/date-only';
import { normalizeAdminBitsImageSource } from './image-shared';
import {
  ESSAY_PUBLIC_SLUG_RE,
  RESERVED_ESSAY_SLUGS,
  contentSourceEntryIdToPublicEntryId,
  flattenEntryIdToSlug
} from '../../utils/slug-rules';
import {
  parseMarkdownFrontmatterDocument,
  patchMarkdownFrontmatter,
  replaceMarkdownBody,
  type FrontmatterPatch,
  splitMarkdownFrontmatter
} from './frontmatter';
import { findMissingEssayLocalImageReferences } from './essay-image-references';
import type {
  AdminContentCollectionKey
} from './content-collections';

export {
  ADMIN_CONTENT_COLLECTION_KEYS,
  ADMIN_CONTENT_WRITE_COLLECTION_KEYS,
  isAdminContentCollectionKey,
  isAdminContentWriteCollectionKey
} from './content-collections';
export type {
  AdminContentCollectionKey,
  AdminContentWriteCollectionKey
} from './content-collections';

export type AdminContentEntryResolutionErrorCode = 'invalid-entry-id' | 'source-not-found';

export class AdminContentEntryResolutionError extends Error {
  readonly code: AdminContentEntryResolutionErrorCode;

  constructor(code: AdminContentEntryResolutionErrorCode, message: string) {
    super(message);
    this.name = 'AdminContentEntryResolutionError';
    this.code = code;
  }
}

export type AdminContentValidationIssue = {
  path: string;
  message: string;
};

type FrontmatterTextReadResult =
  | { status: 'done'; frontmatterText: string | null }
  | { status: 'none' }
  | { status: 'pending' };

export type AdminEssayEditorValues = {
  title: string;
  description: string;
  date: string;
  publishedAt: string;
  tagsText: string;
  draft: boolean;
  archive: boolean;
  slug: string;
  cover: string;
  badge: string;
};

export type AdminBitsEditorValues = {
  title: string;
  description: string;
  date: string;
  tagsText: string;
  draft: boolean;
  authorName: string;
  authorAvatar: string;
  imagesText: string;
};

export type AdminMemoEditorValues = {
  title: string;
  subtitle: string;
  date: string;
  draft: boolean;
  slug: string;
};

export type AdminContentEditorValues =
  | AdminEssayEditorValues
  | AdminBitsEditorValues
  | AdminMemoEditorValues;

export type AdminEssayEditorPayload = {
  collection: 'essay';
  entryId: string;
  publicEntryId: string;
  defaultPublicSlug: string;
  revision: string;
  relativePath: string;
  writable: true;
  readonlyReason: null;
  bodyText: string;
  values: AdminEssayEditorValues;
};

export type AdminBitsEditorPayload = {
  collection: 'bits';
  entryId: string;
  publicEntryId: string;
  defaultPublicSlug: string;
  revision: string;
  relativePath: string;
  writable: true;
  readonlyReason: null;
  bodyText: string;
  values: AdminBitsEditorValues;
};

export type AdminMemoEditorPayload = {
  collection: 'memo';
  entryId: string;
  publicEntryId: string;
  defaultPublicSlug: string;
  revision: string;
  relativePath: string;
  writable: false;
  readonlyReason: string;
  values: AdminMemoEditorValues;
};

export type AdminContentEditorPayload =
  | AdminEssayEditorPayload
  | AdminBitsEditorPayload
  | AdminMemoEditorPayload;

type AdminEssayFrontmatter = {
  title: string;
  description?: string;
  date: string;
  publishedAt?: string;
  tags: string[];
  draft: boolean;
  archive: boolean;
  slug?: string;
  cover?: string;
  badge?: string;
};

type AdminEssayPublishedAtInputMode = 'missing' | 'present';

type AdminBitsImage = {
  src: string;
  width?: number;
  height?: number;
  alt?: string;
};

type AdminBitsFrontmatter = {
  title?: string;
  description?: string;
  date: string;
  tags: string[];
  draft: boolean;
  author?: {
    name?: string;
    avatar?: string;
  };
  images?: AdminBitsImage[];
};

type AdminContentSourceState = {
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

type AdminWritePlan = {
  issues: AdminContentValidationIssue[];
  changedFields: string[];
  patches: FrontmatterPatch[];
  bodyText?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const normalizeOptionalText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const createIssue = (path: string, message: string): AdminContentValidationIssue => ({
  path,
  message
});

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

export const resolveAdminContentEntrySourcePath = (
  collection: AdminContentCollectionKey,
  entryId: string
): string => {
  const normalizedEntryId = normalizeEntryId(entryId);
  const basePath = path.join(getContentRoot(), collection, ...normalizedEntryId.split('/'));
  const candidates = normalizedEntryId.endsWith('.md') || normalizedEntryId.endsWith('.mdx')
    ? [basePath]
    : [`${basePath}.md`, `${basePath}.mdx`, path.join(basePath, 'index.md'), path.join(basePath, 'index.mdx')];
  const resolved = candidates.find((candidate) => existsSync(candidate));
  if (!resolved) {
    throw new AdminContentEntryResolutionError(
      'source-not-found',
      `未找到 content 源文件：${collection}/${normalizedEntryId}`
    );
  }

  return resolved;
};

const toRelativeProjectPath = (filePath: string): string =>
  toAdminContentRelativeProjectPath(filePath);

const getStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
    : [];

const getDateString = (frontmatter: Record<string, unknown>, key: string, fallback: string): string => {
  const value = frontmatter[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
};

const getRequiredStringField = (
  input: Record<string, unknown>,
  field: string,
  issues: AdminContentValidationIssue[]
): string => {
  const value = input[field];
  if (typeof value === 'string') return value;
  issues.push(createIssue(field, `frontmatter.${field} 必须是字符串`));
  return '';
};

const getRequiredBooleanField = (
  input: Record<string, unknown>,
  field: string,
  issues: AdminContentValidationIssue[]
): boolean => {
  const value = input[field];
  if (typeof value === 'boolean') return value;
  issues.push(createIssue(field, `frontmatter.${field} 必须是布尔值`));
  return false;
};

const parseTagsText = (value: string): string[] =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;

const parseOptionalPositiveInteger = (value: unknown): number | undefined => {
  if (value == null) {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value !== 'string') {
    return Number.NaN;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return POSITIVE_INTEGER_PATTERN.test(trimmed) ? Number(trimmed) : Number.NaN;
};

const isPositiveInteger = (value: number | undefined): boolean =>
  value === undefined || (Number.isInteger(value) && value > 0);

const parseAdminEssayEditorInput = (
  input: unknown
): {
  values?: AdminEssayEditorValues;
  publishedAtInputMode: AdminEssayPublishedAtInputMode;
  issues: AdminContentValidationIssue[];
} => {
  if (!isRecord(input)) {
    return {
      publishedAtInputMode: 'missing',
      issues: [createIssue('frontmatter', 'frontmatter 必须是对象')]
    };
  }

  const issues: AdminContentValidationIssue[] = [];
  const rawPublishedAtInput = input.publishedAt;
  const hasPublishedAtInput = Object.prototype.hasOwnProperty.call(input, 'publishedAt')
    && typeof rawPublishedAtInput === 'string';
  const values: AdminEssayEditorValues = {
    title: getRequiredStringField(input, 'title', issues),
    description: getRequiredStringField(input, 'description', issues),
    date: getRequiredStringField(input, 'date', issues),
    publishedAt: hasPublishedAtInput ? rawPublishedAtInput : '',
    tagsText: getRequiredStringField(input, 'tagsText', issues),
    draft: getRequiredBooleanField(input, 'draft', issues),
    archive: getRequiredBooleanField(input, 'archive', issues),
    slug: getRequiredStringField(input, 'slug', issues),
    cover: getRequiredStringField(input, 'cover', issues),
    badge: getRequiredStringField(input, 'badge', issues)
  };

  return issues.length > 0
    ? { publishedAtInputMode: hasPublishedAtInput ? 'present' : 'missing', issues }
    : { values, publishedAtInputMode: hasPublishedAtInput ? 'present' : 'missing', issues };
};

const parseAdminBitsEditorInput = (
  input: unknown
): { values?: AdminBitsEditorValues; issues: AdminContentValidationIssue[] } => {
  if (!isRecord(input)) {
    return {
      issues: [createIssue('frontmatter', 'frontmatter 必须是对象')]
    };
  }

  const issues: AdminContentValidationIssue[] = [];
  const values: AdminBitsEditorValues = {
    title: getRequiredStringField(input, 'title', issues),
    description: getRequiredStringField(input, 'description', issues),
    date: getRequiredStringField(input, 'date', issues),
    tagsText: getRequiredStringField(input, 'tagsText', issues),
    draft: getRequiredBooleanField(input, 'draft', issues),
    authorName: getRequiredStringField(input, 'authorName', issues),
    authorAvatar: getRequiredStringField(input, 'authorAvatar', issues),
    imagesText: getRequiredStringField(input, 'imagesText', issues)
  };

  return issues.length > 0 ? { issues } : { values, issues };
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
      `content 源文件不在 ${collection} 集合目录下：${toRelativeProjectPath(absoluteFilePath)}`
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

  const walk = async (dirPath: string): Promise<string[]> => {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          return walk(fullPath);
        }
        return entry.isFile() && /\.(md|mdx)$/i.test(entry.name) ? [fullPath] : [];
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

const resolveEssayPublicSlug = (publicEntryId: string, explicitSlug?: string): string =>
  explicitSlug && explicitSlug.trim().length > 0
    ? explicitSlug.trim()
    : flattenEntryIdToSlug(publicEntryId);

const validateEssayPublicSlug = async (
  state: Pick<AdminContentSourceState, 'entryId' | 'publicEntryId'>,
  frontmatter: Pick<AdminEssayFrontmatter, 'slug'>
): Promise<AdminContentValidationIssue[]> => {
  const issues: AdminContentValidationIssue[] = [];
  const publicSlug = resolveEssayPublicSlug(state.publicEntryId, frontmatter.slug);

  if (!ESSAY_PUBLIC_SLUG_RE.test(publicSlug)) {
    issues.push(
      createIssue(
        'slug',
        frontmatter.slug
          ? 'essay.slug 必须是小写 kebab-case'
          : '当前条目路径拍平后的公开 slug 不合法，请设置合法 slug 或调整文件路径'
      )
    );
  }

  if (RESERVED_ESSAY_SLUGS.has(publicSlug)) {
    issues.push(
      createIssue(
        'slug',
        `公开 slug "${publicSlug}" 与 /archive 或 /essay 下的保留路由冲突，请修改 slug`
      )
    );
  }

  if (issues.length > 0) {
    return issues;
  }

  try {
    const essayFiles = await listAdminCollectionSourceFiles('essay');
    for (const filePath of essayFiles) {
      const candidateEntryId = resolveAdminContentEntryIdFromSourcePath('essay', filePath);
      if (candidateEntryId === state.entryId) continue;

      const frontmatterRecord = await readAdminSourceFrontmatterRecord(filePath);
      const candidatePublicEntryId = resolveDefaultPublicEntryId(candidateEntryId);
      const candidateSlug = resolveEssayPublicSlug(candidatePublicEntryId, normalizeOptionalText(frontmatterRecord.slug));
      if (candidateSlug === publicSlug) {
        issues.push(
          createIssue(
            'slug',
            `公开 slug "${publicSlug}" 已被其他 essay 占用：${candidateEntryId}`
          )
        );
        return issues;
      }
    }
  } catch (error) {
    issues.push(
      createIssue(
        'slug',
        `无法完成 essay.slug 唯一性校验：${error instanceof Error ? error.message : 'unknown error'}`
      )
    );
  }

  return issues;
};

const loadAdminContentSourceState = async (
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
    relativePath: toRelativeProjectPath(sourcePath),
    revision: hashSourceText(sourceText),
    sourceText,
    bodyText: section.bodyText,
    frontmatterDocument,
    rawFrontmatter: isRecord(rawFrontmatter) ? rawFrontmatter : {}
  };
};

const toEssayEditorValues = (state: AdminContentSourceState): AdminEssayEditorValues => {
  const frontmatter = state.rawFrontmatter;
  const rawDate = getDateString(frontmatter, 'date', '');
  const rawPublishedAt = normalizeOptionalText(frontmatter.publishedAt);
  const dateResult = parseEssayDateInput(rawDate);

  return {
    title: normalizeOptionalText(frontmatter.title),
    description: normalizeOptionalText(frontmatter.description),
    date: dateResult?.dateText ?? rawDate,
    publishedAt: rawPublishedAt || dateResult?.publishedAtText || '',
    tagsText: getStringArray(frontmatter.tags).join('\n'),
    draft: frontmatter.draft === true,
    archive: frontmatter.archive !== false,
    slug: normalizeOptionalText(frontmatter.slug),
    cover: normalizeOptionalText(frontmatter.cover),
    badge: normalizeOptionalText(frontmatter.badge)
  };
};

const toBitsEditorValues = (state: AdminContentSourceState): AdminBitsEditorValues => {
  const frontmatter = state.rawFrontmatter;
  const author = isRecord(frontmatter.author) ? frontmatter.author : null;

  return {
    title: normalizeOptionalText(frontmatter.title),
    description: normalizeOptionalText(frontmatter.description),
    date: getDateString(frontmatter, 'date', ''),
    tagsText: getStringArray(frontmatter.tags).join('\n'),
    draft: frontmatter.draft === true,
    authorName: normalizeOptionalText(author?.name),
    authorAvatar: normalizeOptionalText(author?.avatar),
    imagesText: Array.isArray(frontmatter.images) ? JSON.stringify(frontmatter.images, null, 2) : ''
  };
};

const toMemoEditorValues = (state: AdminContentSourceState): AdminMemoEditorValues => {
  const frontmatter = state.rawFrontmatter;
  return {
    title: normalizeOptionalText(frontmatter.title),
    subtitle: normalizeOptionalText(frontmatter.subtitle),
    date: normalizeOptionalText(frontmatter.date),
    draft: frontmatter.draft === true,
    slug: normalizeOptionalText(frontmatter.slug)
  };
};

export const getAdminContentReadOnlyReason = (collection: AdminContentCollectionKey): string | null =>
  collection === 'memo'
    ? 'memo 当前保持只读；仅 essay / bits 支持内容写回。memo.date 可选，memo.slug 使用普通字符串，不复用 essay 的 slugRule。'
    : null;

export const readAdminContentEntryEditorPayload = async (
  collection: AdminContentCollectionKey,
  entryId: string
): Promise<AdminContentEditorPayload> => {
  const state = await loadAdminContentSourceState(collection, entryId);

  if (collection === 'essay') {
    return {
      collection,
      entryId: state.entryId,
      publicEntryId: state.publicEntryId,
      defaultPublicSlug: state.defaultPublicSlug,
      revision: state.revision,
      relativePath: state.relativePath,
      writable: true,
      readonlyReason: null,
      bodyText: state.bodyText,
      values: toEssayEditorValues(state)
    };
  }

  if (collection === 'bits') {
    return {
      collection,
      entryId: state.entryId,
      publicEntryId: state.publicEntryId,
      defaultPublicSlug: state.defaultPublicSlug,
      revision: state.revision,
      relativePath: state.relativePath,
      writable: true,
      readonlyReason: null,
      bodyText: state.bodyText,
      values: toBitsEditorValues(state)
    };
  }

  return {
    collection,
    entryId: state.entryId,
    publicEntryId: state.publicEntryId,
    defaultPublicSlug: state.defaultPublicSlug,
    revision: state.revision,
    relativePath: state.relativePath,
    writable: false,
    readonlyReason: getAdminContentReadOnlyReason(collection) ?? '当前 collection 暂不支持写盘',
    values: toMemoEditorValues(state)
  };
};

const buildEssayFrontmatterFromValues = (
  values: AdminEssayEditorValues,
  options: {
    preservedPublishedAt?: string;
  } = {}
): { frontmatter?: AdminEssayFrontmatter; issues: AdminContentValidationIssue[] } => {
  const issues: AdminContentValidationIssue[] = [];
  const title = values.title.trim();
  if (!title) {
    issues.push(createIssue('title', 'title 不能为空'));
  }

  const dateResult = parseEssayDateInput(values.date);
  if (!dateResult) {
    issues.push(createIssue('date', 'essay.date 必须是 YYYY-MM-DD 或带时区的 ISO 8601 日期时间'));
  }

  const explicitPublishedAt = values.publishedAt.trim();
  const hasExplicitPublishedAt = explicitPublishedAt.length > 0;
  const publishedAt = hasExplicitPublishedAt
    ? parseEssayPublishedAtInput(explicitPublishedAt)
    : dateResult?.publishedAt;

  if (hasExplicitPublishedAt && !publishedAt) {
    issues.push(createIssue('publishedAt', 'essay.publishedAt 必须是带时区的 ISO 8601 日期时间'));
  }

  if (!dateResult || issues.length > 0) {
    return { issues };
  }

  const slug = values.slug.trim();
  const date = dateResult.dateText;
  const preservedPublishedAt = normalizeOptionalText(options.preservedPublishedAt);
  const publishedAtText = hasExplicitPublishedAt
    ? explicitPublishedAt
    : dateResult.publishedAtText || preservedPublishedAt;

  return {
    issues,
    frontmatter: {
      title,
      ...(values.description.trim() ? { description: values.description.trim() } : {}),
      date,
      ...(publishedAtText ? { publishedAt: publishedAtText } : {}),
      tags: parseTagsText(values.tagsText),
      draft: values.draft === true,
      archive: values.archive !== false,
      ...(slug ? { slug } : {}),
      ...(values.cover.trim() ? { cover: values.cover.trim() } : {}),
      ...(values.badge.trim() ? { badge: values.badge.trim() } : {})
    }
  };
};

const parseBitsImages = (value: string): { images?: AdminBitsImage[]; issues: AdminContentValidationIssue[] } => {
  const trimmed = value.trim();
  if (!trimmed) {
    return { issues: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      issues: [createIssue('imagesText', 'images 必须是合法 JSON 数组')]
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      issues: [createIssue('imagesText', 'images 必须是 JSON 数组')]
    };
  }

  const issues: AdminContentValidationIssue[] = [];
  const images: AdminBitsImage[] = [];

  parsed.forEach((item, index) => {
    if (!isRecord(item)) {
      issues.push(createIssue(`images[${index}]`, `images[${index}] 必须是对象`));
      return;
    }

    const src = normalizeOptionalText(item.src);
    const normalizedSrc = normalizeAdminBitsImageSource(src);
    if (!normalizedSrc) {
      issues.push(createIssue(`images[${index}].src`, `images[${index}].src 只允许 https:// 远程路径或仓库内相对图片路径`));
    }

    const width = parseOptionalPositiveInteger(item.width);
    const height = parseOptionalPositiveInteger(item.height);
    const hasInvalidWidth = !isPositiveInteger(width);
    const hasInvalidHeight = !isPositiveInteger(height);

    if (hasInvalidWidth) {
      issues.push(createIssue(`images[${index}].width`, `images[${index}].width 必须是正整数`));
    }
    if (hasInvalidHeight) {
      issues.push(createIssue(`images[${index}].height`, `images[${index}].height 必须是正整数`));
    }

    if (
      !normalizedSrc ||
      hasInvalidWidth ||
      hasInvalidHeight
    ) {
      return;
    }

    const alt = normalizeOptionalText(item.alt);
    images.push({
      src: normalizedSrc,
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      ...(alt ? { alt } : {})
    });
  });

  return issues.length > 0 ? { issues } : { issues, images };
};

const buildBitsFrontmatterFromValues = (
  values: AdminBitsEditorValues
): { frontmatter?: AdminBitsFrontmatter; issues: AdminContentValidationIssue[] } => {
  const issues: AdminContentValidationIssue[] = [];
  const date = values.date.trim();

  if (!date) {
    issues.push(createIssue('date', 'bits.date 不能为空'));
  } else if (Number.isNaN(new Date(date).valueOf())) {
    issues.push(createIssue('date', 'bits.date 不是合法日期时间'));
  }

  const authorName = values.authorName.trim();
  const authorAvatarRaw = values.authorAvatar.trim();
  const authorAvatar = authorAvatarRaw ? normalizeBitsAvatarPath(authorAvatarRaw) : '';
  if (authorAvatarRaw && authorAvatar === undefined) {
    issues.push(
      createIssue(
        'authorAvatar',
        'author.avatar 只允许相对图片路径（例如 author/avatar.webp），不要带 public/、不要以 / 开头，也不要使用 URL、..、?、#'
      )
    );
  }

  const imageResult = parseBitsImages(values.imagesText);
  issues.push(...imageResult.issues);

  if (issues.length > 0) {
    return { issues };
  }

  return {
    issues,
    frontmatter: {
      ...(values.title.trim() ? { title: values.title.trim() } : {}),
      ...(values.description.trim() ? { description: values.description.trim() } : {}),
      date,
      tags: parseTagsText(values.tagsText),
      draft: values.draft === true,
      ...((authorName || authorAvatar)
        ? {
            author: {
              ...(authorName ? { name: authorName } : {}),
              ...(authorAvatar ? { avatar: authorAvatar } : {})
            }
          }
        : {}),
      ...(imageResult.images && imageResult.images.length > 0 ? { images: imageResult.images } : {})
    }
  };
};

const getCurrentTextValue = (
  frontmatter: Record<string, unknown>,
  field: string,
  fallback: unknown
): unknown => {
  if (!hasOwn(frontmatter, field)) return fallback;
  const value = frontmatter[field];
  return typeof value === 'string' ? value.trim() : value;
};

const getCurrentOptionalTextValue = (
  frontmatter: Record<string, unknown>,
  field: string
): unknown => {
  const value = getCurrentTextValue(frontmatter, field, undefined);
  return typeof value === 'string' && value.length === 0 ? undefined : value;
};

const getCurrentBooleanValue = (
  frontmatter: Record<string, unknown>,
  field: string,
  fallback: boolean
): unknown => {
  if (!hasOwn(frontmatter, field)) return fallback;
  const value = frontmatter[field];
  return typeof value === 'boolean' ? value : value;
};

const getCurrentStringArrayValue = (
  frontmatter: Record<string, unknown>,
  field: string,
  fallback: string[]
): unknown => {
  if (!hasOwn(frontmatter, field)) return fallback;
  const value = frontmatter[field];
  if (!Array.isArray(value)) return value;
  return value.every((item) => typeof item === 'string')
    ? value.map((item) => item.trim()).filter(Boolean)
    : value;
};

type AdminEssayCurrentFrontmatter = {
  title: unknown;
  description: unknown;
  date: unknown;
  publishedAt: unknown;
  preservedPublishedAt?: string;
  tags: unknown;
  draft: unknown;
  archive: unknown;
  slug: unknown;
  cover: unknown;
  badge: unknown;
};

type AdminBitsCurrentFrontmatter = {
  title: unknown;
  description: unknown;
  date: unknown;
  tags: unknown;
  draft: unknown;
  author: unknown;
  images: unknown;
};

const buildEssayCurrentFrontmatter = (state: AdminContentSourceState): AdminEssayCurrentFrontmatter => {
  const frontmatter = state.rawFrontmatter;
  const currentDate = getCurrentTextValue(frontmatter, 'date', '');
  const dateResult = typeof currentDate === 'string' ? parseEssayDateInput(currentDate) : null;
  const currentPublishedAt = getCurrentOptionalTextValue(frontmatter, 'publishedAt');
  const preservedPublishedAt = typeof currentPublishedAt === 'string'
    ? (parseEssayPublishedAtInput(currentPublishedAt) ? currentPublishedAt : undefined)
    : dateResult?.publishedAtText;

  return {
    title: getCurrentTextValue(frontmatter, 'title', ''),
    description: getCurrentOptionalTextValue(frontmatter, 'description'),
    date: currentDate,
    publishedAt: currentPublishedAt,
    ...(preservedPublishedAt ? { preservedPublishedAt } : {}),
    tags: getCurrentStringArrayValue(frontmatter, 'tags', []),
    draft: getCurrentBooleanValue(frontmatter, 'draft', false),
    archive: getCurrentBooleanValue(frontmatter, 'archive', true),
    slug: getCurrentOptionalTextValue(frontmatter, 'slug'),
    cover: getCurrentOptionalTextValue(frontmatter, 'cover'),
    badge: getCurrentOptionalTextValue(frontmatter, 'badge')
  };
};

const getCurrentBitsAuthorValue = (frontmatter: Record<string, unknown>): unknown => {
  if (!hasOwn(frontmatter, 'author')) return undefined;

  const author = frontmatter.author;
  if (!isRecord(author)) return author;

  const name = getCurrentOptionalTextValue(author, 'name');
  const rawAvatar = getCurrentOptionalTextValue(author, 'avatar');
  if ((name !== undefined && typeof name !== 'string') || (rawAvatar !== undefined && typeof rawAvatar !== 'string')) {
    return author;
  }

  const avatar = rawAvatar ? normalizeBitsAvatarPath(rawAvatar) : '';
  if (rawAvatar && avatar === undefined) return author;

  return name || avatar
    ? {
        ...(name ? { name } : {}),
        ...(avatar ? { avatar } : {})
      }
    : undefined;
};

const getCurrentBitsImagesValue = (frontmatter: Record<string, unknown>): unknown => {
  if (!hasOwn(frontmatter, 'images')) return undefined;

  const images = frontmatter.images;
  if (!Array.isArray(images)) return images;

  const parsed = parseBitsImages(JSON.stringify(images));
  if (parsed.issues.length > 0) return images;
  return parsed.images && parsed.images.length > 0 ? parsed.images : undefined;
};

const buildBitsCurrentFrontmatter = (state: AdminContentSourceState): AdminBitsCurrentFrontmatter => {
  const frontmatter = state.rawFrontmatter;
  return {
    title: getCurrentOptionalTextValue(frontmatter, 'title'),
    description: getCurrentOptionalTextValue(frontmatter, 'description'),
    date: getCurrentTextValue(frontmatter, 'date', ''),
    tags: getCurrentStringArrayValue(frontmatter, 'tags', []),
    draft: getCurrentBooleanValue(frontmatter, 'draft', false),
    author: getCurrentBitsAuthorValue(frontmatter),
    images: getCurrentBitsImagesValue(frontmatter)
  };
};

const isEqualJsonValue = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const buildEssayWritePlan = async (
  state: AdminContentSourceState,
  values: AdminEssayEditorValues,
  bodyInput?: string,
  options: {
    publishedAtInputMode?: AdminEssayPublishedAtInputMode;
  } = {}
): Promise<AdminWritePlan> => {
  const current = buildEssayCurrentFrontmatter(state);
  const shouldPreservePublishedAt = options.publishedAtInputMode === 'missing';
  const next = buildEssayFrontmatterFromValues(values, {
    ...(shouldPreservePublishedAt && current.preservedPublishedAt
      ? { preservedPublishedAt: current.preservedPublishedAt }
      : {})
  });
  if (!next.frontmatter) {
    return { issues: next.issues, changedFields: [], patches: [] };
  }

  const slugIssues = await validateEssayPublicSlug(state, next.frontmatter);
  if (slugIssues.length > 0) {
    return { issues: slugIssues, changedFields: [], patches: [] };
  }

  if (bodyInput !== undefined) {
    const missingImageReferences = findMissingEssayLocalImageReferences({
      bodyText: bodyInput,
      sourcePath: state.sourcePath
    });
    if (missingImageReferences.length > 0) {
      return {
        issues: missingImageReferences.map((reference) =>
          createIssue('body', `正文引用的本地图片不存在：${reference.relativePath}`)
        ),
        changedFields: [],
        patches: []
      };
    }
  }

  const fieldMatrix: Array<{
    field: string;
    path: readonly string[];
    currentValue: unknown;
    nextValue: unknown;
  }> = [
    { field: 'title', path: ['title'], currentValue: current.title, nextValue: next.frontmatter.title },
    { field: 'description', path: ['description'], currentValue: current.description, nextValue: next.frontmatter.description },
    { field: 'date', path: ['date'], currentValue: current.date, nextValue: next.frontmatter.date },
    { field: 'publishedAt', path: ['publishedAt'], currentValue: current.publishedAt, nextValue: next.frontmatter.publishedAt },
    { field: 'tags', path: ['tags'], currentValue: current.tags, nextValue: next.frontmatter.tags },
    { field: 'draft', path: ['draft'], currentValue: current.draft, nextValue: next.frontmatter.draft },
    { field: 'archive', path: ['archive'], currentValue: current.archive, nextValue: next.frontmatter.archive },
    { field: 'slug', path: ['slug'], currentValue: current.slug, nextValue: next.frontmatter.slug },
    { field: 'cover', path: ['cover'], currentValue: current.cover, nextValue: next.frontmatter.cover },
    { field: 'badge', path: ['badge'], currentValue: current.badge, nextValue: next.frontmatter.badge }
  ];

  const changedFields: string[] = [];
  const patches: FrontmatterPatch[] = [];

  for (const field of fieldMatrix) {
    if (isEqualJsonValue(field.currentValue, field.nextValue)) continue;
    changedFields.push(field.field);
    patches.push(
      field.nextValue === undefined
        ? { path: field.path, action: 'delete' }
        : { path: field.path, value: field.nextValue, action: 'set' }
    );
  }

  if (bodyInput !== undefined && bodyInput !== state.bodyText) {
    changedFields.push('body');
  }

  return {
    issues: [],
    changedFields,
    patches,
    ...(bodyInput !== undefined ? { bodyText: bodyInput } : {})
  };
};

const buildBitsWritePlan = (
  state: AdminContentSourceState,
  values: AdminBitsEditorValues,
  bodyInput?: string
): AdminWritePlan => {
  const next = buildBitsFrontmatterFromValues(values);
  if (!next.frontmatter) {
    return { issues: next.issues, changedFields: [], patches: [] };
  }

  const current = buildBitsCurrentFrontmatter(state);
  const fieldMatrix: Array<{
    field: string;
    path: readonly string[];
    currentValue: unknown;
    nextValue: unknown;
  }> = [
    { field: 'title', path: ['title'], currentValue: current.title, nextValue: next.frontmatter.title },
    { field: 'description', path: ['description'], currentValue: current.description, nextValue: next.frontmatter.description },
    { field: 'date', path: ['date'], currentValue: current.date, nextValue: next.frontmatter.date },
    { field: 'tags', path: ['tags'], currentValue: current.tags, nextValue: next.frontmatter.tags },
    { field: 'draft', path: ['draft'], currentValue: current.draft, nextValue: next.frontmatter.draft },
    { field: 'author', path: ['author'], currentValue: current.author, nextValue: next.frontmatter.author },
    { field: 'images', path: ['images'], currentValue: current.images, nextValue: next.frontmatter.images }
  ];

  const changedFields: string[] = [];
  const patches: FrontmatterPatch[] = [];

  for (const field of fieldMatrix) {
    if (isEqualJsonValue(field.currentValue, field.nextValue)) continue;
    changedFields.push(field.field);
    patches.push(
      field.nextValue === undefined
        ? { path: field.path, action: 'delete' }
        : { path: field.path, value: field.nextValue, action: 'set' }
    );
  }

  if (bodyInput !== undefined && bodyInput !== state.bodyText) {
    changedFields.push('body');
  }

  return {
    issues: [],
    changedFields,
    patches,
    ...(bodyInput !== undefined ? { bodyText: bodyInput } : {})
  };
};

export const buildAdminContentWritePlan = async (
  collection: AdminContentCollectionKey,
  entryId: string,
  frontmatterInput: unknown,
  bodyInput?: string
): Promise<AdminWritePlan & { state: AdminContentSourceState }> => {
  const state = await loadAdminContentSourceState(collection, entryId);

  if (collection === 'essay') {
    const parsed = parseAdminEssayEditorInput(frontmatterInput);
    if (!parsed.values) {
      return {
        state,
        issues: parsed.issues,
        changedFields: [],
        patches: []
      };
    }

    return {
      state,
      ...(await buildEssayWritePlan(state, parsed.values, bodyInput, {
        publishedAtInputMode: parsed.publishedAtInputMode
      }))
    };
  }

  if (collection === 'bits') {
    const parsed = parseAdminBitsEditorInput(frontmatterInput);
    if (!parsed.values) {
      return {
        state,
        issues: parsed.issues,
        changedFields: [],
        patches: []
      };
    }

    return {
      state,
      ...buildBitsWritePlan(state, parsed.values, bodyInput)
    };
  }

  return {
    state,
    issues: [
      createIssue(
        'collection',
        '当前仅支持 essay / bits 内容写回；memo 保持只读。'
      )
    ],
    changedFields: [],
    patches: []
  };
};

export const applyAdminContentWritePlan = (
  state: Pick<AdminContentSourceState, 'sourceText'>,
  patches: readonly FrontmatterPatch[],
  bodyText?: string
): string => {
  const nextSourceText = patchMarkdownFrontmatter(state.sourceText, patches);
  return bodyText === undefined ? nextSourceText : replaceMarkdownBody(nextSourceText, bodyText);
};
