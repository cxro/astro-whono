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

  it('loads editable payload for bits entries with body text', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const payload = await readAdminContentEntryEditorPayload('bits', 'demo');

    expect(payload.writable).toBe(true);
    expect(payload.collection).toBe('bits');
    if (payload.collection === 'bits') {
      expect(payload.bodyText).toBe('\nBits body\n');
      expect(payload.values.imagesText).toContain('bits/demo.webp');
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

  it('repairs semantically invalid current essay frontmatter instead of failing before next validation', async () => {
    const essayPath = path.join(tempRoot, 'src', 'content', 'essay', 'broken-current.md');
    await writeFile(
      essayPath,
      [
        '---',
        'title: 42',
        'date: not-a-date',
        'tags:',
        '  - keep',
        '  - 99',
        'draft: "false"',
        'archive: "yes"',
        'cover: 42',
        '---',
        '',
        'broken body',
        ''
      ].join('\n'),
      'utf8'
    );

    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');
    const current = await readAdminContentEntryEditorPayload('essay', 'broken-current');
    if (current.collection !== 'essay') {
      throw new Error('Expected essay editor payload');
    }

    const invalidNextResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', {
        collection: 'essay',
        entryId: 'broken-current',
        revision: current.revision,
        frontmatter: {
          ...current.values,
          title: 'Still Invalid',
          date: 'not-a-date'
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1')
    } as never);

    expect(invalidNextResponse.status).toBe(400);
    const invalidNextPayload = JSON.parse(await invalidNextResponse.text());
    expect(invalidNextPayload.ok).toBe(false);
    expect(invalidNextPayload.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'date' })
      ])
    );

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry', {
        collection: 'essay',
        entryId: 'broken-current',
        revision: current.revision,
        frontmatter: {
          ...current.values,
          title: 'Repaired Essay',
          date: '2026-05-26',
          tagsText: 'fixed',
          draft: false,
          archive: true
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.changedFields).toEqual(
      expect.arrayContaining(['title', 'date', 'tags', 'draft', 'archive', 'cover'])
    );

    const after = await readFile(essayPath, 'utf8');
    expect(after).toContain('title: Repaired Essay');
    expect(after).toContain('date: 2026-05-26');
    expect(after).toContain('tags:');
    expect(after).toContain('- fixed');
    expect(after).toContain('draft: false');
    expect(after).toContain('archive: true');
    expect(after).not.toContain('cover: 42');
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

  it('allows essay saves when local image references exist or are outside the local-relative check', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');

    await mkdir(path.join(tempRoot, 'src', 'content', 'essay', 'demo-assets'), { recursive: true });
    await writeFile(path.join(tempRoot, 'src', 'content', 'essay', 'demo-assets', 'existing.webp'), 'image');

    const current = await readAdminContentEntryEditorPayload('essay', 'demo');
    const nextBody = [
      '# Essay',
      '',
      '![Existing](./demo-assets/existing.webp)',
      '![Remote](https://example.com/image.webp)',
      '![Public](/images/archive/demo.webp)',
      '<figure class="hero-figure"><img src="./demo-assets/missing-custom-figure.webp" alt="Custom" /></figure>',
      '<ul class="gallery cols-2"><li><figure><img src="./demo-assets/existing.webp" alt="Existing gallery" /></figure></li></ul>',
      '<ul class="gallery"><li><figure><img src="https://example.com/gallery.webp" alt="Remote gallery" /></figure></li></ul>',
      '<ul class="not-gallery"><li><figure><img src="./demo-assets/missing-custom-gallery.webp" alt="Custom gallery" /></figure></li></ul>',
      '`![Inline code](./demo-assets/missing-inline-code.webp)`',
      '<!-- ![Commented](./demo-assets/missing-comment.webp) -->',
      '```md',
      '![Ignored](./demo-assets/missing-in-code.webp)',
      '```',
      ''
    ].join('\n');

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', {
        collection: 'essay',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: current.values,
        body: nextBody
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.changedFields).toEqual(['body']);
  });

  it('rejects essay body saves when submitted body references missing local images', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');

    await writeFile(
      path.join(tempRoot, 'src', 'content', 'essay', 'demo.md'),
      [
        '---',
        'title: Demo Essay',
        'date: 2026-03-18',
        'draft: false',
        '---',
        '',
        '# Essay',
        '',
        '![Missing](./demo-assets/missing.webp)',
        '',
        '<figure class="figure figure--md">',
        '  <img src="./demo-assets/missing-figure.webp" alt="Missing figure" />',
        '</figure>',
        '',
        '<ul class="gallery cols-2">',
        '  <li><figure><img src="./demo-assets/missing-gallery.webp" alt="Missing gallery" /></figure></li>',
        '</ul>',
        '',
        '```html',
        '<figure class="figure"><img src="./demo-assets/missing-in-code.webp" alt="" /></figure>',
        '```',
        ''
      ].join('\n'),
      'utf8'
    );

    const current = await readAdminContentEntryEditorPayload('essay', 'demo');
    if (current.collection !== 'essay') {
      throw new Error('Expected essay editor payload');
    }

    const frontmatterOnlyResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', {
        collection: 'essay',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: {
          ...current.values,
          title: 'Demo Essay Updated'
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1')
    } as never);

    expect(frontmatterOnlyResponse.status).toBe(200);
    const frontmatterOnlyPayload = JSON.parse(await frontmatterOnlyResponse.text());
    expect(frontmatterOnlyPayload.ok).toBe(true);
    expect(frontmatterOnlyPayload.result.changedFields).toEqual(['title']);

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', {
        collection: 'essay',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: current.values,
        body: current.bodyText
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1')
    } as never);

    expect(response.status).toBe(400);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.errors).toEqual(
      expect.arrayContaining([
        '正文引用的本地图片不存在：src/content/essay/demo-assets/missing.webp',
        '正文引用的本地图片不存在：src/content/essay/demo-assets/missing-figure.webp',
        '正文引用的本地图片不存在：src/content/essay/demo-assets/missing-gallery.webp'
      ])
    );
    expect(payload.errors).not.toContain(
      '正文引用的本地图片不存在：src/content/essay/demo-assets/missing-in-code.webp'
    );
    expect(payload.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'body' })
      ])
    );
  });

  it('supports dry-run and real writes for bits body while preserving frontmatter bytes', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { splitMarkdownFrontmatter } = await import('../src/lib/admin-console/frontmatter');
    const { POST } = await import('../src/pages/api/admin/content/entry');

    const current = await readAdminContentEntryEditorPayload('bits', 'demo');
    if (current.collection !== 'bits') {
      throw new Error('Expected bits editor payload');
    }
    const nextBody = ['今天的絮语正文。', '', '- 可以保存 body', ''].join('\n');

    const dryRunResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', {
        collection: 'bits',
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

    const bitsPath = path.join(tempRoot, 'src', 'content', 'bits', 'demo.md');
    const before = await readFile(bitsPath, 'utf8');
    const beforeSection = splitMarkdownFrontmatter(before);

    const writeResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry', {
        collection: 'bits',
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
    expect(writePayload.result.changedFields).toEqual(['body']);
    expect(writePayload.payload.bodyText).toBe(nextBody);

    const after = await readFile(bitsPath, 'utf8');
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

  it('repairs semantically invalid current bits frontmatter instead of failing before next validation', async () => {
    const bitsPath = path.join(tempRoot, 'src', 'content', 'bits', 'broken-current.md');
    await writeFile(
      bitsPath,
      [
        '---',
        'title: 42',
        'date: not-a-date',
        'tags:',
        '  - Bits',
        '  - 99',
        'draft: "false"',
        'author:',
        '  name: 77',
        '  avatar: https://example.com/avatar.webp',
        'images:',
        '  - src: ftp://bad.example/image.webp',
        '    width: -1',
        '---',
        '',
        'broken bit',
        ''
      ].join('\n'),
      'utf8'
    );

    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');
    const current = await readAdminContentEntryEditorPayload('bits', 'broken-current');
    if (current.collection !== 'bits') {
      throw new Error('Expected bits editor payload');
    }

    const invalidNextResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', {
        collection: 'bits',
        entryId: 'broken-current',
        revision: current.revision,
        frontmatter: {
          ...current.values,
          title: 'Still Invalid',
          date: 'still-not-a-date',
          imagesText: '{not json'
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1')
    } as never);

    expect(invalidNextResponse.status).toBe(400);
    const invalidNextPayload = JSON.parse(await invalidNextResponse.text());
    expect(invalidNextPayload.ok).toBe(false);
    expect(invalidNextPayload.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'date' }),
        expect.objectContaining({ path: 'imagesText' })
      ])
    );

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry', {
        collection: 'bits',
        entryId: 'broken-current',
        revision: current.revision,
        frontmatter: {
          ...current.values,
          title: 'Repaired Bit',
          date: '2026-05-26T18:30:00+08:00',
          tagsText: 'Bits\nfixed',
          draft: false,
          authorName: 'Alice',
          authorAvatar: 'author/alice.webp',
          imagesText: JSON.stringify([
            {
              src: 'bits/fixed.webp',
              width: 800,
              height: 600,
              alt: 'fixed image'
            }
          ])
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.changedFields).toEqual(
      expect.arrayContaining(['title', 'date', 'tags', 'draft', 'author', 'images'])
    );

    const after = await readFile(bitsPath, 'utf8');
    expect(after).toContain('title: Repaired Bit');
    expect(after).toContain('date: 2026-05-26T18:30:00+08:00');
    expect(after).toContain('- fixed');
    expect(after).toContain('draft: false');
    expect(after).toContain('name: Alice');
    expect(after).toContain('avatar: author/alice.webp');
    expect(after).toContain('src: bits/fixed.webp');
    expect(after).toContain('width: 800');
    expect(after).not.toContain('ftp://bad.example');
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

  it('returns latest bits body when rejecting stale revisions', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');
    const current = await readAdminContentEntryEditorPayload('bits', 'demo');

    await writeFile(
      path.join(tempRoot, 'src', 'content', 'bits', 'demo.md'),
      [
        '---',
        'date: 2025-02-03T01:01:45+08:00',
        'tags:',
        '  - Markdown',
        '---',
        '',
        'external bits body',
        ''
      ].join('\n'),
      'utf8'
    );

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry', {
        collection: 'bits',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: current.values,
        body: 'local bits body\n'
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry')
    } as never);

    expect(response.status).toBe(409);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.payload.collection).toBe('bits');
    expect(payload.payload.bodyText).toBe('\nexternal bits body\n');
  });
});
