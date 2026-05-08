import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/content', () => ({
  getEssayDerivedText: vi.fn(),
  getEssaySlug: vi.fn(),
  getMemoDerivedText: vi.fn(),
  getPageSlice: vi.fn(),
  getPublished: vi.fn(),
  getSortedEssays: vi.fn(),
  getTotalPages: vi.fn()
}));

vi.mock('../src/lib/bits', () => ({
  getBitAnchorId: (key: string) => `bit-${key}`,
  getBitsPagePath: (page: number) => (page <= 1 ? '/bits/' : `/bits/page/${page}/`),
  getBitSlug: vi.fn(),
  getBitsDerivedText: vi.fn(),
  getBitsSearchIndex: vi.fn(),
  getSortedBits: vi.fn()
}));

vi.mock('../src/lib/admin-console/content-shared', () => ({
  listAdminCollectionSourceFiles: vi.fn(),
  resolveAdminContentEntryIdFromSourcePath: vi.fn((collection: string, filePath: string) => {
    const relative = filePath.replace(/\\/g, '/').replace(`src/content/${collection}/`, '');
    if (relative.endsWith('/index.md')) return relative.slice(0, -'/index.md'.length);
    if (relative.endsWith('/index.mdx')) return relative.slice(0, -'/index.mdx'.length);
    return relative.replace(/\.(md|mdx)$/i, '');
  }),
  toAdminContentRelativeProjectPath: vi.fn((filePath: string) => filePath.replace(/\\/g, '/'))
}));

const contentModule = await import('../src/lib/content');
const bitsModule = await import('../src/lib/bits');
const contentSharedModule = await import('../src/lib/admin-console/content-shared');

const {
  filterAdminContentItems,
  getAdminContentConsolePageData,
  getAdminContentFilterState,
  getAdminContentPublicFallbackLabel
} = await import('../src/lib/admin-console/content');

type AdminContentIndexItem = import('../src/lib/admin-console/content').AdminContentIndexItem;
type EssayEntry = import('../src/lib/content').EssayEntry;
type BitsEntry = import('../src/lib/bits').BitsEntry;
type MemoEntry = import('../src/lib/admin-console/content').MemoEntry;

const mockedContent = vi.mocked(contentModule);
const mockedBits = vi.mocked(bitsModule);
const mockedContentShared = vi.mocked(contentSharedModule);

const createItem = (overrides: Partial<AdminContentIndexItem> = {}): AdminContentIndexItem => ({
  collection: 'essay',
  collectionLabel: '随笔',
  id: 'essay/example.md',
  publicEntryId: 'essay/example.md',
  title: 'Example Entry',
  slug: 'example-entry',
  relativePath: 'src/content/essay/example.md',
  publicHref: '/archive/example-entry/',
  isDraft: false,
  archive: true,
  date: new Date('2026-04-01T08:00:00.000Z'),
  dateLabel: '2026-04-01 08:00',
  year: 2026,
  tags: ['astro', 'admin'],
  searchHaystack: 'example entry example-entry astro admin',
  ...overrides
});

const createEssayEntry = (overrides: Partial<EssayEntry> = {}): EssayEntry => ({
  id: 'admin-console-guide.md',
  body: 'Essay body text',
  data: {
    title: 'Admin Console Guide',
    description: 'Guide description',
    date: new Date('2026-04-01T00:00:00.000Z'),
    tags: ['admin'],
    draft: false,
    archive: true
  },
  ...overrides
} as EssayEntry);

const createBitsEntry = (overrides: Partial<BitsEntry> = {}): BitsEntry => ({
  id: 'bits-2026-02-03-2230.md',
  body: 'Bits body text',
  data: {
    title: 'Bits Note',
    description: 'Bits description',
    date: new Date('2026-02-03T14:30:00.000Z'),
    tags: ['bits'],
    draft: false
  },
  ...overrides
} as BitsEntry);

const createMemoEntry = (overrides: Partial<MemoEntry> = {}): MemoEntry => ({
  id: 'index.md',
  body: 'Memo body text',
  data: {
    title: 'Memo',
    subtitle: 'Memo subtitle',
    date: new Date('2026-01-01T00:00:00.000Z'),
    draft: false,
    slug: 'memo'
  },
  ...overrides
} as MemoEntry);

describe('admin-console/content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedContentShared.listAdminCollectionSourceFiles.mockImplementation(async (collection) => {
      if (collection === 'essay') return ['essay-a.md', 'essay-b.md'];
      if (collection === 'bits') return ['bits-a.md'];
      return ['memo-a.md'];
    });
    mockedContent.getSortedEssays.mockResolvedValue([createEssayEntry()]);
    mockedContent.getPublished.mockResolvedValue([createMemoEntry()]);
    mockedContent.getEssaySlug.mockImplementation((entry) => entry.id.replace(/\.mdx?$/i, ''));
    mockedContent.getEssayDerivedText.mockReturnValue({
      plainText: 'Essay body text',
      text: 'essay body text',
      excerpt: 'Essay body'
    });
    mockedContent.getMemoDerivedText.mockReturnValue({
      plainText: 'Memo body text',
      excerptText: 'Memo body text'
    });
    mockedBits.getSortedBits.mockResolvedValue([createBitsEntry()]);
    mockedBits.getBitSlug.mockImplementation((entry) => entry.id.replace(/\.mdx?$/i, ''));
    mockedBits.getBitsDerivedText.mockReturnValue({
      plainText: 'Bits body text',
      text: 'bits body text',
      excerpt: 'Bits body',
      shouldRenderFull: true
    });
    mockedBits.getBitsSearchIndex.mockResolvedValue([]);
  });

  it('normalizes content filter state from URL search params', () => {
    const state = getAdminContentFilterState(new URLSearchParams([
      ['q', '  Astro   Admin  '],
      ['collection', 'bits'],
      ['draft', 'draft'],
      ['tag', 'Astro Build'],
      ['year', '2026'],
      ['sort', 'title']
    ]));

    expect(state.query).toBe('Astro   Admin');
    expect(state.queryTokens).toEqual(['astro', 'admin']);
    expect(state.collection).toBe('bits');
    expect(state.draft).toBe('draft');
    expect(state.tag).toBe('astro-build');
    expect(state.year).toBe(2026);
    expect(state.sort).toBe('title');
  });

  it('filters content items by query, draft, tag and year', () => {
    const items = [
      createItem(),
      createItem({
        id: 'essay/draft.md',
        title: 'Draft Entry',
        slug: 'draft-entry',
        isDraft: true,
        tags: ['draft'],
        year: 2025,
        searchHaystack: 'draft entry draft-entry draft'
      }),
      createItem({
        id: 'bits/note.md',
        collection: 'bits',
        collectionLabel: '絮语',
        title: 'Bits Note',
        slug: 'bits-note',
        relativePath: 'src/content/bits/note.md',
        tags: ['bits'],
        searchHaystack: 'bits note bits-note bits'
      })
    ];

    const filtered = filterAdminContentItems(items, {
      collection: 'all',
      query: 'example',
      queryTokens: ['example'],
      draft: 'published',
      tag: 'astro',
      year: 2026,
      sort: 'recent'
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('essay/example.md');
  });

  it('filters content items by collection scope before other filters', () => {
    const items = [
      createItem(),
      createItem({
        collection: 'bits',
        collectionLabel: '絮语',
        id: 'bits/note.md',
        title: 'Bits Note',
        slug: 'bits-note',
        relativePath: 'src/content/bits/note.md',
        tags: ['admin'],
        searchHaystack: 'bits note bits-note admin'
      })
    ];

    const filtered = filterAdminContentItems(items, {
      collection: 'bits',
      query: '',
      queryTokens: [],
      draft: 'all',
      tag: 'admin',
      year: null,
      sort: 'recent'
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.collection).toBe('bits');
  });

  it('loads full item data only for the selected collection scope', async () => {
    const pageData = await getAdminContentConsolePageData(new URLSearchParams([
      ['collection', 'essay']
    ]));

    expect(mockedContent.getSortedEssays).toHaveBeenCalledTimes(1);
    expect(mockedBits.getSortedBits).not.toHaveBeenCalled();
    expect(mockedContent.getPublished).not.toHaveBeenCalled();
    expect(mockedContent.getEssayDerivedText).not.toHaveBeenCalled();
    expect(mockedBits.getBitsSearchIndex).not.toHaveBeenCalled();
    expect(pageData.totalCount).toBe(4);
    expect(pageData.collectionOptions).toEqual([
      { value: 'all', label: '全部内容', count: 4 },
      { value: 'essay', label: '随笔', count: 2 },
      { value: 'bits', label: '絮语', count: 1 },
      { value: 'memo', label: '小记', count: 1 }
    ]);
    expect(pageData.tagOptions).toEqual([
      { value: 'admin', label: 'admin', count: 1 }
    ]);
    expect(pageData.sections).toHaveLength(1);
    expect(pageData.sections[0]?.collection).toBe('essay');
    expect(pageData.sections[0]?.totalCount).toBe(2);
  });

  it('keeps an active URL tag visible even when no loaded item has that tag', async () => {
    const pageData = await getAdminContentConsolePageData(new URLSearchParams([
      ['collection', 'essay'],
      ['tag', 'Missing Tag']
    ]));

    expect(pageData.filterState.tag).toBe('missing-tag');
    expect(pageData.filteredCount).toBe(0);
    expect(pageData.hasActiveFilters).toBe(true);
    expect(pageData.tagOptions).toEqual([
      { value: 'admin', label: 'admin', count: 1 },
      { value: 'missing-tag', label: 'missing-tag', count: 0 }
    ]);
  });

  it('loads body search text only when a query is active', async () => {
    const pageData = await getAdminContentConsolePageData(new URLSearchParams([
      ['collection', 'essay'],
      ['q', 'body']
    ]));

    expect(mockedContent.getSortedEssays).toHaveBeenCalledTimes(1);
    expect(mockedContent.getEssayDerivedText).toHaveBeenCalledTimes(1);
    expect(mockedBits.getSortedBits).not.toHaveBeenCalled();
    expect(mockedContent.getPublished).not.toHaveBeenCalled();
    expect(pageData.filteredCount).toBe(1);
    expect(pageData.sections[0]?.items[0]?.id).toBe('admin-console-guide.md');
  });

  it('uses the source file path as the admin entry id when Astro normalizes the public id', async () => {
    mockedContent.getSortedEssays.mockResolvedValue([
      createEssayEntry({
        id: 'admin-console-guide-copy',
        filePath: 'src/content/essay/admin-console-guide copy.md'
      })
    ]);

    const pageData = await getAdminContentConsolePageData(new URLSearchParams([
      ['collection', 'essay']
    ]));
    const item = pageData.sections[0]?.items[0];

    expect(item?.id).toBe('admin-console-guide copy');
    expect(item?.publicEntryId).toBe('admin-console-guide-copy');
    expect(item?.relativePath).toBe('src/content/essay/admin-console-guide copy.md');
    expect(item?.publicHref).toBe('/archive/admin-console-guide-copy/');
  });

  it('builds bits edit list hrefs without loading the public search index', async () => {
    const pageData = await getAdminContentConsolePageData(new URLSearchParams([
      ['collection', 'bits']
    ]));

    expect(mockedBits.getSortedBits).toHaveBeenCalledTimes(1);
    expect(mockedBits.getBitsSearchIndex).not.toHaveBeenCalled();
    expect(pageData.sections[0]?.items[0]?.publicHref).toBe('/bits/#bit-bits-2026-02-03-2230.md');
  });

  it('calculates bits public href pages from published entries only', async () => {
    const draftEntry = createBitsEntry({
      id: 'draft.md',
      data: {
        ...createBitsEntry().data,
        title: 'Draft Bits',
        draft: true
      }
    });
    const publishedEntries = Array.from({ length: 20 }, (_, index) => {
      const id = `published-${String(index + 1).padStart(2, '0')}.md`;
      return createBitsEntry({
        id,
        data: {
          ...createBitsEntry().data,
          title: `Published ${index + 1}`,
          draft: false
        }
      });
    });
    mockedBits.getSortedBits.mockResolvedValue([draftEntry, ...publishedEntries]);
    mockedContentShared.listAdminCollectionSourceFiles.mockImplementation(async (collection) => {
      if (collection === 'bits') return ['draft.md', ...publishedEntries.map((entry) => entry.id)];
      return [];
    });

    const pageData = await getAdminContentConsolePageData(new URLSearchParams([
      ['collection', 'bits']
    ]));
    const draftItem = pageData.sections[0]?.items.find((item) => item.id === 'draft.md');
    const lastFirstPageItem = pageData.sections[0]?.items.find((item) => item.id === 'published-20.md');

    expect(draftItem?.publicHref).toBeNull();
    expect(lastFirstPageItem?.publicHref).toBe('/bits/#bit-published-20.md');
  });

  it('returns readable public fallback labels for non-public entries', () => {
    expect(getAdminContentPublicFallbackLabel(createItem({ isDraft: true, publicHref: null }))).toContain('draft');
    expect(
      getAdminContentPublicFallbackLabel(createItem({
        collection: 'memo',
        collectionLabel: '小记',
        id: 'memo/index.md',
        publicHref: null,
        relativePath: 'src/content/memo/index.md'
      }))
    ).toContain('/memo/');
    expect(
      getAdminContentPublicFallbackLabel(createItem({
        collection: 'bits',
        collectionLabel: '絮语',
        id: 'bits/example.md',
        slug: 'bits-example',
        publicHref: null,
        relativePath: 'src/content/bits/example.md'
      }))
    ).toContain('bit-bits-example');
  });
});
