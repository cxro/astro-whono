import { describe, expect, it } from 'vitest';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createJsonRequest,
  omitPublishedAt,
  omitUpdatedAt,
  setupAdminContentWriteFixture
} from './admin-content-write-fixture';

describe('admin content essay write contract', () => {
  const getTempRoot = setupAdminContentWriteFixture();

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

    const before = await readFile(path.join(getTempRoot(), 'src', 'content', 'essay', 'demo.md'), 'utf8');

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

    const after = await readFile(path.join(getTempRoot(), 'src', 'content', 'essay', 'demo.md'), 'utf8');
    expect(after).toContain('title: Edited Essay');
    expect(after).toContain('tags:');
    expect(after.endsWith('# Essay\n\n正文保持不变。\n')).toBe(true);
    expect(after).not.toBe(before);
  });

  it('normalizes legacy essay datetime dates to date plus publishedAt on save', async () => {
    const legacyPath = path.join(getTempRoot(), 'src', 'content', 'essay', 'legacy-datetime.md');
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
    const legacyPath = path.join(getTempRoot(), 'src', 'content', 'essay', 'legacy-datetime.md');
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

    const after = await readFile(path.join(getTempRoot(), 'src', 'content', 'essay', 'demo.md'), 'utf8');
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

    const after = await readFile(path.join(getTempRoot(), 'src', 'content', 'essay', 'demo.md'), 'utf8');
    expect(after).toContain('date: 2026-03-18');
    expect(after).toContain('publishedAt: 2026-03-18T19:30:00+08:00');
  });

  it('normalizes essay date from explicit publishedAt instead of blocking the save', async () => {
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
          date: '2026-03-18',
          publishedAt: '2026-03-19T00:30:00+08:00'
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.changedFields).toEqual(['date', 'publishedAt']);

    const after = await readFile(path.join(getTempRoot(), 'src', 'content', 'essay', 'demo.md'), 'utf8');
    expect(after).toContain('date: 2026-03-19');
    expect(after).toContain('publishedAt: 2026-03-19T00:30:00+08:00');
  });

  it('rejects updatedAt earlier than the date normalized from explicit publishedAt', async () => {
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
          date: '2026-03-18',
          publishedAt: '2026-03-19T00:30:00+08:00',
          updatedAt: '2026-03-18'
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
          path: 'updatedAt'
        })
      ])
    );
  });

  it('allows essay authors to explicitly clear publishedAt', async () => {
    const essayPath = path.join(getTempRoot(), 'src', 'content', 'essay', 'demo.md');
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

  it('writes optional essay updatedAt as a date-only frontmatter field', async () => {
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
          updatedAt: '2026-03-20T22:30:00+08:00'
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.changedFields).toEqual(['updatedAt']);
    expect(payload.payload.values.updatedAt).toBe('2026-03-20');

    const after = await readFile(path.join(getTempRoot(), 'src', 'content', 'essay', 'demo.md'), 'utf8');
    expect(after).toContain('updatedAt: 2026-03-20');
  });

  it('preserves existing updatedAt when older essay payloads omit the field', async () => {
    const essayPath = path.join(getTempRoot(), 'src', 'content', 'essay', 'demo.md');
    await writeFile(
      essayPath,
      [
        '---',
        'title: Demo Essay',
        'date: 2026-03-18',
        'updatedAt: 2026-03-20',
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
          ...omitUpdatedAt(current.values),
          title: 'UpdatedAt Legacy Payload'
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.changedFields).toEqual(['title']);

    const after = await readFile(essayPath, 'utf8');
    expect(after).toContain('title: UpdatedAt Legacy Payload');
    expect(after).toContain('updatedAt: 2026-03-20');
  });

  it('rejects preserved updatedAt earlier than the final publish date', async () => {
    const essayPath = path.join(getTempRoot(), 'src', 'content', 'essay', 'demo.md');
    await writeFile(
      essayPath,
      [
        '---',
        'title: Demo Essay',
        'date: 2026-03-18',
        'updatedAt: 2026-03-18',
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
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', {
        collection: 'essay',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: {
          ...omitUpdatedAt(current.values),
          publishedAt: '2026-03-19T00:30:00+08:00'
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
          path: 'updatedAt'
        })
      ])
    );
  });

  it('repairs semantically invalid current essay frontmatter instead of failing before next validation', async () => {
    const essayPath = path.join(getTempRoot(), 'src', 'content', 'essay', 'broken-current.md');
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

    const before = await readFile(path.join(getTempRoot(), 'src', 'content', 'essay', 'demo.md'), 'utf8');
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

    const after = await readFile(path.join(getTempRoot(), 'src', 'content', 'essay', 'demo.md'), 'utf8');
    const afterSection = splitMarkdownFrontmatter(after);
    expect(afterSection.frontmatterBlock).toBe(beforeSection.frontmatterBlock);
    expect(afterSection.bodyText).toBe(nextBody);
  });

  it('allows essay saves when local image references exist or are outside the local-relative check', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');

    await mkdir(path.join(getTempRoot(), 'src', 'content', 'essay', 'demo-assets'), { recursive: true });
    await writeFile(path.join(getTempRoot(), 'src', 'content', 'essay', 'demo-assets', 'existing.webp'), 'image');

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
      path.join(getTempRoot(), 'src', 'content', 'essay', 'demo.md'),
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
        '<figure class="figure">',
        '  <img src="./demo-assets/missing-rich-caption-figure.webp" alt="Missing rich caption figure" />',
        '  <figcaption><strong>Rich caption</strong></figcaption>',
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
        '正文引用的本地图片不存在：src/content/essay/demo-assets/missing-rich-caption-figure.webp',
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

  it('rejects essay tags that normalize to non-routable archive tag keys', async () => {
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
          tagsText: '..\n合法标签'
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1')
    } as never);

    expect(response.status).toBe(400);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.issues).toEqual([
      expect.objectContaining({
        path: 'tagsText',
        message: expect.stringContaining('".."')
      })
    ]);
  });

  it('rejects stale revisions after the source file changes externally', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');
    const current = await readAdminContentEntryEditorPayload('essay', 'demo');

    await writeFile(
      path.join(getTempRoot(), 'src', 'content', 'essay', 'demo.md'),
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
