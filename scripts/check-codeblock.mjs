import { readSmokeFixtureHtml, reportSmokeCheckResult } from './smoke-utils.mjs';

const hasClass = (html, className) => {
  const pattern = new RegExp(`class="[^"]*\\b${className}\\b`, 'i');
  return pattern.test(html);
};

const getTagsByClass = (html, tag, className) => {
  const pattern = new RegExp(`<${tag}[^>]*\\bclass="[^"]*\\b${className}\\b[^"]*"[^>]*>`, 'gi');
  return Array.from(html.matchAll(pattern)).map((match) => match[0]);
};

const checks = [
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
];

const html = await readSmokeFixtureHtml('Code block check');
const failed = checks.filter((item) => !item.test(html)).map((item) => item.id);

reportSmokeCheckResult('Code block check', failed);
