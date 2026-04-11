---
title: Theme Console Guide
description: Explains the scope, page groups, configuration targets, and save mechanism of astro-whono's local Theme Console in development environment.
badge: Guide
date: 2026-03-18
tags: ['Theme Console', 'Guide']
draft: false
---

astro-whono provides a local Theme Console for managing theme-level configurations in the development environment.

`/admin` primarily covers site information, sidebar, homepage, inner page copy, and some reading and code display options, making it easy to adjust these theme settings after forking or cloning.

:::note[Development Environment]
`/admin` is writable only in development environment. When accessed in production, it shows read-only status.
:::

## Local Startup and Entry

During local development, start the project with:

```bash
npm install
npm run dev
```

By default, the dev server runs at `http://localhost:4321/`. After starting, access directly:

```text
http://localhost:4321/admin/
```

If you changed the dev port, replace `4321` with the actual port.

## Scope

Theme Console currently handles these configuration categories:

- Site title, default language, default SEO description
- Footer year and copyright text
- Social links and their ordering
- Sidebar site name, quote text, navigation order and visibility
- Homepage Hero, homepage intro, and homepage internal links
- Main and subtitles for `/essay/`, `/archive/`, `/bits/`, `/memo/`, `/about/`
- Article metadata display options
- Code block line numbers and reading mode entry

## Configuration Files

Saved settings are automatically written to `src/data/settings/` by group:

```text
src/data/settings/
  site.json
  shell.json
  home.json
  page.json
  ui.json
```

> If src/data/settings/\*.json doesn't exist yet, it will be auto-generated on first save in /admin

Theme Console manages theme configurations within the repository; changes can still be tracked and reverted via Git.

## Page Groups

`/admin` is currently divided into five groups by editing scenario.

### Site

`Site` handles site-level basic information:

- Site title
- Default language
- Default SEO description
- Footer year and copyright text
- Social links

Social links support mixing fixed platforms with custom links, with unified ordering.

### Sidebar

`Sidebar` handles shell and navigation related configurations:

- Sidebar site name
- Sidebar quote text
- Sidebar divider style
- Navigation name, order, suffix character, and visibility

![Sidebar group screenshot](./theme-console/theme-console-sidebar.webp)

### Home

`Home` handles homepage display related configurations:

- Hero image URL and alt text
- Hero visibility
- Homepage intro lead text
- Homepage intro more text
- Primary and secondary links in intro more

![Home group screenshot](./theme-console/theme-console-home.webp)

Homepage intro more still uses fixed sentence structure; the backend only exposes text and entry selection to keep homepage structure stable. Currently selectable entries include `archive`, `essay`, `bits`, `memo`, `about`, and `tag`.

### Inner Pages

`Inner Pages` handles unified copy and display strategy for inner pages:

- `/essay/` page main and subtitle
- `/archive/` page main and subtitle
- `/bits/` page main and subtitle
- `/memo/` page main and subtitle
- `/about/` page main and subtitle
- Whether to show date, tags, word count, reading time in article metadata
- `/bits/` default author name and avatar

![Inner Pages group screenshot](./theme-console/theme-console-inner-pages.webp)

### Reading / Code

- Whether to show line numbers in code blocks
- Whether to show reading mode entry in sidebar

## Save Mechanism

- Saves write back by group: `site / shell / home / page / ui`, without directly modifying template source
- Most fields provide instant preview or clear page correspondence
- Field validation runs before saving
- Version info is included when saving to avoid silent overwrites from concurrent modifications
- Write process includes rollback on failure to avoid partial success states

---

The above covers the commonly used configuration entries and save mechanism in Theme Console. If you encounter configuration anomalies or save issues during use, feel free to submit an Issue.
