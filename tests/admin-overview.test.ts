import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', () => ({
  getCollection: vi.fn()
}));

import { getCollection } from 'astro:content';
import {
  buildAdminOverviewBitsHrefById,
  buildAdminOverviewMaintainerSummary,
  buildAdminOverviewPublicSummary,
  countAdminOverviewWords,
  getAdminOverviewData,
  type AdminOverviewMaintainerSource,
  type AdminOverviewPublicSource
} from '../src/lib/admin-console/overview';

const getCollectionMock = vi.mocked(getCollection);
const date = (value: string) => new Date(value);

const essay = (id: string, options: Record<string, unknown> = {}) => ({
  id,
  collection: 'essay',
  data: {
    title: `Essay ${id}`,
    date: date('2026-01-10T00:00:00.000Z'),
    tags: [] as string[],
    draft: false,
    archive: true,
    ...options
  }
});

const bit = (id: string, options: Record<string, unknown> = {}) => ({
  id,
  collection: 'bits',
  data: {
    title: `Bit ${id}`,
    date: date('2026-01-09T12:00:00.000Z'),
    tags: [] as string[],
    draft: false,
    ...options
  }
});

const memo = (id: string, options: Record<string, unknown> = {}) => ({
  id,
  collection: 'memo',
  data: {
    title: `Memo ${id}`,
    date: date('2026-01-08T00:00:00.000Z'),
    draft: false,
    ...options
  }
});

const withBody = <T extends object>(entry: T, body: string): T & { body: string } => ({
  ...entry,
  body
});

const mockCollections = (collections: Record<string, object[]>) => {
  getCollectionMock.mockImplementation(async (collection, filter) => {
    const entries = collections[String(collection)] ?? [];
    const entryFilter = typeof filter === 'function'
      ? filter as (entry: object) => boolean
      : null;
    return (entryFilter
      ? entries.filter((entry) => entryFilter(entry))
      : entries) as never;
  });
};

describe('admin-console/overview', () => {
  beforeEach(() => {
    getCollectionMock.mockReset();
  });

  it('builds public summary from published source and archive-only tag source', () => {
    const publicSource = {
      essays: [
        essay('archive-essay', { tags: ['Design', 'Astro'] }),
        essay('essay-only', { archive: false, tags: ['Hidden'] })
      ],
      archiveEssays: [
        essay('archive-essay', { tags: ['Design', 'Astro'] })
      ],
      bits: [bit('published-bit', { date: date('2026-01-12T12:00:00.000Z') })],
      memos: [memo('published-memo')],
      bitsHrefById: new Map([['published-bit', '/bits/#bit-published-bit']])
    } as unknown as AdminOverviewPublicSource;

    const summary = buildAdminOverviewPublicSummary(publicSource, {
      now: date('2026-01-20T06:00:00.000Z')
    });

    expect(summary.stats.publishedCount).toBe(4);
    expect(summary.stats.tagCount).toBe(2);
    expect(summary.stats.wordCount).toBe(0);
    expect(summary.stats.lastUpdate?.date.toISOString()).toBe('2026-01-12T12:00:00.000Z');
    expect(summary.topTags.map((tag) => tag.label)).toEqual(['Astro', 'Design']);
    expect(summary).not.toHaveProperty('archiveYears');
    expect(summary.writingActivity).toHaveLength(90);
    expect(summary.writingActivity.at(-1)).toMatchObject({
      date: '2026-01-20',
      count: 0,
      level: 0
    });
    expect(summary.writingActivity.find((day) => day.date === '2026-01-12')).toMatchObject({
      count: 1,
      level: 1
    });
  });

  it('counts CJK characters and English or numeric runs from cleaned markdown', () => {
    const markdown = [
      '# 标题',
      '中文 and English 2026，标点！42',
      '[链接](https://example.com) ![图片](./image.png)',
      '```js',
      'const ignored = 100;',
      '```'
    ].join('\n');

    expect(countAdminOverviewWords(markdown)).toBe(12);
    expect(countAdminOverviewWords('')).toBe(0);
    expect(countAdminOverviewWords('，。、；:!? -')).toBe(0);
  });

  it('counts only public source bodies for the overview word metric', () => {
    const draftBodyWordCount = countAdminOverviewWords('草稿 draft 999');
    const publicSource = {
      essays: [
        withBody(essay('published-essay'), '中文 alpha 123')
      ],
      archiveEssays: [],
      bits: [
        withBody(bit('published-bit'), 'beta test 42')
      ],
      memos: [
        withBody(memo('published-memo'), 'かな memo')
      ],
      bitsHrefById: new Map([['published-bit', '/bits/#bit-published-bit']])
    } as unknown as AdminOverviewPublicSource;

    const summary = buildAdminOverviewPublicSummary(publicSource);

    expect(summary.stats.wordCount).toBe(10);
    expect(summary.stats.wordCount).not.toBe(10 + draftBodyWordCount);
  });

  it('excludes draft bodies from word count while maintainer data can still include drafts', async () => {
    mockCollections({
      essay: [
        withBody(essay('published-essay'), '中文 alpha 123'),
        withBody(essay('draft-essay', { draft: true }), '草稿 draft 999')
      ],
      bits: [
        withBody(bit('published-bit'), 'beta test 42'),
        withBody(bit('draft-bit', { draft: true }), '草稿 bit 888')
      ],
      memo: [
        withBody(memo('published-memo'), 'かな memo'),
        withBody(memo('draft-memo', { draft: true }), '草稿 memo 777')
      ]
    });

    const data = await getAdminOverviewData({
      includeMaintainer: true,
      includeDraftInRecent: true
    });

    expect(data.stats.wordCount).toBe(10);
    expect(data.maintainerSummary?.draftCount).toBe(3);
    expect(data.recentPublications.some((entry) => entry.isDraft)).toBe(true);
  });

  it('keeps draft recent items unlinkable while published bits use the public href map', () => {
    const maintainerSource = {
      essays: [],
      bits: [
        bit('draft-bit', {
          title: 'Draft Bit',
          draft: true,
          date: date('2026-01-13T12:00:00.000Z')
        }),
        bit('published-bit', {
          title: 'Published Bit',
          date: date('2026-01-12T12:00:00.000Z')
        })
      ],
      memos: []
    } as unknown as AdminOverviewMaintainerSource;

    const summary = buildAdminOverviewMaintainerSummary(
      maintainerSource,
      new Map([['published-bit', '/bits/#bit-published-bit']])
    );

    expect(summary?.draftCount).toBe(1);
    expect(summary?.recentPublications[0]).toMatchObject({
      title: 'Draft Bit',
      isDraft: true,
      href: null
    });
    expect(summary?.recentPublications[1]).toMatchObject({
      title: 'Published Bit',
      isDraft: false,
      href: '/bits/#bit-published-bit'
    });
  });

  it('builds bits hrefs from the published bits order and page size', () => {
    const bits = Array.from({ length: 21 }, (_, index) => bit(`bit-${index}`));
    const hrefById = buildAdminOverviewBitsHrefById(bits as unknown as AdminOverviewPublicSource['bits']);

    expect(hrefById.get('bit-0')).toBe('/bits/#bit-bit-0');
    expect(hrefById.get('bit-20')).toBe('/bits/page/2/#bit-bit-20');
  });
});
