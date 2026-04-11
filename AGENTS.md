# AGENTS.md - Personal Website Guide

This document serves as the comprehensive guide for working with this Astro-based personal website. It contains workflows, architecture details, and best practices for both human contributors and AI assistants.

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Architecture Overview](#architecture-overview)
3. [Content Workflows](#content-workflows)
4. [Theme Customization](#theme-customization)
5. [Image Management](#image-management)
6. [Development Commands](#development-commands)
7. [Common Tasks](#common-tasks)
8. [File Structure Reference](#file-structure-reference)
9. [Troubleshooting](#troubleshooting)

---

## Quick Reference

### Content Type Quick Links

| Content Type            | Location                               | Template                                       | Frequency           |
| ----------------------- | -------------------------------------- | ---------------------------------------------- | ------------------- |
| Essays (thought pieces) | `src/content/essay/`                   | `src/content/templates/essay-template.md`      | Multiple times/week |
| Photography             | `src/content/bits/`                    | `src/content/templates/bits-photo-template.md` | Multiple times/week |
| Life notes              | `src/content/memo/index.md`            | Inline editing                                 | As needed           |
| Projects                | `src/data/projects.json`               | JSON structure                                 | As needed           |
| Resume                  | `src/pages/about/resume-section.astro` | Component-based                                | As needed           |

### Essential Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type check
npm run check

# Run tests
npm test

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run linter
npm run lint

# Run formatter
npm run format

# Full CI pipeline
npm run ci
```

### Key Configuration Files

- `site.config.mjs` - Site metadata, author info, page sizes
- `src/data/settings/*.json` - Theme Console settings (managed via `/admin` in dev)
- `src/content.config.ts` - Content collection schemas
- `astro.config.mjs` - Build configuration, integrations
- `tsconfig.json` - TypeScript configuration
- `.env.example` - Environment variable template (copy to `.env` for local production checks)

---

## Architecture Overview

This is **astro-whono**, a minimal two-column Astro theme optimized for personal writing and portfolio sites.

### Core Technologies

- **Framework:** Astro v6 (static site generation)
- **Language:** TypeScript
- **Styling:** CSS (custom properties, no framework)
- **Build Tool:** Vite
- **Testing:** Vitest
- **Node Version:** >=22.12.0

### Content Architecture

The site uses Astro's Content Collections with three main content types:

1. **Essays** - Long-form articles with rich frontmatter support
2. **Bits** - Short-form micro-posts, ideal for photography
3. **Memo** - Journal-style life notes (single file)

All content is written in Markdown with YAML frontmatter.

### Routing Structure

```
/                  → Homepage (latest content)
/essay/            → Essay listing page
/essay/[slug]      → Individual essay (redirects to /archive/)
/archive/          → Archive with year grouping
/archive/[slug]    → Canonical essay detail page
/bits/             → Bits listing (photography + short posts)
/bits/page/[n]     → Paginated bits
/memo/             → Life notes page
/about/            → About page + resume + projects
/admin/            → Theme Console (dev only)
```

### Two-Column Layout

- **Left Sidebar:** Site title, quote, navigation, theme controls
- **Main Content:** Article content, lists, or page-specific content
- **Responsive:** Collapses to single column on mobile (<900px)

---

## Content Workflows

### Workflow 1: Publishing an Essay (Thought Piece)

**Purpose:** Long-form writing, career reflections, technical deep-dives

**Steps:**

1. **Create the file:**

   ```bash
   # Copy template
   cp src/content/templates/essay-template.md src/content/essay/my-post-title.md

   # Or create directly
   touch src/content/essay/my-post-title.md
   ```

2. **Add frontmatter:**

   ```yaml
   ---
   title: 'Your Thought Piece Title'
   description: 'Brief description for SEO and social sharing'
   date: 2026-04-10
   tags: ['career', 'reflection', 'tech']
   draft: false # Set to true while writing
   archive: true # Include in archive listings
   ---
   ```

3. **Write content:**
   - Use standard Markdown
   - Use `<!-- more -->` for excerpt break
   - See [Markdown Formatting Guide](#markdown-formatting-guide) below

4. **Test locally:**

   ```bash
   npm run dev
   # Visit http://localhost:4321/essay/
   ```

5. **Deploy:**
   ```bash
   npm run build
   # Deploy dist/ folder to your host
   ```

**Frontmatter Reference:**

| Field         | Type     | Required | Description                         |
| ------------- | -------- | -------- | ----------------------------------- |
| `title`       | string   | Yes      | Article title                       |
| `description` | string   | No       | SEO/meta description                |
| `date`        | string   | Yes      | ISO date (YYYY-MM-DD)               |
| `tags`        | string[] | No       | Array of tags                       |
| `draft`       | boolean  | No       | Hide in production (default: false) |
| `archive`     | boolean  | No       | Include in archive (default: true)  |
| `slug`        | string   | No       | Custom URL slug                     |
| `badge`       | string   | No       | Badge text on list                  |

---

### Workflow 2: Publishing Photography (Bits)

**Purpose:** Photo galleries, short observations, quick updates

**Steps:**

1. **Upload images to R2:**
   - Upload to: `https://f3269be535874c84e13e71f0d70c37dd.r2.cloudflarestorage.com/shuhanluo-gallery/`
   - Use descriptive filenames: `sunset-brooklyn-2026-04-10.webp`
   - Note the image dimensions (width x height)

2. **Create the Bits file:**

   ```bash
   # Filename format: bits-YYYY-MM-DD-HHMM.md
   touch src/content/bits/bits-$(date +%Y-%m-%d-%H%M).md
   ```

3. **Add frontmatter with images:**

   ```yaml
   ---
   date: 2026-04-10T14:30:00+08:00
   tags:
     - 'loc:Brooklyn'
     - photography
     - sunset
   images:
     - src: https://f3269be535874c84e13e71f0d70c37dd.r2.cloudflarestorage.com/shuhanluo-gallery/sunset-brooklyn-2026-04-10.webp
       width: 1200
       height: 800
       alt: 'Sunset over Brooklyn Bridge'
   ---
   ```

4. **Add caption (optional):**
   ```markdown
   Golden hour in Brooklyn. The light was perfect.
   ```

**Alternative: Use the Quick Note Generator**

1. Navigate to `/bits/` in your browser
2. Click "Quick Note" button
3. Fill in content, tags, image URLs
4. Click "Generate & Copy" or "Download .md"
5. Save to `src/content/bits/`

**Bits Frontmatter Reference:**

| Field    | Type     | Required | Description                        |
| -------- | -------- | -------- | ---------------------------------- |
| `date`   | string   | Yes      | ISO datetime with timezone         |
| `tags`   | string[] | No       | Tags, use `loc:Location` for place |
| `images` | Image[]  | No       | Array of image objects             |
| `author` | object   | No       | Override default author            |
| `draft`  | boolean  | No       | Hide in production                 |

**Image Object:**

```yaml
images:
  - src: 'https://...' # Full R2 URL or local path
    width: 1200 # Required for CLS prevention
    height: 800 # Required for CLS prevention
    alt: 'Description' # Accessibility
```

---

### Workflow 3: Adding a Project

**Purpose:** Showcase GitHub projects on your About page

**Steps:**

1. **Edit the projects file:**

   ```bash
   # Open in your editor
   code src/data/projects.json
   ```

2. **Add project entry:**

   ```json
   {
     "projects": [
       {
         "title": "Project Name",
         "description": "Brief one-line description of what this project does",
         "github": "username/repo-name",
         "url": "https://live-demo-url.com",
         "tech": ["React", "TypeScript", "Node.js"],
         "featured": true
       }
     ],
     "githubUsername": "yourusername"
   }
   ```

3. **Rebuild and deploy** (projects are baked at build time)

**Project Schema:**

| Field         | Type     | Required | Description            |
| ------------- | -------- | -------- | ---------------------- |
| `title`       | string   | Yes      | Project name           |
| `description` | string   | Yes      | Short description      |
| `github`      | string   | Yes      | "username/repo" format |
| `url`         | string   | No       | Live demo URL          |
| `tech`        | string[] | No       | Technology tags        |
| `featured`    | boolean  | No       | Highlight on page      |

---

### Workflow 4: Updating Resume

**Purpose:** Keep your resume/cv current on the About page

**Location:** `src/pages/about/resume-section.astro`

**Current Structure:**

- Static content in the component
- PDF download placeholder (add your PDF URL when ready)
- Optional interactive elements

**To Update:**

1. Edit `src/pages/about/resume-section.astro`
2. Modify sections: Experience, Education, Skills
3. Add PDF link when available
4. Rebuild and deploy

**Future Enhancement:** Could be converted to JSON-driven like projects.

---

### Workflow 5: Updating Life Notes (Memo)

**Purpose:** Journal-style entries, life updates

**Location:** `src/content/memo/index.md`

**Format:**

```markdown
---
title: 'Life Notes'
subtitle: 'Subtitle'
date: 2026-01-10
draft: false
---

## 2026

### Entry Title

Your journal entry here...

> Quote or reflection

## 2025

### Another Entry

More content...
```

**Structure:**

- Use `##` for years
- Use `###` for individual entries
- Images work the same as essays

---

## Markdown Formatting Guide

### Basic Text Formatting

```markdown
**Bold text**
_Italic text_
**_Bold italic_**
~~Strikethrough~~
`inline code`
```

### Headings

```markdown
# H1 (Use once per page - usually the title)

## H2 (Section headers)

### H3 (Subsections)

#### H4 (Rarely needed)
```

### Lists

**Unordered:**

```markdown
- Item 1
- Item 2
  - Nested item
- Item 3
```

**Ordered:**

```markdown
1. First step
2. Second step
3. Third step
```

**Task List:**

```markdown
- [x] Completed task
- [ ] Pending task
```

### Links

```markdown
[Link text](https://example.com)
[Internal link](/essay/my-post)
```

### Images

**Basic:**

```markdown
![Alt text](/path/to/image.webp)
```

**With caption (Figure):**

```markdown
<figure class="figure">
  <img src="/path/to/image.webp" alt="Description" />
  <figcaption class="figure-caption">Image caption here</figcaption>
</figure>
```

**Gallery:**

```markdown
<ul class="gallery">
  <li>
    <figure>
      <img src="/img1.webp" alt="Image 1" />
      <figcaption>Optional caption</figcaption>
    </figure>
  </li>
  <li>
    <figure>
      <img src="/img2.webp" alt="Image 2" />
    </figure>
  </li>
</ul>
```

### Code Blocks

**Inline:**

```markdown
Use `npm install` to install dependencies
```

**Block with language:**

````markdown
```javascript
function hello() {
  console.log('Hello, World!');
}
```
````

Supported languages: All languages supported by Shiki (100+)

### Blockquotes

```markdown
> This is a quote
>
> Multi-paragraph quote

> Quote with citation
> <cite>— Author Name</cite>
```

**Pullquote variant:**

```markdown
<blockquote class="pullquote">
  Standout quote text
  <cite>— Source</cite>
</blockquote>
```

### Callouts

```markdown
:::note[Note Title]
Your note content here
:::

:::tip[Pro Tip]
Helpful suggestion
:::

:::info[Information]
Context or explanation
:::

:::warning[Warning]
Important caution
:::
```

### Excerpt Break

```markdown
First paragraph visible in list...

<!-- more -->

Rest of content only visible on detail page...
```

### Tables

```markdown
| Column 1 | Column 2 | Column 3 |
| -------- | -------- | -------- |
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
```

### Horizontal Rule

```markdown
---
```

### Special Characters

```markdown
© ™ ® → ← ↑ ↓
π ≈ 3.14159
```

---

## Image Management

### R2 Storage Setup

**Your R2 Bucket:** `https://f3269be535874c84e13e71f0d70c37dd.r2.cloudflarestorage.com/shuhanluo-gallery/`

**Best Practices:**

1. **File Formats:**
   - Use WebP for photos (best compression)
   - Use AVIF for even smaller sizes (if browser support acceptable)
   - Keep original backups elsewhere

2. **Naming:**
   - Use descriptive names: `sunset-brooklyn-bridge-2026-04-10.webp`
   - Avoid spaces (use hyphens)
   - Include date for organization

3. **Sizing:**
   - Max width: 1600px for most images
   - Hero images: 1920px wide
   - Thumbnails: 400px wide
   - Always include width/height in frontmatter

4. **Organization:**
   ```
   shuhanluo-gallery/
   ├── essays/
   │   └── post-name/
   │       └── image.webp
   ├── bits/
   │   └── 2026/
   │       └── month/
   │           └── image.webp
   └── projects/
       └── project-name/
           └── screenshot.webp
   ```

### Image URL Formats

**Full R2 URL:**

```
https://f3269be535874c84e13e71f0d70c37dd.r2.cloudflarestorage.com/shuhanluo-gallery/path/to/image.webp
```

**In Bits frontmatter:**

```yaml
images:
  - src: https://f3269be535874c84e13e71f0d70c37dd.r2.cloudflarestorage.com/shuhanluo-gallery/photo.webp
    width: 1200
    height: 800
```

**In Essays (Markdown):**

```markdown
![Alt text](https://f3269be535874c84e13e71f0d70c37dd.r2.cloudflarestorage.com/shuhanluo-gallery/photo.webp)
```

### Lightbox Feature

Images automatically get lightbox functionality:

- Click images to open full-screen preview
- Swipe on mobile to navigate
- Pinch to zoom
- Keyboard navigation (arrow keys)

Works for:

- Essay inline images
- Bits photo galleries
- Memo images

---

## Theme Customization

### Color Scheme

Colors are defined in CSS custom properties. Main files:

- `src/styles/global.css` - Base color variables
- `src/styles/theme.css` - Theme-specific overrides

**Key Variables:**

```css
:root {
  --color-bg: #ffffff; /* Background */
  --color-text: #1a1a1a; /* Primary text */
  --color-text-secondary: #666; /* Secondary text */
  --color-link: #0066cc; /* Links */
  --color-accent: #ff6b6b; /* Accent color */

  /* Dark mode */
  --color-bg-dark: #1a1a1a;
  --color-text-dark: #e4e4e4;
}
```

### Typography

**Fonts:**

- Body: Noto Serif SC (serif)
- UI/Headings: System sans-serif stack
- Monospace: System monospace

**Customization:**

- Font sizes: `src/styles/global.css`
- Line heights: Component-specific CSS

### Sidebar

Edit via Theme Console (`/admin` in dev) or directly in:

- `src/data/settings/shell.json` - Navigation, quote, brand title

### Homepage

Edit via Theme Console or:

- `src/data/settings/home.json` - Hero, intro text

### Adding Motion Animations

**Installation:**

```bash
npm install motion
```

**Basic Usage:**

```typescript
// In a component or script
import { animate } from 'motion';

// Fade in element
animate('.my-element', { opacity: [0, 1] }, { duration: 0.5 });

// Scroll-triggered animation
import { scroll } from 'motion';

scroll(animate('.progress-bar', { scaleX: [0, 1] }));
```

**Common Animation Patterns:**

1. **Page Transition:**

   ```typescript
   // src/scripts/page-transition.ts
   import { animate } from 'motion';

   document.addEventListener('astro:page-load', () => {
     animate('main', { opacity: [0, 1] }, { duration: 0.3 });
   });
   ```

2. **Scroll Reveal:**

   ```typescript
   import { scroll, animate } from 'motion';

   document.querySelectorAll('.reveal').forEach((el) => {
     scroll(animate(el, { opacity: [0, 1], y: [20, 0] }), {
       target: el,
       offset: ['start end', 'center center'],
     });
   });
   ```

3. **Hover Effects:**
   ```typescript
   // Using CSS is often better for hover
   .card:hover {
     transform: translateY(-4px);
     transition: transform 0.2s;
   }
   ```

---

## Development Commands

### Essential Commands

```bash
# Install dependencies
npm install

# Start development server (http://localhost:4321)
npm run dev

# Build for production (outputs to dist/)
npm run build

# Preview production build locally
npm run preview

# Type check
npm run check

# Run tests
npm test

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run linter
npm run lint

# Run formatter
npm run format

# Full CI pipeline
npm run ci
```

### Testing Strategy

The test suite is organized into three tiers:

1. **Unit tests** (`npm test`) — Pure logic tests for tags, theme settings, and admin console utilities.
2. **Integration tests** (`npm run test:integration`) — Post-build assertions against generated HTML and artifacts (markdown smoke checks, production artifact validation).
3. **E2E tests** (`npm run test:e2e`) — Browser-level tests using Playwright to verify critical pages and the admin production boundary.

### Content Management Commands

```bash
# Generate new Bit draft (interactive)
npm run new:bit

# Font subsetting (if modifying fonts)
npm run font:build
```

### Verification Commands

```bash
# Run integration tests (requires build first)
npm run test:integration

# Run E2E tests (starts preview server automatically)
npm run test:e2e

# Check production artifacts
SITE_URL=https://your-domain.com npm run check:prod-artifacts
```

---

## Common Tasks

### Task: Change Site Title

1. Edit `site.config.mjs`:

   ```javascript
   export const site = {
     title: 'Your Name',
     brandTitle: 'Your Brand',
     // ...
   };
   ```

2. Or use Theme Console at `/admin` → Site Settings

3. Rebuild and deploy

### Task: Modify Navigation

1. Edit `src/data/settings/shell.json`:

   ```json
   {
     "nav": [
       {
         "id": "essay",
         "label": "Writing",
         "visible": true,
         "order": 1
       }
     ]
   }
   ```

2. Or use Theme Console at `/admin` → Sidebar Settings

### Task: Update Footer Copyright

1. Edit `src/data/settings/site.json`:

   ```json
   {
     "footer": {
       "copyright": "Your Name · Personal Site"
     }
   }
   ```

2. Or use Theme Console

### Task: Change Color Scheme

1. Edit `src/styles/global.css`
2. Modify CSS custom properties in `:root`
3. Also update dark mode variables
4. Test both light and dark modes

### Task: Add Social Links

1. Edit `src/data/settings/site.json`:

   ```json
   {
     "socialLinks": {
       "github": "https://github.com/username",
       "x": "https://x.com/username",
       "email": "mailto:you@example.com"
     }
   }
   ```

2. Rebuild

### Task: Create New Page

1. Create file: `src/pages/page-name.astro`
2. Use this template:

   ```astro
   ---
   import BaseLayout from '../layouts/BaseLayout.astro';
   ---

   <BaseLayout title="Page Title">
     <h1>Page Title</h1>
     <p>Content here...</p>
   </BaseLayout>
   ```

3. Access at `/page-name/`

### Task: Modify Essay List Page Size

Edit `site.config.mjs`:

```javascript
export const PAGE_SIZE_ESSAY = 12; // Change from default
```

---

## File Structure Reference

### Root Level

```
/
├── AGENTS.md                    # This guide
├── README.md                    # Public project readme
├── CHANGELOG.md                 # Version history
├── site.config.mjs             # Site configuration
├── astro.config.mjs            # Astro build config
├── tsconfig.json               # TypeScript config
├── package.json                # Dependencies
└── vitest.config.ts           # Test configuration
```

### Source Code

```
src/
├── assets/                     # Static assets processed by Astro
│   └── hero.png               # Homepage hero image
├── components/                 # Reusable Astro components
│   ├── admin/                 # Theme Console components
│   ├── Icon.astro             # Icon component
│   ├── Sidebar.astro          # Sidebar navigation
│   └── ...
├── content/                    # Content collections
│   ├── essay/                 # Long-form articles
│   ├── bits/                  # Short posts/photos
│   └── memo/                  # Journal entries
├── content.config.ts          # Content collection config
├── data/                      # JSON data files
│   ├── settings/             # Theme settings
│   └── projects.json         # Your projects
├── layouts/                   # Page layouts
│   ├── BaseLayout.astro      # Main layout
│   └── ...
├── lib/                       # Utility libraries
│   ├── admin-console/        # Theme Console logic
│   ├── tags.ts               # Tag utilities
│   └── theme-settings.ts     # Settings management
├── pages/                     # Route pages
│   ├── about/                # About + resume
│   ├── admin.astro           # Theme Console
│   ├── archive/              # Archive pages
│   ├── bits/                 # Bits listing
│   ├── essay/                # Essay listing
│   ├── index.astro           # Homepage
│   └── memo.astro            # Memo page
├── plugins/                   # Build plugins
│   └── shiki-toolbar.mjs     # Code block enhancements
├── scripts/                   # Client-side scripts
│   ├── admin-console/        # Admin panel scripts
│   ├── bits-*.ts             # Bits page scripts
│   ├── entry-*.ts            # Listing page scripts
│   ├── lightbox.ts           # Image lightbox
│   └── sidebar-theme.ts      # Theme toggle
├── styles/                    # CSS stylesheets
│   ├── components/           # Component styles
│   ├── global.css            # Global styles
│   ├── article.css           # Article page styles
│   ├── bits-page.css         # Bits page styles
│   └── ...
└── utils/                     # Utility functions
    ├── format.ts             # Formatting helpers
    └── r2-images.ts          # R2 image utilities (create this)
```

### Public Assets

```
public/
├── fonts/                     # Self-hosted fonts
├── images/                    # Static images
│   ├── archive/              # Essay images
│   ├── author/               # Author avatars
│   ├── bits/                 # Bits images (if local)
│   └── memo/                 # Memo images
├── bits/                      # Public bits images
├── favicon.ico               # Site favicon
├── preview-*.png             # Preview images
└── robots.txt                # SEO robots file
```

---

## Troubleshooting

### Issue: Changes not showing in development

**Solution:**

- Astro dev server has hot reload, but sometimes needs manual refresh
- Try: Stop server (`Ctrl+C`), run `npm run dev` again
- Clear browser cache

### Issue: Images not loading

**Check:**

- URL is correct and accessible
- Image exists in R2 bucket
- Width/height specified in frontmatter
- Using correct format (WebP recommended)

### Issue: Build fails

**Common causes:**

1. **Type errors:** Run `npm run check` to see TypeScript errors
2. **Missing dependencies:** Run `npm install`
3. **Node version:** Ensure Node >=22.12.0
4. **Syntax errors in Markdown:** Check frontmatter YAML syntax

### Issue: Theme Console not saving

**Note:** Theme Console (`/admin`) only works in development (`npm run dev`), not in production builds.

### Issue: Fonts not loading

**Check:**

- Font files exist in `public/fonts/`
- `@font-face` declarations in CSS
- `unicode-range` properly set

### Issue: Site looks wrong on mobile

**Check:**

- Meta viewport tag present (in BaseLayout)
- CSS responsive breakpoints
- Images have proper sizing

### Getting Help

1. Check this AGENTS.md guide first
2. Review the [Astro documentation](https://docs.astro.build)
3. Check existing content files as examples
4. For theme-specific issues, refer to original [astro-whono docs](https://github.com/cxro/astro-whono)

---

## Quick Reference Card

### Content Creation Checklist

**Essay:**

- [ ] File in `src/content/essay/`
- [ ] Frontmatter with title, date
- [ ] Content written
- [ ] `<!-- more -->` for excerpt
- [ ] Images uploaded to R2 (if any)
- [ ] Tags added
- [ ] draft: false

**Bits:**

- [ ] Images uploaded to R2
- [ ] File in `src/content/bits/`
- [ ] Frontmatter with date
- [ ] Image URLs and dimensions
- [ ] Tags (use `loc:Location` for place)

**Project:**

- [ ] Entry added to `src/data/projects.json`
- [ ] GitHub repo correct
- [ ] Description concise

**Build & Deploy:**

- [ ] `npm run build` succeeds
- [ ] Preview looks correct
- [ ] Deploy `dist/` folder

---

## Notes for AI Assistants

### Common Patterns

1. **Content files:** Always use frontmatter, validate YAML syntax
2. **Components:** Use TypeScript, define Props interface
3. **Styling:** Prefer CSS custom properties, use existing utility classes
4. **Images:** Always include width/height for performance
5. **Links:** Use relative paths for internal, full URLs for external

### Things to Avoid

- Don't modify files in `dist/` (generated)
- Don't commit `node_modules/`
- Don't use `&&` in npm scripts (Windows compatibility)
- Don't forget to handle both light and dark modes for colors

### Testing Changes

Always test:

1. Development server (`npm run dev`)
2. Production build (`npm run build && npm run preview`)
3. Both light and dark modes
4. Mobile viewport (responsive)
5. Different browsers if making significant changes

---

**Last Updated:** 2026-04-09
**Version:** 1.0
**Maintainer:** shuhanluo
