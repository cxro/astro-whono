import { performance } from 'node:perf_hooks';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import rehypeShiki from '@shikijs/rehype';
import type { RehypeShikiOptions } from '@shikijs/rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import type { Options as RehypeSanitizeOptions } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkDirective from 'remark-directive';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import type { Element, Root } from 'hast';
import remarkCallout from '../../plugins/remark-callout.mjs';
import { sanitizeSchema } from '../../plugins/sanitize-schema.mjs';
import shikiToolbar from '../../plugins/shiki-toolbar.mjs';
import {
  resolveAdminContentEntrySourcePath,
  type AdminContentCollectionKey
} from './content-shared';
import { extractMarkdownOutline } from './editor-outline';

export const ADMIN_PREVIEW_CODE_HIGHLIGHT_MODE = 'shiki-rehype' as const;

export type AdminPreviewCodeHighlightMode = typeof ADMIN_PREVIEW_CODE_HIGHLIGHT_MODE;

export type AdminMarkdownPreviewInput = {
  collection: AdminContentCollectionKey;
  entryId?: string;
  source: string;
};

export type AdminMarkdownPreviewResult = {
  collection: AdminContentCollectionKey;
  html: string;
  elapsedMs: number;
  codeHighlight: AdminPreviewCodeHighlightMode;
  warnings: string[];
};

const previewCodeHighlightCache: NonNullable<RehypeShikiOptions['cache']> = new Map();
const PREVIEW_IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpg', '.jpeg', '.png', '.svg', '.webp']);
const PREVIEW_OUTLINE_KEY_ATTR = 'data-admin-outline-key';

const PREVIEW_SHIKI_LANGUAGES: NonNullable<RehypeShikiOptions['langs']> = [
  'astro',
  'bash',
  'css',
  'dockerfile',
  'go',
  'html',
  'javascript',
  'jsx',
  'json',
  'markdown',
  'python',
  'rust',
  'scss',
  'sql',
  'svelte',
  'toml',
  'ts',
  'tsx',
  'typescript',
  'yaml'
];

const previewShikiOptions: RehypeShikiOptions = {
  themes: {
    light: 'github-light',
    dark: 'github-dark'
  },
  langs: PREVIEW_SHIKI_LANGUAGES,
  transformers: [shikiToolbar()],
  addLanguageClass: true,
  fallbackLanguage: 'text',
  cache: previewCodeHighlightCache
};

const getProjectRoot = (): string => process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT?.trim() || process.cwd();

const isInsideProject = (filePath: string): boolean => {
  const relative = path.relative(getProjectRoot(), filePath);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
};

const hasUrlScheme = (value: string): boolean => /^[a-z][a-z\d+.-]*:/i.test(value);

const toViteFsUrl = (filePath: string): string => `/@fs${pathToFileURL(filePath).pathname}`;

const getPreviewLocalImageSrc = (sourceFilePath: string, value: string): string | null => {
  const trimmed = value.trim();
  if (
    !trimmed
    || trimmed.startsWith('/')
    || trimmed.startsWith('//')
    || trimmed.startsWith('#')
    || trimmed.includes('?')
    || trimmed.includes('#')
    || hasUrlScheme(trimmed)
  ) {
    return null;
  }

  let decoded = trimmed;
  try {
    decoded = decodeURI(trimmed);
  } catch {}

  const filePath = path.resolve(path.dirname(sourceFilePath), decoded);
  if (!isInsideProject(filePath) || !PREVIEW_IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    return null;
  }

  return existsSync(filePath) ? toViteFsUrl(filePath) : null;
};

const createPreviewImageSrcPlugin = (sourceFilePath: string | null): Plugin<[], Root> => {
  return () => (tree) => {
    if (!sourceFilePath) return;

    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'img') return;
      const src = node.properties?.src;
      if (typeof src !== 'string') return;

      const previewSrc = getPreviewLocalImageSrc(sourceFilePath, src);
      if (previewSrc) {
        node.properties.src = previewSrc;
      }
    });
  };
};

const createPreviewOutlineAnchorPlugin = (source: string): Plugin<[], Root> => {
  const outlineItems = extractMarkdownOutline(source);
  const outlineKeyByPosition = new Map(outlineItems.map((item) => [item.key, item.key]));
  const outlineKeyByLine = new Map(outlineItems.map((item) => [item.line, item.key]));

  return () => (tree) => {
    if (outlineItems.length === 0) return;

    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'h2' && node.tagName !== 'h3') return;

      const start = node.position?.start;
      const positionKey = typeof start?.line === 'number' && typeof start.offset === 'number'
        ? `${start.line}:${start.offset}`
        : '';
      const outlineKey = positionKey
        ? outlineKeyByPosition.get(positionKey) ?? outlineKeyByLine.get(start?.line ?? 0)
        : outlineKeyByLine.get(start?.line ?? 0);
      if (!outlineKey) return;

      node.properties = {
        ...node.properties,
        [PREVIEW_OUTLINE_KEY_ATTR]: outlineKey
      };
    });
  };
};

const createPreviewProcessor = (sourceFilePath: string | null, source: string) =>
  unified()
    .use(remarkParse)
    .use(remarkDirective)
    .use(remarkCallout)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(createPreviewOutlineAnchorPlugin(source))
    .use(rehypeShiki, previewShikiOptions)
    .use(rehypeRaw)
    .use(createPreviewImageSrcPlugin(sourceFilePath))
    .use(rehypeSanitize, sanitizeSchema as unknown as RehypeSanitizeOptions)
    .use(rehypeStringify);

const roundElapsedMs = (value: number): number => Math.round(value * 10) / 10;

export const renderAdminMarkdownPreview = async ({
  collection,
  entryId,
  source
}: AdminMarkdownPreviewInput): Promise<AdminMarkdownPreviewResult> => {
  const startedAt = performance.now();
  const sourceFilePath = entryId ? resolveAdminContentEntrySourcePath(collection, entryId) : null;
  const previewProcessor = createPreviewProcessor(sourceFilePath, source);
  const file = await previewProcessor.process(source);

  return {
    collection,
    html: String(file),
    elapsedMs: roundElapsedMs(performance.now() - startedAt),
    codeHighlight: ADMIN_PREVIEW_CODE_HIGHLIGHT_MODE,
    warnings: file.messages.map((message) => String(message))
  };
};
