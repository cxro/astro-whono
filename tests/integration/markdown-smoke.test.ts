import { describe, expect, it } from 'vitest';
import { readSmokeFixtureHtml } from '../../scripts/smoke-utils.mjs';

describe('markdown-smoke', async () => {
  const html = await readSmokeFixtureHtml('Markdown smoke');

  it('renders callouts', () => {
    expect(html).toMatch(/class="[^"]*\bcallout\b[^"]*\btip\b/);
    expect(html).toMatch(/class="[^"]*\bcallout-title\b/);
  });

  it('renders code blocks with toolbar and data attrs', () => {
    expect(html).toMatch(/class="[^"]*\bcode-block\b/);
    expect(html).toMatch(/class="[^"]*\bcode-toolbar\b/);

    const blocks = Array.from(
      html.matchAll(/<div[^>]*\bclass="[^"]*\bcode-block\b[^"]*"[^>]*>/gi),
      (m) => m[0]
    );
    expect(
      blocks.some(
        (tag) => /data-lines\s*=/.test(tag) && /data-lang\s*=/.test(tag)
      )
    ).toBe(true);

    const buttons = Array.from(
      html.matchAll(/<button[^>]*\bclass="[^"]*\bcode-copy\b[^"]*"[^>]*>/gi),
      (m) => m[0]
    );
    expect(
      buttons.some(
        (tag) => /aria-label\s*=/.test(tag) && /data-state\s*=/.test(tag)
      )
    ).toBe(true);

    expect(html).toMatch(/class="[^"]*\bline\b/);
  });

  it('renders figures', () => {
    expect(html).toMatch(/<figure[^>]*\bclass="[^"]*\bfigure\b/);

    const figureMatch = html.match(
      /<figure[^>]*\bclass="[^"]*\bfigure\b[^"]*"[^>]*>([\s\S]*?)<\/figure>/i
    );
    const figureInner = figureMatch?.[1] ?? '';
    expect(/<(img|picture)\b/i.test(figureInner)).toBe(true);
    expect(
      /<figcaption[^>]*\bclass="[^"]*\bfigure-caption\b/.test(figureInner)
    ).toBe(true);
  });

  it('renders galleries', () => {
    expect(html).toMatch(/<ul[^>]*\bclass="[^"]*\bgallery\b/);

    const galleryMatch = html.match(
      /<ul[^>]*\bclass="[^"]*\bgallery\b[^"]*"[^>]*>([\s\S]*?)<\/ul>/i
    );
    const galleryInner = galleryMatch?.[1] ?? '';
    expect(/<li[\s>]/i.test(galleryInner)).toBe(true);
    expect(/<figure[\s>]/i.test(galleryInner)).toBe(true);
    expect(/<(img|picture)\b/i.test(galleryInner)).toBe(true);
  });
});
