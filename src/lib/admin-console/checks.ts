import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  getBitsAvatarLocalFilePath,
  normalizeBitsAvatarPath
} from '../../utils/format';
import {
  ESSAY_PUBLIC_SLUG_RE,
  RESERVED_ESSAY_SLUGS,
  contentSourceEntryIdToPublicEntryId,
  flattenEntryIdToSlug
} from '../../utils/slug-rules';
import { isRoutableTagKey, normalizeTagLabel, toTagKey } from '../tags';
import {
  getEditableThemeSettingsState,
  type ThemeSettingsReadDiagnostic
} from '../theme-settings';
import {
  listAdminCollectionSourceFiles,
  readAdminSourceFrontmatterRecord,
  resolveAdminContentEntryIdFromSourcePath,
  type AdminContentCollectionKey
} from './content-shared';
import { normalizeAdminBitsImageSource } from './image-shared';

export type AdminChecksCategoryId = 'settings' | 'essay-slug' | 'bits-images' | 'tag';
export type AdminChecksFilterValue = 'all' | AdminChecksCategoryId;
export type AdminChecksCategoryStatus = 'ready' | 'blocked';

export type AdminChecksIssue = {
  id: string;
  title: string;
  message: string;
  detail: string | null;
  relativePath: string | null;
  fieldPath: string | null;
  collection: AdminContentCollectionKey | null;
  entryId: string | null;
  href: string | null;
};

export type AdminChecksCategoryResult = {
  id: AdminChecksCategoryId;
  label: string;
  description: string;
  issueCount: number;
  status: AdminChecksCategoryStatus;
  statusLabel: string;
  issues: AdminChecksIssue[];
};

export type AdminChecksData = {
  totalIssueCount: number;
  blockedCategoryCount: number;
  readyCategoryCount: number;
  affectedPathCount: number;
  categories: AdminChecksCategoryResult[];
};

type AdminContentSourceRecord = {
  collection: AdminContentCollectionKey;
  entryId: string;
  relativePath: string;
  frontmatter: Record<string, unknown> | null;
  readError: string | null;
};

type AdminCheckContext = {
  relativePath?: string | null;
  fieldPath?: string | null;
  collection?: AdminContentCollectionKey | null;
  entryId?: string | null;
  href?: string | null;
  detail?: string | null;
};

const ADMIN_CHECKS_CATEGORIES = [
  {
    id: 'settings',
    label: 'Settings',
    description: '检查 settings 文件是否缺字段或结构异常。'
  },
  {
    id: 'essay-slug',
    label: '随笔 Slug',
    description: '检查 slug 格式、重复和保留路由冲突。'
  },
  {
    id: 'bits-images',
    label: 'Bits 图片',
    description: '检查头像和图片路径是否有效，引用文件是否存在。'
  },
  {
    id: 'tag',
    label: 'Tags',
    description: '检查标签 key 是否可正常生成路由。'
  }
] as const satisfies readonly {
  id: AdminChecksCategoryId;
  label: string;
  description: string;
}[];

const CATEGORY_STATUS_LABELS: Record<AdminChecksCategoryStatus, string> = {
  ready: '已通过',
  blocked: '需处理'
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getProjectRoot = (): string =>
  process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT?.trim() || process.cwd();

const toRelativeProjectPath = (filePath: string): string =>
  path.relative(getProjectRoot(), filePath).replace(/\\/g, '/');

const resolveContentHref = (
  collection: AdminContentCollectionKey,
  entryId: string
): string => {
  const params = new URLSearchParams({
    q: entryId,
    entry: entryId
  });
  return `/admin/content/${collection}/?${params.toString()}`;
};

const createIssueId = (
  category: AdminChecksCategoryId,
  relativePath: string | null,
  fieldPath: string | null,
  suffix: string
): string => [category, relativePath ?? 'global', fieldPath ?? 'root', suffix].join(':');

const createIssue = (
  category: AdminChecksCategoryId,
  title: string,
  message: string,
  context: AdminCheckContext = {}
): AdminChecksIssue => ({
  id: createIssueId(
    category,
    context.relativePath ?? null,
    context.fieldPath ?? null,
    context.entryId ?? title
  ),
  title,
  message,
  detail: context.detail ?? null,
  relativePath: context.relativePath ?? null,
  fieldPath: context.fieldPath ?? null,
  collection: context.collection ?? null,
  entryId: context.entryId ?? null,
  href: context.href ?? null
});

const loadCollectionSources = async (
  collection: AdminContentCollectionKey
): Promise<AdminContentSourceRecord[]> => {
  const sourceFiles = await listAdminCollectionSourceFiles(collection);
  return Promise.all(
    sourceFiles.map(async (filePath) => {
      const entryId = resolveAdminContentEntryIdFromSourcePath(collection, filePath);
      const relativePath = toRelativeProjectPath(filePath);

      try {
        return {
          collection,
          entryId,
          relativePath,
          frontmatter: await readAdminSourceFrontmatterRecord(filePath),
          readError: null
        };
      } catch (error) {
        return {
          collection,
          entryId,
          relativePath,
          frontmatter: null,
          readError: error instanceof Error ? error.message : 'unknown error'
        };
      }
    })
  );
};

const createSettingsIssues = (): AdminChecksIssue[] => {
  const editableState = getEditableThemeSettingsState();
  if (editableState.ok) return [];

  const diagnostics: ThemeSettingsReadDiagnostic[] = editableState.diagnostics;
  if (diagnostics.length > 0) {
    return diagnostics.map((diagnostic) =>
      createIssue(
        'settings',
        'settings JSON 结构错误',
        diagnostic.message,
        {
          relativePath: diagnostic.path,
          fieldPath: diagnostic.group,
          href: '/admin/theme/',
          detail: diagnostic.detail ?? null
        }
      )
    );
  }

  return editableState.errors.map((error, index) =>
    createIssue('settings', 'settings 当前不可写', error, {
      fieldPath: `settings-${index + 1}`,
      href: '/admin/theme/'
    })
  );
};

const createSourceReadIssue = (category: AdminChecksCategoryId, source: AdminContentSourceRecord): AdminChecksIssue =>
  createIssue(category, 'frontmatter 解析失败', '当前文件 frontmatter 无法解析，后台未执行该项检查。', {
    relativePath: source.relativePath,
    collection: source.collection,
    entryId: source.entryId,
    fieldPath: 'frontmatter',
    href: resolveContentHref(source.collection, source.entryId),
    detail: source.readError
  });

const createEssaySlugIssues = (sources: readonly AdminContentSourceRecord[]): AdminChecksIssue[] => {
  const issues: AdminChecksIssue[] = [];
  const collisions = new Map<string, AdminContentSourceRecord[]>();

  for (const source of sources) {
    if (source.readError || !source.frontmatter) {
      issues.push(createSourceReadIssue('essay-slug', source));
      continue;
    }

    const explicitSlug =
      typeof source.frontmatter.slug === 'string' && source.frontmatter.slug.trim()
        ? source.frontmatter.slug.trim()
        : '';
    const publicEntryId = contentSourceEntryIdToPublicEntryId(source.entryId) || source.entryId;
    const publicSlug = explicitSlug || flattenEntryIdToSlug(publicEntryId);

    if (!ESSAY_PUBLIC_SLUG_RE.test(publicSlug)) {
      issues.push(
        createIssue(
          'essay-slug',
          'essay public slug 非法',
          explicitSlug
            ? `frontmatter.slug "${explicitSlug}" 不是合法的小写 kebab-case。`
            : `由内容源路径得到的默认公开 slug "${publicSlug}" 不合法，请调整路径或显式设置 slug。`,
          {
            relativePath: source.relativePath,
            fieldPath: 'slug',
            collection: source.collection,
            entryId: source.entryId,
            href: resolveContentHref(source.collection, source.entryId)
          }
        )
      );
      continue;
    }

    if (RESERVED_ESSAY_SLUGS.has(publicSlug)) {
      issues.push(
        createIssue(
          'essay-slug',
          'essay public slug 命中保留路由',
          `公开 slug "${publicSlug}" 会与 /archive 或 /essay 下的保留路由冲突。`,
          {
            relativePath: source.relativePath,
            fieldPath: 'slug',
            collection: source.collection,
            entryId: source.entryId,
            href: resolveContentHref(source.collection, source.entryId)
          }
        )
      );
      continue;
    }

    const bucket = collisions.get(publicSlug) ?? [];
    bucket.push(source);
    collisions.set(publicSlug, bucket);
  }

  for (const [publicSlug, duplicatedSources] of collisions) {
    if (duplicatedSources.length < 2) continue;

    for (const source of duplicatedSources) {
      const otherEntryIds = duplicatedSources
        .filter((candidate) => candidate.entryId !== source.entryId)
        .map((candidate) => candidate.entryId);

      issues.push(
        createIssue(
          'essay-slug',
          'essay public slug 冲突',
          `公开 slug "${publicSlug}" 已被其他 essay 占用：${otherEntryIds.join(', ')}。`,
          {
            relativePath: source.relativePath,
            fieldPath: 'slug',
            collection: source.collection,
            entryId: source.entryId,
            href: resolveContentHref(source.collection, source.entryId)
          }
        )
      );
    }
  }

  return issues;
};

const createBitsImagesIssues = (sources: readonly AdminContentSourceRecord[]): AdminChecksIssue[] => {
  const issues: AdminChecksIssue[] = [];

  for (const source of sources) {
    if (source.readError || !source.frontmatter) {
      issues.push(createSourceReadIssue('bits-images', source));
      continue;
    }

    const author = isRecord(source.frontmatter.author) ? source.frontmatter.author : null;
    const rawAvatar = typeof author?.avatar === 'string' ? author.avatar.trim() : '';
    if (rawAvatar) {
      const normalizedAvatar = normalizeBitsAvatarPath(rawAvatar);
      if (normalizedAvatar === undefined) {
        issues.push(
          createIssue(
            'bits-images',
            'bits.author.avatar 路径非法',
            'author.avatar 只允许相对图片路径，不要带 public/、/、URL、..、? 或 #。',
            {
              relativePath: source.relativePath,
              fieldPath: 'author.avatar',
              collection: source.collection,
              entryId: source.entryId,
              href: resolveContentHref(source.collection, source.entryId),
              detail: `当前值：${rawAvatar}`
            }
          )
        );
      } else {
        const avatarFilePath = getBitsAvatarLocalFilePath(normalizedAvatar);
        if (avatarFilePath && !existsSync(path.join(getProjectRoot(), ...avatarFilePath.split('/')))) {
          issues.push(
            createIssue(
              'bits-images',
              'bits.author.avatar 指向的文件不存在',
              `author.avatar 指向的本地文件不存在：${avatarFilePath}`,
              {
                relativePath: source.relativePath,
                fieldPath: 'author.avatar',
                collection: source.collection,
                entryId: source.entryId,
                href: resolveContentHref(source.collection, source.entryId)
              }
            )
          );
        }
      }
    }

    const images = Array.isArray(source.frontmatter.images) ? source.frontmatter.images : [];
    images.forEach((image, index) => {
      if (!isRecord(image) || typeof image.src !== 'string' || !image.src.trim()) return;

      const normalizedSrc = normalizeAdminBitsImageSource(image.src);
      const fieldPath = `images[${index}].src`;
      if (!normalizedSrc) {
        issues.push(
          createIssue(
            'bits-images',
            'bits.images[*].src 路径非法',
            'bits.images[*].src 只允许 public/** 下的相对图片路径或 https:// 远程 URL。',
            {
              relativePath: source.relativePath,
              fieldPath,
              collection: source.collection,
              entryId: source.entryId,
              href: resolveContentHref(source.collection, source.entryId),
              detail: `当前值：${image.src}`
            }
          )
        );
        return;
      }

      if (!normalizedSrc.startsWith('https://')) {
        const imageFilePath = `public/${normalizedSrc}`;
        if (!existsSync(path.join(getProjectRoot(), ...imageFilePath.split('/')))) {
          issues.push(
            createIssue(
              'bits-images',
              'bits.images[*].src 指向的文件不存在',
              `bits.images[*].src 指向的本地文件不存在：${imageFilePath}`,
              {
                relativePath: source.relativePath,
                fieldPath,
                collection: source.collection,
                entryId: source.entryId,
                href: resolveContentHref(source.collection, source.entryId)
              }
            )
          );
        }
      }
    });
  }

  return issues;
};

const createTagIssues = (sources: readonly AdminContentSourceRecord[]): AdminChecksIssue[] => {
  const issues: AdminChecksIssue[] = [];

  for (const source of sources) {
    if (source.readError || !source.frontmatter) {
      issues.push(createSourceReadIssue('tag', source));
      continue;
    }

    const tags = Array.isArray(source.frontmatter.tags) ? source.frontmatter.tags : [];
    tags.forEach((tag, index) => {
      if (typeof tag !== 'string') return;

      const normalizedLabel = normalizeTagLabel(tag);
      const key = toTagKey(normalizedLabel);
      if (isRoutableTagKey(key)) return;

      issues.push(
        createIssue(
          'tag',
          'tag 路由键不可用',
          `tag "${tag}" 规范化后得到的路由键 ${key ? `"${key}"` : '(empty)'} 不可用于 archive tag 路由。`,
          {
            relativePath: source.relativePath,
            fieldPath: `tags[${index}]`,
            collection: source.collection,
            entryId: source.entryId,
            href: resolveContentHref(source.collection, source.entryId),
            detail: `标准化标签：${normalizedLabel || '(empty)'}`
          }
        )
      );
    });
  }

  return issues;
};

const sortIssues = (issues: readonly AdminChecksIssue[]): AdminChecksIssue[] =>
  issues.slice().sort((left, right) => {
    const pathOrder = (left.relativePath ?? '').localeCompare(right.relativePath ?? '', 'en');
    if (pathOrder !== 0) return pathOrder;
    const fieldOrder = (left.fieldPath ?? '').localeCompare(right.fieldPath ?? '', 'en');
    if (fieldOrder !== 0) return fieldOrder;
    return left.title.localeCompare(right.title, 'zh-Hans-CN');
  });

export const isAdminChecksCategoryId = (value: string): value is AdminChecksCategoryId =>
  ADMIN_CHECKS_CATEGORIES.some((category) => category.id === value);

export const getAdminChecksData = async (): Promise<AdminChecksData> => {
  const [essaySources, bitsSources] = await Promise.all([
    loadCollectionSources('essay'),
    loadCollectionSources('bits')
  ]);

  const issuesByCategory: Record<AdminChecksCategoryId, AdminChecksIssue[]> = {
    settings: createSettingsIssues(),
    'essay-slug': createEssaySlugIssues(essaySources),
    'bits-images': createBitsImagesIssues(bitsSources),
    tag: createTagIssues([...essaySources, ...bitsSources])
  };

  const categories = ADMIN_CHECKS_CATEGORIES.map((category) => {
    const issues = sortIssues(issuesByCategory[category.id]);
    const status: AdminChecksCategoryStatus = issues.length > 0 ? 'blocked' : 'ready';
    return {
      id: category.id,
      label: category.label,
      description: category.description,
      issueCount: issues.length,
      status,
      statusLabel: CATEGORY_STATUS_LABELS[status],
      issues
    } satisfies AdminChecksCategoryResult;
  });

  const allIssues = categories.flatMap((category) => category.issues);
  const affectedPathCount = new Set(
    allIssues.map((issue) => issue.relativePath).filter((value): value is string => Boolean(value))
  ).size;

  return {
    totalIssueCount: allIssues.length,
    blockedCategoryCount: categories.filter((category) => category.status === 'blocked').length,
    readyCategoryCount: categories.filter((category) => category.status === 'ready').length,
    affectedPathCount,
    categories
  };
};
