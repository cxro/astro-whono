import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { ESSAY_PUBLIC_SLUG_RE } from './utils/slug-rules';
import { getBitsAvatarLocalFilePath, normalizeBitsAvatarPath } from './utils/format';

const slugRule = z
  .string()
  .regex(ESSAY_PUBLIC_SLUG_RE, 'slug must be lowercase kebab-case');

const baseFields = {
  title: z.string(),
  description: z.string().optional(),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  archive: z.boolean().default(true),
  // Optional custom permalink. If present, it overrides the default public slug
  // derived from the entry id / path.
  slug: slugRule.optional()
};

const bitsImage = z.object({
  src: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().optional()
});

const hasProjectFile = (relativePath: string): boolean =>
  existsSync(join(process.cwd(), ...relativePath.split('/')));

const bitsAuthorAvatar = z
  .string()
  .superRefine((value, ctx) => {
    const normalized = normalizeBitsAvatarPath(value);
    if (normalized === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'author.avatar only allows relative image paths (e.g., author/avatar.webp). Do not include public/, do not start with /, and do not use URL, .., ?, or #.'
      });
      return;
    }

    const localFilePath = getBitsAvatarLocalFilePath(normalized);
    if (localFilePath && !hasProjectFile(localFilePath)) {
      ctx.addIssue({
        code: 'custom',
        message: `The local file pointed to by author.avatar does not exist: ${localFilePath}`
      });
    }
  })
  .transform((value) => normalizeBitsAvatarPath(value) ?? value);

const bitsAuthor = z.object({
  name: z.string().optional(),
  avatar: bitsAuthorAvatar.optional()
});

const essay = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/essay' }),
  schema: z.object({
    ...baseFields,
    cover: z.string().optional(),
    badge: z.string().optional()
  })
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
    title: z.string(),
    subtitle: z.string().optional(),
    date: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    slug: z.string().optional()
  })
});

export const collections = { essay, bits, memo };
