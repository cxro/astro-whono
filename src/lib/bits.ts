import type { CollectionEntry } from 'astro:content';
import { getPublished, getPageSlice, getTotalPages, type GetPublishedOptions } from './content';
import { createWithBase, formatDateTime } from '../utils/format';
import { deriveBitsCardText } from './bits-card-view-model';
import {
  buildPublishedBitsHrefMap,
  compareBitsForRouting,
  getBitAnchorId,
  getBitsPagePath,
  type BitPublicOrderItem
} from './bits-public-routing';

export {
  buildPublishedBitsHrefMap,
  getBitAnchorId,
  getBitsPagePath,
  orderPublishedBitsForRouting,
  type BitPublicOrderItem
} from './bits-public-routing';

export type BitsEntry = CollectionEntry<'bits'>;
export type BitsYearOption = {
  value: number;
  count: number;
};

export type BitsIndexItem = {
  key: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  text: string;
  excerpt: string;
  date: string | null;
  dateLabel: string | null;
  year: number | null;
  page: number;
  href: string;
  thumbnail?: {
    src: string;
    width?: number;
    height?: number;
    alt: string;
  } | null;
};

export type BitsDerivedText = {
  plainText: string;
  text: string;
  excerpt: string;
  shouldRenderFull: boolean;
};

type BitsQueryOptions = Pick<GetPublishedOptions<'bits'>, 'includeDraft'>;

const MAX_INDEX_TEXT = 600;
export const MAX_PRIMARY_BITS_FILTER_YEARS = 2;
const shouldMemoizeBitQueries = import.meta.env.PROD;
const base = import.meta.env.BASE_URL ?? '/';
const withBase = createWithBase(base);

let sortedBitsPromise: Promise<BitsEntry[]> | null = null;
const bitsIndexPromiseByPageSize = new Map<number, Promise<BitsIndexItem[]>>();
const bitsDerivedTextById = new Map<string, BitsDerivedText>();

const cloneBitEntries = (entries: readonly BitsEntry[]) => entries.slice();

const shouldUseDefaultBitsCache = (includeDraft?: boolean) =>
  shouldMemoizeBitQueries && includeDraft !== true;

const toBitPublicOrderItem = (entry: BitsEntry): BitPublicOrderItem => ({
  id: entry.id,
  date: entry.data.date,
  draft: entry.data.draft === true
});

const orderByBitsDate = (left: BitsEntry, right: BitsEntry) =>
  compareBitsForRouting(toBitPublicOrderItem(left), toBitPublicOrderItem(right));

const loadSortedBits = ({ includeDraft }: BitsQueryOptions = {}) =>
  getPublished('bits', {
    ...(includeDraft === undefined ? {} : { includeDraft }),
    orderBy: orderByBitsDate
  });

export const getBitSlug = (entry: BitsEntry) => entry.data.slug ?? entry.id;

const buildBitsYearOptions = (bits: readonly BitsEntry[]): BitsYearOption[] => {
  const yearCountMap = new Map<number, number>();

  for (const bit of bits) {
    const year = bit.data.date.getFullYear();
    yearCountMap.set(year, (yearCountMap.get(year) ?? 0) + 1);
  }

  return Array.from(yearCountMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([value, count]) => ({
      value,
      count
    }));
};

export async function getSortedBits(options: BitsQueryOptions = {}) {
  if (!shouldUseDefaultBitsCache(options.includeDraft)) {
    return loadSortedBits(options);
  }

  sortedBitsPromise ??= loadSortedBits();
  return cloneBitEntries(await sortedBitsPromise);
}

export async function getBitsPageData(currentPage: number, pageSize: number) {
  const bits = await getSortedBits();
  const totalCount = bits.length;
  const totalPages = Math.max(getTotalPages(totalCount, pageSize), 1);

  return {
    items: getPageSlice(bits, currentPage, pageSize),
    yearOptions: buildBitsYearOptions(bits),
    totalCount,
    totalPages
  };
}

const getSearchIndexText = (plainText: string) =>
  plainText.length > MAX_INDEX_TEXT ? plainText.slice(0, MAX_INDEX_TEXT) : plainText;

const buildBitsDerivedText = (bit: BitsEntry): BitsDerivedText => {
  const derivedText = deriveBitsCardText(bit.body ?? '');

  return {
    plainText: derivedText.plainText,
    text: getSearchIndexText(derivedText.plainText),
    excerpt: derivedText.excerpt,
    shouldRenderFull: derivedText.shouldRenderFull
  };
};

export function getBitsDerivedText(bit: BitsEntry): BitsDerivedText {
  if (!shouldMemoizeBitQueries) {
    return buildBitsDerivedText(bit);
  }

  let derivedText = bitsDerivedTextById.get(bit.id);
  if (!derivedText) {
    derivedText = buildBitsDerivedText(bit);
    bitsDerivedTextById.set(bit.id, derivedText);
  }

  return derivedText;
}

const buildBitsIndex = async (pageSize: number) => {
  const bits = await getSortedBits();
  const publishedHrefById = buildPublishedBitsHrefMap(bits.map(toBitPublicOrderItem), pageSize);
  return bits.map((bit, index) => {
    const derivedText = getBitsDerivedText(bit);
    const page = Math.floor(index / pageSize) + 1;
    const firstImage = bit.data.images?.[0];
    const hrefPath = publishedHrefById.get(bit.id) ?? `${getBitsPagePath(page)}#${getBitAnchorId(bit.id)}`;

    return {
      key: bit.id,
      slug: getBitSlug(bit),
      title: bit.data.title ?? '',
      description: bit.data.description ?? '',
      tags: bit.data.tags ?? [],
      text: derivedText.text,
      excerpt: derivedText.excerpt,
      date: bit.data.date ? bit.data.date.toISOString() : null,
      dateLabel: bit.data.date ? formatDateTime(bit.data.date) : null,
      year: bit.data.date ? bit.data.date.getFullYear() : null,
      page,
      href: withBase(hrefPath),
      thumbnail: firstImage
        ? {
            src: withBase(firstImage.src),
            ...(firstImage.width ? { width: firstImage.width } : {}),
            ...(firstImage.height ? { height: firstImage.height } : {}),
            alt: firstImage.alt ?? ''
          }
        : null
    };
  });
};

export async function getBitsSearchIndex(pageSize: number) {
  if (!shouldMemoizeBitQueries) {
    return buildBitsIndex(pageSize);
  }

  let promise = bitsIndexPromiseByPageSize.get(pageSize);
  if (!promise) {
    promise = buildBitsIndex(pageSize);
    bitsIndexPromiseByPageSize.set(pageSize, promise);
  }

  const index = await promise;
  return index.map((item) => ({
    ...item,
    tags: item.tags.slice(),
    thumbnail: item.thumbnail
      ? {
          ...item.thumbnail
        }
      : null
  }));
}
