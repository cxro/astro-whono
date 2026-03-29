# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project aims to follow Semantic Versioning.

## [Unreleased]

## [0.3.1] - 2026-03-24

### Changed

- Upgraded Astro to v6, and updated related official packages, continuing the existing theme, content collections, and build process.
- Clarified the production environment boundaries for Theme Console: `/admin/` retains a read-only notice, `/api/admin/settings/` is for local development only.
- Optimized the loading scope of code block interaction scripts: copy and line number logic are loaded on demand for article and memo pages; related scripts are no longer loaded on non-article pages.

### Fixed

- Fixed blank space on the mobile homepage and abnormal display of titles and meta information on article and memo pages, improving mobile browsing experience.
- Fixed the issue where `npm run check:preview-admin` could not be executed on Windows.
- Fixed inconsistent validation rules for Hero images and Bits avatars at different entry points; Theme Console, content configuration, and frontend display are now consistent.
- Fixed injection risk when loading configuration for the first time in Theme Console on local development `/admin/`.
- Fixed abnormal table display in Markdown articles on article pages.
- Completed the dependencies and step instructions for font subset rebuilding; if `pyftsubset` is missing, the script now directly prompts for installation.

## [0.3.0] - 2026-03-21

This update focuses on tag browsing, list searching, and the `/bits/` browsing experience, and further improves the stability of Theme Console in local maintenance scenarios.

### Added

- Added tag entry to `/archive/`, and provided paginated static tag result pages.
- Homepage introduction now supports direct access to tag browsing; `/bits/` adds year filtering and more complete search result display.
- Theme Console adds article meta information display options, allowing control over whether to show word count and reading time on article pages.
- `/bits/` adds year filtering and enhances search result display.

### Changed

- List search can now be linked with the archive tag page; year groups with no results in the archive page will automatically collapse.
- `/archive/` and `/essay/` now have clearer page descriptions, improving sharing and search engine recognition.
- `/bits/` changed to paginated browsing; search supports highlighting, hit fragments, keyboard operations, and direct jumps to corresponding content.
- Unified article routing and slug rules to avoid conflicts with `tag/` and `page/` subroutes.
- Adjusted testing and CI baseline: Markdown smoke check now uses a dedicated test page, added `npm test` and lightweight regression tests to reduce unrelated CI failures after forking or replacing example content.

### Fixed

- Fixed the issue where the tag entry in `/archive/` was unavailable without JavaScript, and abnormal tag display on tag result pages.
- Fixed list search filtering failure, cross-timezone date display issues in `/archive/` and `/essay/`, and possible reading of old indexes in development environment.
- Fixed `/bits/` search and year filter results not syncing, abnormal image preview output in special character scenarios, and slight jumping during search box interaction.
- Fixed multiple issues with Theme Console regarding configuration cache, validation prompts, and sorting consistency after manually modifying settings JSON.
- Fixed the issue where abnormal tags in archive could generate incorrect routes and statistics; the build will now stop and prompt directly.

## [0.2.0] - 2026-03-13

This update focuses on the local Theme Console, making it easier to take over site configuration after forking or cloning.

### Added

- Added local Theme Console `/admin/`, allowing centralized management of site title, default description, footer copyright, homepage introduction, sidebar navigation, social links, inner page main/subtitles, and Bits default author in the development environment.
- Added interface display options to control reading mode entry, code line numbers, and sidebar divider styles.
- Added fine-grained configuration for homepage introduction and sidebar navigation, supporting independent show/hide, sorting, and decoration character settings.
- Added local configuration saving mechanism; the first save will generate `src/data/settings/*.json`, and old configurations remain compatible for reading.

### Changed

- Unified site information such as homepage, sidebar, footer, and about page into Theme Console configuration; backend modifications are directly reflected on the frontend.
- Enhanced configuration capabilities for homepage Hero and inner page titles, supporting custom Hero images and section main/subtitles.
- Social links now support unified sorting of fixed platforms and custom links; frontend display and backend configuration remain consistent.
- `/admin/` remains read-only in production and is excluded from the sitemap.
- Adjusted release baseline and updated some dependencies to secure versions.
- When both Hero and introduction are disabled on the homepage, it switches to a more compact first screen, reducing blank space.
- Theme Console backend styles are now loaded on demand only on the `/admin/` page; public pages no longer carry backend styles, reducing redundant HTML/CSS in build artifacts.
- Optimized public page style loading: reduces HTML overhead from repeated inline styles when browsing multiple pages; article and `/bits/` pages now load styles per page scenario, improving cache reuse.
- Adjusted public page style structure: homepage, about, and memo pages now maintain styles per page, with shared styles retaining only common parts, making it easier to locate and modify after forking.
- Optimized homepage first screen loading: homepage now prioritizes loading styles and font declarations needed for the first screen, then loads shared styles, reducing wait time without changing the current visual effect.
- The "Bits Draft Generator" on `/bits/` page is now loaded on demand; the draft dialog and related scripts are no longer loaded on the first screen, but only on first click.

### Fixed

- Fixed possible errors on first load of `/admin/` and occasional inability to save configuration in development environment.
- Fixed layout misalignment after hiding the sidebar divider, and improved error prompts and API validation feedback when saving fails.
- Fixed possible sorting conflicts between fixed platform and custom social links in Theme Console; backend automatically organizes sorting and limits selectable range to avoid duplicate sorting values.
- Fixed possible silent overwriting of existing names when saving custom social links in Theme Console; fixed platforms automatically use platform names, and fallback platforms are uniformly displayed as "Website".
- Fixed possible repeated concatenation of Base URL in list search for `/archive/` and `/essay/` under subpath deployment, causing index loading failure.
- Fixed possible font path request errors on the homepage under subpath deployment; current first screen font declaration now follows `BASE_URL` output to avoid font 404, fallback, or secondary switching.
- Fixed the issue where single-image cards in `/bits/` could not open image preview; single and multiple images now share the same Lightbox interaction.
- Fixed accessibility issues in the author setting area of the Bits draft dialog in `/bits/`, supplementing expanded state semantics and focus management.
- Fixed possible inaccessibility of `/archive/{slug}/`, `/essay/{slug}/`, and corresponding paginated pages in development environment after using `server` output mode in Theme Console.
- Fixed the issue where image preview on article pages was unavailable to keyboard users; now Lightbox can be opened via keyboard, and focus returns to the original trigger position after closing.
- Fixed the issue where the default language of Theme Console could still be passed through when an illegal value was manually written into the configuration file; now it falls back to a safe default value to avoid outputting illegal `<html lang>`.

## [0.1.1] - 2026-02-07

本次更新聚焦搜索、图片预览、bits 多图展示与部署安全基线，进一步完善阅读体验与静态站部署细节。

### Added

- 新增 sitemap 与构建期 `robots.txt`，在设置 `SITE_URL` 时自动启用。
- 新增统一的 Lightbox 预览能力，正文页与 `/bits/` 复用同一套图片预览交互。
- `/archive/` 与 `/essay/` 列表页新增静态搜索，索引按需加载，搜索体验更轻量。
- `/bits/` 新增轻量图片预览与 Markdown 语法演示。
- `/bits/` 支持作者覆盖，并在草稿生成器中补充作者输入。
- 新增 Cloudflare Pages 与 Netlify 的基础部署配置。

### Changed

- Markdown 渲染链路补充安全清洗，在保留现有写作能力的前提下增强 XSS 防护。
- `/bits/` 列表改为按内容长度分流展示：短内容保留原结构渲染，长内容显示摘要。
- `/archive/` 与 `/essay/` 列表页新增搜索框与命中提示。
- `/bits/` 多图展示与交互进一步优化，缩略图、移动端网格与 `+N` 展示更清晰。
- 首页 Hero 图片改用 `astro:assets` 优化，并配合 LCP 控制提升首屏表现。
- 字体改为子集化与自托管，减少首屏字体负担。
- 路由与内容集合进一步收敛：归档入口统一为 `/archive/`，`/essay/` 改为重定向，`/memo/` 替代 `/kids/`。

### Fixed

- 修复 bits 多图 `+N` 点击无响应的问题。
- 修复灯箱遮挡与默认露出问题。
- 修复列表与详情页 slug 过滤不一致可能导致的潜在 404。
- 修复 `robots.txt` 中误导性的 sitemap 注释。

### Maintenance

- 调整部署与安全基线，包括响应头、构建参数与依赖治理。
- 新增 `npm run audit:prod` 并接入 CI。
- 统一部分图标、路径拼接与内容工具实现，减少重复代码。

## [0.1.0] - 2026-01-28 (Pre-release)

本次预发布完成主题的基础能力，包括代码块、Callout、搜索、移动端交互与阅读体验。

### Added

- 新增代码块工具栏，支持语言、行号与复制能力。
- 新增 Callout 写作支持，统一提示块的内容结构与样式。
- 新增 Figure / Caption 支持，完善图文写作场景。
- 新增 `/bits/` 搜索索引与搜索提示。
- 新增客户端交互脚本目录，用于搜索、主题与阅读模式等前端交互。
- 新增移动端 / 平板回到顶部按钮。
- 新增文章详情页上下篇导航。
- 新增本地与 CI 聚合命令。

### Changed

- 重构代码块结构与变量体系，增强行号与复制按钮体验。
- 更新 Markdown 指南与 README，补充 Callout 与 Figure 的使用方式。
- 调整全局排版与样式入口结构，梳理导入顺序。
- `/bits/` 搜索改为 JSON 懒加载，并补充摘要信息。
- 主题、阅读模式与搜索脚本迁移到 TS 模块。
- 优化移动端断点与交互表现，包括导航、列表、图像和工具栏等场景。
- 调整图标使用策略与文档结构。

### Fixed

- 修复暗色模式下纯文本代码块可读性问题。
- 修复代码块语言图标裁切问题。
- 修复阅读模式退出按钮错位问题。
- 修复行内代码换行导致的背景断裂问题。
- 修复小屏长行内容撑宽引发的横向滚动问题。

### Maintenance

- 补充类型检查支持与开发依赖。
- 整理部分样式与脚本入口，为后续迭代收敛结构。

## Pre-release（未发布历史）

以下内容为 `0.1.0` 之前的早期迭代记录，按主题能力做归档整理。

### Added

- 建立 Astro 主题基础骨架，包含固定侧栏与内容区布局。
- 初步建立内容集合：`essay`、`bits`、`memo`。
- 增加基础路由：`/`、`/archive/`、`/essay/`、`/bits/`、`/memo/`、`/about/`。
- 增加 RSS 订阅入口与 `/bits/` 草稿生成能力。
- 增加夜间模式与阅读模式入口。
- 增加最薄的 Callout 组件，实现统一的输出结构。

### Changed

- 逐步收敛 Callout 的结构、图标与样式表现。
- 调整整体配色与引用、代码块等基础排版样式，提升暗色模式适配。
- 统一列表页标题结构，形成主标题加副标题的页面头部样式。
- 优化正文图片展示、TOC 区域间距与侧栏交互细节。
- 调整导航与 hover 反馈，统一整体交互风格。

### Fixed

- 修复早期类型检查、文档路径与引用样式问题。
- 修复深色模式下代码块背景与高亮异常。
- 修复部分未使用样式与细节遗留问题。
