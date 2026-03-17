import type { CollectionEntry } from 'astro:content';
import { getPublished, getPageSlice, getTotalPages } from './content';
import { createWithBase, formatDateTime } from '../utils/format';
import { cleanMarkdownToText, getBitsExcerpt } from '../utils/excerpt';

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
    width: number;
    height: number;
    alt: string;
  } | null;
};

const MAX_INDEX_TEXT = 600;
export const MAX_PRIMARY_BITS_FILTER_YEARS = 2;
const orderByBitsDate = (a: BitsEntry, b: BitsEntry) => b.data.date.valueOf() - a.data.date.valueOf();
const shouldMemoizeBitQueries = import.meta.env.PROD;
const base = import.meta.env.BASE_URL ?? '/';
const withBase = createWithBase(base);

let sortedBitsPromise: Promise<BitsEntry[]> | null = null;
const bitsIndexPromiseByPageSize = new Map<number, Promise<BitsIndexItem[]>>();

const cloneBitEntries = (entries: readonly BitsEntry[]) => entries.slice();

const loadSortedBits = () =>
  getPublished('bits', {
    orderBy: orderByBitsDate
  });

export const getBitSlug = (entry: BitsEntry) => entry.data.slug ?? entry.id;

export const getBitAnchorId = (key: string) => `bit-${key}`;

export const getBitsPagePath = (page: number) => (page <= 1 ? '/bits/' : `/bits/page/${page}/`);

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

export async function getSortedBits() {
  if (!shouldMemoizeBitQueries) {
    return loadSortedBits();
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

const buildBitsIndex = async (pageSize: number) => {
  const bits = await getSortedBits();
  return bits.map((bit, index) => {
    const plain = cleanMarkdownToText(bit.body ?? '');
    const text = plain.length > MAX_INDEX_TEXT ? plain.slice(0, MAX_INDEX_TEXT) : plain;
    const page = Math.floor(index / pageSize) + 1;
    const firstImage = bit.data.images?.[0];

    return {
      key: bit.id,
      slug: getBitSlug(bit),
      title: bit.data.title ?? '',
      description: bit.data.description ?? '',
      tags: bit.data.tags ?? [],
      text,
      excerpt: getBitsExcerpt(bit),
      date: bit.data.date ? bit.data.date.toISOString() : null,
      dateLabel: bit.data.date ? formatDateTime(bit.data.date) : null,
      year: bit.data.date ? bit.data.date.getFullYear() : null,
      page,
      href: `${withBase(getBitsPagePath(page))}#${getBitAnchorId(bit.id)}`,
      thumbnail: firstImage
        ? {
            src: withBase(firstImage.src),
            width: firstImage.width,
            height: firstImage.height,
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
