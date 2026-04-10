import type { CollectionEntry } from "astro:content";
import { getPublished, getPageSlice, getTotalPages } from "./content";
import { createWithBase, formatDateTime } from "../utils/format";
import { deriveMarkdownText, truncateText } from "../utils/excerpt";

export type GalleryEntry = CollectionEntry<'bits'>;
export type GalleryYearOption = { value: number; count: number };
export type GalleryIndexItem = {
  key: string; slug: string; title: string; description: string; tags: string[];
  text: string; excerpt: string; date: string | null; dateLabel: string | null;
  year: number | null; page: number; href: string;
  thumbnail?: { src: string; width: number; height: number; alt: string } | null;
};
export type GalleryDerivedText = { plainText: string; text: string; excerpt: string; shouldRenderFull: boolean };

const MAX_INDEX_TEXT = 600;
const FULL_RENDER_LIMIT = 180;
export const MAX_PRIMARY_GALLERY_FILTER_YEARS = 2;
const orderByGalleryDate = (a: GalleryEntry, b: GalleryEntry) => b.data.date.valueOf() - a.data.date.valueOf();
const shouldMemoize = import.meta.env.PROD;
const base = import.meta.env.BASE_URL ?? '/';
const withBase = createWithBase(base);

let sortedPromise: Promise<GalleryEntry[]> | null = null;
const indexPromiseByPageSize = new Map<number, Promise<GalleryIndexItem[]>>();
const derivedTextById = new Map<string, GalleryDerivedText>();

const loadSorted = () => getPublished('bits', { orderBy: orderByGalleryDate });

export const getGallerySlug = (entry: GalleryEntry) => entry.data.slug ?? entry.id;
export const getGalleryAnchorId = (key: string) => `gallery-${key}`;
export const getGalleryPagePath = (page: number) => (page <= 1 ? '/gallery/' : '/gallery/page/' + page + '/');

const buildYearOptions = (items: readonly GalleryEntry[]): GalleryYearOption[] => {
  const yearCountMap = new Map<number, number>();
  for (const item of items) {
    const year = item.data.date.getFullYear();
    yearCountMap.set(year, (yearCountMap.get(year) ?? 0) + 1);
  }
  return Array.from(yearCountMap.entries()).sort((a, b) => b[0] - a[0]).map(([value, count]) => ({ value, count }));
};

export async function getSortedGallery() {
  if (!shouldMemoize) return loadSorted();
  sortedPromise ??= loadSorted();
  return (await sortedPromise).slice();
}

export async function getGalleryPageData(currentPage: number, pageSize: number) {
  const items = await getSortedGallery();
  const totalCount = items.length;
  const totalPages = Math.max(getTotalPages(totalCount, pageSize), 1);
  return { items: getPageSlice(items, currentPage, pageSize), yearOptions: buildYearOptions(items), totalCount, totalPages };
}

const getSearchIndexText = (plainText: string) => plainText.length > MAX_INDEX_TEXT ? plainText.slice(0, MAX_INDEX_TEXT) : plainText;

const buildDerivedText = (item: GalleryEntry): GalleryDerivedText => {
  const { plainText, excerptText } = deriveMarkdownText(item.body ?? '');
  return { plainText, text: getSearchIndexText(plainText), excerpt: truncateText(excerptText, FULL_RENDER_LIMIT), shouldRenderFull: plainText.length <= FULL_RENDER_LIMIT };
};

export function getGalleryDerivedText(item: GalleryEntry): GalleryDerivedText {
  if (!shouldMemoize) return buildDerivedText(item);
  let dt = derivedTextById.get(item.id);
  if (!dt) { dt = buildDerivedText(item); derivedTextById.set(item.id, dt); }
  return dt;
}

const buildIndex = async (pageSize: number) => {
  const items = await getSortedGallery();
  return items.map((item, index) => {
    const derivedText = getGalleryDerivedText(item);
    const page = Math.floor(index / pageSize) + 1;
    const firstImage = item.data.images?.[0];
    return {
      key: item.id, slug: getGallerySlug(item), title: item.data.title ?? '', description: item.data.description ?? '',
      tags: item.data.tags ?? [], text: derivedText.text, excerpt: derivedText.excerpt,
      date: item.data.date ? item.data.date.toISOString() : null,
      dateLabel: item.data.date ? formatDateTime(item.data.date) : null,
      year: item.data.date ? item.data.date.getFullYear() : null, page,
      href: `${withBase(getGalleryPagePath(page))}#${getGalleryAnchorId(item.id)}`,
      thumbnail: firstImage ? { src: withBase(firstImage.src), width: firstImage.width, height: firstImage.height, alt: firstImage.alt ?? '' } : null
    };
  });
};

export async function getGallerySearchIndex(pageSize: number) {
  if (!shouldMemoize) return buildIndex(pageSize);
  let promise = indexPromiseByPageSize.get(pageSize);
  if (!promise) { promise = buildIndex(pageSize); indexPromiseByPageSize.set(pageSize, promise); }
  const index = await promise;
  return index.map((item) => ({ ...item, tags: item.tags.slice(), thumbnail: item.thumbnail ? { ...item.thumbnail } : null }));
}
