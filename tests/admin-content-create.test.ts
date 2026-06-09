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

    const bitsResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/create', {
        collection: 'bits',
        entryId: 'new-bit',
        frontmatter: createEssayFrontmatter()
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/create')
    } as never);

    expect(bitsResponse.status).toBe(400);
    expect(JSON.parse(await bitsResponse.text()).issues).toEqual(
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
});
