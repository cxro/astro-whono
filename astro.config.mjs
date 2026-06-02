import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import remarkDirective from 'remark-directive';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import {
  markdownMathRawOptions,
  rehypeProtectMarkdownMath,
  rehypeRestoreMarkdownMathBoundary
} from './src/plugins/rehype-markdown-math-boundary.mjs';
import remarkCallout from './src/plugins/remark-callout.mjs';
import { sanitizeSchema } from './src/plugins/sanitize-schema.mjs';
import shikiToolbar from './src/plugins/shiki-toolbar.mjs';
import { site, hasSiteUrl } from './site.config.mjs';

const isProductionBuild = process.env.NODE_ENV === 'production';
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
const integrations = [
  ...(!isProductionBuild ? [svelte()] : []),
  ...(hasSiteUrl ? [sitemap({ filter: (page) => !isExcludedSitemapEntry(page) })] : [])
];

export default defineConfig({
  // Required for RSS generation. Prefer SITE_URL; fallback keeps build passing.
  site: site.url,
  // DEV 使用 server output 允许 Theme Console 的 /api/admin/settings/ 处理读写；
  // 构建阶段回到 static，让 /admin/ 保持只读提示，并避免把该路径当作生产公开 API。
  output: isProductionBuild ? 'static' : 'server',
  integrations,
  trailingSlash: 'always',
  build: {
    inlineStylesheets: 'auto'
  },
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    optimizeDeps: {
      include: ['emoji-picker-element']
    }
  },
  markdown: {
    remarkPlugins: [[remarkMath, { singleDollarTextMath: false }], remarkDirective, remarkCallout],
    // Only double-dollar syntax from remark-math may reach KaTeX; raw HTML math classes are scrubbed.
    rehypePlugins: [
      rehypeProtectMarkdownMath,
      [rehypeRaw, markdownMathRawOptions],
      rehypeRestoreMarkdownMathBoundary,
      [rehypeSanitize, sanitizeSchema],
      rehypeKatex
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
