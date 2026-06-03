import { createWithBase, toSafeHttpUrl } from '../utils/format';
import { normalizeContentImageSource } from '../utils/image-source';

export const DEFAULT_ABOUT_FRIENDS_TITLE = '朋友们';

export type AboutFriendInput = {
  name: string;
  url: string;
  description?: string | undefined;
  avatar?: string | undefined;
  visible?: boolean | undefined;
  order?: number | undefined;
};

export type AboutFriendViewModel = {
  name: string;
  url: string;
  description: string;
  avatarSrc: string;
};

export type AboutFriendApplyInput = {
  label?: string | undefined;
  href?: string | undefined;
};

export type AboutFriendApplyViewModel = {
  label: string;
  href: string;
};

export const normalizeAboutFriendUrl = (value: string): string | null =>
  toSafeHttpUrl(value) || null;

export const normalizeAboutFriendAvatarSource = (value: string): string | null =>
  normalizeContentImageSource(value);

export const normalizeAboutFriendApplyHref = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed || /[\r\n]/.test(trimmed)) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'mailto:') return trimmed;
  } catch {
    // Fall through to http(s) normalization below.
  }

  return normalizeAboutFriendUrl(trimmed);
};

export const resolveAboutFriendApply = (
  friendApply: AboutFriendApplyInput | null | undefined
): AboutFriendApplyViewModel | null => {
  const label = friendApply?.label?.trim() ?? '';
  const hrefInput = friendApply?.href?.trim() ?? '';
  if (!label || !hrefInput) return null;

  const href = normalizeAboutFriendApplyHref(hrefInput);
  return href ? { label, href } : null;
};

export const resolveAboutFriends = (
  friends: readonly AboutFriendInput[],
  base = '/'
): AboutFriendViewModel[] => {
  const withBase = createWithBase(base);

  return friends
    .map((friend, sourceIndex) => ({ friend, sourceIndex }))
    .filter(({ friend }) => friend.visible !== false)
    .sort((left, right) => {
      const leftOrder = typeof left.friend.order === 'number' ? left.friend.order : Number.POSITIVE_INFINITY;
      const rightOrder = typeof right.friend.order === 'number' ? right.friend.order : Number.POSITIVE_INFINITY;
      return leftOrder - rightOrder || left.sourceIndex - right.sourceIndex;
    })
    .map(({ friend }) => ({
      name: friend.name.trim(),
      url: friend.url.trim(),
      description: friend.description?.trim() ?? '',
      avatarSrc: friend.avatar ? withBase(friend.avatar.trim()) : ''
    }));
};
