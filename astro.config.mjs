import { fileURLToPath } from 'node:url';
import mdx from '@astrojs/mdx';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkDirective from 'remark-directive';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkCallout from './src/plugins/remark-callout.mjs';
import shikiToolbar from './src/plugins/shiki-toolbar.mjs';
import { site, hasSiteUrl } from './site.config.mjs';

const getSchemaAttrs = (tagName) => {
  const attrs = defaultSchema.attributes?.[tagName];
  return Array.isArray(attrs) ? attrs : [];
};

const mergeAttrs = (...lists) => Array.from(new Set(lists.flat()));
const SITEMAP_ROUTE_ROOTS = new Set(['about', 'admin', 'archive', 'bits', 'checks', 'essay', 'memo']);

const normalizeSitemapPathname = (page) => {
  let pathname = '/';

  try {
    pathname = new URL(page).pathname;
  } catch {
    [pathname = '/'] = page.split(/[?#]/, 1);
  }

  const normalizedPathname = pathname.replace(/\/+$/, '') || '/';
  const segments = normalizedPathname.split('/').filter(Boolean);
  const routeRootIndex = segments.findIndex((segment) => SITEMAP_ROUTE_ROOTS.has(segment));

  if (routeRootIndex > 0) {
    return `/${segments.slice(routeRootIndex).join('/')}`;
  }

  return normalizedPathname;
};

const isExcludedSitemapPathname = (pathname) =>
  pathname === '/admin'
  || pathname.startsWith('/admin/')
  || pathname === '/checks'
  || pathname.startsWith('/checks/')
  || pathname === '/bits/draft-dialog'
  || /^\/essay\/[^/]+$/.test(pathname);

const isExcludedSitemapEntry = (page) => isExcludedSitemapPathname(normalizeSitemapPathname(page));

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'cite',
    'figure',
    'figcaption',
    'picture',
    'source',
    'summary',
    'details',
    'dialog',
    'button',
    'svg',
    'path',
    'rect'
  ],
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    '*': [
      ...((defaultSchema.attributes?.['*'] ?? [])),
      'className',
      'class',
      'id',
      'title',
      'role',
      'style',
      'tabIndex',
      'tabindex',
      'aria-label',
      'aria-hidden',
      'aria-live',
      'aria-controls',
      'aria-haspopup',
      'aria-pressed',
      'data-icon',
      'data-lang',
      'data-lines',
      'data-state'
    ],
    a: mergeAttrs(getSchemaAttrs('a'), ['target', 'rel']),
    img: mergeAttrs(getSchemaAttrs('img'), ['loading', 'decoding', 'width', 'height']),
    source: mergeAttrs(getSchemaAttrs('source'), ['srcset', 'srcSet', 'type', 'media', 'sizes']),
    ul: [['className', 'gallery', 'cols-2', 'cols-3', 'contains-task-list']],
    figure: [['className', 'figure']],
    figcaption: [['className', 'figure-caption']],
    div: mergeAttrs(getSchemaAttrs('div'), ['dataIcon', 'dataLang', 'dataLines', 'data-icon', 'data-lang', 'data-lines']),
    p: mergeAttrs(getSchemaAttrs('p'), ['dataIcon', 'data-icon']),
    pre: mergeAttrs(getSchemaAttrs('pre'), ['dataLang', 'dataLines', 'data-lang', 'data-lines']),
    code: mergeAttrs(getSchemaAttrs('code'), ['dataLang', 'data-lang']),
    button: mergeAttrs(getSchemaAttrs('button'), [
      'type',
      'disabled',
      'title',
      'ariaLabel',
      'aria-label',
      'dataState',
      'data-state'
    ]),
    svg: [
      ...getSchemaAttrs('svg'),
      'viewBox',
      'width',
      'height',
      'fill',
      'stroke',
      'strokeWidth',
      'strokeLinecap',
      'strokeLinejoin',
      'ariaHidden'
    ],
    path: [
      ...getSchemaAttrs('path'),
      'd',
      'fill',
      'stroke',
      'strokeWidth',
      'strokeLinecap',
      'strokeLinejoin'
    ],
    rect: [...getSchemaAttrs('rect'), 'x', 'y', 'rx', 'ry', 'width', 'height']
  }
};

export default defineConfig({
  image: {
    // sharp is the default, just being explicit
    service: { entrypoint: 'astro/assets/services/sharp' },
    experimentalLayout: 'responsive', // your 6.0+ responsive default
  },
  
  // Required for RSS generation. Prefer SITE_URL; fallback keeps build passing.
  site: site.url,
  // DEV 使用 server output 允许 Theme Console 的 /api/admin/settings/ 处理读写；
  // 构建阶段回到 static，让 /admin/ 保持只读提示，并避免把该路径当作生产公开 API。
  output: process.env.NODE_ENV === 'production' ? 'static' : 'server',
  integrations: [
  
    mdx(),
  
    ...(hasSiteUrl
  
      ? [sitemap({ filter: (page) => !isExcludedSitemapEntry(page) })]
  
      : []),
  
  ],
  trailingSlash: 'always',
  build: {
    inlineStylesheets: 'auto'
  },
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  },
 markdown: {
 
     remarkPlugins: [remarkDirective, remarkCallout],
 
  rehypePlugins: [
  
    rehypeRaw,
  
  ], 
     shikiConfig: {
 
       themes: {
 
         light: 'github-light',
 
         dark: 'github-dark'
 
       },
 
       transformers: [shikiToolbar()]
 
     }
 
   }
 
 });