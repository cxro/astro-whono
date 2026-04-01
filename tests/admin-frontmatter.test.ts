import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { patchMarkdownFrontmatter, splitMarkdownFrontmatter } from '../src/lib/admin-console/frontmatter';

const getFrontmatter = (source: string): Record<string, unknown> => {
  const section = splitMarkdownFrontmatter(source);
  return YAML.parse(section.frontmatterText ?? '') as Record<string, unknown>;
};

describe('admin-console/frontmatter', () => {
  it('keeps markdown body byte-identical when only frontmatter changes', () => {
    const source = [
      '---',
      'title: Old Title',
      'date: 2026-03-18',
      '---',
      '',
      '# Heading',
      '',
      '正文保持不变。',
      ''
    ].join('\n');

    const next = patchMarkdownFrontmatter(source, [
      { path: ['title'], value: 'New Title', action: 'set' }
    ]);

    const before = splitMarkdownFrontmatter(source);
    const after = splitMarkdownFrontmatter(next);

    expect(after.bodyText).toBe(before.bodyText);
    expect(getFrontmatter(next).title).toBe('New Title');
  });

  it('round-trips Chinese text without corrupting YAML', () => {
    const source = ['---', 'title: 旧标题', '---', '', '正文', ''].join('\n');

    const next = patchMarkdownFrontmatter(source, [
      { path: ['title'], value: '中文标题：后台演进', action: 'set' }
    ]);

    expect(getFrontmatter(next).title).toBe('中文标题：后台演进');
  });

  it('round-trips special characters in scalar fields', () => {
    const source = ['---', 'description: old', '---', '', 'body', ''].join('\n');

    const next = patchMarkdownFrontmatter(source, [
      { path: ['description'], value: 'A&B: "quotes" #hash ?query', action: 'set' }
    ]);

    expect(getFrontmatter(next).description).toBe('A&B: "quotes" #hash ?query');
  });

  it('writes multiline strings as valid YAML while preserving body', () => {
    const source = ['---', 'description: old', '---', '', 'line-1', 'line-2', ''].join('\n');

    const next = patchMarkdownFrontmatter(source, [
      { path: ['description'], value: '第一行\n第二行\n第三行', action: 'set' }
    ]);

    expect(getFrontmatter(next).description).toBe('第一行\n第二行\n第三行');
    expect(splitMarkdownFrontmatter(next).bodyText).toBe(splitMarkdownFrontmatter(source).bodyText);
  });

  it('adds fields into an empty frontmatter block', () => {
    const source = ['---', '---', '', 'body', ''].join('\n');

    const next = patchMarkdownFrontmatter(source, [
      { path: ['title'], value: 'From Empty Frontmatter', action: 'set' }
    ]);

    expect(getFrontmatter(next).title).toBe('From Empty Frontmatter');
  });

  it('creates a frontmatter block when the markdown file had none', () => {
    const source = ['# Plain Markdown', '', 'without frontmatter', ''].join('\n');

    const next = patchMarkdownFrontmatter(source, [
      { path: ['title'], value: 'Generated Frontmatter', action: 'set' }
    ]);

    expect(getFrontmatter(next).title).toBe('Generated Frontmatter');
    expect(splitMarkdownFrontmatter(next).bodyText).toBe(source);
  });

  it('keeps timezone date values intact when they are updated', () => {
    const source = ['---', 'date: 2025-02-03T01:01:45+08:00', '---', '', 'body', ''].join('\n');

    const next = patchMarkdownFrontmatter(source, [
      { path: ['date'], value: '2026-02-03T22:30:00+08:00', action: 'set' }
    ]);

    expect(getFrontmatter(next).date).toBe('2026-02-03T22:30:00+08:00');
  });

  it('round-trips YAML arrays and nested image objects', () => {
    const source = [
      '---',
      'tags:',
      '  - Markdown',
      'images:',
      '  - src: bits/demo.webp',
      '    width: 800',
      '    height: 600',
      '---',
      '',
      'body',
      ''
    ].join('\n');

    const next = patchMarkdownFrontmatter(source, [
      { path: ['tags'], value: ['Markdown', '示例'], action: 'set' },
      {
        path: ['images'],
        value: [
          { src: 'bits/demo.webp', width: 800, height: 600, alt: 'demo' },
          { src: 'https://example.com/hero.webp', width: 1200, height: 630 }
        ],
        action: 'set'
      }
    ]);

    expect(getFrontmatter(next).tags).toEqual(['Markdown', '示例']);
    expect(getFrontmatter(next).images).toEqual([
      { src: 'bits/demo.webp', width: 800, height: 600, alt: 'demo' },
      { src: 'https://example.com/hero.webp', width: 1200, height: 630 }
    ]);
  });

  it('supports deleting optional memo date fields', () => {
    const source = ['---', 'title: Memo', 'date: 2026-01-10', '---', '', 'memo body', ''].join('\n');

    const next = patchMarkdownFrontmatter(source, [
      { path: ['date'], action: 'delete' }
    ]);

    expect(getFrontmatter(next).date).toBeUndefined();
  });

  it('supports memo slug values without applying essay slugRule restrictions', () => {
    const source = ['---', 'title: Memo', '---', '', 'memo body', ''].join('\n');

    const next = patchMarkdownFrontmatter(source, [
      { path: ['slug'], value: 'memo/自由记录', action: 'set' }
    ]);

    expect(getFrontmatter(next).slug).toBe('memo/自由记录');
  });
});
