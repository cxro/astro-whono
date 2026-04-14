import {
  getCollection,
  type CollectionEntry,
  type CollectionKey
} from 'astro:content';
import {
  ESSAY_PUBLIC_SLUG_RE,
  RESERVED_ESSAY_SLUGS,
  flattenEntryIdToSlug
} from '../utils/slug-rules';
import { deriveMarkdownText, truncateText } from '../utils/excerpt';
export { createWithBase } from '../utils/format';

type OrderBy<K extends CollectionKey> = (a: CollectionEntry<K>, b: CollectionEntry<K>) => number;

export type GetPublishedOptions<K extends CollectionKey> = {
  orderBy?: OrderBy<K>;
  includeDraft?: boolean;
};

/**
 * Check whether a slug collides with sibling static routes under /archive/
 * or /essay/.  After the route narrowing (catch-all → single-segment), only
 * exact matches need to be checked.
 *
 * NOTE: The primary defence is `assertUniqueEssaySlugs` which throws at build
 * time.  This predicate is kept in `getVisibleEssays` / `getArchiveEssays` as
 * defense-in-depth — it is NOT the main enforcement point.
 */
export const isReservedSlug = (slug: string) => RESERVED_ESSAY_SLUGS.has(slug);

export const getTotalPages = (itemCount: number, pageSize: number) =>
  Math.ceil(itemCount / pageSize);

export const getPageSlice = <T>(items: T[], currentPage: number, pageSize: number) => {
  const start = (currentPage - 1) * pageSize;
  return items.slice(start, start + pageSize);
};

export const buildPaginatedPaths = (totalPages: number) => {
  if (totalPages <= 1) return [];
  return Array.from({ length: totalPages - 1 }, (_, i) => ({
    params: { page: String(i + 2) }
  }));
};

export async function getPublished<K extends CollectionKey>(
  name: K,
  opts: GetPublishedOptions<K> = {}
) {
  const prod = import.meta.env.PROD;
  const includeDraft = opts.includeDraft ?? !prod;
  const filter = includeDraft ? undefined : ({ data }: CollectionEntry<K>) => data.draft !== true;
  const items = await getCollection(name, filter);

  if (!opts.orderBy) return items;
  return items.slice().sort(opts.orderBy);
}

export type EssayEntry = CollectionEntry<'essay'>;
export type MemoEntry = CollectionEntry<'memo'>;
type EssayQueryOptions = Pick<GetPublishedOptions<'essay'>, 'includeDraft'>;
export type EssayRouteEntry = {
  slug: string;
  entry: EssayEntry;
  prev: EssayEntry | null;
  next: EssayEntry | null;
};
export type EssayDerivedText = {
  plainText: string;
  text: string;
  excerpt: string;
};
export type MemoDerivedText = {
  plainText: string;
  excerptText: string;
};

export const getEssaySlug = (entry: EssayEntry) =>
  entry.data.slug ?? flattenEntryIdToSlug(entry.id);

const assertUniqueEssaySlugs = (entries: readonly EssayEntry[]) => {
  const seen = new Map<string, string>();
  const duplicates = new Map<string, string[]>();

  for (const entry of entries) {
    const slug = getEssaySlug(entry);
    const slugSource = entry.data.slug ? 'frontmatter.slug' : `entry.id (flattened from "${entry.id}")`;

    // --- reserved-word check (primary defence) ---
    if (isReservedSlug(slug)) {
      throw new Error(
        [
          'Essay route slug conflict detected.',
          `  Entry:       ${entry.id}`,
          `  Public slug: ${slug}`,
          `  Source:      ${slugSource}`,
          `  Reason:      "${slug}" is reserved for sibling static routes under /archive/ and /essay/.`,
          '  How to fix:  change frontmatter.slug, or rename the file/path so the final public slug is no longer reserved.'
        ].join('\n')
      );
    }

    // --- format validity check (catches bad flattened results) ---
    if (!ESSAY_PUBLIC_SLUG_RE.test(slug)) {
      throw new Error(
        [
          'Invalid public essay slug detected.',
          `  Entry:       ${entry.id}`,
          `  Public slug: ${slug}`,
          `  Source:      ${slugSource}`,
          '  Reason:      final public slug must be lowercase kebab-case.',
          '  How to fix:  provide a valid frontmatter.slug, or rename files/folders to kebab-case.'
        ].join('\n')
      );
    }

    // --- uniqueness check ---
    const firstEntryId = seen.get(slug);
    if (!firstEntryId) {
      seen.set(slug, entry.id);
      continue;
    }

    const duplicateIds = duplicates.get(slug) ?? [firstEntryId];
    duplicateIds.push(entry.id);
    duplicates.set(slug, duplicateIds);
  }

  if (duplicates.size === 0) return;

  const detail = Array.from(duplicates.entries())
    .map(([slug, entryIds]) => `"${slug}" <- ${entryIds.join(', ')}`)
    .join('; ');

  throw new Error(
    `Duplicate essay slug detected. Public essay slugs must be unique after path flattening. ${detail}`
  );
};

const orderByEssayDate = (a: EssayEntry, b: EssayEntry) => b.data.date.valueOf() - a.data.date.valueOf();
const shouldMemoizeEssayQueries = import.meta.env.PROD;
const shouldMemoizeMemoQueries = import.meta.env.PROD;
const MAX_ESSAY_INDEX_TEXT = 600;

let sortedEssaysPromise: Promise<EssayEntry[]> | null = null;
let visibleEssaysPromise: Promise<EssayEntry[]> | null = null;
let archiveEssaysPromise: Promise<EssayEntry[]> | null = null;
const essayDerivedTextById = new Map<string, EssayDerivedText>();
const memoDerivedTextById = new Map<string, MemoDerivedText>();

const cloneEssayEntries = (entries: readonly EssayEntry[]) => entries.slice();

const shouldUseDefaultEssayCache = (includeDraft?: boolean) =>
  shouldMemoizeEssayQueries && includeDraft !== true;

const loadSortedEssays = async ({ includeDraft }: EssayQueryOptions = {}) => {
  const essays = await getPublished('essay', {
    ...(includeDraft === undefined ? {} : { includeDraft }),
    orderBy: orderByEssayDate
  });
  assertUniqueEssaySlugs(essays);
  return essays;
};

const buildEssayDerivedText = (entry: EssayEntry): EssayDerivedText => {
  const { plainText, excerptText } = deriveMarkdownText(entry.body ?? '');

  return {
    plainText,
    text: plainText.length > MAX_ESSAY_INDEX_TEXT ? plainText.slice(0, MAX_ESSAY_INDEX_TEXT) : plainText,
    excerpt: truncateText(excerptText, 120)
  };
};

export function getEssayDerivedText(entry: EssayEntry): EssayDerivedText {
  if (!shouldMemoizeEssayQueries) {
    return buildEssayDerivedText(entry);
  }

  let derivedText = essayDerivedTextById.get(entry.id);
  if (!derivedText) {
    derivedText = buildEssayDerivedText(entry);
    essayDerivedTextById.set(entry.id, derivedText);
  }

  return derivedText;
}

const buildMemoDerivedText = (entry: MemoEntry): MemoDerivedText =>
  deriveMarkdownText(entry.body ?? '');

export function getMemoDerivedText(entry: MemoEntry): MemoDerivedText {
  if (!shouldMemoizeMemoQueries) {
    return buildMemoDerivedText(entry);
  }

  let derivedText = memoDerivedTextById.get(entry.id);
  if (!derivedText) {
    derivedText = buildMemoDerivedText(entry);
    memoDerivedTextById.set(entry.id, derivedText);
  }

  return derivedText;
}

export async function getSortedEssays(options: EssayQueryOptions = {}) {
  if (!shouldUseDefaultEssayCache(options.includeDraft)) {
    return loadSortedEssays(options);
  }

  sortedEssaysPromise ??= loadSortedEssays();
  return cloneEssayEntries(await sortedEssaysPromise);
}

export async function getVisibleEssays(options: EssayQueryOptions = {}) {
  if (!shouldUseDefaultEssayCache(options.includeDraft)) {
    const essays = await getSortedEssays(options);
    return essays.filter((entry) => !isReservedSlug(getEssaySlug(entry)));
  }

  visibleEssaysPromise ??= getSortedEssays().then((essays) =>
    essays.filter((entry) => !isReservedSlug(getEssaySlug(entry)))
  );
  return cloneEssayEntries(await visibleEssaysPromise);
}

export async function getArchiveEssays(options: EssayQueryOptions = {}) {
  if (!shouldUseDefaultEssayCache(options.includeDraft)) {
    const essays = await getSortedEssays(options);
    return essays.filter((entry) => entry.data.archive !== false && !isReservedSlug(getEssaySlug(entry)));
  }

  archiveEssaysPromise ??= getSortedEssays().then((essays) =>
    essays.filter((entry) => entry.data.archive !== false && !isReservedSlug(getEssaySlug(entry)))
  );
  return cloneEssayEntries(await archiveEssaysPromise);
}

export async function getVisibleEssayRouteEntries(options: EssayQueryOptions = {}) {
  const essays = await getVisibleEssays(options);
  return essays.map((entry, index) => ({
    slug: getEssaySlug(entry),
    entry,
    prev: essays[index - 1] ?? null,
    next: essays[index + 1] ?? null
  })) satisfies EssayRouteEntry[];
}
