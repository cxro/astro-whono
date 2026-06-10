import { describe, expect, it } from 'vitest';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createJsonRequest, setupAdminContentWriteFixture } from './admin-content-write-fixture';

const createEssayFrontmatter = (overrides: Record<string, unknown> = {}) => ({
  title: 'New Essay',
  description: '',
  date: '2026-06-08',
  publishedAt: '',
  updatedAt: '',
  tagsText: 'admin',
  draft: false,
  archive: true,
  slug: '',
  cover: '',
  badge: '',
  ...overrides
});

describe('admin content create contract', () => {
  const getTempRoot = setupAdminContentWriteFixture();

  it('creates draft essay entries without requiring revision', async () => {
    const { POST } = await import('../src/pages/api/admin/content/create');

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/create', {
        collection: 'essay',
        entryId: 'new-essay',
        frontmatter: createEssayFrontmatter()
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/create')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.written).toBe(true);
    expect(payload.editHref).toBe('/admin/content/essay/_edit/new-essay/');
    expect(payload.payload.collection).toBe('essay');
    expect(payload.payload.entryId).toBe('new-essay');
    expect(payload.payload.values.draft).toBe(true);

    const source = await readFile(path.join(getTempRoot(), 'src', 'content', 'essay', 'new-essay.md'), 'utf8');
    expect(source).toContain('title: New Essay');
    expect(source).toContain('draft: true');
    expect(source).toContain('tags:');
  });

  it('creates draft bits entries from a selected minute', async () => {
    const { POST } = await import('../src/pages/api/admin/content/create');

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/create', {
        collection: 'bits',
        frontmatter: {
          date: '2026-06-09T14:30:00-04:00'
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/create')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.written).toBe(true);
    expect(payload.result.relativePath).toBe('src/content/bits/bits-2026-06-09-1430.md');
    expect(payload.editHref).toBe('/admin/content/bits/_edit/bits-2026-06-09-1430/');
    expect(payload.payload.collection).toBe('bits');
    expect(payload.payload.entryId).toBe('bits-2026-06-09-1430');
    expect(payload.payload.values.date).toBe('2026-06-09T14:30:00-04:00');
    expect(payload.payload.values.draft).toBe(true);

    const source = await readFile(path.join(getTempRoot(), 'src', 'content', 'bits', 'bits-2026-06-09-1430.md'), 'utf8');
    expect(source).toContain('date: 2026-06-09T14:30:00-04:00');
    expect(source).toContain('draft: true');
  });

  it('auto-fills valid public slug when create defaults cannot produce one', async () => {
    const { POST } = await import('../src/pages/api/admin/content/create');

    const chineseResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/create', {
        collection: 'essay',
        entryId: '中文标题',
        frontmatter: createEssayFrontmatter({
          title: '中文标题',
          date: '2026-06-08'
        })
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/create')
    } as never);

    expect(chineseResponse.status).toBe(200);
    const chineseSource = await readFile(path.join(getTempRoot(), 'src', 'content', 'essay', '中文标题.md'), 'utf8');
    expect(chineseSource).toMatch(/\bslug: essay-260608-[a-z0-9]{4}\b/);

    const englishTitleResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/create', {
        collection: 'essay',
        entryId: '中文-source',
        frontmatter: createEssayFrontmatter({
          title: 'Readable English Title',
          date: '2026-06-08'
        })
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/create')
    } as never);

    expect(englishTitleResponse.status).toBe(200);
    const englishTitleSource = await readFile(path.join(getTempRoot(), 'src', 'content', 'essay', '中文-source.md'), 'utf8');
    expect(englishTitleSource).toContain('slug: readable-english-title');

    const multiSegmentTitleResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/create', {
        collection: 'essay',
        entryId: '中文-slash-title',
        frontmatter: createEssayFrontmatter({
          title: 'AI/ML Notes',
          date: '2026-06-08'
        })
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/create')
    } as never);

    expect(multiSegmentTitleResponse.status).toBe(200);
    const multiSegmentTitleSource = await readFile(path.join(getTempRoot(), 'src', 'content', 'essay', '中文-slash-title.md'), 'utf8');
    expect(multiSegmentTitleSource).toContain('slug: ai-ml-notes');

    const manualSlugResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/create', {
        collection: 'essay',
        entryId: '中文-manual',
        frontmatter: createEssayFrontmatter({
          title: '中文标题',
          date: '2026-06-08',
          slug: 'my-chinese-title'
        })
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/create')
    } as never);

    expect(manualSlugResponse.status).toBe(200);
    const manualSlugSource = await readFile(path.join(getTempRoot(), 'src', 'content', 'essay', '中文-manual.md'), 'utf8');
    expect(manualSlugSource).toContain('slug: my-chinese-title');
  });

  it('rejects duplicate files and duplicate public slugs before writing', async () => {
    const { POST } = await import('../src/pages/api/admin/content/create');

    const duplicateFileResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/create', {
        collection: 'essay',
        entryId: 'demo',
        frontmatter: createEssayFrontmatter()
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/create')
    } as never);

    expect(duplicateFileResponse.status).toBe(400);
    expect(JSON.parse(await duplicateFileResponse.text()).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'entryId' })])
    );

    const indexConflictDir = path.join(getTempRoot(), 'src', 'content', 'essay', 'index-conflict');
    await mkdir(indexConflictDir, { recursive: true });
    await writeFile(
      path.join(indexConflictDir, 'index.md'),
      ['---', 'title: Index Conflict', 'date: 2026-06-08', 'draft: false', '---', '', 'body', ''].join('\n'),
      'utf8'
    );

    const duplicateIndexResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/create', {
        collection: 'essay',
        entryId: 'index-conflict',
        frontmatter: createEssayFrontmatter()
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/create')
    } as never);

    expect(duplicateIndexResponse.status).toBe(400);
    expect(JSON.parse(await duplicateIndexResponse.text()).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'entryId' })])
    );

    const duplicateExplicitIndexResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/create', {
        collection: 'essay',
        entryId: 'demo/index',
        frontmatter: createEssayFrontmatter()
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/create')
    } as never);

    expect(duplicateExplicitIndexResponse.status).toBe(400);
    expect(JSON.parse(await duplicateExplicitIndexResponse.text()).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'entryId' })])
    );

    const duplicateSlugResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/create', {
        collection: 'essay',
        entryId: 'new-slug-conflict',
        frontmatter: createEssayFrontmatter({ slug: 'existing-essay' })
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/create')
    } as never);

    expect(duplicateSlugResponse.status).toBe(400);
    expect(JSON.parse(await duplicateSlugResponse.text()).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'slug' })])
    );
  });

  it('rejects non-creatable collections and malformed entry ids', async () => {
    const { POST } = await import('../src/pages/api/admin/content/create');

    const memoResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/create', {
        collection: 'memo',
        entryId: 'new-memo',
        frontmatter: createEssayFrontmatter()
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/create')
    } as never);

    expect(memoResponse.status).toBe(400);
    expect(JSON.parse(await memoResponse.text()).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'collection' })])
    );

    const invalidEntryResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/create', {
        collection: 'essay',
        entryId: '../secret',
        frontmatter: createEssayFrontmatter()
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/create')
    } as never);

    expect(invalidEntryResponse.status).toBe(400);
    expect(JSON.parse(await invalidEntryResponse.text()).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'entryId' })])
    );
  });

  it('rejects duplicate bits filenames derived from the selected minute', async () => {
    const { POST } = await import('../src/pages/api/admin/content/create');

    await writeFile(
      path.join(getTempRoot(), 'src', 'content', 'bits', 'bits-2026-06-09-1430.md'),
      ['---', 'date: 2026-06-09T14:30:00+08:00', '---', '', 'existing bit', ''].join('\n'),
      'utf8'
    );

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/create', {
        collection: 'bits',
        frontmatter: {
          date: '2026-06-09T14:30:00+08:00'
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/create')
    } as never);

    expect(response.status).toBe(400);
    expect(JSON.parse(await response.text()).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'entryId' })])
    );
  });
});
