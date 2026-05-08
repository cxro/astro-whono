import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

const toAbsoluteTestPath = (root: string, relativePath: string): string =>
  path.join(root, ...relativePath.split('/'));

describe('admin content delete api', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-content-delete-'));
    process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT = tempRoot;

    await mkdir(path.join(tempRoot, 'src', 'content', 'essay'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'bits'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'memo'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'essay', 'series', 'intro'), { recursive: true });

    await writeFile(
      path.join(tempRoot, 'src', 'content', 'essay', 'demo.md'),
      ['---', 'title: Demo Essay', 'date: 2026-03-18', 'draft: false', '---', '', '# Demo', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'essay', 'admin-console-guide copy.md'),
      ['---', 'title: Space Name Essay', 'date: 2026-03-21', 'draft: false', '---', '', '# Space Name', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'essay', 'series', 'intro', 'index.md'),
      ['---', 'title: Intro Essay', 'date: 2026-03-19', 'draft: false', '---', '', '# Intro', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'bits', 'demo.mdx'),
      ['---', 'date: 2025-02-03T22:30:00+08:00', 'draft: false', '---', '', '<Aside />', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'memo', 'index.md'),
      ['---', 'title: Memo', '---', '', 'memo body', ''].join('\n'),
      'utf8'
    );
  });

  afterEach(async () => {
    delete process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT;
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('moves an entry source file to the project trash folder', async () => {
    const { POST } = await import('../src/pages/api/admin/content/delete');
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const current = await readAdminContentEntryEditorPayload('essay', 'demo');
    const url = 'http://127.0.0.1:4321/api/admin/content/delete/';

    const response = await POST({
      request: createJsonRequest(url, {
        collection: 'essay',
        entryId: 'demo',
        revision: current.revision,
        expectedRelativePath: current.relativePath
      }),
      url: new URL(url)
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result).toEqual(
      expect.objectContaining({
        collection: 'essay',
        entryId: 'demo',
        deleted: true,
        relativePath: 'src/content/essay/demo.md'
      })
    );
    expect(payload.result.trashedPath).toMatch(/^\.trash\/content\/\d{8}-\d{9}(?:-\d+)?\/src\/content\/essay\/demo\.md$/);
    await expect(access(path.join(tempRoot, 'src', 'content', 'essay', 'demo.md'))).rejects.toThrow();
    await expect(readFile(toAbsoluteTestPath(tempRoot, payload.result.trashedPath), 'utf8')).resolves.toContain('# Demo');
  });

  it('deletes a source file whose file name contains spaces', async () => {
    const { POST } = await import('../src/pages/api/admin/content/delete');
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const current = await readAdminContentEntryEditorPayload('essay', 'admin-console-guide copy');
    const url = 'http://127.0.0.1:4321/api/admin/content/delete/';

    const response = await POST({
      request: createJsonRequest(url, {
        collection: 'essay',
        entryId: 'admin-console-guide copy',
        revision: current.revision,
        expectedRelativePath: current.relativePath
      }),
      url: new URL(url)
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.result).toEqual(
      expect.objectContaining({
        collection: 'essay',
        entryId: 'admin-console-guide copy',
        relativePath: 'src/content/essay/admin-console-guide copy.md'
      })
    );
    await expect(access(path.join(tempRoot, 'src', 'content', 'essay', 'admin-console-guide copy.md'))).rejects.toThrow();
    await expect(readFile(toAbsoluteTestPath(tempRoot, payload.result.trashedPath), 'utf8')).resolves.toContain('# Space Name');
  });

  it('keeps nested index entry paths restorable inside trash', async () => {
    const { moveAdminContentEntryToTrash } = await import('../src/lib/admin-console/content-delete');

    const result = await moveAdminContentEntryToTrash('essay', 'series/intro');

    expect(result.relativePath).toBe('src/content/essay/series/intro/index.md');
    expect(result.trashedPath).toMatch(/\/src\/content\/essay\/series\/intro\/index\.md$/);
    await expect(access(path.join(tempRoot, 'src', 'content', 'essay', 'series', 'intro', 'index.md'))).rejects.toThrow();
    await expect(readFile(toAbsoluteTestPath(tempRoot, result.trashedPath), 'utf8')).resolves.toContain('# Intro');
  });

  it('rejects memo delete requests because memo is a fixed readonly page', async () => {
    const { POST } = await import('../src/pages/api/admin/content/delete');
    const url = 'http://127.0.0.1:4321/api/admin/content/delete/';

    const response = await POST({
      request: createJsonRequest(url, {
        collection: 'memo',
        entryId: 'index',
        revision: 'stale',
        expectedRelativePath: 'src/content/memo/index.md'
      }),
      url: new URL(url)
    } as never);

    expect(response.status).toBe(400);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.errors[0]).toContain('memo 是固定单页内容');
    await expect(readFile(path.join(tempRoot, 'src', 'content', 'memo', 'index.md'), 'utf8')).resolves.toContain('memo body');
  });

  it('rejects stale revisions and leaves the source file in place', async () => {
    const { POST } = await import('../src/pages/api/admin/content/delete');
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const current = await readAdminContentEntryEditorPayload('bits', 'demo');
    const url = 'http://127.0.0.1:4321/api/admin/content/delete/';

    const response = await POST({
      request: createJsonRequest(url, {
        collection: 'bits',
        entryId: 'demo',
        revision: 'stale-revision',
        expectedRelativePath: current.relativePath
      }),
      url: new URL(url)
    } as never);

    expect(response.status).toBe(409);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.errors[0]).toContain('已拒绝删除');
    await expect(readFile(path.join(tempRoot, 'src', 'content', 'bits', 'demo.mdx'), 'utf8')).resolves.toContain('<Aside />');
  });

  it('rejects mismatched confirmed source paths', async () => {
    const { POST } = await import('../src/pages/api/admin/content/delete');
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const current = await readAdminContentEntryEditorPayload('essay', 'demo');
    const url = 'http://127.0.0.1:4321/api/admin/content/delete/';

    const response = await POST({
      request: createJsonRequest(url, {
        collection: 'essay',
        entryId: 'demo',
        revision: current.revision,
        expectedRelativePath: 'src/content/essay/other.md'
      }),
      url: new URL(url)
    } as never);

    expect(response.status).toBe(409);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.errors[0]).toContain('路径与确认时不一致');
    await expect(readFile(path.join(tempRoot, 'src', 'content', 'essay', 'demo.md'), 'utf8')).resolves.toContain('# Demo');
  });
});
