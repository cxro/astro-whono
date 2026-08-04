import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  ADMIN_IMAGE_BROWSE_GROUP_LABELS,
  type AdminImageBrowseGroup,
  type AdminImageOrigin,
  type AdminImageScopeKey
} from './image-contract';
import {
  buildAdminImageScopeItems,
  matchesAdminImageQuery,
  normalizeAdminImageBrowseGroup,
  normalizeAdminImageBrowseSubgroup,
  resolveAdminImageBrowsePage,
  type AdminImageBrowseFilterOption,
  type AdminImageBrowseResolvedGroup,
  type AdminImageScopeIndex
} from './image-browse';
import {
  AdminImageError,
  getAdminImageFieldAllowedOrigins,
  getAdminImageCompatibleFieldValues,
  getAdminImageFieldSortRank,
  getAdminImageFieldValue,
  normalizeAdminLocalImageSource,
  normalizeAdminImageOwnerValue,
  type AdminImageDirectory,
  type AdminImageFieldContext,
  type AdminImageListRequest,
  type AdminImageMetaInput
} from './image-params';
import {
  getBitsAvatarLocalFilePath,
  getHeroImageLocalFilePath,
  normalizeBitsAvatarPath,
  normalizeHeroImageSrc,
  toSafeHttpUrl
} from '../../utils/format';

export type { AdminImageBrowseGroup, AdminImageOrigin, AdminImageScopeKey } from './image-contract';
export type { AdminImageScopeIndex } from './image-browse';
export {
  ADMIN_IMAGE_LIST_API_PATH,
  ADMIN_IMAGE_META_API_PATH,
  ADMIN_IMAGE_UPLOAD_API_PATH
} from './admin-api-paths';
export {
  ADMIN_IMAGE_DIRECTORY_OPTIONS,
  AdminImageError,
  getAdminImageFieldAllowedOrigins,
  getAdminImageListRequest,
  getAdminImageMetaRequest,
  isAdminImageDirectory,
  isAdminImageFieldContext,
  normalizeAdminBitsImageSource,
  normalizeAdminLocalImageSource,
  normalizeAdminImageDirectory
} from './image-params';
export type {
  AdminImageDirectory,
  AdminImageDirectoryOption,
  AdminImageFieldContext,
  AdminImageListRequest,
  AdminImageMetaInput
} from './image-params';

export type AdminImageOwnerOption = {
  value: string;
  label: string;
  count: number;
};

export type AdminImageBrowseGroupOption = AdminImageBrowseFilterOption;

export type AdminImageBrowseSubgroupOption = AdminImageBrowseFilterOption;

export type AdminImageBrowseIndexItem = {
  path: string;
  origin: AdminImageOrigin;
  fileName: string;
  owner: string | null;
  ownerLabel: string | null;
  browseGroup: Exclude<AdminImageBrowseGroup, 'all'>;
  browseGroupLabel: string;
  browseSubgroup: string;
  browseSubgroupLabel: string | null;
  preferredValue: string | null;
  previewSrc: string | null;
};

export type AdminImageListItem = {
  path: string;
  value: string;
  origin: AdminImageOrigin;
  fileName: string;
  owner: string | null;
  ownerLabel: string | null;
  browseGroup: Exclude<AdminImageBrowseGroup, 'all'>;
  browseGroupLabel: string;
  browseSubgroup: string;
  browseSubgroupLabel: string | null;
  preferredValue: string | null;
  width: number | null;
  height: number | null;
  size: number | null;
  mimeType: string | null;
  previewSrc: string | null;
};

export type AdminImageListResult = {
  field: AdminImageFieldContext | null;
  directory: AdminImageDirectory;
  owner: string;
  ownerOptions: AdminImageOwnerOption[];
  scope: AdminImageScopeKey | '';
  group: string;
  subgroup: string;
  groupOptions: AdminImageBrowseGroupOption[];
  subgroupOptions: AdminImageBrowseSubgroupOption[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  items: AdminImageListItem[];
};

export type AdminImageMetaResult = {
  kind: 'local' | 'remote';
  path: string | null;
  value: string;
  origin: AdminImageOrigin | null;
  width: number | null;
  height: number | null;
  size: number | null;
  mimeType: string | null;
  previewSrc: string | null;
};

type AdminImageAssetRecord = {
  path: string;
  origin: AdminImageOrigin;
  fileName: string;
  owner: string | null;
  ownerLabel: string | null;
};

type AdminImageAssetBrowseMeta = {
  browseGroup: AdminImageBrowseResolvedGroup;
  browseGroupLabel: string;
  browseSubgroup: string;
  browseSubgroupLabel: string | null;
  preferredValue: string | null;
  hiddenFromBrowse: boolean;
};

type AdminImageBrowseAsset = AdminImageAssetRecord & { value: string } & AdminImageAssetBrowseMeta;

type ContentCollectionKey = keyof typeof CONTENT_COLLECTION_LABELS;

type AdminImageContentOwner = {
  value: string;
  label: string;
  aliases: string[];
};

type LocalImageTarget = {
  path: string;
  value: string;
  origin: AdminImageOrigin;
  previewSrc: string | null;
};

type FieldImageTarget =
  | { kind: 'local'; target: LocalImageTarget }
  | { kind: 'remote'; url: string };

type AdminImageInspectionMeta = Pick<AdminImageMetaResult, 'width' | 'height' | 'size' | 'mimeType'>;

type AdminImageShortCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const IMAGE_LOCAL_EXT_RE = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;
const MARKDOWN_EXT_RE = /\.(?:md|mdx)$/i;
const RELATIVE_CONTENT_ASSET_RE = /!\[[^\]]*]\(([^)]+)\)|<img[^>]+src=["']([^"']+)["']/g;
const ADMIN_IMAGE_SHORT_CACHE_TTL_MS = 3_000;
const ADMIN_IMAGE_SHORT_CACHE_MAX_ENTRIES = 32;
const CONTENT_COLLECTION_LABELS = {
  essay: '随笔',
  bits: '絮语',
  memo: '小记'
} as const;
const OWNER_PATH_SEPARATORS = ['/', '.', '-', '_'] as const;
const ADMIN_IMAGE_SCAN_ROOTS = [
  {
    origin: 'public',
    prefix: 'public',
    pathSegments: ['public']
  },
  {
    origin: 'src/assets',
    prefix: 'src/assets',
    pathSegments: ['src', 'assets']
  },
  {
    origin: 'src/content',
    prefix: 'src/content',
    pathSegments: ['src', 'content']
  }
] as const satisfies readonly {
  origin: AdminImageOrigin;
  prefix: Exclude<AdminImageDirectory, ''>;
  pathSegments: readonly string[];
}[];

const MIME_BY_EXT: Record<string, string> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};
const ADMIN_IMAGE_PAGE_ALLOWLIST = [
  { prefix: 'public/images/archive/', subgroup: 'archive', label: 'Archive' },
  { prefix: 'public/images/home/', subgroup: 'home', label: 'Home' },
  { prefix: 'public/images/about/', subgroup: 'about', label: 'About' }
] as const;

const ADMIN_IMAGE_ASSET_SUBGROUP_LABELS = {
  avatar: '头像',
  other: '其他'
} as const;

const SYSTEM_ASSET_FILE_PATTERNS = [
  /^favicon(?:[-\w]*)?\.(?:avif|gif|jpe?g|png|svg|webp)$/i,
  /^apple-touch-icon(?:[-\w]*)?\.(?:avif|gif|jpe?g|png|svg|webp)$/i,
  /^preview-[^/]+\.(?:avif|gif|jpe?g|png|svg|webp)$/i
] as const;
const adminImageOwnerOptionsCache = new Map<string, AdminImageShortCacheEntry<AdminImageContentOwner[]>>();
const adminImageOwnerOptionsPendingLoads = new Map<string, Promise<AdminImageContentOwner[]>>();
const adminImageAssetListCache = new Map<string, AdminImageShortCacheEntry<AdminImageAssetRecord[]>>();
const adminImageAssetListPendingLoads = new Map<string, Promise<AdminImageAssetRecord[]>>();
const adminImageInspectionMetaCache = new Map<string, AdminImageShortCacheEntry<AdminImageInspectionMeta>>();
const adminImageInspectionMetaPendingLoads = new Map<string, Promise<AdminImageInspectionMeta>>();
const adminImageScopeIndexCache = new Map<string, AdminImageShortCacheEntry<AdminImageScopeIndex>>();
const adminImageScopeIndexPendingLoads = new Map<string, Promise<AdminImageScopeIndex>>();

const getProjectRoot = (): string => process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT?.trim() || process.cwd();
const toAbsoluteAssetPath = (assetPath: string): string => path.join(getProjectRoot(), ...assetPath.split('/'));
const getAdminImageCacheKey = (...parts: string[]): string => `${getProjectRoot()}::${parts.join('::')}`;

const readAdminImageShortCache = <T>(
  cache: Map<string, AdminImageShortCacheEntry<T>>,
  key: string
): T | null => {
  const cached = cache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.value;
};

const writeAdminImageShortCache = <T>(
  cache: Map<string, AdminImageShortCacheEntry<T>>,
  key: string,
  value: T
): T => {
  cache.set(key, {
    expiresAt: Date.now() + ADMIN_IMAGE_SHORT_CACHE_TTL_MS,
    value
  });
  while (cache.size > ADMIN_IMAGE_SHORT_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey !== 'string') break;
    cache.delete(oldestKey);
  }
  return value;
};

const withAdminImageShortCache = async <T>(
  cache: Map<string, AdminImageShortCacheEntry<T>>,
  pendingLoads: Map<string, Promise<T>>,
  key: string,
  load: () => Promise<T>
): Promise<T> => {
  const cached = readAdminImageShortCache(cache, key);
  if (cached !== null) return cached;

  const pending = pendingLoads.get(key);
  if (pending) return pending;

  const nextLoad = load()
    .then((value) => writeAdminImageShortCache(cache, key, value))
    .finally(() => {
      pendingLoads.delete(key);
    });
  pendingLoads.set(key, nextLoad);
  return nextLoad;
};

const toDevFsPreviewSrc = (assetPath: string): string =>
  `/@fs/${encodeURI(toAbsoluteAssetPath(assetPath).replace(/\\/g, '/'))}`;

const getPreviewSrcFromPath = (assetPath: string): string | null => {
  if (assetPath.startsWith('public/')) return `/${assetPath.slice('public/'.length)}`;
  if (assetPath.startsWith('src/assets/') || assetPath.startsWith('src/content/')) {
    return toDevFsPreviewSrc(assetPath);
  }
  return null;
};

const getMimeType = (assetPath: string): string | null =>
  MIME_BY_EXT[path.extname(assetPath).toLowerCase()] ?? null;

const isImageFile = (name: string): boolean => IMAGE_LOCAL_EXT_RE.test(name);

const walkImageFiles = async (dirPath: string): Promise<string[]> => {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return walkImageFiles(fullPath);
      }
      return entry.isFile() && isImageFile(entry.name) ? [fullPath] : [];
    })
  );
  return nested.flat();
};

const walkMarkdownFiles = async (dirPath: string): Promise<string[]> => {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return walkMarkdownFiles(fullPath);
      }
      return entry.isFile() && MARKDOWN_EXT_RE.test(entry.name) ? [fullPath] : [];
    })
  );
  return nested.flat();
};

const stripQuotes = (value: string): string => value.replace(/^['"]|['"]$/g, '').trim();

const humanizeEntryId = (value: string): string =>
  value
    .split(/[/-]+/)
    .filter(Boolean)
    .join(' ')
    .trim();

const extractContentTitle = (source: string): string | null => {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const frontmatterSource = match[1] ?? '';

  const titleLine = frontmatterSource
    .split(/\r?\n/)
    .find((line) => line.trimStart().startsWith('title:'));

  if (!titleLine) return null;
  const [, rawTitle = ''] = titleLine.split(/:(.+)/, 2);
  const normalized = stripQuotes(rawTitle);
  return normalized || null;
};

const normalizeRelativeContentAssetRef = (value: string): string | null => {
  const normalized = stripQuotes((value.split(/[?#]/, 1)[0] ?? '').trim());
  if (
    !normalized
    || normalized.startsWith('/')
    || normalized.startsWith('//')
    || /^[A-Za-z]+:\/\//.test(normalized)
    || !normalized.startsWith('.')
  ) {
    return null;
  }

  return normalized;
};

const extractContentAssetAliases = (source: string, ownerValue: string): string[] => {
  const aliases = new Set<string>([ownerValue]);
  const ownerDirectory = path.posix.dirname(ownerValue);

  for (const match of source.matchAll(RELATIVE_CONTENT_ASSET_RE)) {
    const relativeRef = normalizeRelativeContentAssetRef(match[1] ?? match[2] ?? '');
    if (!relativeRef) continue;

    const resolvedPath = path.posix.normalize(path.posix.join(ownerDirectory, relativeRef));
    if (!resolvedPath.startsWith('src/content/')) continue;

    aliases.add(resolvedPath);
    const resolvedDirectory = path.posix.dirname(resolvedPath);
    if (resolvedDirectory && resolvedDirectory !== ownerDirectory) {
      aliases.add(resolvedDirectory);
    }
  }

  return Array.from(aliases);
};

const loadContentOwnerOptions = async (): Promise<AdminImageContentOwner[]> => {
  const projectRoot = getProjectRoot();
  const contentRoot = path.join(projectRoot, 'src', 'content');
  if (!existsSync(contentRoot)) return [];
  const cacheKey = getAdminImageCacheKey('content-owners');

  return withAdminImageShortCache(
    adminImageOwnerOptionsCache,
    adminImageOwnerOptionsPendingLoads,
    cacheKey,
    async () => {
      const markdownFiles = await walkMarkdownFiles(contentRoot);
      const owners = await Promise.all(
        markdownFiles.map(async (filePath) => {
          const relativeFilePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
          const relativeWithoutExt = relativeFilePath.replace(MARKDOWN_EXT_RE, '');
          const segments = relativeWithoutExt.split('/');
          const collection = segments[2] as ContentCollectionKey | undefined;
          if (!collection || !(collection in CONTENT_COLLECTION_LABELS)) return null;

          const entryId = segments.slice(3).join('/');
          if (!entryId) return null;

          const source = await readFile(filePath, 'utf8');
          const title = extractContentTitle(source);
          const fallbackId = entryId.endsWith('/index') ? entryId.slice(0, -'/index'.length) : entryId;
          const normalizedTitle = title || humanizeEntryId(fallbackId || entryId) || entryId;

          return {
            value: relativeWithoutExt,
            label: `${CONTENT_COLLECTION_LABELS[collection]} · ${normalizedTitle}`,
            aliases: extractContentAssetAliases(source, relativeWithoutExt)
          } satisfies AdminImageContentOwner;
        })
      );

      return owners.filter((owner): owner is AdminImageContentOwner => owner !== null);
    }
  );
};

const resolveAssetOwner = (
  assetPath: string,
  owners: readonly AdminImageContentOwner[]
): AdminImageContentOwner | null => {
  const matched = owners
    .map((owner) => {
      const matchingAlias = owner.aliases
        .filter((alias) =>
          assetPath === alias
          || OWNER_PATH_SEPARATORS.some((separator) => assetPath.startsWith(`${alias}${separator}`))
          || (alias.endsWith('/index') && assetPath.startsWith(`${alias.slice(0, -'/index'.length)}/`))
        )
        .sort((left, right) => right.length - left.length)[0];

      return matchingAlias
        ? {
            owner,
            aliasLength: matchingAlias.length
          }
        : null;
    })
    .filter((entry): entry is { owner: AdminImageContentOwner; aliasLength: number } => entry !== null)
    .sort((left, right) => right.aliasLength - left.aliasLength);

  return matched[0]?.owner ?? null;
};

const resolveImageScanTargets = (
  directory: AdminImageDirectory
): Array<{ origin: AdminImageOrigin; rootPath: string }> => {
  const projectRoot = getProjectRoot();
  if (!directory) {
    return ADMIN_IMAGE_SCAN_ROOTS.map((root) => ({
      origin: root.origin,
      rootPath: path.join(projectRoot, ...root.pathSegments)
    }));
  }

  const matchedRoot = ADMIN_IMAGE_SCAN_ROOTS.find(
    (root) => directory === root.prefix || directory.startsWith(`${root.prefix}/`)
  );
  if (!matchedRoot) return [];

  return [
    {
      origin: matchedRoot.origin,
      rootPath: path.join(projectRoot, ...directory.split('/'))
    }
  ];
};

const getOriginSortRank = (assetPath: string): number => {
  const index = ADMIN_IMAGE_SCAN_ROOTS.findIndex((root) => assetPath.startsWith(`${root.prefix}/`));
  return index === -1 ? ADMIN_IMAGE_SCAN_ROOTS.length : index;
};

const listAdminImageAssets = async (
  directory: AdminImageDirectory,
  contentOwners?: readonly AdminImageContentOwner[]
): Promise<AdminImageAssetRecord[]> => {
  const projectRoot = getProjectRoot();
  const cacheKey = getAdminImageCacheKey('asset-list', directory || 'all');

  return withAdminImageShortCache(
    adminImageAssetListCache,
    adminImageAssetListPendingLoads,
    cacheKey,
    async () => {
      const roots = resolveImageScanTargets(directory);
      const resolvedContentOwners = roots.some((root) => root.origin === 'src/content')
        ? (contentOwners?.length ? [...contentOwners] : await loadContentOwnerOptions())
        : [];

      const entries = await Promise.all(
        roots.map(async ({ origin, rootPath }) => {
          if (!existsSync(rootPath)) return [] as AdminImageAssetRecord[];
          const files = await walkImageFiles(rootPath);
          return files.map((filePath) => {
            const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
            const matchedOwner = origin === 'src/content'
              ? resolveAssetOwner(relativePath, resolvedContentOwners)
              : null;

            return {
              path: relativePath,
              origin,
              fileName: path.basename(filePath),
              owner: matchedOwner?.value ?? null,
              ownerLabel: matchedOwner?.label ?? null
            } satisfies AdminImageAssetRecord;
          });
        })
      );

      return entries.flat();
    }
  );
};

const sortImageAssets = (field: AdminImageFieldContext | null, left: AdminImageAssetRecord, right: AdminImageAssetRecord): number => {
  const rankDiff = field
    ? getAdminImageFieldSortRank(field, left.path) - getAdminImageFieldSortRank(field, right.path)
    : getOriginSortRank(left.path) - getOriginSortRank(right.path);
  if (rankDiff !== 0) return rankDiff;
  return left.path.localeCompare(right.path);
};

const getCompatibleFieldValues = (record: AdminImageAssetRecord): string[] =>
  getAdminImageCompatibleFieldValues(record.path, record.origin);

const getPreferredFieldValue = (record: AdminImageAssetRecord): string | null => {
  const compatibleValues = getCompatibleFieldValues(record);
  const [preferredValue] = compatibleValues;
  return compatibleValues.length === 1 ? preferredValue ?? null : null;
};

const isSystemAssetPath = (assetPath: string): boolean => {
  // Theme Console 站点图标托管目录整体按系统资产处理，不进入浏览与字段选择列表。
  if (assetPath.startsWith('public/images/site/')) return true;
  if (path.posix.dirname(assetPath) !== 'public') return false;
  const fileName = path.posix.basename(assetPath);
  return SYSTEM_ASSET_FILE_PATTERNS.some((pattern) => pattern.test(fileName));
};

const getBitsBrowseSubgroup = (assetPath: string): { browseSubgroup: string; browseSubgroupLabel: string | null } => {
  const relativePath = assetPath.startsWith('public/bits/')
    ? assetPath.slice('public/bits/'.length)
    : assetPath.startsWith('src/content/bits/')
      ? assetPath.slice('src/content/bits/'.length)
      : '';
  const firstSegment = relativePath.split('/', 1)[0] ?? '';
  if (/^(?:19|20)\d{2}$/.test(firstSegment)) {
    return {
      browseSubgroup: firstSegment,
      browseSubgroupLabel: firstSegment
    };
  }

  return {
    browseSubgroup: '',
    browseSubgroupLabel: null
  };
};

const resolveBrowseMeta = (record: AdminImageAssetRecord): AdminImageAssetBrowseMeta => {
  const preferredValue = getPreferredFieldValue(record);
  if (isSystemAssetPath(record.path)) {
    return {
      browseGroup: 'uncategorized',
      browseGroupLabel: ADMIN_IMAGE_BROWSE_GROUP_LABELS.uncategorized,
      browseSubgroup: '',
      browseSubgroupLabel: null,
      preferredValue,
      hiddenFromBrowse: true
    };
  }

  if (record.path.startsWith('src/content/essay/')) {
    return {
      browseGroup: 'essay',
      browseGroupLabel: ADMIN_IMAGE_BROWSE_GROUP_LABELS.essay,
      browseSubgroup: record.owner ?? '',
      browseSubgroupLabel: record.ownerLabel,
      preferredValue,
      hiddenFromBrowse: false
    };
  }

  if (record.path.startsWith('src/content/memo/') || record.path.startsWith('public/images/memo/')) {
    return {
      browseGroup: 'memo',
      browseGroupLabel: ADMIN_IMAGE_BROWSE_GROUP_LABELS.memo,
      browseSubgroup: '',
      browseSubgroupLabel: null,
      preferredValue,
      hiddenFromBrowse: false
    };
  }

  if (record.path.startsWith('src/content/bits/') || record.path.startsWith('public/bits/')) {
    const bitsSubgroup = getBitsBrowseSubgroup(record.path);
    return {
      browseGroup: 'bits',
      browseGroupLabel: ADMIN_IMAGE_BROWSE_GROUP_LABELS.bits,
      browseSubgroup: bitsSubgroup.browseSubgroup,
      browseSubgroupLabel: bitsSubgroup.browseSubgroupLabel,
      preferredValue,
      hiddenFromBrowse: false
    };
  }

  if (record.path.startsWith('public/author/')) {
    return {
      browseGroup: 'assets',
      browseGroupLabel: ADMIN_IMAGE_BROWSE_GROUP_LABELS.assets,
      browseSubgroup: 'avatar',
      browseSubgroupLabel: ADMIN_IMAGE_ASSET_SUBGROUP_LABELS.avatar,
      preferredValue,
      hiddenFromBrowse: false
    };
  }

  if (record.path.startsWith('src/assets/')) {
    return {
      browseGroup: 'assets',
      browseGroupLabel: ADMIN_IMAGE_BROWSE_GROUP_LABELS.assets,
      browseSubgroup: 'other',
      browseSubgroupLabel: ADMIN_IMAGE_ASSET_SUBGROUP_LABELS.other,
      preferredValue,
      hiddenFromBrowse: false
    };
  }

  const matchedPage = ADMIN_IMAGE_PAGE_ALLOWLIST.find((item) => record.path.startsWith(item.prefix));
  if (matchedPage) {
    return {
      browseGroup: 'pages',
      browseGroupLabel: ADMIN_IMAGE_BROWSE_GROUP_LABELS.pages,
      browseSubgroup: matchedPage.subgroup,
      browseSubgroupLabel: matchedPage.label,
      preferredValue,
      hiddenFromBrowse: false
    };
  }

  return {
    browseGroup: 'uncategorized',
    browseGroupLabel: ADMIN_IMAGE_BROWSE_GROUP_LABELS.uncategorized,
    browseSubgroup: '',
    browseSubgroupLabel: null,
    preferredValue,
    hiddenFromBrowse: false
  };
};

export const invalidateAdminImageCaches = (): void => {
  adminImageOwnerOptionsCache.clear();
  adminImageOwnerOptionsPendingLoads.clear();
  adminImageAssetListCache.clear();
  adminImageAssetListPendingLoads.clear();
  adminImageInspectionMetaCache.clear();
  adminImageInspectionMetaPendingLoads.clear();
  adminImageScopeIndexCache.clear();
  adminImageScopeIndexPendingLoads.clear();
};

const toAdminImageBrowseAsset = (asset: AdminImageAssetRecord): AdminImageBrowseAsset | null => {
  const browseMeta = resolveBrowseMeta(asset);
  if (browseMeta.hiddenFromBrowse) return null;
  return {
    ...asset,
    value: asset.path,
    ...browseMeta
  } satisfies AdminImageBrowseAsset;
};

const listAdminImageBrowseAssets = async (): Promise<AdminImageBrowseAsset[]> => {
  const assets = await listAdminImageAssets('');
  return assets
    .map(toAdminImageBrowseAsset)
    .filter((asset): asset is AdminImageBrowseAsset => asset !== null)
    .sort((left, right) => sortImageAssets(null, left, right));
};

export const listAdminImageBrowseIndex = async (): Promise<AdminImageBrowseIndexItem[]> => {
  const browseAssets = await listAdminImageBrowseAssets();
  return browseAssets.map((asset) => ({
    path: asset.path,
    origin: asset.origin,
    fileName: asset.fileName,
    owner: asset.owner,
    ownerLabel: asset.ownerLabel,
    browseGroup: asset.browseGroup,
    browseGroupLabel: asset.browseGroupLabel,
    browseSubgroup: asset.browseSubgroup,
    browseSubgroupLabel: asset.browseSubgroupLabel,
    preferredValue: asset.preferredValue,
    previewSrc: getPreviewSrcFromPath(asset.path)
  }));
};

export const listAdminImageScopeIndex = async (): Promise<AdminImageScopeIndex> => {
  const cacheKey = getAdminImageCacheKey('scope-index');

  return withAdminImageShortCache(
    adminImageScopeIndexCache,
    adminImageScopeIndexPendingLoads,
    cacheKey,
    async () => {
      const browseAssets = await listAdminImageBrowseAssets();
      const recent = (
        await Promise.all(
          browseAssets.map(async (asset) => {
            try {
              const fileStat = await stat(toAbsoluteAssetPath(asset.path));
              return {
                path: asset.path,
                mtimeMs: fileStat.mtimeMs
              };
            } catch {
              return null;
            }
          })
        )
      )
        .filter((entry): entry is { path: string; mtimeMs: number } => entry !== null)
        .sort((left, right) => {
          const timeDiff = right.mtimeMs - left.mtimeMs;
          return timeDiff !== 0 ? timeDiff : left.path.localeCompare(right.path);
        })
        .map((entry) => entry.path);

      return {
        recent
      } satisfies AdminImageScopeIndex;
    }
  );
};

const toAdminImageListItem = async (
  item: AdminImageAssetRecord & { value: string },
  browseMeta: AdminImageAssetBrowseMeta = resolveBrowseMeta(item)
): Promise<AdminImageListItem> => {
  const meta = await readAdminLocalImageInspectionMeta(item.path);

  return {
    path: item.path,
    value: item.value,
    origin: item.origin,
    fileName: item.fileName,
    owner: item.owner,
    ownerLabel: item.ownerLabel,
    browseGroup: browseMeta.browseGroup,
    browseGroupLabel: browseMeta.browseGroupLabel,
    browseSubgroup: browseMeta.browseSubgroup,
    browseSubgroupLabel: browseMeta.browseSubgroupLabel,
    preferredValue: browseMeta.preferredValue,
    width: meta.width,
    height: meta.height,
    size: meta.size,
    mimeType: meta.mimeType,
    previewSrc: getPreviewSrcFromPath(item.path)
  } satisfies AdminImageListItem;
};
const readSvgSize = (buffer: Buffer): { width: number | null; height: number | null } => {
  const source = buffer.toString('utf8');
  const widthMatch = source.match(/\bwidth=["']([0-9.]+)(?:px)?["']/i);
  const heightMatch = source.match(/\bheight=["']([0-9.]+)(?:px)?["']/i);
  const parseSvgNumber = (value?: string): number | null => {
    if (!value) return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const width = parseSvgNumber(widthMatch?.[1]);
  const height = parseSvgNumber(heightMatch?.[1]);
  if (width && height) return { width, height };

  const viewBoxMatch = source.match(/\bviewBox=["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*["']/i);
  return {
    width: parseSvgNumber(viewBoxMatch?.[1]),
    height: parseSvgNumber(viewBoxMatch?.[2])
  };
};

const readPngSize = (buffer: Buffer): { width: number; height: number } | null => {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
};

const readGifSize = (buffer: Buffer): { width: number; height: number } | null => {
  if (buffer.length < 10 || (buffer.toString('ascii', 0, 6) !== 'GIF87a' && buffer.toString('ascii', 0, 6) !== 'GIF89a')) {
    return null;
  }
  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8)
  };
};

const readJpegSize = (buffer: Buffer): { width: number; height: number } | null => {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (typeof marker !== 'number') {
      break;
    }

    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }

    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) break;

    const isSofMarker =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;

    if (isSofMarker) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }

    offset += 2 + length;
  }

  return null;
};

const readWebpSize = (buffer: Buffer): { width: number; height: number } | null => {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }

  const chunkType = buffer.toString('ascii', 12, 16);
  if (chunkType === 'VP8X' && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
  }

  if (chunkType === 'VP8 ' && buffer.length >= 30) {
    const signatureOffset = buffer.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 20);
    if (signatureOffset !== -1 && signatureOffset + 7 < buffer.length) {
      return {
        width: buffer.readUInt16LE(signatureOffset + 3) & 0x3fff,
        height: buffer.readUInt16LE(signatureOffset + 5) & 0x3fff
      };
    }
  }

  if (chunkType === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    };
  }

  return null;
};

export const readAdminLocalImageInspectionMeta = async (assetPath: string): Promise<AdminImageInspectionMeta> => {
  const absolutePath = toAbsoluteAssetPath(assetPath);
  if (!existsSync(absolutePath)) {
    throw new AdminImageError(`图片文件不存在：${assetPath}`, 404);
  }

  const cacheKey = getAdminImageCacheKey('inspection-meta', assetPath);
  return withAdminImageShortCache(
    adminImageInspectionMetaCache,
    adminImageInspectionMetaPendingLoads,
    cacheKey,
    async () => {
      const [buffer, fileStat] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
      const extension = path.extname(assetPath).toLowerCase();
      const sizeReaders = extension === '.svg'
        ? [readSvgSize]
        : [readPngSize, readGifSize, readJpegSize, readWebpSize];
      let width: number | null = null;
      let height: number | null = null;

      for (const reader of sizeReaders) {
        const result = reader(buffer);
        if (result) {
          width = result.width;
          height = result.height;
          break;
        }
      }

      return {
        width,
        height,
        size: fileStat.size,
        mimeType: getMimeType(assetPath)
      };
    }
  );
};

const readLocalImageMeta = async (target: LocalImageTarget): Promise<AdminImageMetaResult> => {
  const inspectionMeta = await readAdminLocalImageInspectionMeta(target.path);

  return {
    kind: 'local',
    path: target.path,
    value: target.value,
    origin: target.origin,
    width: inspectionMeta.width,
    height: inspectionMeta.height,
    size: inspectionMeta.size,
    mimeType: inspectionMeta.mimeType,
    previewSrc: target.previewSrc
  };
};

const resolveFieldImageTarget = (field: AdminImageFieldContext, rawValue: string): FieldImageTarget => {
  const value = rawValue.trim();
  if (!value) {
    throw new AdminImageError('图片值为空，无法读取元数据');
  }

  if (field === 'bits.images') {
    const safeRemoteUrl = toSafeHttpUrl(value);
    if (safeRemoteUrl.startsWith('https://')) return { kind: 'remote', url: safeRemoteUrl };

    const normalized = normalizeAdminLocalImageSource(value);
    if (!normalized) {
      throw new AdminImageError('bits.images 只允许 public/** 下的相对图片路径或 https:// 远程 URL');
    }

    return {
      kind: 'local',
      target: {
        path: `public/${normalized}`,
        value: normalized,
        origin: 'public',
        previewSrc: `/${normalized}`
      }
    };
  }

  if (field === 'page.bits.defaultAuthor.avatar') {
    const normalized = normalizeBitsAvatarPath(value);
    if (normalized === undefined || !normalized) {
      throw new AdminImageError('Bits 默认头像只允许相对图片路径（例如 author/avatar.webp）');
    }

    return {
      kind: 'local',
      target: {
        path: getBitsAvatarLocalFilePath(normalized) ?? `public/${normalized}`,
        value: normalized,
        origin: 'public',
        previewSrc: `/${normalized}`
      }
    };
  }

  const normalized = normalizeHeroImageSrc(value);
  if (!normalized) {
    throw new AdminImageError('Hero 图片只允许 src/assets/**、public 路径或 https:// 远程 URL');
  }

  if (normalized.startsWith('https://')) return { kind: 'remote', url: normalized };

  const localPath = getHeroImageLocalFilePath(normalized);
  if (!localPath) {
    throw new AdminImageError('Hero 图片地址不支持当前本地路径格式');
  }

  return {
    kind: 'local',
    target: {
      path: localPath,
      value: normalized,
      origin: localPath.startsWith('public/') ? 'public' : 'src/assets',
      previewSrc: getPreviewSrcFromPath(localPath)
    }
  };
};

const resolveLocalTargetFromPath = (assetPath: string): LocalImageTarget => {
  const normalizedPath = assetPath.trim().replace(/\\/g, '/');
  if (
    !normalizedPath
    || normalizedPath.startsWith('/')
    || normalizedPath.startsWith('//')
    || /^[A-Za-z]+:\/\//.test(normalizedPath)
    || /(^|\/)\.\.(?:\/|$)/.test(normalizedPath)
    || normalizedPath.includes('?')
    || normalizedPath.includes('#')
    || !IMAGE_LOCAL_EXT_RE.test(normalizedPath)
  ) {
    throw new AdminImageError('图片路径必须是 public/**、src/assets/** 或 src/content/** 下的规范仓库相对图片路径');
  }

  const canonicalPath = path.posix.normalize(normalizedPath);

  if (canonicalPath.startsWith('public/')) {
    return {
      path: canonicalPath,
      value: canonicalPath.slice('public/'.length),
      origin: 'public',
      previewSrc: getPreviewSrcFromPath(canonicalPath)
    };
  }

  if (canonicalPath.startsWith('src/assets/')) {
    return {
      path: canonicalPath,
      value: canonicalPath,
      origin: 'src/assets',
      previewSrc: getPreviewSrcFromPath(canonicalPath)
    };
  }

  if (canonicalPath.startsWith('src/content/')) {
    return {
      path: canonicalPath,
      value: canonicalPath,
      origin: 'src/content',
      previewSrc: getPreviewSrcFromPath(canonicalPath)
    };
  }

  throw new AdminImageError('图片路径必须是 public/**、src/assets/** 或 src/content/** 下的规范仓库相对图片路径');
};

export const getAdminImageMeta = async (input: AdminImageMetaInput): Promise<AdminImageMetaResult> => {
  const rawPath = 'path' in input && typeof input.path === 'string' ? input.path.trim() : '';
  if (rawPath) {
    return readLocalImageMeta(resolveLocalTargetFromPath(rawPath));
  }

  const rawValue = 'value' in input && typeof input.value === 'string' ? input.value.trim() : '';
  if (!('field' in input) || !input.field) {
    throw new AdminImageError('缺少 field 或 path，无法读取图片元数据');
  }

  if (!rawValue) {
    throw new AdminImageError('缺少图片值，无法读取元数据');
  }

  const fieldTarget = resolveFieldImageTarget(input.field, rawValue);
  if (fieldTarget.kind === 'remote') {
    return {
      kind: 'remote',
      path: null,
      value: fieldTarget.url,
      origin: null,
      width: null,
      height: null,
      size: null,
      mimeType: null,
      previewSrc: fieldTarget.url
    };
  }

  return readLocalImageMeta(fieldTarget.target);
};

export const listAdminImageItems = async ({
  field = null,
  directory = '',
  owner = '',
  origin = '',
  scope = '',
  group = '',
  subgroup = '',
  query = '',
  page = 1,
  limit = 20
}: Partial<AdminImageListRequest> = {}): Promise<AdminImageListResult> => {
  const normalizedQuery = query.trim();
  const normalizedOrigin = getAdminImageFieldAllowedOrigins(field).includes(origin as AdminImageOrigin)
    ? origin
    : '';
  const normalizedScope = !field && scope === 'recent' ? scope : '';
  const normalizedGroup = normalizeAdminImageBrowseGroup(group);
  const normalizedSubgroup = normalizeAdminImageBrowseSubgroup(subgroup);
  const safeLimit = Math.max(1, Math.min(limit, 60));
  const isScopeMode = normalizedScope === 'recent';
  const isBrowseMode = !field && normalizedGroup.length > 0;

  if (isScopeMode) {
    const browseAssets = await listAdminImageBrowseAssets();
    const scopePool = buildAdminImageScopeItems(
      normalizedScope,
      browseAssets,
      await listAdminImageScopeIndex()
    ).filter((item) => matchesAdminImageQuery(item, normalizedQuery));
    const totalPages = Math.max(1, Math.ceil(scopePool.length / safeLimit));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const startIndex = (safePage - 1) * safeLimit;
    const pageItems = scopePool.slice(startIndex, startIndex + safeLimit);
    const items = await Promise.all(pageItems.map((item) => toAdminImageListItem(item, item)));

    return {
      field: null,
      directory: '',
      owner: '',
      ownerOptions: [],
      scope: normalizedScope,
      group: '',
      subgroup: '',
      groupOptions: [],
      subgroupOptions: [],
      page: safePage,
      limit: safeLimit,
      totalCount: scopePool.length,
      totalPages,
      items
    };
  }

  if (isBrowseMode) {
    const browsePage = resolveAdminImageBrowsePage({
      items: await listAdminImageBrowseAssets(),
      group: normalizedGroup,
      subgroup: normalizedSubgroup,
      query: normalizedQuery,
      page,
      limit: safeLimit
    });
    const items = await Promise.all(browsePage.items.map((item) => toAdminImageListItem(item, item)));

    return {
      field: null,
      directory: '',
      owner: '',
      ownerOptions: [],
      scope: '',
      group: browsePage.activeGroup,
      subgroup: browsePage.activeGroup && browsePage.activeGroup !== 'all' ? browsePage.activeSubgroup : '',
      groupOptions: browsePage.groupOptions,
      subgroupOptions: browsePage.subgroupOptions,
      page: browsePage.page,
      limit: safeLimit,
      totalCount: browsePage.totalCount,
      totalPages: browsePage.totalPages,
      items
    };
  }

  const contentOwners = directory === 'src/content' ? await loadContentOwnerOptions() : [];
  const assets = await listAdminImageAssets(directory, contentOwners);
  const mappedAssets = assets
    .map((asset) => {
      const value = getAdminImageFieldValue(field, asset.path, asset.origin);
      if (!value) return null;
      return { ...asset, value };
    })
    .filter((asset): asset is AdminImageAssetRecord & { value: string } => asset !== null);
  const queryMatchedAssets = mappedAssets
    .filter((asset) => matchesAdminImageQuery(asset, normalizedQuery))
    .sort((left, right) => sortImageAssets(field, left, right));
  const ownerCountMap = queryMatchedAssets.reduce((counts, asset) => {
    if (!asset.owner) return counts;
    counts.set(asset.owner, (counts.get(asset.owner) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const ownerOptions = directory === 'src/content'
    ? contentOwners
        .map((contentOwner) => ({
          value: contentOwner.value,
          label: contentOwner.label,
          count: ownerCountMap.get(contentOwner.value) ?? 0
        }))
        .filter((option) => option.count > 0)
    : [];
  const normalizedOwner = directory === 'src/content'
    ? (() => {
        const candidate = normalizeAdminImageOwnerValue(owner);
        return ownerOptions.some((option) => option.value === candidate) ? candidate : '';
      })()
    : '';
  const filtered = queryMatchedAssets.filter((asset) =>
    (!normalizedOwner || asset.owner === normalizedOwner)
    && (!normalizedOrigin || asset.origin === normalizedOrigin)
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / safeLimit));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * safeLimit;
  const pageItems = filtered.slice(startIndex, startIndex + safeLimit);
  const items = await Promise.all(pageItems.map((item) => toAdminImageListItem(item)));

  return {
    field,
    directory,
    owner: normalizedOwner,
    ownerOptions,
    scope: '',
    group: '',
    subgroup: '',
    groupOptions: [],
    subgroupOptions: [],
    page: safePage,
    limit: safeLimit,
    totalCount: filtered.length,
    totalPages,
    items
  };
};
