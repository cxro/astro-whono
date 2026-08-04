import { describe, expect, it } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createJsonRequest, setupAdminContentWriteFixture } from './admin-content-write-fixture';

describe('admin content bits write contract', () => {
  const getTempRoot = setupAdminContentWriteFixture();

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

    const bitsPath = path.join(getTempRoot(), 'src', 'content', 'bits', 'demo.md');
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
    const bitsPath = path.join(getTempRoot(), 'src', 'content', 'bits', 'broken-current.md');
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

  it('rejects bits tags that normalize to non-routable tag keys', async () => {
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
          tagsText: '///\n摄影'
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
        message: expect.stringContaining('"///"')
      })
    ]);
  });

  it('returns latest bits body when rejecting stale revisions', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');
    const current = await readAdminContentEntryEditorPayload('bits', 'demo');

    await writeFile(
      path.join(getTempRoot(), 'src', 'content', 'bits', 'demo.md'),
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
