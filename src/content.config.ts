import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { ESSAY_PUBLIC_SLUG_RE } from './utils/slug-rules';
import { normalizeBitsAvatarPath } from './utils/format';
import { parseEssayDateInput, parseEssayPublishedAtInput } from './utils/date-only';
import { normalizeBitsImageSource } from './lib/bits-image-source';
import {
  DEFAULT_ABOUT_FRIENDS_TITLE,
  normalizeAboutFriendApplyHref,
  normalizeAboutFriendAvatarSource,
  normalizeAboutFriendUrl
} from './lib/about-page';

const slugRule = z
  .string()
  .regex(ESSAY_PUBLIC_SLUG_RE, 'slug must be lowercase kebab-case');

const essayBaseFields = {
  title: z.string(),
  description: z.string().optional(),
  date: z.unknown(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  archive: z.boolean().default(true),
  publishedAt: z.unknown().optional(),
  // Optional custom permalink. If present, it overrides the default public slug
  // derived from the entry id / path.
  slug: slugRule.optional()
};

const essayShape = {
  ...essayBaseFields,
  cover: z.string().optional(),
  badge: z.string().optional()
};

const essaySchema = z.object(essayShape).transform((data, ctx) => {
  const dateResult = parseEssayDateInput(data.date);
  if (!dateResult) {
    ctx.addIssue({
      code: 'custom',
      path: ['date'],
      message: 'date must be a valid YYYY-MM-DD date or ISO 8601 datetime'
    });
    return z.NEVER;
  }

  const publishedAtInput = data.publishedAt;
  const hasExplicitPublishedAt =
    publishedAtInput != null &&
    !(typeof publishedAtInput === 'string' && publishedAtInput.trim() === '');
  const publishedAt = hasExplicitPublishedAt
    ? parseEssayPublishedAtInput(publishedAtInput)
    : dateResult.publishedAt;

  if (hasExplicitPublishedAt && !publishedAt) {
    ctx.addIssue({
      code: 'custom',
      path: ['publishedAt'],
      message: 'publishedAt must be a valid ISO 8601 datetime with timezone'
    });
    return z.NEVER;
  }

  const normalizedData = { ...data };
  delete normalizedData.publishedAt;

  return {
    ...normalizedData,
    date: dateResult.date,
    ...(publishedAt ? { publishedAt } : {})
  };
});

const bitsImage = z.object({
  src: z
    .string()
    .superRefine((value, ctx) => {
      if (!normalizeBitsImageSource(value)) {
        ctx.addIssue({
          code: 'custom',
          message: 'images[].src 只允许 public/** 下的相对图片路径或 https:// 远程 URL，不要带 public/、不要以 / 开头，也不要使用 http、..、?、#'
        });
      }
    })
    .transform((value) => normalizeBitsImageSource(value) ?? value),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  alt: z.string().optional()
});

const bitsAuthorAvatar = z
  .string()
  .superRefine((value, ctx) => {
    const normalized = normalizeBitsAvatarPath(value);
    if (normalized === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'author.avatar 只允许相对图片路径（例如 author/avatar.webp），不要带 public/、不要以 / 开头，也不要使用 URL、..、?、#'
      });
      return;
    }
  })
  .transform((value) => normalizeBitsAvatarPath(value) ?? value);

const bitsAuthor = z.object({
  name: z.string().optional(),
  avatar: bitsAuthorAvatar.optional()
});

const optionalTextInput = z.preprocess(
  (value) => value === null ? undefined : value,
  z.string().trim().optional()
);

const optionalDisplayText = optionalTextInput
  .transform((value) => value || undefined);

const aboutFriendsTitle = optionalTextInput
  .transform((value) => value || DEFAULT_ABOUT_FRIENDS_TITLE);

const aboutFriendApply = z.preprocess(
  (value) => value === null ? undefined : value,
  z.object({
    label: optionalDisplayText,
    href: optionalDisplayText
  })
    .optional()
)
  .transform((value, ctx) => {
    if (!value) return undefined;

    const label = value.label ?? '';
    const hrefInput = value.href ?? '';
    if (!label && !hrefInput) return undefined;
    if (!label || !hrefInput) {
      ctx.addIssue({
        code: 'custom',
        message: 'friendApply.label 和 friendApply.href 必须同时存在'
      });
      return z.NEVER;
    }

    const href = normalizeAboutFriendApplyHref(hrefInput);
    if (!href) {
      ctx.addIssue({
        code: 'custom',
        path: ['href'],
        message: 'friendApply.href 只允许 mailto: 或 http(s): 外部入口'
      });
      return z.NEVER;
    }

    return { label, href };
  });

const aboutFriendUrl = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (!normalizeAboutFriendUrl(value)) {
      ctx.addIssue({
        code: 'custom',
        message: 'friends[].url 只允许 http(s): URL'
      });
    }
  })
  .transform((value) => normalizeAboutFriendUrl(value) ?? value);

const aboutFriendAvatar = z.preprocess(
  (value) => value === null ? undefined : value,
  z.string().trim().optional()
)
  .transform((value, ctx) => {
    if (!value) return undefined;

    const normalized = normalizeAboutFriendAvatarSource(value);
    if (!normalized) {
      ctx.addIssue({
        code: 'custom',
        message: 'friends[].avatar 只允许 public/** 下的相对图片路径或 https:// 远程 URL，不要带 public/、不要以 / 开头，也不要使用 http、..、?、#'
      });
      return z.NEVER;
    }

    return normalized;
  });

const aboutFriend = z.object({
  name: z.string().trim().min(1, 'friends[].name 不能为空'),
  url: aboutFriendUrl,
  description: optionalDisplayText,
  avatar: aboutFriendAvatar,
  visible: z.boolean().nullish().transform((value) => value ?? true),
  order: z.number().int().nullish().transform((value) => value ?? undefined)
});

const aboutFaqItem = z.object({
  question: z.string().trim().min(1, 'faq[].question 不能为空'),
  answer: z.string().trim().min(1, 'faq[].answer 不能为空')
});

const essay = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/essay' }),
  schema: essaySchema
});

const bits = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/bits' }),
  schema: z.object({
    // Bits can be untitled.
    title: z.string().optional(),
    description: z.string().optional(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    slug: slugRule.optional(),

    // Optional media for card display.
    images: z.array(bitsImage).optional(),
    author: bitsAuthor.optional()
  })
});

const memo = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/memo' }),
  schema: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    date: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    slug: z.string().optional()
  })
});

const about = defineCollection({
  loader: glob({ pattern: 'index.md', base: './src/content/about' }),
  schema: z.object({
    friendsTitle: aboutFriendsTitle,
    friendsDescription: optionalDisplayText,
    friendApply: aboutFriendApply,
    friends: z.array(aboutFriend).nullish().transform((value) => value ?? []),
    faq: z.array(aboutFaqItem).nullish().transform((value) => value ?? []),
    contactNote: optionalDisplayText
  })
});

export const collections = { essay, bits, memo, about };
