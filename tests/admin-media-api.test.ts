import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0ioAAAAASUVORK5CYII=',
  'base64'
);

describe('admin media api', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-media-api-'));
    process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT = tempRoot;

    await mkdir(path.join(tempRoot, 'public', 'author'), { recursive: true });
    await mkdir(path.join(tempRoot, 'public', 'bits'), { recursive: true });
    await mkdir(path.join(tempRoot, 'public', 'images', 'archive'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'essay', 'guide-assets'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'essay', 'no-assets'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'assets'), { recursive: true });

    await writeFile(path.join(tempRoot, 'public', 'favicon.png'), PNG_1X1);
    await writeFile(path.join(tempRoot, 'public', 'author', 'avatar.png'), PNG_1X1);
    await writeFile(path.join(tempRoot, 'public', 'bits', 'demo.png'), PNG_1X1);
    await writeFile(path.join(tempRoot, 'public', 'images', 'archive', 'cover.png'), PNG_1X1);
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'essay', 'guide.md'),
      ['---', 'title: 附件映射测试', '---', '', '![封面](./guide-assets/hero.png)'].join('\n')
    );
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'essay', 'no-assets', 'index.md'),
      ['---', 'title: 无附件条目', '---', '', '这里只是普通正文，没有图片。'].join('\n')
    );
    await writeFile(path.join(tempRoot, 'src', 'content', 'essay', 'guide-assets', 'hero.png'), PNG_1X1);
    await writeFile(path.join(tempRoot, 'src', 'assets', 'hero.png'), PNG_1X1);
  });

  afterEach(async () => {
    delete process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT;
    try {
      const mediaShared = await import('../src/lib/admin-console/media-shared');
      mediaShared.invalidateAdminMediaCaches();
    } catch {
      // Ignore cache cleanup failures during teardown.
    }
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('lists field-scoped items in dev/test mode', async () => {
    const { GET } = await import('../src/pages/api/admin/media/list');

    const response = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/media/list?field=bits.images&dir=public/bits&page=1&limit=10')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.directory).toBe('public/bits');
    expect(payload.result.items.every((item: { path: string }) => item.path.startsWith('public/bits/'))).toBe(true);
    expect(payload.result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: 'bits/demo.png',
          origin: 'public'
        })
      ])
    );
  });

  it('supports browse mode for assets and returns a single stable preferred value with dev preview src', async () => {
    const { GET } = await import('../src/pages/api/admin/media/list');

    const response = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/media/list?group=assets&sub=other&page=1&limit=10')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.group).toBe('assets');
    expect(payload.result.subgroup).toBe('other');
    expect(payload.result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'src/assets/hero.png',
          browseGroup: 'assets',
          browseSubgroup: 'other',
          preferredValue: 'src/assets/hero.png',
          previewSrc: expect.stringContaining('/@fs/')
        })
      ])
    );
  });

  it('filters content attachments by owner and resolves relative asset references', async () => {
    const { GET } = await import('../src/pages/api/admin/media/list');

    const response = await GET({
      url: new URL(
        'http://127.0.0.1:4321/api/admin/media/list?dir=src/content&owner=src/content/essay/guide&page=1&limit=10'
      )
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.directory).toBe('src/content');
    expect(payload.result.owner).toBe('src/content/essay/guide');
    expect(payload.result.ownerOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: 'src/content/essay/guide',
          label: '随笔 · 附件映射测试',
          count: 1
        })
      ])
    );
    expect(payload.result.ownerOptions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: 'src/content/essay/no-assets/index'
        })
      ])
    );
    expect(payload.result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'src/content/essay/guide-assets/hero.png',
          value: 'src/content/essay/guide-assets/hero.png',
          origin: 'src/content',
          owner: 'src/content/essay/guide',
          ownerLabel: '随笔 · 附件映射测试'
        })
      ])
    );
    expect(payload.result.items.every((item: { owner: string | null }) => item.owner === 'src/content/essay/guide')).toBe(true);
  });

  it('returns metadata for field values and keeps remote urls readonly-compatible', async () => {
    const { GET } = await import('../src/pages/api/admin/media/meta');

    const localResponse = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/media/meta?field=home.heroImageSrc&value=src/assets/hero.png')
    } as never);
    expect(localResponse.status).toBe(200);
    const localPayload = JSON.parse(await localResponse.text());
    expect(localPayload.ok).toBe(true);
    expect(localPayload.result.kind).toBe('local');
    expect(localPayload.result.width).toBe(1);
    expect(localPayload.result.height).toBe(1);

    const remoteResponse = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/media/meta?field=bits.images&value=https://example.com/demo.webp')
    } as never);
    expect(remoteResponse.status).toBe(200);
    const remotePayload = JSON.parse(await remoteResponse.text());
    expect(remotePayload.ok).toBe(true);
    expect(remotePayload.result.kind).toBe('remote');
    expect(remotePayload.result.width).toBeNull();
    expect(remotePayload.result.height).toBeNull();
  });

  it('returns metadata for canonical local path values and rejects unsafe path traversal', async () => {
    const { GET } = await import('../src/pages/api/admin/media/meta');

    const pathResponse = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/media/meta?path=src/assets/hero.png')
    } as never);
    expect(pathResponse.status).toBe(200);
    const pathPayload = JSON.parse(await pathResponse.text());
    expect(pathPayload.ok).toBe(true);
    expect(pathPayload.result.kind).toBe('local');
    expect(pathPayload.result.path).toBe('src/assets/hero.png');
    expect(pathPayload.result.origin).toBe('src/assets');
    expect(pathPayload.result.width).toBe(1);
    expect(pathPayload.result.height).toBe(1);

    const unsafeResponse = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/media/meta?path=public/../src/assets/hero.png')
    } as never);
    expect(unsafeResponse.status).toBe(400);
    const unsafePayload = JSON.parse(await unsafeResponse.text());
    expect(unsafePayload.ok).toBe(false);
    expect(Array.isArray(unsafePayload.errors)).toBe(true);
  });

  it('derives recent scope from local file mtime and excludes hidden system assets', async () => {
    const { listAdminMediaScopeIndex } = await import('../src/lib/admin-console/media-shared');
    const touch = async (relativePath: string, isoTime: string) => {
      const nextTime = new Date(isoTime);
      await utimes(path.join(tempRoot, ...relativePath.split('/')), nextTime, nextTime);
    };

    await touch('public/author/avatar.png', '2026-04-01T00:00:00.000Z');
    await touch('public/bits/demo.png', '2026-04-02T00:00:00.000Z');
    await touch('public/images/archive/cover.png', '2026-04-03T00:00:00.000Z');
    await touch('src/content/essay/guide-assets/hero.png', '2026-03-31T00:00:00.000Z');
    await touch('src/assets/hero.png', '2026-04-04T00:00:00.000Z');

    const scopeIndex = await listAdminMediaScopeIndex();

    expect(scopeIndex.recent.slice(0, 4)).toEqual([
      'src/assets/hero.png',
      'public/images/archive/cover.png',
      'public/bits/demo.png',
      'public/author/avatar.png'
    ]);
    expect(scopeIndex.recent).toContain('src/content/essay/guide-assets/hero.png');
    expect(scopeIndex.recent).not.toContain('public/favicon.png');
  });

});
