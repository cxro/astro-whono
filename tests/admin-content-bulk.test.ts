import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { strFromU8, unzipSync } from 'fflate';

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

const readJson = async (response: Response) => JSON.parse(await response.text()) as Record<string, any>;

const readZipText = (entries: Record<string, Uint8Array>, entryPath: string): string => {
  const entry = entries[entryPath];
  if (!entry) throw new Error(`Missing zip entry: ${entryPath}`);
  return strFromU8(entry);
};

describe('admin content bulk api', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-content-bulk-'));
    process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT = tempRoot;

    await mkdir(path.join(tempRoot, 'src', 'content', 'essay'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'bits'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'memo'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'about'), { recursive: true });

    await writeFile(
      path.join(tempRoot, 'src', 'content', 'essay', 'published.md'),
      ['---', 'title: Published', 'date: 2026-03-18', '---', '', '# Published', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'essay', 'delete-me.md'),
      ['---', 'title: Delete Me', 'date: 2026-03-19', 'draft: false', '---', '', '# Delete', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'bits', 'stale.md'),
      ['---', 'date: 2025-02-03T22:30:00+08:00', 'draft: false', '---', '', 'stale bit', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'essay', 'broken-frontmatter.md'),
      ['---', 'title: [broken', '---', '', 'still exportable', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'memo', 'index.md'),
      ['---', 'title: Memo', '---', '', 'memo body', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'about', 'index.md'),
      ['---', '---', '', 'about body', ''].join('\n'),
      'utf8'
    );
  });

  afterEach(async () => {
    vi.doUnmock('../src/lib/admin-console/admin-api');
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT;
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('patches draft status per entry without rewriting unchanged published entries', async () => {
    const { POST } = await import('../src/pages/api/admin/content/bulk-status');
    const sourcePath = path.join(tempRoot, 'src', 'content', 'essay', 'published.md');
    const before = await readFile(sourcePath, 'utf8');
    const url = 'http://127.0.0.1:4321/api/admin/content/bulk-status/';

    const unchangedResponse = await POST({
      request: createJsonRequest(url, {
        targetDraft: false,
        entries: [
          {
            collection: 'essay',
            entryId: 'published',
            expectedRelativePath: 'src/content/essay/published.md'
          }
        ]
      }),
      url: new URL(url)
    } as never);

    expect(unchangedResponse.status).toBe(200);
    const unchangedPayload = await readJson(unchangedResponse);
    expect(unchangedPayload.summary.unchanged).toBe(1);
    await expect(readFile(sourcePath, 'utf8')).resolves.toBe(before);

    const draftResponse = await POST({
      request: createJsonRequest(url, {
        targetDraft: true,
        entries: [
          {
            collection: 'essay',
            entryId: 'published',
            expectedRelativePath: 'src/content/essay/published.md'
          },
          {
            collection: 'bits',
            entryId: 'stale',
            expectedRelativePath: 'src/content/bits/other.md'
          },
          {
            collection: 'memo',
            entryId: 'index',
            expectedRelativePath: 'src/content/memo/index.md'
          }
        ]
      }),
      url: new URL(url)
    } as never);

    expect(draftResponse.status).toBe(200);
    const draftPayload = await readJson(draftResponse);
    expect(draftPayload.summary).toMatchObject({
      requested: 3,
      succeeded: 1,
      skipped: 1,
      failed: 1
    });
    const after = await readFile(sourcePath, 'utf8');
    expect(after).toContain('draft: true');
    expect(after.endsWith('# Published\n')).toBe(true);
  });

  it('reports revision conflicts when bulk status source changes before write', async () => {
    const sourcePath = path.join(tempRoot, 'src', 'content', 'essay', 'published.md');
    vi.resetModules();
    vi.doMock('../src/lib/admin-console/admin-api', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/lib/admin-console/admin-api')>();
      return {
        ...actual,
        persistAdminFileTransaction: async (
          entries: Parameters<typeof actual.persistAdminFileTransaction>[0],
          options: Parameters<typeof actual.persistAdminFileTransaction>[1] = {}
        ) => {
          await writeFile(
            sourcePath,
            ['---', 'title: Published', 'date: 2026-03-18', 'draft: false', '---', '', '# External edit', ''].join('\n'),
            'utf8'
          );
          return actual.persistAdminFileTransaction(entries, options);
        }
      };
    });

    const { POST } = await import('../src/pages/api/admin/content/bulk-status');
    const url = 'http://127.0.0.1:4321/api/admin/content/bulk-status/';

    const response = await POST({
      request: createJsonRequest(url, {
        targetDraft: true,
        entries: [
          {
            collection: 'essay',
            entryId: 'published',
            expectedRelativePath: 'src/content/essay/published.md'
          }
        ]
      }),
      url: new URL(url)
    } as never);

    expect(response.status).toBe(200);
    const payload = await readJson(response);
    expect(payload.summary).toMatchObject({
      requested: 1,
      failed: 1
    });
    expect(payload.results[0].errorCodes).toContain('revision_conflict');
    await expect(readFile(sourcePath, 'utf8')).resolves.toContain('# External edit');
  });

  it('bulk-deletes successful entries while keeping conflicted entries in place', async () => {
    const { POST } = await import('../src/pages/api/admin/content/bulk-delete');
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const deletePayload = await readAdminContentEntryEditorPayload('essay', 'delete-me');
    const stalePayload = await readAdminContentEntryEditorPayload('bits', 'stale');
    const stalePath = path.join(tempRoot, 'src', 'content', 'bits', 'stale.md');
    await writeFile(
      stalePath,
      ['---', 'date: 2025-02-03T22:30:00+08:00', 'draft: true', '---', '', 'updated stale bit', ''].join('\n'),
      'utf8'
    );
    const url = 'http://127.0.0.1:4321/api/admin/content/bulk-delete/';

    const response = await POST({
      request: createJsonRequest(url, {
        entries: [
          {
            collection: 'essay',
            entryId: 'delete-me',
            revision: deletePayload.revision,
            expectedRelativePath: deletePayload.relativePath
          },
          {
            collection: 'bits',
            entryId: 'stale',
            revision: stalePayload.revision,
            expectedRelativePath: stalePayload.relativePath
          }
        ]
      }),
      url: new URL(url)
    } as never);

    expect(response.status).toBe(200);
    const payload = await readJson(response);
    expect(payload.summary).toMatchObject({
      requested: 2,
      succeeded: 1,
      failed: 1
    });
    await expect(access(path.join(tempRoot, 'src', 'content', 'essay', 'delete-me.md'))).rejects.toThrow();
    await expect(readFile(stalePath, 'utf8')).resolves.toContain('updated stale bit');
    const deleted = payload.results.find((result: any) => result.entryId === 'delete-me');
    await expect(readFile(toAbsoluteTestPath(tempRoot, deleted.trashedPath), 'utf8')).resolves.toContain('# Delete');
  });

  it('bulk-exports source files into a zip report without parsing frontmatter', async () => {
    const { POST } = await import('../src/pages/api/admin/content/bulk-export');
    const url = 'http://127.0.0.1:4321/api/admin/content/bulk-export/';

    const response = await POST({
      request: createJsonRequest(url, {
        entries: [
          {
            collection: 'essay',
            entryId: 'broken-frontmatter',
            expectedRelativePath: 'src/content/essay/broken-frontmatter.md'
          },
          {
            collection: 'about',
            entryId: 'index',
            expectedRelativePath: 'src/content/about/index.md'
          },
          {
            collection: 'bits',
            entryId: 'stale',
            expectedRelativePath: 'src/content/bits/other.md'
          }
        ]
      }),
      url: new URL(url)
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/zip');
    expect(response.headers.get('x-admin-content-bulk-export-summary')).toBeTruthy();

    const zip = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(readZipText(zip, 'essay/broken-frontmatter/broken-frontmatter.md')).toContain('title: [broken');
    expect(readZipText(zip, 'about/index/about.md')).toContain('about body');
    const report = readZipText(zip, '_admin-content-export-report.md');
    expect(report).toContain('# Admin Content 批量下载报告');
    expect(report).toContain('- 请求数量：3');
    expect(report).toContain('- 成功：2');
    expect(report).toContain('- 失败：1');
    expect(report).toContain('## 失败');
    expect(report).toContain('bits/stale');
    expect(report).toContain('- 状态：失败');
    expect(report).toContain('错误码：relative_path_mismatch');
    expect(report).toContain('relative_path_mismatch');
  });
});
