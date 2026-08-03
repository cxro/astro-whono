import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import { createPublicMarkdownConfig } from './src/plugins/markdown-pipeline.mjs';
import {
  getSelectedAstroApiFonts,
  resolveTypographyFromRawUiSettings
} from './src/lib/fonts/registry';
import { site, hasSiteUrl } from './site.config.mjs';

const isProductionBuild = process.env.NODE_ENV === 'production';
const SITEMAP_ROUTE_ROOTS = new Set(['about', 'admin', 'archive', 'bits', 'checks', 'essay', 'memo']);
const rawDeploymentBase = process.env.ASTRO_WHONO_BASE_PATH ?? '/';
const trimmedDeploymentBase = String(rawDeploymentBase).trim();

// Git Bash 的 MSYS 路径转换会把 "/blog" 这类值改写成 "C:/Program Files/Git/blog"，
// 导致深处的 "Missing parameter" 预渲染错误；在配置期直接报可读错误。
// 规避：命令前加 MSYS_NO_PATHCONV=1（或 MSYS2_ENV_CONV_EXCL=ASTRO_WHONO_BASE_PATH）。
if (/[:\s]/.test(trimmedDeploymentBase)) {
  throw new Error(
    `Invalid ASTRO_WHONO_BASE_PATH "${rawDeploymentBase}": looks like a filesystem path, not a URL base. ` +
      'If running under Git Bash, prefix the command with MSYS_NO_PATHCONV=1 to stop MSYS path conversion.',
  );
}

const normalizeDeploymentBase = (value) => {
  const segment = String(value ?? '').trim().replace(/^\/+|\/+$/g, '');
  return segment ? `/${segment}/` : '/';
};

const deploymentBase = normalizeDeploymentBase(rawDeploymentBase);

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

// ui.typography 选中 astro-fonts-api 字体时，构建期由 Astro Fonts API 下载自托管；
// 只下载被选中的条目，默认配置下 fonts 数组为空。config 期手读 ui.json（dev 下改字体需重启）。
const FONT_PROVIDERS = {
  google: () => fontProviders.google(),
  fontsource: () => fontProviders.fontsource()
};

const readUiSettingsRaw = () => {
  try {
    return JSON.parse(readFileSync(new URL('./src/data/settings/ui.json', import.meta.url), 'utf8'));
  } catch {
    return undefined;
  }
};

const selectedApiFonts = getSelectedAstroApiFonts(resolveTypographyFromRawUiSettings(readUiSettingsRaw()));
const fonts = selectedApiFonts.flatMap((entry) => {
  if (!entry.familyName) return [];

  if (entry.provider === 'local') {
    if (!entry.localVariants?.length) return [];
    return [{
      provider: fontProviders.local(),
      name: entry.familyName,
      cssVariable: `--font-${entry.id}`,
      options: {
        variants: entry.localVariants.map((variant) => ({
          weight: variant.weight,
          style: variant.style,
          src: [variant.src]
        }))
      }
    }];
  }

  if (!entry.provider || !FONT_PROVIDERS[entry.provider]) return [];
  return [{
    provider: FONT_PROVIDERS[entry.provider](),
    name: entry.familyName,
    cssVariable: `--font-${entry.id}`,
    weights: [...entry.weights],
    styles: ['normal'],
    subsets: entry.subsets ? [...entry.subsets] : ['latin']
  }];
});

export default defineConfig({
  // Required for RSS generation. Prefer SITE_URL; fallback keeps build passing.
  site: site.url,
  base: deploymentBase,
  // DEV 使用 server output 允许 Theme Console 的 /api/admin/settings/ 处理读写；
  // 构建阶段回到 static，让 /admin/ 保持只读提示，并避免把该路径当作生产公开 API。
  output: isProductionBuild ? 'static' : 'server',
  integrations,
  ...(fonts.length ? { fonts } : {}),
  trailingSlash: 'always',
  // Astro 7 起 compressHTML 默认值改为 'jsx'(按 JSX 规则吞行内空格);
  // 显式固定为 v6 的 HTML-aware 压缩,避免中英混排的行内空格被移除。
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto'
  },
  vite: {
    // 本次启动实际注册进 fonts[] 的 cssVariable 快照。BaseLayout 据此过滤 <Font> 渲染：
    // dev 下 ui.json 热改字体（config 期快照不含新条目）时跳过渲染而非让 Astro 抛
    // FontFamilyNotFound 崩掉全站；重启后生效。
    define: {
      'import.meta.env.ASTRO_WHONO_FONT_CSS_VARIABLES': JSON.stringify(
        fonts.map((font) => font.cssVariable).join(',')
      )
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    optimizeDeps: {
      include: [
        'emoji-picker-element',
        '@lucide/svelte/icons/*',
        '@codemirror/commands',
        '@codemirror/lang-markdown',
        '@codemirror/language',
        '@codemirror/state',
        '@codemirror/view',
        '@lezer/highlight'
      ]
    }
  },
  markdown: createPublicMarkdownConfig({ base: deploymentBase })
});
