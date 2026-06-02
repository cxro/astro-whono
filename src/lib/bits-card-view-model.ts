import { createWithBase, formatDateTime } from '../utils/format';
import { deriveMarkdownText, truncateText } from '../utils/excerpt';

export const BITS_CARD_FULL_RENDER_LIMIT = 180;

export type BitsCardImageInput = {
  src?: string | undefined;
  width?: number | string | undefined;
  height?: number | string | undefined;
  alt?: string | undefined;
};

export type BitsCardAuthorInput = {
  name?: string | undefined;
  avatar?: string | undefined;
};

export type BitsCardText = {
  plainText: string;
  excerpt: string;
  shouldRenderFull: boolean;
};

export type BitsCardImageViewModel = {
  src: string;
  width?: number;
  height?: number;
  alt: string;
};

export type BitsCardViewModelInput = {
  id: string;
  slug?: string | undefined;
  bodyText: string;
  tags?: readonly string[] | undefined;
  date?: Date | string | null;
  images?: readonly BitsCardImageInput[] | undefined;
  author?: BitsCardAuthorInput | null | undefined;
  defaultAuthor?: BitsCardAuthorInput | null | undefined;
  base?: string | undefined;
  draft?: boolean | undefined;
};

export type BitsCardViewModel = {
  id: string;
  slug: string;
  draft: boolean;
  body: BitsCardText;
  authorName: string;
  authorAvatar: string;
  avatarLetter: string;
  placeText: string;
  normalTagItems: string[];
  hasTags: boolean;
  dateLabel: string;
  imageItems: BitsCardImageViewModel[];
  visibleImages: BitsCardImageViewModel[];
  firstImage: BitsCardImageViewModel | null;
  totalImages: number;
  wideIndex: number;
};

const maxVisibleImages = 4;

const toPositiveInteger = (value: number | string | undefined): number | undefined => {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : undefined;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const toDateLabel = (value: Date | string | null | undefined): string => {
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? '' : formatDateTime(value);
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.valueOf()) ? trimmed : formatDateTime(parsed);
};

export const deriveBitsCardText = (bodyText: string): BitsCardText => {
  const { plainText, excerptText } = deriveMarkdownText(bodyText);
  return {
    plainText,
    excerpt: truncateText(excerptText, BITS_CARD_FULL_RENDER_LIMIT),
    shouldRenderFull: plainText.length <= BITS_CARD_FULL_RENDER_LIMIT
  };
};

export const buildBitsCardViewModel = ({
  id,
  slug,
  bodyText,
  tags = [],
  date = null,
  images = [],
  author = null,
  defaultAuthor = null,
  base = '/',
  draft = false
}: BitsCardViewModelInput): BitsCardViewModel => {
  const withBase = createWithBase(base);
  const defaultAuthorName = (defaultAuthor?.name ?? 'Whono').trim() || 'Whono';
  const authorName = (author?.name ?? defaultAuthorName).trim() || defaultAuthorName;
  const authorAvatarRaw = (author?.avatar?.trim() || defaultAuthor?.avatar?.trim() || '');
  const imageItems = images
    .map((image) => {
      const src = (image.src ?? '').trim();
      if (!src) return null;
      const width = toPositiveInteger(image.width);
      const height = toPositiveInteger(image.height);
      return {
        src: withBase(src),
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
        alt: (image.alt ?? '').trim()
      };
    })
    .filter((image): image is BitsCardImageViewModel => image !== null);
  const placeTag = tags.find((tag) => tag.toLowerCase().startsWith('loc:')) ?? '';
  const placeText = placeTag ? placeTag.slice(4).trim() : '';
  const normalTagItems = tags
    .filter((tag) => !tag.toLowerCase().startsWith('loc:'))
    .map((tag) => `#${tag}`);
  const totalImages = imageItems.length;

  return {
    id,
    slug: slug || id,
    draft,
    body: deriveBitsCardText(bodyText),
    authorName,
    authorAvatar: authorAvatarRaw ? withBase(authorAvatarRaw) : '',
    avatarLetter: Array.from(authorName)[0] ?? 'W',
    placeText,
    normalTagItems,
    hasTags: Boolean(placeText || normalTagItems.length),
    dateLabel: toDateLabel(date),
    imageItems,
    visibleImages: imageItems.slice(0, maxVisibleImages),
    firstImage: totalImages === 1 ? imageItems[0] ?? null : null,
    totalImages,
    wideIndex: totalImages > 1 && totalImages <= maxVisibleImages && totalImages % 2 === 1 ? 0 : -1
  };
};
