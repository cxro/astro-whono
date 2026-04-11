# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project aims to follow Semantic Versioning.

## [Unreleased]

## [0.3.1] - 2026-03-24

### Changed

- Upgraded Astro to v6, synchronized updates to related official packages, maintaining existing theme, content collections, and build workflow.
- Clarified Theme Console production environment boundaries: `/admin/` retains read-only notice, `/api/admin/settings/` for local development only.
- Optimized code block interaction script loading scope: article and memo pages load copy and line number logic on demand, non-article pages no longer load related scripts.

### Fixed

- Fixed mobile homepage whitespace and article/memo page title and metadata display issues, optimizing mobile browsing experience.
- Fixed Windows `npm run check:preview-admin` execution failure.
- Fixed Hero image and Bits avatar validation rule inconsistencies across different entry points; Theme Console, content configuration, and frontend display are now consistent.
- Fixed Theme Console injection risk when loading configuration on first visit to `/admin/` in local development.
- Fixed table display issues in Markdown content on article pages.
- Completed font subset rebuild dependencies and step instructions; when `pyftsubset` is missing, scripts now directly prompt for installation method.

## [0.3.0] - 2026-03-21

This update focuses on tag browsing, list search, and `/bits/` browsing experience, further improving Theme Console stability in local maintenance scenarios.

### Added

- Added tag entry to `/archive/` with paginated static tag result pages.
- Homepage intro now supports direct entry to tag browsing; `/bits/` added year filtering with more complete search result display.
- Theme Console added article metadata display options, controlling whether word count and reading time display on article pages.
- `/bits/` added year filtering and enhanced search result display.

### Changed

- List search now links with archive tag pages; year groups with no results automatically collapse.
- `/archive/` and `/essay/` added clearer page descriptions, improving sharing and search engine recognition.
- `/bits/` changed to paginated browsing; search supports highlighting, hit snippets, keyboard operations, and direct content jumping.
- Unified article routing and slug rules to avoid conflicts with `tag/`, `page/` sub-routes.
- Adjusted testing and CI baseline: Markdown smoke check uses dedicated test page, added `npm test` and lightweight regression tests, reducing unrelated CI failures after forking or replacing example content.

### Fixed

- Fixed `/archive/` tag entry unavailable without JavaScript, and tag display issues on tag result pages.
- Fixed `/archive/` and `/essay/` list search filter failures, cross-timezone date display anomalies, and potential old index reads in development.
- Fixed `/bits/` search and year filter desynchronization, image preview output anomalies with special characters, and slight search box interaction jitter.
- Fixed multiple issues in Theme Console regarding configuration cache, validation prompts, and sort consistency after manually modifying settings JSON.
- Fixed archive abnormal tags potentially generating wrong routes and statistics; build now aborts directly with prompt.

## [0.2.0] - 2026-03-13

This update focuses on the local Theme Console, making it faster to take over site configuration after forking or cloning.

### Added

- Added local Theme Console `/admin/`, enabling centralized management in development of site title, default description, footer copyright, homepage intro, sidebar navigation, social links, inner page main/subtitles, and Bits default author.
- Added UI display options to control reading mode entry, code line numbers, and sidebar divider style.
- Added fine-grained configuration for homepage intro and sidebar navigation, supporting independent visibility, sorting, and ornament character settings.
- Added local configuration save mechanism; first save generates `src/data/settings/*.json`, old config remains compatible.

### Changed

- Homepage, sidebar, footer, and about page site info unified to Theme Console configuration, backend changes directly reflect on frontend.
- Homepage Hero and inner page title configuration enhanced, supporting custom Hero images and section main/subtitles.
- Social links support unified sorting of fixed platforms and custom links, frontend display consistent with backend configuration.
- `/admin/` in production remains read-only and excluded from sitemap.
- Adjusted release baseline and updated some dependencies to secure versions.
- Homepage switches to more compact rhythm when both Hero and intro are off, reducing above-fold whitespace.
- Theme Console backend styles changed to load on demand only on `/admin/`, public pages no longer carry backend styles, reducing redundant HTML/CSS in build output.
- Optimized public page style loading: reduced HTML volume from repeated inline styles during multi-page browsing; article and `/bits/` pages load styles by scenario, better for cache reuse.
- Adjusted public page style structure: homepage, about, and memo page styles maintained per page, shared styles only keep common parts, easier to locate and modify after fork.
- Optimized homepage above-fold loading: homepage prioritizes loading above-fold styles and font declarations, then shared styles, reducing wait without changing visual effects.
- `/bits/` "Quick Note" draft generator changed to load on demand; draft dialog and related scripts no longer load on first paint, only on first click.

### Fixed

- Fixed `/admin/` first load errors and occasional config save failures in development.
- Fixed layout misalignment after hiding sidebar divider, and improved error prompts on save failure and interface validation feedback.
- Fixed Theme Console social link sorting conflicts between fixed platforms and custom links; backend auto-organizes sorting and limits selectable range to avoid duplicate sort values.
- Fixed Theme Console custom social link silent overwrite of existing names on save; fixed platforms auto-use platform names, fallback platform统一显示为"Website".
- Fixed `/archive/` and `/essay/` list search potentially double-appending Base URL in subpath deployment, causing index load failures.
- Fixed homepage potentially requesting wrong font paths in subpath deployment; current above-fold font declarations follow `BASE_URL` output, avoiding font 404s, fallbacks, or double switches.
- Fixed `/bits/` single-image card unable to open image preview; single and multi-images now share same Lightbox interaction.
- Fixed `/bits/` draft dialog author settings area accessibility issues, completed expand state semantics and focus management.
- Fixed development `/archive/{slug}/`, `/essay/{slug}/` and corresponding pagination pages potentially inaccessible after Theme Console uses `server` output mode.
- Fixed article page image preview unavailable to keyboard users; keyboard can now open Lightbox, focus returns to original trigger after close.
- Fixed Theme Console default language potentially passing through when config file manually written with illegal values; now falls back to safe default, avoiding illegal `<html lang>` output.

## [0.1.1] - 2026-02-07

This update focuses on search, image preview, bits multi-image display, and deployment security baseline, further improving reading experience and static site deployment details.

### Added

- Added sitemap and build-time `robots.txt`, auto-enabled when `SITE_URL` is set.
- Added unified Lightbox preview capability, article and `/bits/` share same image preview interaction.
- Added static search to `/archive/` and `/essay/` list pages, index loads on demand for lighter search experience.
- Added lightweight image preview and Markdown syntax demo to `/bits/`.
- Added author override support to `/bits/`, and added author input to draft generator.
- Added Cloudflare Pages and Netlify basic deployment configurations.

### Changed

- Markdown rendering pipeline added security sanitization, enhancing XSS protection while preserving existing writing capabilities.
- `/bits/` list changed to分流展示 by content length: short content retains original structure rendering, long content shows excerpt.
- `/archive/` and `/essay/` list pages added search box and hit prompts.
- `/bits/` multi-image display and interaction further optimized, thumbnails, mobile grid, and `+N` display clearer.
- Homepage Hero image switched to `astro:assets` optimization, with LCP control for improved above-fold performance.
- Fonts changed to subsetted and self-hosted, reducing above-fold font burden.
- Routes and content collections further converged: archive entry unified to `/archive/`, `/essay/` changed to redirect, `/memo/` replaces `/kids/`.

### Fixed

- Fixed bits multi-image `+N` click unresponsive issue.
- Fixed lightbox occlusion and default exposure issues.
- Fixed list and detail page slug filtering inconsistencies potentially causing 404s.
- Fixed misleading sitemap comment in `robots.txt`.

### Maintenance

- Adjusted deployment and security baseline, including response headers, build parameters, and dependency governance.
- Added `npm run audit:prod` and integrated into CI.
- Unified some icons, path concatenation, and content utility implementations, reducing duplicate code.

## [0.1.0] - 2026-01-28 (Pre-release)

This pre-release completes the theme's basic capabilities, including code blocks, Callout, search, mobile interaction, and reading experience.

### Added

- Added code block toolbar supporting language, line numbers, and copy capability.
- Added Callout writing support, unifying prompt block content structure and style.
- Added Figure / Caption support, improving image-text writing scenarios.
- Added `/bits/` search index and search hints.
- Added client-side interaction script directory for search, theme, and reading mode frontend interactions.
- Added mobile/tablet back-to-top button.
- Added article detail page previous/next navigation.
- Added local and CI aggregate commands.

### Changed

- Refactored code block structure and variable system, enhancing line number and copy button experience.
- Updated Markdown guide and README, supplementing Callout and Figure usage.
- Adjusted global typography and style entry structure, organizing import order.
- `/bits/` search changed to JSON lazy loading, with added summary info.
- Theme, reading mode, and search scripts migrated to TS modules.
- Optimized mobile breakpoint and interaction performance, including navigation, lists, images, and toolbar scenarios.
- Adjusted icon usage strategy and documentation structure.

### Fixed

- Fixed dark mode plain text code block readability issues.
- Fixed code block language icon clipping issues.
- Fixed reading mode exit button misalignment.
- Fixed inline code background breakage from line wrapping.
- Fixed small-screen long content width overflow causing horizontal scroll.

### Maintenance

- Added type checking support and dev dependencies.
- Organized some style and script entries, converging structure for future iterations.

## Pre-release (Unpublished History)

The following is early iteration record before `0.1.0`, archived by theme capability.

### Added

- Established Astro theme basic skeleton, including fixed sidebar and content area layout.
- Initially established content collections: `essay`, `bits`, `memo`.
- Added basic routes: `/`, `/archive/`, `/essay/`, `/bits/`, `/memo/`, `/about/`.
- Added RSS subscription entry and `/bits/` draft generation capability.
- Added dark mode and reading mode entry.
- Added thinnest Callout component, implementing unified output structure.

### Changed

- Gradually converged Callout structure, icons, and style presentation.
- Adjusted overall color scheme and quote, code block basic typography styles, improving dark mode adaptation.
- Unified list page title structure, forming main title plus subtitle page header style.
- Optimized article image display, TOC area spacing, and sidebar interaction details.
- Adjusted navigation and hover feedback, unifying overall interaction style.

### Fixed

- Fixed early type checking, document path, and quote style issues.
- Fixed dark mode code block background and highlighting anomalies.
- Fixed some unused styles and detail遗留 issues.
