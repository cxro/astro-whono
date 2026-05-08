import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('admin content source export', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-content-export-'));
    process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT = tempRoot;

    await mkdir(path.join(tempRoot, 'src', 'content', 'essay'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'bits'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'memo'), { recursive: true });

    await writeFile(
      path.join(tempRoot, 'src', 'content', 'essay', 'demo.md'),
      ['---', 'title: Demo Essay', 'date: 2026-03-18', '---', '', '# Demo', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'essay', 'admin-console-guide copy.md'),
      ['---', 'title: Space Name Essay', 'date: 2026-03-21', '---', '', '# Space Name', ''].join('\n'),
      'utf8'
    );
    await mkdir(path.join(tempRoot, 'src', 'content', 'essay', 'series', 'intro'), { recursive: true });
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'essay', 'series', 'intro', 'index.md'),
      ['---', 'title: Intro Essay', 'date: 2026-03-19', '---', '', '# Intro', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'bits', 'bits-2026-02-03-2230.mdx'),
      ['---', 'date: 2025-02-03T22:30:00+08:00', '---', '', '<Aside />', ''].join('\n'),
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

  it('reads a normal content source file with the original file name', async () => {
    const { readAdminContentSourceDownload } = await import('../src/lib/admin-console/content-export');

    const download = await readAdminContentSourceDownload('essay', 'demo');

    expect(download.fileName).toBe('demo.md');
    expect(download.relativePath).toBe('src/content/essay/demo.md');
    expect(download.contentType).toBe('text/markdown; charset=utf-8');
    expect(download.sourceText).toContain('title: Demo Essay');
  });

  it('exports a source file whose file name contains spaces', async () => {
    const { readAdminContentSourceDownload } = await import('../src/lib/admin-console/content-export');

    const download = await readAdminContentSourceDownload('essay', 'admin-console-guide copy');

    expect(download.fileName).toBe('admin-console-guide copy.md');
    expect(download.relativePath).toBe('src/content/essay/admin-console-guide copy.md');
    expect(download.sourceText).toContain('# Space Name');
  });

  it('keeps mdx extensions and gives index source files stable download names', async () => {
    const { readAdminContentSourceDownload } = await import('../src/lib/admin-console/content-export');

    const bitsDownload = await readAdminContentSourceDownload('bits', 'bits-2026-02-03-2230');
    const nestedEssayDownload = await readAdminContentSourceDownload('essay', 'series/intro');
    const memoDownload = await readAdminContentSourceDownload('memo', 'index');

    expect(bitsDownload.fileName).toBe('bits-2026-02-03-2230.mdx');
    expect(bitsDownload.contentType).toBe('text/plain; charset=utf-8');
    expect(nestedEssayDownload.fileName).toBe('intro.md');
    expect(memoDownload.fileName).toBe('memo.md');
  });

  it('serves the source file as an attachment from the export api', async () => {
    const { GET } = await import('../src/pages/api/admin/content/export');
    const url = new URL('http://127.0.0.1:4321/api/admin/content/export/?collection=essay&entryId=demo');

    const response = await GET({ url } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(response.headers.get('content-disposition')).toContain('filename="demo.md"');
    expect(await response.text()).toContain('# Demo');
  });

  it('encodes non-ascii and special attachment file names for filename*', async () => {
    const { createAdminContentSourceDownloadHeaders } = await import('../src/lib/admin-console/content-export');

    const headers = new Headers(createAdminContentSourceDownloadHeaders(
      "一篇'story(1)*.md",
      'text/markdown; charset=utf-8'
    ));

    expect(headers.get('content-disposition')).toContain(
      "filename*=UTF-8''%E4%B8%80%E7%AF%87%27story%281%29%2A.md"
    );
  });

  it('returns structured errors for invalid export inputs', async () => {
    const { GET } = await import('../src/pages/api/admin/content/export');

    const invalidCollectionResponse = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/content/export/?collection=page&entryId=demo')
    } as never);
    expect(invalidCollectionResponse.status).toBe(400);
    expect(JSON.parse(await invalidCollectionResponse.text()).errors[0]).toContain('不支持的 content collection');

    const invalidEntryResponse = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/content/export/?collection=essay&entryId=../secret')
    } as never);
    expect(invalidEntryResponse.status).toBe(400);
    expect(JSON.parse(await invalidEntryResponse.text()).errors[0]).toContain('不支持的 content entryId');

    const missingEntryResponse = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/content/export/?collection=essay&entryId=missing')
    } as never);
    expect(missingEntryResponse.status).toBe(404);
    expect(JSON.parse(await missingEntryResponse.text()).errors[0]).toContain('未找到 content 源文件');
  });
});
