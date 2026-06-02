import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0ioAAAAASUVORK5CYII=',
  'base64'
);

const createUploadRequest = (url: string, formData: FormData) =>
  new Request(url, {
    method: 'POST',
    headers: {
      origin: new URL(url).origin
    },
    body: formData
  });

describe('admin images api', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-images-api-'));
    process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT = tempRoot;

    await mkdir(path.join(tempRoot, 'public', 'author'), { recursive: true });
    await mkdir(path.join(tempRoot, 'public', 'bits'), { recursive: true });
    await mkdir(path.join(tempRoot, 'public', 'images', 'archive'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'essay', 'guide-assets'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'essay', 'no-assets'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'bits'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'assets'), { recursive: true });

    await writeFile(path.join(tempRoot, 'public', 'favicon.png'), PNG_1X1);
    await writeFile(path.join(tempRoot, 'public', 'apple-touch-icon.png'), PNG_1X1);
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
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'bits', 'demo.md'),
      ['---', 'title: Bits 图片上传测试', 'date: 2026-05-26T10:00:00+08:00', '---', '', '短内容。'].join('\n')
    );
    await writeFile(path.join(tempRoot, 'src', 'content', 'essay', 'guide-assets', 'hero.png'), PNG_1X1);
    await writeFile(path.join(tempRoot, 'src', 'assets', 'hero.png'), PNG_1X1);
  });

  afterEach(async () => {
    delete process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT;
    try {
      const imageShared = await import('../src/lib/admin-console/image-shared');
      imageShared.invalidateAdminImageCaches();
    } catch {
      // Ignore cache cleanup failures during teardown.
    }
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('lists field-scoped items in dev/test mode', async () => {
    const { GET } = await import('../src/pages/api/admin/images/list');

    const response = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/images/list?field=bits.images&dir=public/bits&page=1&limit=10')
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
    const { GET } = await import('../src/pages/api/admin/images/list');

    const response = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/images/list?group=assets&sub=other&page=1&limit=10')
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
    const { GET } = await import('../src/pages/api/admin/images/list');

    const response = await GET({
      url: new URL(
        'http://127.0.0.1:4321/api/admin/images/list?dir=src/content&owner=src/content/essay/guide&page=1&limit=10'
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
    const { GET } = await import('../src/pages/api/admin/images/meta');

    const localResponse = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/images/meta?field=home.heroImageSrc&value=src/assets/hero.png')
    } as never);
    expect(localResponse.status).toBe(200);
    const localPayload = JSON.parse(await localResponse.text());
    expect(localPayload.ok).toBe(true);
    expect(localPayload.result.kind).toBe('local');
    expect(localPayload.result.width).toBe(1);
    expect(localPayload.result.height).toBe(1);

    const remoteResponse = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/images/meta?field=bits.images&value=https://example.com/demo.webp')
    } as never);
    expect(remoteResponse.status).toBe(200);
    const remotePayload = JSON.parse(await remoteResponse.text());
    expect(remotePayload.ok).toBe(true);
    expect(remotePayload.result.kind).toBe('remote');
    expect(remotePayload.result.previewSrc).toBe('https://example.com/demo.webp');
    expect(remotePayload.result.width).toBeNull();
    expect(remotePayload.result.height).toBeNull();
  });

  it('rejects metadata previews that violate field image contracts', async () => {
    const { GET } = await import('../src/pages/api/admin/images/meta');

    const cases = [
      {
        field: 'bits.images',
        value: 'http://example.com/demo.webp'
      },
      {
        field: 'home.heroImageSrc',
        value: 'http://example.com/hero.webp'
      },
      {
        field: 'page.bits.defaultAuthor.avatar',
        value: 'https://example.com/avatar.webp'
      }
    ];

    for (const { field, value } of cases) {
      const response = await GET({
        url: new URL(
          `http://127.0.0.1:4321/api/admin/images/meta?field=${field}&value=${encodeURIComponent(value)}`
        )
      } as never);
      const payload = JSON.parse(await response.text());

      expect(response.status).toBe(400);
      expect(payload.ok).toBe(false);
      expect(Array.isArray(payload.errors)).toBe(true);
    }
  });

  it('returns metadata for canonical local path values and rejects unsafe path traversal', async () => {
    const { GET } = await import('../src/pages/api/admin/images/meta');

    const pathResponse = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/images/meta?path=src/assets/hero.png')
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
      url: new URL('http://127.0.0.1:4321/api/admin/images/meta?path=public/../src/assets/hero.png')
    } as never);
    expect(unsafeResponse.status).toBe(400);
    const unsafePayload = JSON.parse(await unsafeResponse.text());
    expect(unsafePayload.ok).toBe(false);
    expect(Array.isArray(unsafePayload.errors)).toBe(true);
  });

  it('uploads essay body images next to the current source file', async () => {
    const { POST } = await import('../src/pages/api/admin/images/upload');
    const formData = new FormData();
    formData.set('collection', 'essay');
    formData.set('entryId', 'guide');
    formData.set('image', new File([PNG_1X1], 'Hero Shot.PNG', { type: 'image/png' }));

    const response = await POST({
      request: createUploadRequest('http://127.0.0.1:4321/api/admin/images/upload', formData),
      url: new URL('http://127.0.0.1:4321/api/admin/images/upload')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result).toEqual(
      expect.objectContaining({
        src: './guide-assets/hero-shot.png',
        path: 'src/content/essay/guide-assets/hero-shot.png',
        fileName: 'hero-shot.png',
        width: 1,
        height: 1,
        mimeType: 'image/png'
      })
    );
    await expect(readFile(path.join(tempRoot, 'src', 'content', 'essay', 'guide-assets', 'hero-shot.png'))).resolves.toEqual(PNG_1X1);
  });

  it('keeps uploads non-blocking by auto-renaming conflicts', async () => {
    const { POST } = await import('../src/pages/api/admin/images/upload');
    const formData = new FormData();
    formData.set('collection', 'essay');
    formData.set('entryId', 'guide');
    formData.set('image', new File([PNG_1X1], 'hero.png', { type: 'image/png' }));

    const response = await POST({
      request: createUploadRequest('http://127.0.0.1:4321/api/admin/images/upload', formData),
      url: new URL('http://127.0.0.1:4321/api/admin/images/upload')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.src).toBe('./guide-assets/hero-2.png');
    await expect(readFile(path.join(tempRoot, 'src', 'content', 'essay', 'guide-assets', 'hero-2.png'))).resolves.toEqual(PNG_1X1);
  });

  it('uploads bits images to the public bits directory with field-ready src', async () => {
    const { POST } = await import('../src/pages/api/admin/images/upload');
    const formData = new FormData();
    formData.set('collection', 'bits');
    formData.set('entryId', 'demo');
    formData.set('image', new File([PNG_1X1], 'Bit Cover.PNG', { type: 'image/png' }));

    const response = await POST({
      request: createUploadRequest('http://127.0.0.1:4321/api/admin/images/upload', formData),
      url: new URL('http://127.0.0.1:4321/api/admin/images/upload')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result).toEqual(
      expect.objectContaining({
        src: 'bits/bit-cover.png',
        path: 'public/bits/bit-cover.png',
        fileName: 'bit-cover.png',
        width: 1,
        height: 1,
        mimeType: 'image/png'
      })
    );
    await expect(readFile(path.join(tempRoot, 'public', 'bits', 'bit-cover.png'))).resolves.toEqual(PNG_1X1);
  });

  it('rejects non-image uploads without writing files', async () => {
    const { POST } = await import('../src/pages/api/admin/images/upload');
    const formData = new FormData();
    formData.set('collection', 'essay');
    formData.set('entryId', 'guide');
    formData.set('image', new File(['hello'], 'note.txt', { type: 'text/plain' }));

    const response = await POST({
      request: createUploadRequest('http://127.0.0.1:4321/api/admin/images/upload', formData),
      url: new URL('http://127.0.0.1:4321/api/admin/images/upload')
    } as never);

    expect(response.status).toBe(400);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.errors).toEqual(expect.arrayContaining(['请选择图片文件']));
  });

  it('derives recent scope from local file mtime and excludes hidden system assets', async () => {
    const { listAdminImageScopeIndex } = await import('../src/lib/admin-console/image-shared');
    const { GET } = await import('../src/pages/api/admin/images/list');
    const touch = async (relativePath: string, isoTime: string) => {
      const nextTime = new Date(isoTime);
      await utimes(path.join(tempRoot, ...relativePath.split('/')), nextTime, nextTime);
    };

    await touch('public/author/avatar.png', '2026-04-01T00:00:00.000Z');
    await touch('public/bits/demo.png', '2026-04-02T00:00:00.000Z');
    await touch('public/images/archive/cover.png', '2026-04-03T00:00:00.000Z');
    await touch('src/content/essay/guide-assets/hero.png', '2026-03-31T00:00:00.000Z');
    await touch('src/assets/hero.png', '2026-04-04T00:00:00.000Z');
    await touch('public/apple-touch-icon.png', '2026-04-05T00:00:00.000Z');

    const scopeIndex = await listAdminImageScopeIndex();

    expect(scopeIndex.recent.slice(0, 4)).toEqual([
      'src/assets/hero.png',
      'public/images/archive/cover.png',
      'public/bits/demo.png',
      'public/author/avatar.png'
    ]);
    expect(scopeIndex.recent).toContain('src/content/essay/guide-assets/hero.png');
    expect(scopeIndex.recent).not.toContain('public/favicon.png');
    expect(scopeIndex.recent).not.toContain('public/apple-touch-icon.png');

    const response = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/images/list?scope=recent&page=1&limit=3')
    } as never);
    const payload = JSON.parse(await response.text());
    expect(response.status).toBe(200);
    expect(payload.result.scope).toBe('recent');
    expect(payload.result.items.map((item: { path: string }) => item.path)).toEqual([
      'src/assets/hero.png',
      'public/images/archive/cover.png',
      'public/bits/demo.png'
    ]);
  });

});
