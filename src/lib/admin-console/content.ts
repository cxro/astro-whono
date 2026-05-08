import type { CollectionEntry } from 'astro:content';
import {
  listAdminCollectionSourceFiles,
  resolveAdminContentEntryIdFromSourcePath,
  toAdminContentRelativeProjectPath
} from './content-shared';
import { PAGE_SIZE_BITS } from '../../../site.config.mjs';
import {
  getEssayDerivedText,
  getEssaySlug,
  getMemoDerivedText,
  getPublished,
  getSortedEssays,
  type EssayEntry
} from '../content';
import {
  getBitAnchorId,
  getBitsPagePath,
  getBitSlug,
  getBitsDerivedText,
  getSortedBits,
  type BitsEntry
} from '../bits';
import { getTagKeys, isRoutableTagKey, normalizeTagLabel, toTagKey } from '../tags';
import { truncateText } from '../../utils/excerpt';
import {
  buildSearchHaystack,
  formatISODate,
  formatISODateUtc,
  tokenizeSearchQuery
} from '../../utils/format';

export type MemoEntry = CollectionEntry<'memo'>;
export type AdminContentCollectionKey = 'essay' | 'bits' | 'memo';
export type AdminContentScopeKey = 'all' | AdminContentCollectionKey;
export type AdminContentDraftFilter = 'all' | 'draft' | 'published';
export type AdminContentSortKey = 'recent' | 'title';
type AdminContentCollectionCountMap = Record<AdminContentCollectionKey, number>;

type CreateAdminContentIndexItemOptions = {
  includeSearchText: boolean;
};

export type AdminContentIndexItem = {
  collection: AdminContentCollectionKey;
  collectionLabel: string;
  id: string;
  publicEntryId: string;
  title: string;
  slug: string | null;
  relativePath: string;
  publicHref: string | null;
  isDraft: boolean;
  archive: boolean | null;
  date: Date | null;
  dateLabel: string;
  year: number | null;
  tags: string[];
  searchHaystack: string;
};

export type AdminContentFilterOption = {
  value: string;
  label: string;
  count: number;
};

export type AdminContentScopeOption = {
  value: AdminContentScopeKey;
  label: string;
  count: number;
};

export type AdminContentCollectionSection = {
  collection: AdminContentCollectionKey;
  collectionLabel: string;
  totalCount: number;
  filteredCount: number;
  items: AdminContentIndexItem[];
};

export type AdminContentFilterState = {
  collection: AdminContentScopeKey;
  query: string;
  queryTokens: string[];
  draft: AdminContentDraftFilter;
  tag: string;
  year: number | null;
  sort: AdminContentSortKey;
};

export type AdminContentConsolePageData = {
  collection: AdminContentScopeKey;
  collectionLabel: string;
  totalCount: number;
  filteredCount: number;
  items: AdminContentIndexItem[];
  sections: AdminContentCollectionSection[];
  collectionOptions: AdminContentScopeOption[];
  tagOptions: AdminContentFilterOption[];
  yearOptions: AdminContentFilterOption[];
  filterState: AdminContentFilterState;
  hasActiveFilters: boolean;
};

export const ADMIN_CONTENT_COLLECTIONS = ['essay', 'bits', 'memo'] as const satisfies readonly AdminContentCollectionKey[];

export const ADMIN_CONTENT_SCOPE_OPTIONS = [
  { value: 'all', label: '全部内容' },
  { value: 'essay', label: '随笔' },
  { value: 'bits', label: '絮语' },
  { value: 'memo', label: '小记' }
] as const satisfies readonly { value: AdminContentScopeKey; label: string }[];

export const ADMIN_CONTENT_SORT_OPTIONS = [
  { value: 'recent', label: '最近更新' },
  { value: 'title', label: '标题 A-Z' }
] as const satisfies readonly { value: AdminContentSortKey; label: string }[];

export const ADMIN_CONTENT_DRAFT_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'published', label: '仅非草稿' },
  { value: 'draft', label: '仅草稿' }
] as const satisfies readonly { value: AdminContentDraftFilter; label: string }[];

const COLLECTION_LABELS: Record<AdminContentCollectionKey, string> = {
  essay: '随笔',
  bits: '絮语',
  memo: '小记'
};

const MISSING_VALUE = '(未设置)';
const TAG_LABEL_COLLATOR = new Intl.Collator('zh-CN', {
  sensitivity: 'variant',
  numeric: true
});
const COLLECTION_ORDER = new Map<AdminContentCollectionKey, number>(
  ADMIN_CONTENT_COLLECTIONS.map((collection, index) => [collection, index])
);

const isAdminContentDraftFilter = (value: string): value is AdminContentDraftFilter =>
  ADMIN_CONTENT_DRAFT_OPTIONS.some((option) => option.value === value);

const isAdminContentSortKey = (value: string): value is AdminContentSortKey =>
  ADMIN_CONTENT_SORT_OPTIONS.some((option) => option.value === value);

const isAdminContentScopeKey = (value: string): value is AdminContentScopeKey =>
  value === 'all' || ADMIN_CONTENT_COLLECTIONS.includes(value as AdminContentCollectionKey);

const normalizePositiveInteger = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeOptionalText = (value: string | null | undefined): string =>
  typeof value === 'string' ? value.trim() : '';

const normalizeAdminContentTagFilter = (value: string | null): string => {
  const key = toTagKey(normalizeOptionalText(value));
  return isRoutableTagKey(key) ? key : '';
};

const normalizeFieldValue = (value: string | null | undefined, emptyValue = MISSING_VALUE): string => {
  const normalized = normalizeOptionalText(value);
  return normalized || emptyValue;
};

const orderByNullableDateDesc = (left: Date | null, right: Date | null): number => {
  if (left && right) return right.valueOf() - left.valueOf();
  if (left) return -1;
  if (right) return 1;
  return 0;
};

const orderByMemoDate = (left: MemoEntry, right: MemoEntry): number =>
  orderByNullableDateDesc(left.data.date ?? null, right.data.date ?? null);

const formatNullableDate = (date: Date | null): { label: string; value: string | null; year: number | null } => {
  if (!date) {
    return {
      label: '未设置日期',
      value: null,
      year: null
    };
  }

  return {
    label: formatISODate(date),
    value: formatISODateUtc(date),
    year: date.getUTCFullYear()
  };
};

type ContentEntryWithSourcePath = {
  id: string;
  filePath?: string;
};

// Admin 操作使用源文件身份；Astro entry.id 仅作为公开 entry id / slug 来源。
const resolveContentEntrySourceIdentity = (
  collection: AdminContentCollectionKey,
  entry: ContentEntryWithSourcePath
): { entryId: string; publicEntryId: string; relativePath: string } => {
  const filePath = typeof entry.filePath === 'string' ? entry.filePath.trim() : '';
  if (!filePath) {
    return {
      entryId: entry.id,
      publicEntryId: entry.id,
      relativePath: `src/content/${collection}/${entry.id}`
    };
  }

  const relativePath = toAdminContentRelativeProjectPath(filePath);
  return {
    entryId: resolveAdminContentEntryIdFromSourcePath(collection, relativePath),
    publicEntryId: entry.id,
    relativePath
  };
};

const encodeEntryIdPath = (entryId: string): string =>
  entryId
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

const buildYearOptions = (items: readonly AdminContentIndexItem[]): AdminContentFilterOption[] => {
  const counts = new Map<number, number>();
  for (const item of items) {
    if (item.year === null) continue;
    counts.set(item.year, (counts.get(item.year) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[0] - left[0])
    .map(([value, count]) => ({
      value: String(value),
      label: String(value),
      count
    }));
};

const compareTagLabel = (left: string, right: string): number =>
  TAG_LABEL_COLLATOR.compare(left, right);

const buildTagOptions = (
  items: readonly AdminContentIndexItem[],
  selectedTag: string
): AdminContentFilterOption[] => {
  const summaries = new Map<string, { label: string; count: number }>();

  for (const item of items) {
    const seenInItem = new Set<string>();

    for (const rawTag of item.tags) {
      const label = normalizeTagLabel(rawTag);
      if (!label) continue;

      const key = toTagKey(label);
      if (!isRoutableTagKey(key) || seenInItem.has(key)) continue;

      const current = summaries.get(key);
      if (current) {
        current.count += 1;
        if (compareTagLabel(label, current.label) < 0) current.label = label;
      } else {
        summaries.set(key, {
          label,
          count: 1
        });
      }

      seenInItem.add(key);
    }
  }

  if (selectedTag && !summaries.has(selectedTag)) {
    summaries.set(selectedTag, {
      label: selectedTag,
      count: 0
    });
  }

  return Array.from(summaries.entries())
    .map(([value, summary]) => ({
      value,
      label: summary.label,
      count: summary.count
    }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return compareTagLabel(left.label, right.label);
    });
};

const getContentCollectionTotalCount = (collectionCounts: AdminContentCollectionCountMap): number =>
  ADMIN_CONTENT_COLLECTIONS.reduce((total, collection) => total + collectionCounts[collection], 0);

const buildCollectionOptions = (collectionCounts: AdminContentCollectionCountMap): AdminContentScopeOption[] => {
  const totalCount = getContentCollectionTotalCount(collectionCounts);
  return ADMIN_CONTENT_SCOPE_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    count: option.value === 'all'
      ? totalCount
      : collectionCounts[option.value]
  }));
};

const buildBitsHrefMap = (entries: readonly BitsEntry[]): Map<string, string> => {
  const hrefById = new Map<string, string>();
  const publishedEntries = entries.filter((entry) => entry.data.draft !== true);

  publishedEntries.forEach((entry, index) => {
    const page = Math.floor(index / PAGE_SIZE_BITS) + 1;
    hrefById.set(entry.id, `${getBitsPagePath(page)}#${getBitAnchorId(entry.id)}`);
  });

  return hrefById;
};

const createEssayIndexItem = (
  entry: EssayEntry,
  options: CreateAdminContentIndexItemOptions
): AdminContentIndexItem => {
  const sourceIdentity = resolveContentEntrySourceIdentity('essay', entry);
  const derivedText = options.includeSearchText ? getEssayDerivedText(entry) : null;
  const title = normalizeFieldValue(entry.data.title, sourceIdentity.entryId);
  const { label, year } = formatNullableDate(entry.data.date);
  const slug = getEssaySlug(entry);
  const publicHref = entry.data.draft === true ? null : `/archive/${slug}/`;

  return {
    collection: 'essay',
    collectionLabel: COLLECTION_LABELS.essay,
    id: sourceIdentity.entryId,
    publicEntryId: sourceIdentity.publicEntryId,
    title,
    slug,
    relativePath: sourceIdentity.relativePath,
    publicHref,
    isDraft: entry.data.draft === true,
    archive: entry.data.archive !== false,
    date: entry.data.date,
    dateLabel: label,
    year,
    tags: entry.data.tags.slice(),
    searchHaystack: buildSearchHaystack([
      title,
      sourceIdentity.entryId,
      sourceIdentity.publicEntryId,
      slug,
      entry.data.description,
      entry.data.tags,
      derivedText?.text
    ])
  };
};

const createBitsIndexItem = (
  entry: BitsEntry,
  publicHrefById: ReadonlyMap<string, string>,
  options: CreateAdminContentIndexItemOptions
): AdminContentIndexItem => {
  const sourceIdentity = resolveContentEntrySourceIdentity('bits', entry);
  const shouldLoadDerivedText = options.includeSearchText || normalizeOptionalText(entry.data.title).length === 0;
  const derivedText = shouldLoadDerivedText ? getBitsDerivedText(entry) : null;
  const fallbackTitle = derivedText
    ? truncateText(derivedText.excerpt || derivedText.plainText, 48) || sourceIdentity.entryId
    : sourceIdentity.entryId;
  const title = normalizeFieldValue(entry.data.title, fallbackTitle);
  const { label, year } = formatNullableDate(entry.data.date);
  const slug = getBitSlug(entry);
  const publicHref = entry.data.draft === true ? null : publicHrefById.get(entry.id) ?? null;
  const authorName = normalizeOptionalText(entry.data.author?.name);
  const authorAvatar = normalizeOptionalText(entry.data.author?.avatar);

  return {
    collection: 'bits',
    collectionLabel: COLLECTION_LABELS.bits,
    id: sourceIdentity.entryId,
    publicEntryId: sourceIdentity.publicEntryId,
    title,
    slug,
    relativePath: sourceIdentity.relativePath,
    publicHref,
    isDraft: entry.data.draft === true,
    archive: null,
    date: entry.data.date,
    dateLabel: label,
    year,
    tags: entry.data.tags.slice(),
    searchHaystack: buildSearchHaystack([
      title,
      sourceIdentity.entryId,
      sourceIdentity.publicEntryId,
      slug,
      entry.data.description,
      entry.data.tags,
      authorName,
      authorAvatar,
      options.includeSearchText ? derivedText?.text : undefined
    ])
  };
};

const createMemoIndexItem = (
  entry: MemoEntry,
  options: CreateAdminContentIndexItemOptions
): AdminContentIndexItem => {
  const sourceIdentity = resolveContentEntrySourceIdentity('memo', entry);
  const derivedText = options.includeSearchText ? getMemoDerivedText(entry) : null;
  const title = normalizeFieldValue(entry.data.title, sourceIdentity.entryId);
  const { label, year } = formatNullableDate(entry.data.date ?? null);
  const slug = normalizeOptionalText(entry.data.slug) || null;
  const publicHref = entry.data.draft === true ? null : '/memo/';
  const subtitle = normalizeOptionalText(entry.data.subtitle);

  return {
    collection: 'memo',
    collectionLabel: COLLECTION_LABELS.memo,
    id: sourceIdentity.entryId,
    publicEntryId: sourceIdentity.publicEntryId,
    title,
    slug,
    relativePath: sourceIdentity.relativePath,
    publicHref,
    isDraft: entry.data.draft === true,
    archive: null,
    date: entry.data.date ?? null,
    dateLabel: label,
    year,
    tags: [],
    searchHaystack: buildSearchHaystack([
      title,
      sourceIdentity.entryId,
      sourceIdentity.publicEntryId,
      slug,
      subtitle,
      derivedText?.plainText
    ])
  };
};

const loadCollectionItems = async (
  collection: AdminContentCollectionKey,
  options: CreateAdminContentIndexItemOptions
): Promise<AdminContentIndexItem[]> => {
  switch (collection) {
    case 'essay':
      return (await getSortedEssays({ includeDraft: true })).map((entry) => createEssayIndexItem(entry, options));
    case 'bits': {
      const entries = await getSortedBits({ includeDraft: true });
      const publicHrefById = buildBitsHrefMap(entries);
      return entries.map((entry) => createBitsIndexItem(entry, publicHrefById, options));
    }
    case 'memo':
      return (await getPublished('memo', { includeDraft: true, orderBy: orderByMemoDate }))
        .map((entry) => createMemoIndexItem(entry, options));
    default:
      throw new Error(`Unsupported admin content collection: ${String(collection)}`);
  }
};

const loadContentIndexItems = async (
  collections: readonly AdminContentCollectionKey[],
  options: CreateAdminContentIndexItemOptions
): Promise<AdminContentIndexItem[]> => {
  const collectionItems = await Promise.all(collections.map((collection) => loadCollectionItems(collection, options)));
  return collectionItems.flat();
};

const loadContentCollectionCounts = async (): Promise<AdminContentCollectionCountMap> => {
  const entries = await Promise.all(
    ADMIN_CONTENT_COLLECTIONS.map(async (collection) => {
      const files = await listAdminCollectionSourceFiles(collection);
      return [collection, files.length] as const;
    })
  );

  return Object.fromEntries(entries) as AdminContentCollectionCountMap;
};

const getAdminContentScopeLabel = (collection: AdminContentScopeKey): string =>
  collection === 'all' ? '全部内容' : COLLECTION_LABELS[collection];

const getAdminContentVisibleCollections = (collection: AdminContentScopeKey): readonly AdminContentCollectionKey[] =>
  collection === 'all' ? ADMIN_CONTENT_COLLECTIONS : [collection];

const orderAdminContentItemsByRecent = (items: readonly AdminContentIndexItem[]): AdminContentIndexItem[] =>
  items.slice().sort((left, right) => {
    const dateOrder = orderByNullableDateDesc(left.date, right.date);
    if (dateOrder !== 0) return dateOrder;
    const collectionOrder = (COLLECTION_ORDER.get(left.collection) ?? 0) - (COLLECTION_ORDER.get(right.collection) ?? 0);
    if (collectionOrder !== 0) return collectionOrder;
    return left.id.localeCompare(right.id, 'en');
  });

export const isAdminContentCollectionKey = (value: string): value is AdminContentCollectionKey =>
  ADMIN_CONTENT_COLLECTIONS.includes(value as AdminContentCollectionKey);

export const getAdminContentEntryEditHref = (
  collection: AdminContentCollectionKey,
  entryId: string
): string =>
  `/admin/content/${collection}/_edit/${encodeEntryIdPath(entryId)}/`;

export const getAdminContentEntryListHref = (collection: AdminContentCollectionKey): string => {
  const params = new URLSearchParams({
    collection
  });
  return `/admin/content/?${params.toString()}`;
};

export const getAdminContentFilterState = (searchParams: URLSearchParams): AdminContentFilterState => {
  const collectionValue = normalizeOptionalText(searchParams.get('collection'));
  const query = normalizeOptionalText(searchParams.get('q'));
  const draftValue = normalizeOptionalText(searchParams.get('draft'));
  const sortValue = normalizeOptionalText(searchParams.get('sort'));
  const year = normalizePositiveInteger(searchParams.get('year'));

  return {
    collection: isAdminContentScopeKey(collectionValue) ? collectionValue : 'all',
    query,
    queryTokens: tokenizeSearchQuery(query),
    draft: isAdminContentDraftFilter(draftValue) ? draftValue : 'all',
    tag: normalizeAdminContentTagFilter(searchParams.get('tag')),
    year,
    sort: isAdminContentSortKey(sortValue) ? sortValue : 'recent'
  };
};

export const filterAdminContentItems = (
  items: readonly AdminContentIndexItem[],
  filterState: AdminContentFilterState
): AdminContentIndexItem[] => {
  const tagKey = normalizeAdminContentTagFilter(filterState.tag);
  const queryTokens = filterState.queryTokens;

  const filteredItems = items.filter((item) => {
    if (filterState.collection !== 'all' && item.collection !== filterState.collection) return false;
    if (filterState.draft === 'draft' && !item.isDraft) return false;
    if (filterState.draft === 'published' && item.isDraft) return false;
    if (tagKey && !getTagKeys(item.tags).includes(tagKey)) return false;
    if (filterState.year !== null && item.year !== filterState.year) return false;
    if (queryTokens.length > 0 && !queryTokens.every((token) => item.searchHaystack.includes(token))) return false;
    return true;
  });

  if (filterState.sort === 'title') {
    return filteredItems.slice().sort((left, right) => {
      const titleOrder = left.title.localeCompare(right.title, 'zh-Hans-CN');
      if (titleOrder !== 0) return titleOrder;
      return left.id.localeCompare(right.id, 'en');
    });
  }

  return orderAdminContentItemsByRecent(filteredItems);
};

const buildAdminContentCollectionSections = (
  collectionCounts: AdminContentCollectionCountMap,
  filteredItems: readonly AdminContentIndexItem[],
  collection: AdminContentScopeKey
): AdminContentCollectionSection[] => {
  const visibleCollections = getAdminContentVisibleCollections(collection);

  return visibleCollections.map((sectionCollection) => {
    const sectionItems = filteredItems.filter((item) => item.collection === sectionCollection);
    const totalCount = collectionCounts[sectionCollection];

    return {
      collection: sectionCollection,
      collectionLabel: COLLECTION_LABELS[sectionCollection],
      totalCount,
      filteredCount: sectionItems.length,
      items: sectionItems
    };
  });
};

export const getAdminContentConsolePageData = async (
  searchParams: URLSearchParams
): Promise<AdminContentConsolePageData> => {
  const filterState = getAdminContentFilterState(searchParams);
  const visibleCollections = getAdminContentVisibleCollections(filterState.collection);
  const includeSearchText = filterState.queryTokens.length > 0;
  const [collectionCounts, items] = await Promise.all([
    loadContentCollectionCounts(),
    loadContentIndexItems(visibleCollections, { includeSearchText })
  ]);
  const filteredItems = filterAdminContentItems(items, filterState);

  return {
    collection: filterState.collection,
    collectionLabel: getAdminContentScopeLabel(filterState.collection),
    totalCount: getContentCollectionTotalCount(collectionCounts),
    filteredCount: filteredItems.length,
    items,
    sections: buildAdminContentCollectionSections(collectionCounts, filteredItems, filterState.collection),
    collectionOptions: buildCollectionOptions(collectionCounts),
    tagOptions: buildTagOptions(items, filterState.tag),
    yearOptions: buildYearOptions(items),
    filterState,
    hasActiveFilters:
      filterState.collection !== 'all'
      || filterState.query.length > 0
      || filterState.draft !== 'all'
      || filterState.tag.length > 0
      || filterState.year !== null
      || filterState.sort !== 'recent'
  };
};

export const getAdminContentPublicFallbackLabel = (item: AdminContentIndexItem): string => {
  if (item.isDraft) {
    return 'draft 条目默认不暴露公开页';
  }

  if (item.collection === 'memo') {
    return 'memo 当前使用固定公开路由 /memo/';
  }

  if (item.collection === 'bits') {
    const anchorId = getBitAnchorId(item.slug ?? item.id);
    return `公开定位依赖 /bits/ 分页与锚点（${anchorId}）`;
  }

  return '当前条目未生成公开页链接';
};
