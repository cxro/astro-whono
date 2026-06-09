import { createHash } from 'node:crypto';
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  contentSourceEntryIdToPublicEntryId,
  flattenEntryIdToSlug
} from '../../utils/slug-rules';
import { buildAdminContentEntryEditorPayloadFromState } from './content-editor-payload';
import type { AdminEssayEditorValues } from './content-editor-payload';
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
import { patchMarkdownFrontmatter } from './frontmatter';

export type AdminContentCreateInput = {
  collection: AdminContentCreatableCollectionKey;
  entryId: string;
  frontmatter: unknown;
};

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

type AdminEssayContentCreateInput = Omit<AdminContentCreateInput, 'collection'> & {
  collection: 'essay';
};

const EMPTY_MARKDOWN_SOURCE = '---\n---\n\n';
const AUTO_SLUG_HASH_LENGTHS = [4, 5, 6] as const;

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

export const buildAdminContentCreatePlan = async (
  input: AdminContentCreateInput
): Promise<AdminContentCreatePlan> => {
  switch (input.collection) {
    case 'essay':
      return buildEssayContentCreatePlan(input);
    default:
      return assertUnsupportedCreateCollection(input.collection);
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
