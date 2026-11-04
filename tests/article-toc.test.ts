import type { MarkdownHeading } from 'astro';
import { describe, expect, it } from 'vitest';
import { getArticleTocHeadings, hasOwnHeadingNumber } from '../src/lib/article-toc';
import { resolveActiveTocIndex } from '../src/scripts/article-toc';

const heading = (depth: number, slug: string, text = slug): MarkdownHeading => ({ depth, slug, text });
const summarize = (headings: MarkdownHeading[]) =>
  getArticleTocHeadings(headings).map(({ slug, level, number }) => [slug, level, number]);

describe('article toc headings', () => {
  it('keeps only H2/H3 in source order with Astro slugs untouched', () => {
    const headings = [
      heading(1, 'title'),
      heading(2, '文本格式', '文本格式'),
      heading(3, 'javascript', 'JavaScript'),
      heading(4, 'deep'),
      heading(2, '️-theme-console', '⚙️ Theme Console'),
      heading(3, 'javascript-1', 'JavaScript')
    ];

    expect(getArticleTocHeadings(headings).map(({ depth, slug }) => [depth, slug])).toEqual([
      [2, '文本格式'],
      [3, 'javascript'],
      [2, '️-theme-console'],
      [3, 'javascript-1']
    ]);
  });

  it('drops the GFM footnotes label heading', () => {
    const headings = [
      heading(2, 'intro'),
      heading(2, 'body'),
      heading(2, 'user-content-footnote-label', 'Footnotes'),
      heading(2, 'footnote-label', 'Footnote label')
    ];

    expect(getArticleTocHeadings(headings).map(({ slug }) => slug)).toEqual(['intro', 'body', 'footnote-label']);
  });

  it('returns no items when fewer than two headings remain', () => {
    expect(getArticleTocHeadings([])).toEqual([]);
    expect(getArticleTocHeadings([heading(1, 'title'), heading(2, 'only')])).toEqual([]);
    expect(getArticleTocHeadings([heading(2, 'only'), heading(2, 'user-content-footnote-label')])).toEqual([]);
  });

  it('numbers H2 as n. and H3 as n.m', () => {
    expect(summarize([heading(2, 'a'), heading(3, 'a1'), heading(3, 'a2'), heading(2, 'b'), heading(3, 'b1')])).toEqual([
      ['a', 1, '1.'],
      ['a1', 2, '1.1'],
      ['a2', 2, '1.2'],
      ['b', 1, '2.'],
      ['b1', 2, '2.1']
    ]);
  });

  it('treats the shallowest present depth as level 1', () => {
    expect(summarize([heading(3, 'x'), heading(3, 'y')])).toEqual([
      ['x', 1, '1.'],
      ['y', 1, '2.']
    ]);
  });

  it('skips numbering for the whole article when any heading carries its own number', () => {
    expect(summarize([heading(2, 'a', '1. 背景'), heading(2, 'b', '结论')])).toEqual([
      ['a', 1, null],
      ['b', 1, null]
    ]);
    expect(summarize([heading(2, 'a', '背景'), heading(3, 'b', '（一）细节')])).toEqual([
      ['a', 1, null],
      ['b', 2, null]
    ]);
  });

  it('skips numbering when an H3 appears before the first H2', () => {
    expect(summarize([heading(3, 'lead'), heading(2, 'a'), heading(3, 'a1')])).toEqual([
      ['lead', 2, null],
      ['a', 1, null],
      ['a1', 2, null]
    ]);
  });
});

describe('own heading number detection', () => {
  it.each([
    '1. 背景', '1 背景', '1.1 安装', '2.3.1 细节', '1、准备', '1) 步骤', '3）结果', '1：概述', '１．全角',
    '(1) 步骤', '（一）缘起', '一、背景', '十二. 附录', '第一章 开端', '第 2 节', '第三部分', 'I. Intro', 'IV) 收尾',
    '① 安装', '  2. 前导空格'
  ])('detects %s', (text) => {
    expect(hasOwnHeadingNumber(text)).toBe(true);
  });

  it.each([
    '2025年记', '3D 打印', '10%的人', '背景', 'CSS', 'Python 3 新特性', 'JavaScript', '十分重要', '一起出发',
    'Figure / Caption', '⚙️ Theme Console', 'I’m back', 'Vite 8'
  ])('ignores %s', (text) => {
    expect(hasOwnHeadingNumber(text)).toBe(false);
  });
});

describe('article toc active heading', () => {
  const base = {
    threshold: 80,
    viewportHeight: 900,
    atBottom: false,
    hashIndex: -1
  };

  it('returns -1 before the first heading reaches the threshold', () => {
    expect(resolveActiveTocIndex({ ...base, tops: [400, 1200, 2000] })).toBe(-1);
  });

  it('picks the last heading at or above the threshold', () => {
    expect(resolveActiveTocIndex({ ...base, tops: [-800, 80, 900] })).toBe(1);
    expect(resolveActiveTocIndex({ ...base, tops: [-2000, -1200, -300] })).toBe(2);
  });

  it('keeps a jumped-to H2 active when an H3 follows right below it', () => {
    // 跳转后 H2 停在 scroll-margin 56px，紧随的 H3 约在 115px。
    expect(resolveActiveTocIndex({ ...base, tops: [-900, 56, 115, 600] })).toBe(1);
  });

  it('activates the last heading once the page is at the bottom', () => {
    expect(resolveActiveTocIndex({ ...base, tops: [-1200, 60, 500, 760], atBottom: true })).toBe(3);
  });

  it('prefers a visible hash target below the threshold at the bottom', () => {
    const tops = [-1200, 60, 500, 760];
    expect(resolveActiveTocIndex({ ...base, tops, atBottom: true, hashIndex: 2 })).toBe(2);
  });

  it('falls back to the last heading when the hash target is off-screen or already passed', () => {
    expect(resolveActiveTocIndex({ ...base, tops: [-1200, 60, 500, 950], atBottom: true, hashIndex: 3 })).toBe(3);
    expect(resolveActiveTocIndex({ ...base, tops: [-1200, -400, 500, 760], atBottom: true, hashIndex: 0 })).toBe(3);
  });

  it('ignores the hash target when not at the bottom', () => {
    expect(resolveActiveTocIndex({ ...base, tops: [-1200, 60, 500, 760], hashIndex: 3 })).toBe(1);
  });
});
