# astro-whono

[中文](README.md) | [English](README.en.md)

[![CI](https://img.shields.io/github/actions/workflow/status/cxro/astro-whono/ci.yml?style=flat&label=CI&labelColor=2E3440&color=A3BE8C&logo=githubactions&logoColor=ECEFF4)](https://github.com/cxro/astro-whono/actions/workflows/ci.yml)  [![Node](https://img.shields.io/badge/Node-%3E%3D22.12.0-81A1C1?style=flat&labelColor=2E3440&logo=nodedotjs&logoColor=ECEFF4)](README.en.md#requirements)  [![Astro](https://img.shields.io/github/package-json/dependency-version/cxro/astro-whono/astro?branch=main&style=flat&label=Astro&labelColor=2E3440&color=BC52EE&logo=astro&logoColor=ECEFF4)](https://docs.astro.build/)  [![License](https://img.shields.io/badge/License-MIT-4C566A?style=flat&labelColor=2E3440&logo=opensourceinitiative&logoColor=ECEFF4)](LICENSE)

**✨ astro-whono is now upgraded to Astro v6**

A minimal two-column Astro theme for personal writing and lightweight publishing.

## Links

- Live demo: <https://astro.whono.me>
- Repository: <https://github.com/cxro/astro-whono>


## Preview

<p align="center">
  <img src="public/preview-light.png" width="49%" alt="Light preview" />
  <img src="public/preview-dark.png" width="49%" alt="Dark preview" />
</p>


## Features

- Two-column layout (sidebar navigation + content area)
- Responsive design for mobile devices
- Content collections: essay / bits / memo / about (archive is generated from essay)
- Built-in local Admin Console (`/admin`): use Theme / Content / Images / Checks / Data Console in development to manage site settings, content, and assets, and take over the theme after forking or cloning
- Bits draft generator on `/bits/`: one-click Markdown output (copy/download), with multi-image support and automatic image dimension detection
- RSS: default archive feed + section feeds
- Light / dark theme + reading mode


## Getting Started

### Requirements

- Node.js 22.12+ (`.nvmrc` recommended)


### Quick Start

```bash
npm install
# Repeatable install (recommended for CI/troubleshooting)
# npm ci
npm run dev
npm run build
```

<details>
  <summary>Windows (PowerShell) note</summary>

If execution policy blocks `npm.ps1`, use one of the following:

- `cmd /c npm run ...`
- Or use Git Bash / WSL
</details>


### Common Commands

  - `npm run dev`: start the local dev server
  - `npm run build`: generate the static site
  - `npm run preview`: preview the production build
  - `npm run new:bit`: create a bits draft

<details>
  <summary>Maintainer checks</summary>

These commands are for maintaining the theme itself. Regular writing and deployment usually do not require them.

```bash
# Baseline verification: Astro check, Vitest, build
npm run verify

# Markdown rendering contract: run after changing rendering, article styles, or the code block toolbar
npm run build
npm run check:markdown-smoke

# Release artifact check: requires the final production domain
SITE_URL=https://your-domain npm run build
SITE_URL=https://your-domain npm run check:prod-artifacts

# Admin boundary check: only when changing /admin/** or /api/admin/**
npm run check:preview-admin

# Production dependency audit: run before release or after dependency changes
npm run audit:prod
```
</details>


## Deployment

### One-click Deploy

[![Deploy to Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=flat&logo=vercel&logoColor=white)](https://vercel.com/new/clone?repository-url=https://github.com/cxro/astro-whono)&nbsp;&nbsp;[![Deploy to Netlify](https://img.shields.io/badge/Deploy-Netlify-00C7B7?style=flat&logo=netlify&logoColor=white)](https://app.netlify.com/start/deploy?repository=https://github.com/cxro/astro-whono)&nbsp;&nbsp;[![Deploy to Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?style=flat&logo=cloudflare&logoColor=white)](https://dash.cloudflare.com/?to=/:account/workers-and-pages)

> For production, set: `SITE_URL=https://your-domain` (without a trailing slash).
> If not set, the site can still run, but link metadata for sharing/indexing may be incomplete.

<details>
  <summary><strong>Cloudflare Pages deployment (manual repository import)</strong></summary>

**Build settings**
- Framework preset: `Astro`
- Build command: `npm run build`
- Output directory: `dist`

**Node.js version (usually not required)**
- This project includes `.nvmrc`, and Cloudflare Pages reads it automatically.
- If you need to set it manually, add `NODE_VERSION=22.22.0` in environment variables.

**Environment variables (strongly recommended for production)**
- In Pages project -> Settings -> Environment variables, add: `SITE_URL=https://your-domain` (for example `https://astro.whono.me`, without a trailing `/`).

**Why set `SITE_URL`?**
- Astro uses it to generate canonical, Open Graph `og:url`, RSS links, sitemap, and other fields that require absolute URLs. Without `SITE_URL`, deployment still works, but these links may fall back to relative paths or placeholder domains, which can hurt share previews and search indexing.

**About sitemap / robots**
- `sitemap` is generated only when `SITE_URL` is set, and `/robots.txt` includes a `Sitemap:` line only in that case (to avoid pointing to the wrong domain).

</details>

<details>
<summary><strong>Post-deploy checklist</strong></summary>

- Home page / list pages / detail pages are accessible
- RSS endpoints are accessible (`/rss.xml` and section feeds)
- With `SITE_URL` set: canonical / `og:url` point to your domain
- No network requests to demo-domain resources

</details>


## Configuration and Entry Points

### Project Entry Points

- Site config: `site.config.mjs`
- Content collections: `src/content.config.ts`
- Shared style entry: `src/styles/global.css`
- Page / scene style entries: `src/styles/home.css`, `src/styles/about.css`, `src/styles/memo.css`, `src/styles/article.css`, `src/styles/bits-page.css`
- Admin style entry: `src/styles/components/admin/shell.css` + route-specific styles under `src/styles/components/admin/**`; the full `admin.css` aggregate is no longer provided

### Admin Console (`/admin`)

astro-whono includes a local Admin Console as the development entry point for viewing the site overview, adjusting theme settings, and importing/exporting settings snapshots.

#### Admin Entry Points

Admin Console is intended for **local development** by default.

Start the dev server:

```bash
npm install
npm run dev
```

Then open `http://localhost:4321/admin/` in your browser.
(If you changed the dev server port, replace `4321` with your actual port.)

| Entry | Status | Purpose |
| :---: | :---: | :--- |
| `/admin/` | Available | Stable Admin entry and Site Overview |
| `/admin/theme/` | Available | Theme Console for editing site information, sidebar, home page, inner-page copy, and more |
| `/admin/images/` | Available | Image resource browser and path helper |
| `/admin/checks/` | Available | Structured diagnostics and pre-release checks |
| `/admin/data/` | Available | Settings snapshot export / dry-run import / confirmed write |
| `/admin/content/` | Available | Content management, essay / bits draft creation, local editing for essay / bits / memo / about page, and source export |


<details>
<summary><strong>🖼️ Theme Console Overview </strong></summary>

astro-whono provides a local Theme Console for centralized theme-level configuration in development.<br>

#### Current Theme Console Support

Theme Console mainly covers **site-level** and **page-level** settings, including:

- Site title, description, brand name, and other basic metadata
- `/admin/` Overview public visibility and hidden-state copy
- Home intro copy and Hero image settings
- Sidebar navigation labels, visibility, and ordering
- Social links and custom social items
- Footer copyright line / basic footer copy
- Main title and subtitle for fixed inner pages
- Article metadata display rules
- Default author for the `/bits/` page

For more details, see the [Theme Console configuration guide](https://astro.whono.me/archive/theme-console-guide/).

<br>
</details>

#### Production behavior

- Admin Console write capabilities are available only in local development, including theme settings, content editing, settings import/export, and supported content image uploads.
- `/admin/content/` provides the content list, filters, search, essay / bits draft creation, and row-level actions. In development, edit pages support local editing and preview for essay, bits, memo, and about content.
- Production builds remain static output. `/admin/` can show a read-only public Overview or a hidden-state message based on Theme settings; production does not show Admin tabs, and other Admin subroutes only keep a local-development notice.
- `/api/admin/**` is for local development only and should not be treated as a production API

#### Compatibility for existing forks

- If `src/data/settings/*.json` does not exist yet, the frontend still reads config via `settings > legacy > default`
- The JSON files are generated only after the first save in `/admin/theme/`, so no manual migration script is required


## Content and Writing

### Collections and Routes

Content Collections:
- Essay: `src/content/essay`
- Bits: `src/content/bits`
- Memo: `src/content/memo/index.md`
- Archive: generated from essay entries via the `archive` field

Main routes:
- List pages: `/archive/`, `/essay/`, `/bits/`, `/memo/`, `/about/`
- Canonical detail route: `/archive/[slug]` (`/essay/[slug]` remains as a compatibility redirect)

### Image Assets

- Images inside article content: prefer `src/content/**` or `src/assets/**`, so Astro can process and optimize them during build
- `/bits/` images: place them under `public/bits/**` and use the actual file path, for example `bits/demo-01.jpg`
- Default avatar for `/bits/`: place it under `public/author/**` and use the actual file path, for example `author/your-avatar.png`
- Home Hero: supports `src/assets/**`, `public/**`, and `https://` image URLs
- If you need a public direct URL, or do not want Astro to process the asset, place it under `public/**`


### Core Frontmatter Fields

Essay:
```yaml
title: My Post
date: 2026-01-01
draft: false        # Draft: hidden from list/RSS in production (visible in local preview; default false, optional)
archive: true       # Archive switch: false excludes it from /archive and /archive/rss.xml (default true; detail page and /essay remain available)
slug: optional      # Custom URL slug (defaults to the flattened content path, e.g. 2024/my-post -> 2024-my-post)
badge: optional     # List badge; if omitted, list shows "Essay"
updatedAt: 2026-01-02 # Optional update date; replaces the visible article date when set
```

`essay.date` should use the `YYYY-MM-DD` format for archive grouping, ordering, and page date display.

Legacy ISO 8601 datetime values are still accepted. When written as a string, for example `date: "2026-01-01T12:00:00+08:00"`, the leading date is normalized to `2026-01-01`.

If you need to keep a precise publish time, you can add:

```yaml
publishedAt: 2026-01-01T12:00:00+08:00
```

`publishedAt` does not need to be added to existing content in bulk. It only keeps a more precise publish time; archive ordering and RSS publish time continue to read `date` / `publishedAt` as before.

If the article has a revision date, add:

```yaml
updatedAt: 2026-01-02
```

`updatedAt` is an optional update date. Prefer `YYYY-MM-DD`. When set, the home index, essay list, and article detail page replace the original visible date with an update label such as `更新于：YYYY-MM-DD`; when omitted, pages keep the existing date display.

Unquoted YAML datetimes are also accepted. In rare UTC-boundary cases, the parser may have already lost the original timezone text; in that case the parsed UTC date is used.

Bits:
```yaml
date: 2026-01-01T12:00:00+08:00 # Example; generator outputs local timezone
tags:                           # Optional tags (defaults to empty array)
  - loc:Shenzhen                # Location tag format: loc:<place>; only the first one is displayed
  - reading
images:                         # Optional: multi-image list (dimensions reduce CLS)
  - src: bits/demo-01.webp      # Supports relative path bits/... or absolute URL https://...
    width: 800                  # Optional; recommended, generator / image picker can fill it
    height: 800                 # Optional; recommended, generator / image picker can fill it
# draft: true   # Optional draft; visible in `dev`, hidden by default in `build/preview` and production
```

`/bits/` does not currently generate detail routes from `slug`, nor does it render it as visible UI text; unless you are extending the theme, you usually do not need to set it.

Author info (on `/bits/` only):

- Default author and avatar are read from Theme Console via `page.bits.defaultAuthor`; if `src/data/settings/page.json` does not exist yet, they fall back to `site.author` / `site.authorAvatar` in `site.config.mjs`
- `authorAvatar` should be a relative image path only (no `public/`, no leading `/`), for example: `author/avatar.webp`; it should point to an existing file under `public/**`
- Per-bit overrides are supported via `author` in frontmatter:

```yaml
author:
  name: Alice
  avatar: author/alice.webp
```
- Per-bit `author.avatar` follows the same rule as the default avatar: use a relative image path and preferably point it to an existing file under `public/**`

- If the avatar is missing or fails to load, it automatically falls back to an initial-based avatar.
- `bits.images[*].width / height` can be omitted and will not block builds; keeping them helps reduce image layout shift.


### Excerpt and Description (`description`)

- List excerpt is generated from content by default (sanitized and truncated)
- Use `<!-- more -->` to define excerpt split point
- `description` is used for SEO/OG (meta description) only and does not affect list excerpts


### Writing Conventions (Content Blocks)

- Callout: recommended directive syntax `:::note[title] ... :::` (`note` / `tip` / `info` / `warning`); in HTML form use `.callout-title`, and use `data-icon="none"` to hide icon
- Figure: `figure.figure > (img|picture) + figcaption.figure-caption?`; optional `figure--sm/md/lg/full` and `figure--left/center/right`
- Gallery: `ul.gallery > li > figure > (img|picture) + figcaption?`; optional `cols-2` / `cols-3`
- Math: double-dollar syntax is supported, with inline `$$x$$` and block `$$ ... $$`; single-dollar `$x$` is not parsed as math
- Quote: standard `blockquote`, optional `cite` for source
- Pullquote: `blockquote.pullquote`
- Code Block: toolbar / copy button / line numbers are enhanced at build time (no extra author-side syntax needed)

Callout example:

```md
:::note[Note]
Body text goes here...
:::
```

HTML example:

```html
<div class="callout note">
  <p class="callout-title" data-icon="none">Note</p>
  <p>Body text goes here...</p>
</div>
```


## Fonts and Licensing

This theme uses two typeface families (self-hosted + subsetted):
- Noto Serif SC (400 / 600)
- LXGW WenKai Lite (Regular)

The repository includes subsetted WOFF2 files (`latin` / `cjk-common` / `cjk-ext`, loaded on demand via `unicode-range`), so you can use the project immediately after cloning.
Subset charset is generated from repository text plus `tools/charset-base.txt` (3,500 common characters) to reduce missing-glyph cases.

To regenerate font subsets:
1. Install Python 3, then run `python -m pip install fonttools brotli zopfli`
2. Make sure `pyftsubset --help` works; if it does not, add the Python Scripts directory to `PATH`
3. Put the source fonts in `tools/fonts-src/`
4. Run `npm run font:build`
5. If glyphs are missing, add the characters to `tools/charset-base.txt` and rerun `npm run font:build`
6. `tools/charset-common.txt` is regenerated by `npm run font:charset`; do not edit it unless you only want to rerun `npm run font:subset`

<details>
  <summary>Font file list (subsets + source files)</summary>

Subset files (tracked in repository):
- `public/fonts/lxgw-wenkai-lite-latin.woff2`
- `public/fonts/lxgw-wenkai-lite-cjk-common.woff2`
- `public/fonts/lxgw-wenkai-lite-cjk-ext.woff2`
- `public/fonts/noto-serif-sc-400-latin.woff2`
- `public/fonts/noto-serif-sc-400-cjk-common.woff2`
- `public/fonts/noto-serif-sc-400-cjk-ext.woff2`
- `public/fonts/noto-serif-sc-600-latin.woff2`
- `public/fonts/noto-serif-sc-600-cjk-common.woff2`
- `public/fonts/noto-serif-sc-600-cjk-ext.woff2`

Source files (not tracked in repository):
- `tools/fonts-src/LXGWWenKaiLite-Regular.woff2`
- `tools/fonts-src/NotoSerifSC-Regular.ttf`
- `tools/fonts-src/NotoSerifSC-SemiBold.ttf`
</details>

Font license: SIL Open Font License 1.1 (see `public/fonts/OFL-LXGW-WenKai-Lite.txt` and `public/fonts/OFL-NotoSerifSC.txt`).


## RSS

- `/rss.xml` (default feed; uses the same archive items as `/archive/rss.xml`)
- `/archive/rss.xml` (archive feed)
- `/essay/rss.xml`

Setting `SITE_URL` is recommended for deployment (affects absolute links in RSS/OG/canonical).


## Contributing

Issues are welcome for bug reports and ideas.
Pull requests are welcome; using a `feature/*` branch is recommended.

### Sync Upstream in a Fork

```bash
git remote add upstream https://github.com/cxro/astro-whono.git
git fetch upstream --tags
git checkout main
git merge upstream/main
git push origin main --tags
```


## Acknowledgements

- Thanks to [elizen/elizen-blog](https://github.com/elizen/elizen-blog), the starting point of this theme design, which is inspired by the Hugo theme [yihui/hugo-ivy](https://github.com/yihui/hugo-ivy)


## License

License: MIT
