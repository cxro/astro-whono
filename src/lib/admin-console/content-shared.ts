import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  formatISODateUtc,
  getBitsAvatarLocalFilePath,
  normalizeBitsAvatarPath,
  toSafeHttpUrl
} from '../../utils/format';
import {
  ESSAY_PUBLIC_SLUG_RE,
  RESERVED_ESSAY_SLUGS,
  flattenEntryIdToSlug
} from '../../utils/slug-rules';
import {
  parseMarkdownFrontmatterDocument,
  patchMarkdownFrontmatter,
  type FrontmatterPatch,
  splitMarkdownFrontmatter
} from './frontmatter';

export type AdminContentCollectionKey = 'essay' | 'bits' | 'memo';
export type AdminContentWriteCollectionKey = 'essay' | 'bits';

export type AdminContentValidationIssue = {
  path: string;
  message: string;
};

export type AdminEssayEditorValues = {
  title: string;
  description: string;
  date: string;
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
  revision: string;
  relativePath: string;
  writable: true;
  readonlyReason: null;
  values: AdminEssayEditorValues;
};

export type AdminBitsEditorPayload = {
  collection: 'bits';
  entryId: string;
  revision: string;
  relativePath: string;
  writable: true;
  readonlyReason: null;
  values: AdminBitsEditorValues;
};

export type AdminMemoEditorPayload = {
  collection: 'memo';
  entryId: string;
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
  tags: string[];
  draft: boolean;
  archive: boolean;
  slug?: string;
  cover?: string;
  badge?: string;
};

type AdminBitsImage = {
  src: string;
  width: number;
  height: number;
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
  sourcePath: string;
  relativePath: string;
  revision: string;
  sourceText: string;
  frontmatterDocument: ReturnType<typeof parseMarkdownFrontmatterDocument>;
  rawFrontmatter: Record<string, unknown>;
};

type AdminWritePlan = {
  issues: AdminContentValidationIssue[];
  changedFields: string[];
  patches: FrontmatterPatch[];
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const IMAGE_LOCAL_EXT_RE = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeOptionalText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const createIssue = (path: string, message: string): AdminContentValidationIssue => ({
  path,
  message
});

const getProjectRoot = (): string => process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT?.trim() || process.cwd();
const getContentRoot = (): string => path.join(getProjectRoot(), 'src', 'content');
const getCollectionRoot = (collection: AdminContentCollectionKey): string => path.join(getContentRoot(), collection);

const hasProjectFile = (relativePath: string): boolean =>
  existsSync(path.join(getProjectRoot(), ...relativePath.split('/')));

const hashSourceText = (sourceText: string): string =>
  createHash('sha1').update(sourceText).digest('hex');

const normalizeEntryId = (entryId: string): string => {
  const normalized = entryId.trim().replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('//')) {
    throw new Error(`Unsupported admin content entry id: ${entryId}`);
  }

  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(`Unsupported admin content entry id: ${entryId}`);
  }

  return normalized;
};

const resolveAdminContentEntrySourcePath = (
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
    throw new Error(`Admin content source file not found: ${collection}/${normalizedEntryId}`);
  }

  return resolved;
};

const toRelativeProjectPath = (filePath: string): string =>
  path.relative(getProjectRoot(), filePath).replace(/\\/g, '/');

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

const parseAdminEssayEditorInput = (
  input: unknown
): { values?: AdminEssayEditorValues; issues: AdminContentValidationIssue[] } => {
  if (!isRecord(input)) {
    return {
      issues: [createIssue('frontmatter', 'frontmatter 必须是对象')]
    };
  }

  const issues: AdminContentValidationIssue[] = [];
  const values: AdminEssayEditorValues = {
    title: getRequiredStringField(input, 'title', issues),
    description: getRequiredStringField(input, 'description', issues),
    date: getRequiredStringField(input, 'date', issues),
    tagsText: getRequiredStringField(input, 'tagsText', issues),
    draft: getRequiredBooleanField(input, 'draft', issues),
    archive: getRequiredBooleanField(input, 'archive', issues),
    slug: getRequiredStringField(input, 'slug', issues),
    cover: getRequiredStringField(input, 'cover', issues),
    badge: getRequiredStringField(input, 'badge', issues)
  };

  return issues.length > 0 ? { issues } : { values, issues };
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

const normalizeLocalImageSource = (value: string): string | null => {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (
    !normalized
    || normalized.startsWith('/')
    || normalized.startsWith('//')
    || normalized.startsWith('public/')
    || /(^|\/)\.\.(?:\/|$)/.test(normalized)
    || normalized.includes('?')
    || normalized.includes('#')
  ) {
    return null;
  }

  return IMAGE_LOCAL_EXT_RE.test(normalized) ? normalized : null;
};

const normalizeBitsImageSource = (value: string): string | null => {
  const safeRemoteUrl = toSafeHttpUrl(value);
  if (safeRemoteUrl && safeRemoteUrl.startsWith('https://')) return safeRemoteUrl;
  return normalizeLocalImageSource(value);
};

const resolveCollectionEntryIdFromSourcePath = (
  collection: AdminContentCollectionKey,
  filePath: string
): string => {
  const relative = path.relative(getCollectionRoot(collection), filePath).replace(/\\/g, '/');
  if (relative.endsWith('/index.md')) {
    return relative.slice(0, -'/index.md'.length);
  }
  if (relative.endsWith('/index.mdx')) {
    return relative.slice(0, -'/index.mdx'.length);
  }
  return relative.replace(/\.(md|mdx)$/i, '');
};

const listCollectionSourceFiles = async (collection: AdminContentCollectionKey): Promise<string[]> => {
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

const readSourceFrontmatterRecord = async (filePath: string): Promise<Record<string, unknown>> => {
  const sourceText = await readFile(filePath, 'utf8');
  const section = splitMarkdownFrontmatter(sourceText);
  const document = parseMarkdownFrontmatterDocument(section.frontmatterText);
  const rawFrontmatter = document.toJS();
  return isRecord(rawFrontmatter) ? rawFrontmatter : {};
};

const resolveEssayPublicSlug = (entryId: string, explicitSlug?: string): string =>
  explicitSlug && explicitSlug.trim().length > 0
    ? explicitSlug.trim()
    : flattenEntryIdToSlug(entryId);

const validateEssayPublicSlug = async (
  state: Pick<AdminContentSourceState, 'entryId'>,
  frontmatter: Pick<AdminEssayFrontmatter, 'slug'>
): Promise<AdminContentValidationIssue[]> => {
  const issues: AdminContentValidationIssue[] = [];
  const publicSlug = resolveEssayPublicSlug(state.entryId, frontmatter.slug);

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
    const essayFiles = await listCollectionSourceFiles('essay');
    for (const filePath of essayFiles) {
      const candidateEntryId = resolveCollectionEntryIdFromSourcePath('essay', filePath);
      if (candidateEntryId === state.entryId) continue;

      const frontmatterRecord = await readSourceFrontmatterRecord(filePath);
      const candidateSlug = resolveEssayPublicSlug(candidateEntryId, normalizeOptionalText(frontmatterRecord.slug));
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
  const sourceText = await readFile(sourcePath, 'utf8');
  const section = splitMarkdownFrontmatter(sourceText);
  const frontmatterDocument = parseMarkdownFrontmatterDocument(section.frontmatterText);
  const rawFrontmatter = frontmatterDocument.toJS();

  return {
    collection,
    entryId: normalizeEntryId(entryId),
    sourcePath,
    relativePath: toRelativeProjectPath(sourcePath),
    revision: hashSourceText(sourceText),
    sourceText,
    frontmatterDocument,
    rawFrontmatter: isRecord(rawFrontmatter) ? rawFrontmatter : {}
  };
};

const toEssayEditorValues = (state: AdminContentSourceState): AdminEssayEditorValues => {
  const frontmatter = state.rawFrontmatter;
  return {
    title: normalizeOptionalText(frontmatter.title),
    description: normalizeOptionalText(frontmatter.description),
    date: getDateString(frontmatter, 'date', ''),
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

const readOnlyReasonByCollection = (collection: AdminContentCollectionKey): string | null =>
  collection === 'memo'
    ? 'Phase 2B 首批仅开放 essay / bits frontmatter 写回；memo 仍保持只读，并单独保留 date 可选 / slug 不走 slugRule 的 schema 差异。'
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
      revision: state.revision,
      relativePath: state.relativePath,
      writable: true,
      readonlyReason: null,
      values: toEssayEditorValues(state)
    };
  }

  if (collection === 'bits') {
    return {
      collection,
      entryId: state.entryId,
      revision: state.revision,
      relativePath: state.relativePath,
      writable: true,
      readonlyReason: null,
      values: toBitsEditorValues(state)
    };
  }

  return {
    collection,
    entryId: state.entryId,
    revision: state.revision,
    relativePath: state.relativePath,
    writable: false,
    readonlyReason: readOnlyReasonByCollection(collection) ?? '当前 collection 暂不支持写盘',
    values: toMemoEditorValues(state)
  };
};

const buildEssayFrontmatterFromValues = (
  values: AdminEssayEditorValues
): { frontmatter?: AdminEssayFrontmatter; issues: AdminContentValidationIssue[] } => {
  const issues: AdminContentValidationIssue[] = [];
  const title = values.title.trim();
  if (!title) {
    issues.push(createIssue('title', 'title 不能为空'));
  }

  const date = values.date.trim();
  if (!DATE_ONLY_RE.test(date)) {
    issues.push(createIssue('date', 'essay.date 必须是 YYYY-MM-DD'));
  } else if (formatISODateUtc(new Date(`${date}T00:00:00.000Z`)) !== date) {
    issues.push(createIssue('date', 'essay.date 不是合法日期'));
  }

  if (issues.length > 0) {
    return { issues };
  }

  const slug = values.slug.trim();

  return {
    issues,
    frontmatter: {
      title,
      ...(values.description.trim() ? { description: values.description.trim() } : {}),
      date,
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
      issues.push(createIssue('imagesText', `images[${index}] 必须是对象`));
      return;
    }

    const src = normalizeOptionalText(item.src);
    const normalizedSrc = normalizeBitsImageSource(src);
    if (!normalizedSrc) {
      issues.push(createIssue('imagesText', `images[${index}].src 只允许 https:// 远程路径或仓库内相对图片路径`));
    }

    const width = typeof item.width === 'number' ? item.width : Number.parseInt(String(item.width ?? ''), 10);
    const height = typeof item.height === 'number' ? item.height : Number.parseInt(String(item.height ?? ''), 10);
    if (!Number.isInteger(width) || width <= 0) {
      issues.push(createIssue('imagesText', `images[${index}].width 必须是正整数`));
    }
    if (!Number.isInteger(height) || height <= 0) {
      issues.push(createIssue('imagesText', `images[${index}].height 必须是正整数`));
    }

    if (!normalizedSrc || !Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
      return;
    }

    const alt = normalizeOptionalText(item.alt);
    images.push({
      src: normalizedSrc,
      width,
      height,
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
  } else if (authorAvatar) {
    const localFilePath = getBitsAvatarLocalFilePath(authorAvatar);
    if (localFilePath && !hasProjectFile(localFilePath)) {
      issues.push(createIssue('authorAvatar', `author.avatar 指向的本地文件不存在：${localFilePath}`));
    }
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

const buildEssayCurrentFrontmatter = (state: AdminContentSourceState): AdminEssayFrontmatter => {
  const values = toEssayEditorValues(state);
  const result = buildEssayFrontmatterFromValues(values);
  if (!result.frontmatter) {
    throw new Error(`Current essay frontmatter is invalid: ${state.relativePath}`);
  }
  return result.frontmatter;
};

const buildBitsCurrentFrontmatter = (state: AdminContentSourceState): AdminBitsFrontmatter => {
  const values = toBitsEditorValues(state);
  const result = buildBitsFrontmatterFromValues(values);
  if (!result.frontmatter) {
    throw new Error(`Current bits frontmatter is invalid: ${state.relativePath}`);
  }
  return result.frontmatter;
};

const isEqualJsonValue = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const buildEssayWritePlan = async (
  state: AdminContentSourceState,
  values: AdminEssayEditorValues
): Promise<AdminWritePlan> => {
  const next = buildEssayFrontmatterFromValues(values);
  if (!next.frontmatter) {
    return { issues: next.issues, changedFields: [], patches: [] };
  }

  const slugIssues = await validateEssayPublicSlug(state, next.frontmatter);
  if (slugIssues.length > 0) {
    return { issues: slugIssues, changedFields: [], patches: [] };
  }

  const current = buildEssayCurrentFrontmatter(state);
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

  return { issues: [], changedFields, patches };
};

const buildBitsWritePlan = (state: AdminContentSourceState, values: AdminBitsEditorValues): AdminWritePlan => {
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

  return { issues: [], changedFields, patches };
};

export const buildAdminContentWritePlan = async (
  collection: AdminContentCollectionKey,
  entryId: string,
  frontmatterInput: unknown
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
      ...(await buildEssayWritePlan(state, parsed.values))
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
      ...buildBitsWritePlan(state, parsed.values)
    };
  }

  return {
    state,
    issues: [
      createIssue(
        'collection',
        'Phase 2B 首批仅开放 essay / bits frontmatter 写回；memo 仍保持只读。'
      )
    ],
    changedFields: [],
    patches: []
  };
};

export const applyAdminContentWritePlan = (
  state: Pick<AdminContentSourceState, 'sourceText'>,
  patches: readonly FrontmatterPatch[]
): string => patchMarkdownFrontmatter(state.sourceText, patches);
