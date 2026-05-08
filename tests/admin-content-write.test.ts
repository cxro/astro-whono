import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const createJsonRequest = (url: string, payload: unknown) =>
  new Request(url, {
    method: 'POST',
    headers: {
      origin: new URL(url).origin,
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(payload)
  });

const omitPublishedAt = (values: Record<string, unknown>): Record<string, unknown> => {
  const next = { ...values };
  delete next.publishedAt;
  return next;
};

describe('admin content write api', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-content-'));
    process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT = tempRoot;

    await mkdir(path.join(tempRoot, 'src', 'content', 'essay'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'bits'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'memo'), { recursive: true });
    await mkdir(path.join(tempRoot, 'public', 'author'), { recursive: true });

    await writeFile(path.join(tempRoot, 'public', 'author', 'alice.webp'), 'avatar');
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'essay', 'demo.md'),
      ['---', 'title: Demo Essay', 'date: 2026-03-18', 'draft: false', '---', '', '# Essay', '', '正文保持不变。', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'essay', 'admin-console-guide copy.md'),
      ['---', 'title: Space Name Essay', 'date: 2026-03-21', 'draft: false', '---', '', '# Space Name', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'essay', 'other.md'),
      ['---', 'title: Other Essay', 'date: 2026-03-20', 'slug: existing-essay', '---', '', '# Other', '', 'duplicate guard', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'bits', 'demo.md'),
      [
        '---',
        'date: 2025-02-03T01:01:45+08:00',
        'tags:',
        '  - Markdown',
        'images:',
        '  - src: bits/demo.webp',
        '    width: 800',
        '    height: 600',
        '---',
        '',
        'Bits body',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'memo', 'index.md'),
      [
        '---',
        'title: Memo',
        'subtitle: Memo subtitle',
        'date: 2026-01-10',
        'draft: true',
        'slug: memo-note',
        '---',
        '',
        'memo body',
        ''
      ].join('\n'),
      'utf8'
    );
  });

  afterEach(async () => {
    delete process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT;
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('loads editable payload for essay entries', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const payload = await readAdminContentEntryEditorPayload('essay', 'demo');

    expect(payload.writable).toBe(true);
    expect(payload.values.title).toBe('Demo Essay');
    expect(payload.values.date).toBe('2026-03-18');
    expect(payload.defaultPublicSlug).toBe('demo');
    if (payload.collection === 'essay') {
      expect(payload.values.publishedAt).toBe('');
    }
  });

  it('loads and validates source files whose names differ from Astro public ids', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');
    const current = await readAdminContentEntryEditorPayload('essay', 'admin-console-guide copy');

    expect(current.entryId).toBe('admin-console-guide copy');
    expect(current.defaultPublicSlug).toBe('admin-console-guide-copy');
    expect(current.relativePath).toBe('src/content/essay/admin-console-guide copy.md');

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', {
        collection: 'essay',
        entryId: 'admin-console-guide copy',
        revision: current.revision,
        frontmatter: {
          ...current.values,
          title: 'Space Name Essay Updated'
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.changedFields).toEqual(['title']);
  });

  it('loads legacy essay datetime dates for compatibility', async () => {
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'essay', 'legacy-datetime.md'),
      [
        '---',
        'title: Legacy Datetime',
        'date: 2024-11-23T18:00:00+08:00',
        'draft: false',
        '---',
        '',
        'legacy body',
        ''
      ].join('\n'),
      'utf8'
    );

    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const payload = await readAdminContentEntryEditorPayload('essay', 'legacy-datetime');

    if (payload.collection === 'essay') {
      expect(payload.values.date).toBe('2024-11-23');
      expect(payload.values.publishedAt).toBe('2024-11-23T18:00:00+08:00');
    }
  });

  it('rejects memo writes while still exposing readonly schema info', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const payload = await readAdminContentEntryEditorPayload('memo', 'index');

    expect(payload.writable).toBe(false);
    expect(payload.readonlyReason).toContain('memo 当前保持只读');
    expect(payload.collection).toBe('memo');
    if (payload.collection === 'memo') {
      expect(payload.values.title).toBe('Memo');
      expect(payload.values.subtitle).toBe('Memo subtitle');
      expect(payload.values.date).toBe('2026-01-10');
      expect(payload.values.draft).toBe(true);
      expect(payload.values.slug).toBe('memo-note');
    }
  });

  it('returns structured json errors for invalid write inputs', async () => {
    const { POST } = await import('../src/pages/api/admin/content/entry');

    const cases = [
      {
        body: { collection: 'page', entryId: 'demo', revision: 'stale', frontmatter: {} },
        status: 400,
        issuePath: 'collection',
        message: '不支持的 content collection'
      },
      {
        body: { collection: 'memo', entryId: 'index', revision: 'stale', frontmatter: {} },
        status: 400,
        issuePath: 'collection',
        message: '只读'
      },
      {
        body: { collection: 'essay', entryId: '../secret', revision: 'stale', frontmatter: {} },
        status: 400,
        issuePath: 'entryId',
        message: 'entryId'
      },
      {
        body: { collection: 'essay', entryId: 'missing', revision: 'stale', frontmatter: {} },
        status: 404,
        issuePath: 'entryId',
        message: '未找到 content 源文件'
      },
      {
        body: { collection: 'essay', entryId: 'demo', revision: 'stale', frontmatter: [] },
        status: 400,
        issuePath: 'frontmatter',
        message: 'frontmatter 必须是对象'
      },
      {
        body: { collection: 'essay', entryId: 'demo', revision: 'stale', frontmatter: {}, body: 42 },
        status: 400,
        issuePath: 'body',
        message: 'body 必须是 Markdown 字符串'
      },
      {
        body: { collection: 'bits', entryId: 'demo', revision: 'stale', frontmatter: {}, body: 'Bits body' },
        status: 400,
        issuePath: 'body',
        message: '仅 essay 支持正文写盘'
      }
    ];

    for (const testCase of cases) {
      const response = await POST({
        request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', testCase.body),
        url: new URL('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1')
      } as never);

      expect(response.status).toBe(testCase.status);
      const payload = JSON.parse(await response.text());
      expect(payload.ok).toBe(false);
      expect(payload.errors[0]).toContain(testCase.message);
      expect(payload.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: testCase.issuePath
          })
        ])
      );
    }
  });

  it('supports dry-run and real writes for essay frontmatter without changing body', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');

    const current = await readAdminContentEntryEditorPayload('essay', 'demo');
    const nextValues = {
      ...current.values,
      title: 'Edited Essay',
      tagsText: 'astro\nadmin'
    };

    const dryRunResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', {
        collection: 'essay',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: nextValues
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1')
    } as never);

    expect(dryRunResponse.status).toBe(200);
    const dryRunPayload = JSON.parse(await dryRunResponse.text());
    expect(dryRunPayload.ok).toBe(true);
    expect(dryRunPayload.dryRun).toBe(true);
    expect(dryRunPayload.result.changedFields).toEqual(['title', 'tags']);

    const before = await readFile(path.join(tempRoot, 'src', 'content', 'essay', 'demo.md'), 'utf8');

    const writeResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry', {
        collection: 'essay',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: nextValues
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry')
    } as never);

    expect(writeResponse.status).toBe(200);
    const writePayload = JSON.parse(await writeResponse.text());
    expect(writePayload.ok).toBe(true);
    expect(writePayload.result.written).toBe(true);

    const after = await readFile(path.join(tempRoot, 'src', 'content', 'essay', 'demo.md'), 'utf8');
    expect(after).toContain('title: Edited Essay');
    expect(after).toContain('tags:');
    expect(after.endsWith('# Essay\n\n正文保持不变。\n')).toBe(true);
    expect(after).not.toBe(before);
  });

  it('normalizes legacy essay datetime dates to date plus publishedAt on save', async () => {
    const legacyPath = path.join(tempRoot, 'src', 'content', 'essay', 'legacy-datetime.md');
    await writeFile(
      legacyPath,
      [
        '---',
        'title: Legacy Datetime',
        'date: 2024-11-23T18:00:00+08:00',
        'draft: false',
        '---',
        '',
        'legacy body',
        ''
      ].join('\n'),
      'utf8'
    );

    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');

    const current = await readAdminContentEntryEditorPayload('essay', 'legacy-datetime');
    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry', {
        collection: 'essay',
        entryId: 'legacy-datetime',
        revision: current.revision,
        frontmatter: {
          ...current.values,
          title: 'Legacy Datetime Updated'
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.changedFields).toEqual(['title', 'date', 'publishedAt']);

    const after = await readFile(legacyPath, 'utf8');
    expect(after).toContain('title: Legacy Datetime Updated');
    expect(after).toContain('date: 2024-11-23');
    expect(after).toContain('publishedAt: 2024-11-23T18:00:00+08:00');
    expect(after).not.toContain('date: 2024-11-23T18:00:00+08:00');
  });

  it('preserves derived publishedAt when older essay payloads omit the field', async () => {
    const legacyPath = path.join(tempRoot, 'src', 'content', 'essay', 'legacy-datetime.md');
    await writeFile(
      legacyPath,
      [
        '---',
        'title: Legacy Datetime',
        'date: 2024-11-23T18:00:00+08:00',
        'draft: false',
        '---',
        '',
        'legacy body',
        ''
      ].join('\n'),
      'utf8'
    );

    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');

    const current = await readAdminContentEntryEditorPayload('essay', 'legacy-datetime');
    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry', {
        collection: 'essay',
        entryId: 'legacy-datetime',
        revision: current.revision,
        frontmatter: {
          ...omitPublishedAt(current.values),
          title: 'Legacy Payload Updated'
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.changedFields).toEqual(['title', 'date', 'publishedAt']);

    const after = await readFile(legacyPath, 'utf8');
    expect(after).toContain('title: Legacy Payload Updated');
    expect(after).toContain('date: 2024-11-23');
    expect(after).toContain('publishedAt: 2024-11-23T18:00:00+08:00');
    expect(after).not.toContain('date: 2024-11-23T18:00:00+08:00');
  });

  it('does not create publishedAt when older essay payloads omit it for date-only entries', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');

    const current = await readAdminContentEntryEditorPayload('essay', 'demo');
    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry', {
        collection: 'essay',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: {
          ...omitPublishedAt(current.values),
          title: 'Date Only Legacy Payload'
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.changedFields).toEqual(['title']);

    const after = await readFile(path.join(tempRoot, 'src', 'content', 'essay', 'demo.md'), 'utf8');
    expect(after).toContain('title: Date Only Legacy Payload');
    expect(after).toContain('date: 2026-03-18');
    expect(after).not.toContain('publishedAt:');
  });

  it('writes explicit essay publishedAt without forcing date datetime syntax', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');

    const current = await readAdminContentEntryEditorPayload('essay', 'demo');
    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry', {
        collection: 'essay',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: {
          ...current.values,
          publishedAt: '2026-03-18T19:30:00+08:00'
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.changedFields).toEqual(['publishedAt']);

    const after = await readFile(path.join(tempRoot, 'src', 'content', 'essay', 'demo.md'), 'utf8');
    expect(after).toContain('date: 2026-03-18');
    expect(after).toContain('publishedAt: 2026-03-18T19:30:00+08:00');
  });

  it('allows essay authors to explicitly clear publishedAt', async () => {
    const essayPath = path.join(tempRoot, 'src', 'content', 'essay', 'demo.md');
    await writeFile(
      essayPath,
      [
        '---',
        'title: Demo Essay',
        'date: 2026-03-18',
        'publishedAt: 2026-03-18T19:30:00+08:00',
        'draft: false',
        '---',
        '',
        '# Essay',
        ''
      ].join('\n'),
      'utf8'
    );

    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');

    const current = await readAdminContentEntryEditorPayload('essay', 'demo');
    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry', {
        collection: 'essay',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: {
          ...current.values,
          publishedAt: ''
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.changedFields).toEqual(['publishedAt']);

    const after = await readFile(essayPath, 'utf8');
    expect(after).toContain('date: 2026-03-18');
    expect(after).not.toContain('publishedAt:');
  });

  it('rejects impossible essay publishedAt calendar dates before writing', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');

    const current = await readAdminContentEntryEditorPayload('essay', 'demo');
    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', {
        collection: 'essay',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: {
          ...current.values,
          publishedAt: '2026-02-31T19:30:00+08:00'
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1')
    } as never);

    expect(response.status).toBe(400);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'publishedAt'
        })
      ])
    );
  });

  it('supports dry-run and real writes for essay body while preserving frontmatter bytes', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { splitMarkdownFrontmatter } = await import('../src/lib/admin-console/frontmatter');
    const { POST } = await import('../src/pages/api/admin/content/entry');

    const current = await readAdminContentEntryEditorPayload('essay', 'demo');
    const nextBody = ['# Essay', '', '正文已经由后台编辑器写入。', ''].join('\n');

    const dryRunResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', {
        collection: 'essay',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: current.values,
        body: nextBody
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1')
    } as never);

    expect(dryRunResponse.status).toBe(200);
    const dryRunPayload = JSON.parse(await dryRunResponse.text());
    expect(dryRunPayload.ok).toBe(true);
    expect(dryRunPayload.dryRun).toBe(true);
    expect(dryRunPayload.result.changedFields).toEqual(['body']);

    const before = await readFile(path.join(tempRoot, 'src', 'content', 'essay', 'demo.md'), 'utf8');
    const beforeSection = splitMarkdownFrontmatter(before);

    const writeResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry', {
        collection: 'essay',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: current.values,
        body: nextBody
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry')
    } as never);

    expect(writeResponse.status).toBe(200);
    const writePayload = JSON.parse(await writeResponse.text());
    expect(writePayload.ok).toBe(true);
    expect(writePayload.result.written).toBe(true);
    expect(writePayload.result.changedFields).toEqual(['body']);
    expect(writePayload.payload.bodyText).toBe(nextBody);

    const after = await readFile(path.join(tempRoot, 'src', 'content', 'essay', 'demo.md'), 'utf8');
    const afterSection = splitMarkdownFrontmatter(after);
    expect(afterSection.frontmatterBlock).toBe(beforeSection.frontmatterBlock);
    expect(afterSection.bodyText).toBe(nextBody);
  });

  it('returns field issues for invalid bits author avatar paths', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');
    const current = await readAdminContentEntryEditorPayload('bits', 'demo');

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', {
        collection: 'bits',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: {
          ...current.values,
          authorAvatar: 'https://example.com/avatar.webp'
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1')
    } as never);

    expect(response.status).toBe(400);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'authorAvatar'
        })
      ])
    );
  });

  it('accepts missing bits image dimensions and missing local avatar files as non-blocking content data', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');
    const current = await readAdminContentEntryEditorPayload('bits', 'demo');

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', {
        collection: 'bits',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: {
          ...current.values,
          authorAvatar: 'author/missing.webp',
          imagesText: JSON.stringify([
            {
              src: 'bits/demo.webp',
              alt: 'demo without dimensions'
            }
          ])
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.changedFields).toEqual(
      expect.arrayContaining(['author', 'images'])
    );
  });

  it('rejects non-positive-integer bits image dimensions before writing invalid frontmatter', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');
    const current = await readAdminContentEntryEditorPayload('bits', 'demo');

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', {
        collection: 'bits',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: {
          ...current.values,
          imagesText: JSON.stringify([
            {
              src: 'bits/demo.webp',
              width: '12px',
              height: 600
            },
            {
              src: 'bits/demo.webp',
              width: '1.5',
              height: '10abc'
            },
            {
              src: 'bits/demo.webp',
              width: '0',
              height: '-1'
            }
          ])
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1')
    } as never);

    expect(response.status).toBe(400);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'images[0].width' }),
        expect.objectContaining({ path: 'images[1].width' }),
        expect.objectContaining({ path: 'images[1].height' }),
        expect.objectContaining({ path: 'images[2].width' }),
        expect.objectContaining({ path: 'images[2].height' })
      ])
    );
  });

  it('rejects non-https bits image URLs instead of treating them as local files', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');
    const current = await readAdminContentEntryEditorPayload('bits', 'demo');

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', {
        collection: 'bits',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: {
          ...current.values,
          imagesText: JSON.stringify([
            {
              src: 'http://example.com/demo.png',
              width: 800,
              height: 600
            }
          ])
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1')
    } as never);

    expect(response.status).toBe(400);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'images[0].src',
          message: expect.stringContaining('https://')
        })
      ])
    );
  });

  it('rejects reserved essay slugs before writing invalid content', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');
    const current = await readAdminContentEntryEditorPayload('essay', 'demo');

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', {
        collection: 'essay',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: {
          ...current.values,
          slug: 'tag'
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1')
    } as never);

    expect(response.status).toBe(400);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'slug'
        })
      ])
    );
  });

  it('rejects duplicate public essay slugs before writing invalid content', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');
    const current = await readAdminContentEntryEditorPayload('essay', 'demo');

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', {
        collection: 'essay',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: {
          ...current.values,
          slug: 'existing-essay'
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1')
    } as never);

    expect(response.status).toBe(400);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'slug'
        })
      ])
    );
  });

  it('rejects malformed essay frontmatter payloads with field errors instead of 500', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');
    const current = await readAdminContentEntryEditorPayload('essay', 'demo');

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', {
        collection: 'essay',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: {
          ...current.values,
          title: 42
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1')
    } as never);

    expect(response.status).toBe(400);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'title'
        })
      ])
    );
  });

  it('rejects stale revisions after the source file changes externally', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');
    const current = await readAdminContentEntryEditorPayload('essay', 'demo');

    await writeFile(
      path.join(tempRoot, 'src', 'content', 'essay', 'demo.md'),
      ['---', 'title: External Change', 'date: 2026-03-18', '---', '', 'changed body', ''].join('\n'),
      'utf8'
    );

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry', {
        collection: 'essay',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: {
          ...current.values,
          title: 'Local Change'
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry')
    } as never);

    expect(response.status).toBe(409);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.errors[0]).toContain('外部更新');
    expect(payload.payload.values.title).toBe('External Change');
  });
});
