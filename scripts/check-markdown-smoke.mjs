import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readSmokeFixtureHtml, reportSmokeCheckResult } from './smoke-utils.mjs';

const distDir = path.resolve('dist');
const KATEX_STYLESHEET_ID = 'astro-whono-katex-stylesheet';
const KATEX_STYLESHEET_DATA_ATTR = 'data-astro-whono-katex';

const hasClass = (html, className) => {
  const pattern = new RegExp(`class="[^"]*\\b${className}\\b`, 'i');
  return pattern.test(html);
};

const getStylesheetLinks = (html) => {
  const pattern = /<link\b(?=[^>]*\brel="stylesheet")[^>]*>/gi;
  return Array.from(html.matchAll(pattern)).map((match) => match[0]);
};

const hasKatexStylesheet = (html) =>
  getStylesheetLinks(html).some((tag) =>
    tag.includes(`id="${KATEX_STYLESHEET_ID}"`)
    && tag.includes(KATEX_STYLESHEET_DATA_ATTR)
    && /href="[^"]*katex[^"]*\.css/i.test(tag)
  );

const readBuiltHtml = async (relativePath, label) => {
  const filePath = path.join(distDir, ...relativePath.split('/'));
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    console.error(`${label} failed: unable to read build output.`);
    console.error(`Expected file: ${filePath}`);
    console.error('Run `npm run build` first.');
    process.exit(1);
  }
};

const getTagsByClass = (html, tag, className) => {
  const pattern = new RegExp(`<${tag}[^>]*\\bclass="[^"]*\\b${className}\\b[^"]*"[^>]*>`, 'gi');
  return Array.from(html.matchAll(pattern)).map((match) => match[0]);
};

const getFigureBlock = (html) => {
  const match = html.match(
    /<figure[^>]*\bclass="[^"]*\bfigure\b[^"]*"[^>]*>([\s\S]*?)<\/figure>/i
  );
  return match ? match[1] : '';
};

const getGalleryBlock = (html) => {
  const match = html.match(
    /<ul[^>]*\bclass="[^"]*\bgallery\b[^"]*"[^>]*>([\s\S]*?)<\/ul>/i
  );
  return match ? match[1] : '';
};

const checkGroups = [
  {
    label: 'Callout check',
    checks: [
      {
        id: 'callout.tip',
        test: (html) => /class="[^"]*\bcallout\b[^"]*\btip\b/.test(html)
      },
      {
        id: 'callout-title',
        test: (html) => /class="[^"]*\bcallout-title\b/.test(html)
      }
    ]
  },
  {
    label: 'Content syntax check',
    checks: [
      {
        id: 'highlight.mark',
        test: (html) => html.includes('<mark>高亮</mark>')
      },
      {
        id: 'colon-text.kept',
        test: (html) => html.includes('会议 10:30 开始')
      },
      {
        id: 'spoiler.inline',
        test: (html) => getTagsByClass(html, 'span', 'spoiler').some((tag) => /role="button"/.test(tag) && /aria-label=/.test(tag))
      },
      {
        id: 'spoiler.block',
        test: (html) => hasClass(html, 'spoiler--block')
      },
      {
        id: 'details.summary',
        test: (html) => html.includes('<details><summary>折叠标题</summary>')
      }
    ]
  },
  {
    label: 'Code block check',
    checks: [
      {
        id: 'code-block.wrapper',
        test: (html) => hasClass(html, 'code-block')
      },
      {
        id: 'code-block.toolbar',
        test: (html) => hasClass(html, 'code-toolbar')
      },
      {
        id: 'code-block.data-attrs',
        test: (html) => {
          const blocks = getTagsByClass(html, 'div', 'code-block');
          return blocks.some((tag) => /data-lines\s*=/.test(tag) && /data-lang\s*=/.test(tag));
        }
      },
      {
        id: 'code-copy.button',
        test: (html) => {
          const buttons = getTagsByClass(html, 'button', 'code-copy');
          return buttons.some((tag) => /aria-label\s*=/.test(tag) && /data-state\s*=/.test(tag));
        }
      },
      {
        id: 'code-lines.class',
        test: (html) => hasClass(html, 'line')
      }
    ]
  },
  {
    label: 'Math check',
    checks: [
      {
        id: 'math.katex.inline',
        test: (html) => hasClass(html, 'katex')
      },
      {
        id: 'math.katex.display',
        test: (html) => hasClass(html, 'katex-display')
      },
      {
        id: 'math.stylesheet',
        test: (html) => hasKatexStylesheet(html)
      },
      {
        id: 'math.not-shiki-code',
        test: (html) =>
          !html.includes('language-math')
          && !html.includes('math-inline')
          && !html.includes('math-display')
      }
    ]
  },
  {
    label: 'Figure check',
    checks: [
      {
        id: 'figure.wrapper',
        test: (html) => /<figure[^>]*\bclass="[^"]*\bfigure\b/.test(html)
      },
      {
        id: 'figure.size-class',
        test: (html) => /<figure[^>]*\bclass="[^"]*\bfigure--md\b/.test(html)
      },
      {
        id: 'figure.align-class',
        test: (html) => /<figure[^>]*\bclass="[^"]*\bfigure--left\b/.test(html)
      },
      {
        id: 'figure.media',
        test: (html) => /<(img|picture)\b/i.test(getFigureBlock(html))
      },
      {
        id: 'figure.caption',
        test: (html) => /<figcaption[^>]*\bclass="[^"]*\bfigure-caption\b/.test(getFigureBlock(html))
      }
    ]
  },
  {
    label: 'Gallery check',
    checks: [
      {
        id: 'gallery.list',
        test: (html) => /<ul[^>]*\bclass="[^"]*\bgallery\b/.test(html)
      },
      {
        id: 'gallery.cols-2',
        test: (html) => /<ul[^>]*\bclass="[^"]*\bcols-2\b/.test(html)
      },
      {
        id: 'gallery.item',
        test: (html) => /<li[\s>]/i.test(getGalleryBlock(html))
      },
      {
        id: 'gallery.figure',
        test: (html) => /<figure[\s>]/i.test(getGalleryBlock(html))
      },
      {
        id: 'gallery.media',
        test: (html) => /<(img|picture)\b/i.test(getGalleryBlock(html))
      }
    ]
  }
];

const html = await readSmokeFixtureHtml('Markdown smoke check');
const noMathFixtureHtml = await readBuiltHtml(
  'checks/markdown-smoke-no-math/index.html',
  'No-math markdown smoke fixture'
);
const failedIds = [];

for (const group of checkGroups) {
  const groupFailedIds = group.checks
    .filter((item) => !item.test(html))
    .map((item) => item.id);

  if (groupFailedIds.length === 0) {
    console.log(`${group.label} passed.`);
  } else {
    failedIds.push(...groupFailedIds);
  }
}

const noMathFailedIds = [];
if (hasKatexStylesheet(noMathFixtureHtml)) noMathFailedIds.push('math.stylesheet.absent.fixture-no-math');
if (hasClass(noMathFixtureHtml, 'katex')) noMathFailedIds.push('math.katex.absent.fixture-no-math');

if (noMathFailedIds.length === 0) {
  console.log('KaTeX absence check passed.');
} else {
  failedIds.push(...noMathFailedIds);
}

reportSmokeCheckResult('Markdown smoke check', failedIds);
