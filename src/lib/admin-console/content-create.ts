import { createHash } from 'node:crypto';
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  contentSourceEntryIdToPublicEntryId,
  flattenEntryIdToSlug
} from '../../utils/slug-rules';
import { buildAdminContentEntryEditorPayloadFromState } from './content-editor-payload';
import type { AdminBitsEditorValues, AdminEssayEditorValues } from './content-editor-payload';
import {
  buildEssayFrontmatterFromValues,
  loadEssayPublicSlugUsage,
  type AdminEssayFrontmatter,
  type AdminEssayPublicSlugUsage,
  parseAdminEssayEditorInput,
  validateEssayPublicSlug
} from './content-essay-frontmatter';
import type { AdminContentValidationIssue } from './content-entry-contract';
import {
  type AdminContentCreatableCollectionKey
} from './content-collections';
import {
  AdminContentEntryResolutionError,
  getAdminContentEntrySourcePathCandidates,
  loadAdminContentSourceState,
  toAdminContentRelativeProjectPath
} from './content-entry-source';
import {
  createAdminContentValidationIssue as createIssue
} from './content-entry-utils';
import { getAdminContentEntryEditHref } from './content-routes';
import { buildBitsFrontmatterFromValues } from './content-write-plan';
import { patchMarkdownFrontmatter } from './frontmatter';

type AdminContentCreateBaseInput = {
  frontmatter: unknown;
};

type AdminEssayContentCreateInput = AdminContentCreateBaseInput & {
  collection: 'essay';
  entryId: string;
};

type AdminBitsContentCreateInput = AdminContentCreateBaseInput & {
  collection: 'bits';
};

export type AdminContentCreateInput =
  | AdminEssayContentCreateInput
  | AdminBitsContentCreateInput;

export type AdminContentCreatePlan = {
  collection: AdminContentCreatableCollectionKey;
  entryId: string;
  publicEntryId: string;
  defaultPublicSlug: string;
  sourcePath: string;
  relativePath: string;
  sourceText: string;
  editHref: string;
  issues: AdminContentValidationIssue[];
};

const EMPTY_MARKDOWN_SOURCE = '---\n---\n\n';
const AUTO_SLUG_HASH_LENGTHS = [4, 5, 6] as const;
const BITS_CREATE_DATETIME_RE = /^(\d{4})-(0[1-9]|1[0-2])-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::00)?(Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeCreateEntryId = (entryId: string): string => {
  const withoutExtension = entryId.trim().replace(/\\/g, '/').replace(/\.md$/i, '');
  const normalized = withoutExtension.endsWith('/index')
    ? withoutExtension.slice(0, -'/index'.length)
    : withoutExtension;
  if (!normalized || normalized.startsWith('/') || normalized.includes('//')) {
    throw new AdminContentEntryResolutionError('invalid-entry-id', `不支持的 content entryId：${entryId}`);
  }

  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new AdminContentEntryResolutionError('invalid-entry-id', `不支持的 content entryId：${entryId}`);
  }

  return normalized;
};

const buildEssayCreateValues = (values: AdminEssayEditorValues): AdminEssayEditorValues => ({
  ...values,
  draft: true
});

const buildBitsCreateValues = (date: string): AdminBitsEditorValues => ({
  title: '',
  description: '',
  date,
  tagsText: '',
  draft: true,
  authorName: '',
  authorAvatar: '',
  imagesText: ''
});

const getShortEssayDateSlugPart = (date: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return '000000';

  const year = match[1] ?? '0000';
  const month = match[2] ?? '00';
  const day = match[3] ?? '00';
  return `${year.slice(-2)}${month}${day}`;
};

const buildStableSlugHash = (
  parts: readonly string[],
  length: number
): string => {
  const digest = createHash('sha1').update(parts.join('\n')).digest('hex').slice(0, 12);
  return Number.parseInt(digest, 16).toString(36).padStart(length, '0').slice(0, length);
};

const isEssayPublicSlugAvailable = async (
  publicEntryId: string,
  slugUsage: AdminEssayPublicSlugUsage,
  slug?: string
): Promise<boolean> => {
  const frontmatter: Pick<AdminEssayFrontmatter, 'slug'> = slug === undefined ? {} : { slug };
  return (await validateEssayPublicSlug({ publicEntryId }, frontmatter, { slugUsage })).length === 0;
};

const buildFallbackEssayPublicSlug = (
  frontmatter: AdminEssayFrontmatter,
  entryId: string,
  hashLength: number
): string =>
  `essay-${getShortEssayDateSlugPart(frontmatter.date)}-${buildStableSlugHash(
    [frontmatter.title, frontmatter.date, entryId],
    hashLength
  )}`;

const resolveEssayCreateFrontmatterSlug = async ({
  entryId,
  publicEntryId,
  frontmatter,
  slugUsage
}: {
  entryId: string;
  publicEntryId: string;
  frontmatter: AdminEssayFrontmatter;
  slugUsage: AdminEssayPublicSlugUsage;
}): Promise<AdminEssayFrontmatter> => {
  if (frontmatter.slug?.trim()) return frontmatter;
  if (await isEssayPublicSlugAvailable(publicEntryId, slugUsage)) return frontmatter;

  const titleSlug = flattenEntryIdToSlug(contentSourceEntryIdToPublicEntryId(frontmatter.title));
  if (titleSlug && await isEssayPublicSlugAvailable(publicEntryId, slugUsage, titleSlug)) {
    return { ...frontmatter, slug: titleSlug };
  }

  for (const hashLength of AUTO_SLUG_HASH_LENGTHS) {
    const slug = buildFallbackEssayPublicSlug(frontmatter, entryId, hashLength);
    if (await isEssayPublicSlugAvailable(publicEntryId, slugUsage, slug)) {
      return { ...frontmatter, slug };
    }
  }

  return {
    ...frontmatter,
    slug: buildFallbackEssayPublicSlug(
      frontmatter,
      entryId,
      AUTO_SLUG_HASH_LENGTHS.at(-1) ?? 6
    )
  };
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const findExistingFile = async (filePaths: readonly string[]): Promise<string | null> => {
  for (const filePath of filePaths) {
    if (await fileExists(filePath)) return filePath;
  }
  return null;
};

const isValidCalendarDate = (year: string, month: string, day: string): boolean => {
  const normalized = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return normalized.getUTCFullYear() === Number(year)
    && normalized.getUTCMonth() + 1 === Number(month)
    && normalized.getUTCDate() === Number(day);
};

const normalizeBitsCreateOffset = (offset: string): string =>
  offset === 'Z' || offset.includes(':') ? offset : `${offset.slice(0, 3)}:${offset.slice(3)}`;

const parseBitsCreateDate = (
  frontmatter: unknown
): { entryId?: string; date?: string; issues: AdminContentValidationIssue[] } => {
  if (!isRecord(frontmatter)) {
    return { issues: [createIssue('frontmatter', 'frontmatter 必须是对象')] };
  }

  const input = typeof frontmatter.date === 'string' ? frontmatter.date.trim() : '';
  if (!input) {
    return { issues: [createIssue('date', 'bits.date 不能为空')] };
  }

  const match = BITS_CREATE_DATETIME_RE.exec(input);
  if (!match) {
    return { issues: [createIssue('date', 'bits.date 必须是带时区的 YYYY-MM-DDTHH:mm:ss±HH:mm 格式')] };
  }

  const [, year, month, day, hour, minute, offset] = match;
  if (!year || !month || !day || !hour || !minute || !offset || !isValidCalendarDate(year, month, day)) {
    return { issues: [createIssue('date', 'bits.date 不是合法日期时间')] };
  }

  return {
    entryId: `bits-${year}-${month}-${day}-${hour}${minute}`,
    date: `${year}-${month}-${day}T${hour}:${minute}:00${normalizeBitsCreateOffset(offset)}`,
    issues: []
  };
};

const assertUnsupportedCreateCollection = (collection: never): never => {
  throw new AdminContentEntryResolutionError('invalid-entry-id', `当前 collection 暂未实现新增：${String(collection)}`);
};

const buildEssayContentCreatePlan = async (
  input: AdminEssayContentCreateInput
): Promise<AdminContentCreatePlan> => {
  const collection = input.collection;
  const entryId = normalizeCreateEntryId(input.entryId);
  const sourcePathCandidates = getAdminContentEntrySourcePathCandidates(collection, entryId);
  const [sourcePath] = sourcePathCandidates;
  if (!sourcePath) {
    throw new AdminContentEntryResolutionError('source-not-found', `未找到 content 源文件候选：${collection}/${entryId}`);
  }
  const relativePath = toAdminContentRelativeProjectPath(sourcePath);
  const publicEntryId = contentSourceEntryIdToPublicEntryId(entryId) || entryId;
  const defaultPublicSlug = flattenEntryIdToSlug(publicEntryId);

  const parsed = parseAdminEssayEditorInput(input.frontmatter);
  if (!parsed.values) {
    return {
      collection,
      entryId,
      publicEntryId,
      defaultPublicSlug,
      sourcePath,
      relativePath,
      sourceText: '',
      editHref: getAdminContentEntryEditHref(collection, entryId),
      issues: parsed.issues
    };
  }

  const next = buildEssayFrontmatterFromValues(buildEssayCreateValues(parsed.values));
  if (!next.frontmatter) {
    return {
      collection,
      entryId,
      publicEntryId,
      defaultPublicSlug,
      sourcePath,
      relativePath,
      sourceText: '',
      editHref: getAdminContentEntryEditHref(collection, entryId),
      issues: next.issues
    };
  }

  const existingSourcePath = await findExistingFile(sourcePathCandidates);
  if (existingSourcePath) {
    return {
      collection,
      entryId,
      publicEntryId,
      defaultPublicSlug,
      sourcePath,
      relativePath,
      sourceText: '',
      editHref: getAdminContentEntryEditHref(collection, entryId),
      issues: [createIssue('entryId', `源文件已存在：${toAdminContentRelativeProjectPath(existingSourcePath)}`)]
    };
  }

  const slugUsage = await loadEssayPublicSlugUsage();
  const frontmatter = await resolveEssayCreateFrontmatterSlug({
    entryId,
    publicEntryId,
    frontmatter: next.frontmatter,
    slugUsage
  });

  const slugIssues = await validateEssayPublicSlug({ publicEntryId }, frontmatter, { slugUsage });
  if (slugIssues.length > 0) {
    return {
      collection,
      entryId,
      publicEntryId,
      defaultPublicSlug,
      sourcePath,
      relativePath,
      sourceText: '',
      editHref: getAdminContentEntryEditHref(collection, entryId),
      issues: slugIssues
    };
  }

  return {
    collection,
    entryId,
    publicEntryId,
    defaultPublicSlug,
    sourcePath,
    relativePath,
    sourceText: patchMarkdownFrontmatter(
      EMPTY_MARKDOWN_SOURCE,
      Object.entries(frontmatter).map(([key, value]) => ({
        path: [key],
        value,
        action: 'set' as const
      }))
    ),
    editHref: getAdminContentEntryEditHref(collection, entryId),
    issues: []
  };
};

const buildBitsContentCreatePlan = async (
  input: AdminBitsContentCreateInput
): Promise<AdminContentCreatePlan> => {
  const collection = input.collection;
  const parsedDate = parseBitsCreateDate(input.frontmatter);
  if (!parsedDate.entryId || !parsedDate.date) {
    return {
      collection,
      entryId: '',
      publicEntryId: '',
      defaultPublicSlug: '',
      sourcePath: '',
      relativePath: '',
      sourceText: '',
      editHref: '',
      issues: parsedDate.issues
    };
  }

  const entryId = parsedDate.entryId;
  const sourcePathCandidates = getAdminContentEntrySourcePathCandidates(collection, entryId);
  const [sourcePath] = sourcePathCandidates;
  if (!sourcePath) {
    throw new AdminContentEntryResolutionError('source-not-found', `未找到 content 源文件候选：${collection}/${entryId}`);
  }
  const relativePath = toAdminContentRelativeProjectPath(sourcePath);
  const publicEntryId = contentSourceEntryIdToPublicEntryId(entryId) || entryId;
  const defaultPublicSlug = flattenEntryIdToSlug(publicEntryId);
  const editHref = getAdminContentEntryEditHref(collection, entryId);

  const existingSourcePath = await findExistingFile(sourcePathCandidates);
  if (existingSourcePath) {
    return {
      collection,
      entryId,
      publicEntryId,
      defaultPublicSlug,
      sourcePath,
      relativePath,
      sourceText: '',
      editHref,
      issues: [createIssue('entryId', `源文件已存在：${toAdminContentRelativeProjectPath(existingSourcePath)}`)]
    };
  }

  const next = buildBitsFrontmatterFromValues(buildBitsCreateValues(parsedDate.date));
  if (!next.frontmatter) {
    return {
      collection,
      entryId,
      publicEntryId,
      defaultPublicSlug,
      sourcePath,
      relativePath,
      sourceText: '',
      editHref,
      issues: next.issues
    };
  }

  return {
    collection,
    entryId,
    publicEntryId,
    defaultPublicSlug,
    sourcePath,
    relativePath,
    sourceText: patchMarkdownFrontmatter(
      EMPTY_MARKDOWN_SOURCE,
      Object.entries(next.frontmatter).map(([key, value]) => ({
        path: [key],
        value,
        action: 'set' as const
      }))
    ),
    editHref,
    issues: []
  };
};

export const buildAdminContentCreatePlan = async (
  input: AdminContentCreateInput
): Promise<AdminContentCreatePlan> => {
  switch (input.collection) {
    case 'essay':
      return buildEssayContentCreatePlan(input);
    case 'bits':
      return buildBitsContentCreatePlan(input);
    default:
      return assertUnsupportedCreateCollection(input);
  }
};

export const ensureAdminContentCreateParentDirectory = async (
  plan: Pick<AdminContentCreatePlan, 'sourcePath'>
): Promise<void> => {
  await mkdir(path.dirname(plan.sourcePath), { recursive: true });
};

export const readAdminContentCreatedEditorPayload = async (
  plan: Pick<AdminContentCreatePlan, 'collection' | 'entryId' | 'editHref'>
) => ({
  editHref: plan.editHref,
  payload: buildAdminContentEntryEditorPayloadFromState(
    await loadAdminContentSourceState(plan.collection, plan.entryId)
  )
});
