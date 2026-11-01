import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const fsPromisesMock = vi.hoisted(() => ({
  stat: vi.fn()
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  fsPromisesMock.stat.mockImplementation(actual.stat);
  return {
    ...actual,
    stat: fsPromisesMock.stat
  };
});

const s3SdkMock = vi.hoisted(() => ({
  clientConfigs: [] as Record<string, unknown>[],
  send: vi.fn(),
  paginateListObjectsV2: vi.fn()
}));

vi.mock('@aws-sdk/client-s3', () => {
  class S3Client {
    constructor(readonly config: Record<string, unknown>) {
      s3SdkMock.clientConfigs.push(config);
    }

    send(command: unknown, options?: unknown): Promise<unknown> {
      return s3SdkMock.send(command, options);
    }
  }

  class PutObjectCommand {
    constructor(readonly input: Record<string, unknown>) {}
  }

  return {
    S3Client,
    PutObjectCommand,
    paginateListObjectsV2: s3SdkMock.paginateListObjectsV2
  };
});

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

const createJsonWriteRequest = (url: string, body: unknown) =>
  new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: new URL(url).origin
    },
    body: JSON.stringify(body)
  });

const createS3Paginator = (pages: Record<string, unknown>[]) => (async function* () {
  for (const page of pages) yield page;
})();

const configureS3TestEnv = ({
  prefix = 'uploads',
  forcePathStyle,
  sessionToken,
  publicBaseUrl = 'https://cdn.example.test'
}: {
  prefix?: string;
  forcePathStyle?: boolean;
  sessionToken?: string;
  publicBaseUrl?: string;
} = {}): void => {
  process.env.ASTRO_WHONO_IMAGE_STORAGE = 's3';
  process.env.ASTRO_WHONO_S3_ENDPOINT = 'https://s3.example.test';
  process.env.ASTRO_WHONO_S3_REGION = 'auto';
  process.env.ASTRO_WHONO_S3_BUCKET = 'site-images';
  process.env.ASTRO_WHONO_S3_ACCESS_KEY_ID = 'test-access-key';
  process.env.ASTRO_WHONO_S3_SECRET_ACCESS_KEY = 'test-secret-key';
  process.env.ASTRO_WHONO_S3_PUBLIC_BASE_URL = publicBaseUrl;
  process.env.ASTRO_WHONO_S3_PREFIX = prefix;
  if (forcePathStyle !== undefined) {
    process.env.ASTRO_WHONO_S3_FORCE_PATH_STYLE = String(forcePathStyle);
  }
  if (sessionToken) {
    process.env.ASTRO_WHONO_S3_SESSION_TOKEN = sessionToken;
  }
};

describe('admin images api', () => {
  let tempRoot = '';

  beforeEach(async () => {
    fsPromisesMock.stat.mockClear();
    s3SdkMock.clientConfigs.length = 0;
    s3SdkMock.send.mockReset();
    s3SdkMock.send.mockResolvedValue({});
    s3SdkMock.paginateListObjectsV2.mockReset();
    s3SdkMock.paginateListObjectsV2.mockImplementation(() => createS3Paginator([]));

    tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-images-api-'));
    process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT = tempRoot;

    await mkdir(path.join(tempRoot, 'public', 'author'), { recursive: true });
    await mkdir(path.join(tempRoot, 'public', 'bits'), { recursive: true });
    await mkdir(path.join(tempRoot, 'public', 'images', 'archive'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'essay', 'guide-assets'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'essay', 'no-assets'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'bits'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'memo'), { recursive: true });
    await mkdir(path.join(tempRoot, 'src', 'content', 'about'), { recursive: true });
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
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'memo', 'index.md'),
      ['---', 'title: Memo 图片上传测试', '---', '', 'memo body'].join('\n')
    );
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'about', 'index.md'),
      ['---', '---', '', 'about body'].join('\n')
    );
    await writeFile(path.join(tempRoot, 'src', 'content', 'essay', 'guide-assets', 'hero.png'), PNG_1X1);
    await writeFile(path.join(tempRoot, 'src', 'assets', 'hero.png'), PNG_1X1);
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT;
    delete process.env.ASTRO_WHONO_IMAGE_STORAGE;
    delete process.env.ASTRO_WHONO_S3_ENDPOINT;
    delete process.env.ASTRO_WHONO_S3_REGION;
    delete process.env.ASTRO_WHONO_S3_BUCKET;
    delete process.env.ASTRO_WHONO_S3_ACCESS_KEY_ID;
    delete process.env.ASTRO_WHONO_S3_SECRET_ACCESS_KEY;
    delete process.env.ASTRO_WHONO_S3_SESSION_TOKEN;
    delete process.env.ASTRO_WHONO_S3_FORCE_PATH_STYLE;
    delete process.env.ASTRO_WHONO_S3_PUBLIC_BASE_URL;
    delete process.env.ASTRO_WHONO_S3_PREFIX;
    vi.unstubAllGlobals();
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

  it('includes configured cloud images in browse mode alongside local images', async () => {
    configureS3TestEnv();
    s3SdkMock.paginateListObjectsV2.mockReturnValue(createS3Paginator([
      {
        Contents: [
          {
            Key: 'uploads/essay/guide/cloud-shot.webp',
            LastModified: new Date('2026-07-11T02:00:00.000Z'),
            Size: 2048
          },
          {
            Key: 'uploads/essay/guide/space 雪#hash?query%.png',
            Size: 512
          },
          {
            Key: 'uploads/essay/guide/readme.txt',
            Size: 10
          }
        ],
        IsTruncated: true,
        NextContinuationToken: 'page-2'
      },
      {
        Contents: [
          {
            Key: 'uploads/bits/demo/cloud-cover.png',
            LastModified: new Date('2026-07-12T02:00:00.000Z'),
            Size: 4
          },
          { Key: 'uploads/bits/demo/' }
        ],
        IsTruncated: false
      }
    ]));

    const { GET } = await import('../src/pages/api/admin/images/list');

    const response = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/images/list?group=all&page=1&limit=60')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.groupOptions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: 'cloud'
        })
      ])
    );
    expect(payload.result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'https://cdn.example.test/uploads/essay/guide/cloud-shot.webp',
          value: 'https://cdn.example.test/uploads/essay/guide/cloud-shot.webp',
          origin: 'cloud',
          browseGroup: 'cloud',
          browseGroupLabel: '云端图片',
          fileName: 'cloud-shot.webp',
          size: 2048,
          mimeType: 'image/webp',
          previewSrc: 'https://cdn.example.test/uploads/essay/guide/cloud-shot.webp'
        }),
        expect.objectContaining({
          path: 'https://cdn.example.test/uploads/bits/demo/cloud-cover.png',
          origin: 'cloud',
          size: 4,
          mimeType: 'image/png'
        }),
        expect.objectContaining({
          path: 'https://cdn.example.test/uploads/essay/guide/space%20%E9%9B%AA%23hash%3Fquery%25.png',
          origin: 'cloud',
          size: 512,
          mimeType: 'image/png'
        }),
        expect.objectContaining({
          origin: 'public',
          path: 'public/bits/demo.png'
        })
      ])
    );
    expect(s3SdkMock.paginateListObjectsV2).toHaveBeenCalledTimes(1);
    expect(s3SdkMock.paginateListObjectsV2.mock.calls[0]?.[1]).toEqual({
      Bucket: 'site-images',
      Prefix: 'uploads/'
    });
    expect(s3SdkMock.paginateListObjectsV2.mock.calls[0]?.[2]).toEqual({
      abortSignal: expect.any(AbortSignal)
    });
    expect(s3SdkMock.clientConfigs[0]).toEqual(expect.objectContaining({
      endpoint: 'https://s3.example.test',
      forcePathStyle: true,
      region: 'auto',
      credentials: {
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key'
      }
    }));
  });

  it('preserves the public base pathname when appending encoded cloud keys', async () => {
    configureS3TestEnv({ publicBaseUrl: 'https://cdn.example.test/media%40images///' });
    s3SdkMock.paginateListObjectsV2.mockReturnValue(createS3Paginator([{
      Contents: [{
        Key: 'uploads/essay/guide/space 雪#hash?query%.png',
        Size: 512
      }]
    }]));

    const { GET } = await import('../src/pages/api/admin/images/list');
    const response = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/images/list?group=all&page=1&limit=60')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'https://cdn.example.test/media%40images/uploads/essay/guide/space%20%E9%9B%AA%23hash%3Fquery%25.png',
        value: 'https://cdn.example.test/media%40images/uploads/essay/guide/space%20%E9%9B%AA%23hash%3Fquery%25.png'
      })
    ]));
  });

  it('hides non-managed cloud objects when the storage prefix is empty', async () => {
    configureS3TestEnv({ prefix: '' });
    s3SdkMock.paginateListObjectsV2.mockReturnValue(createS3Paginator([{
      Contents: [
        { Key: 'essay/guide/cloud-shot.webp', Size: 2048 },
        { Key: 'bits/demo/cloud-cover.png', Size: 4 },
        { Key: 'other/not-managed.png', Size: 8 },
        { Key: 'bucket-root.png', Size: 16 }
      ]
    }]));

    const { GET } = await import('../src/pages/api/admin/images/list');
    const response = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/images/list?group=all&page=1&limit=60')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        origin: 'cloud',
        path: 'https://cdn.example.test/essay/guide/cloud-shot.webp'
      }),
      expect.objectContaining({
        origin: 'cloud',
        path: 'https://cdn.example.test/bits/demo/cloud-cover.png'
      })
    ]));
    expect(payload.result.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'https://cdn.example.test/other/not-managed.png' }),
      expect.objectContaining({ path: 'https://cdn.example.test/bucket-root.png' })
    ]));
  });

  it('returns a visible error when cloud listing fails', async () => {
    configureS3TestEnv();
    s3SdkMock.paginateListObjectsV2.mockReturnValue((async function* () {
      throw new Error('S3 unavailable');
    })());

    const { GET } = await import('../src/pages/api/admin/images/list');
    const response = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/images/list?group=all&page=1&limit=60')
    } as never);

    expect(response.status).toBe(502);
    const payload = JSON.parse(await response.text());
    expect(payload).toEqual(expect.objectContaining({
      ok: false,
      errors: ['云端图片操作失败，请查看服务端日志'],
      error: expect.objectContaining({
        code: 'cloud_unknown',
        outcome: 'failed_known',
        traceId: expect.any(String)
      })
    }));
  });

  it('requires an explicit region for native AWS S3 when endpoint is omitted', async () => {
    configureS3TestEnv();
    delete process.env.ASTRO_WHONO_S3_ENDPOINT;
    delete process.env.ASTRO_WHONO_S3_REGION;

    const { GET } = await import('../src/pages/api/admin/images/list');
    const response = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/images/list?group=all&page=1&limit=60')
    } as never);

    expect(response.status).toBe(500);
    expect(JSON.parse(await response.text())).toEqual(expect.objectContaining({
      ok: false,
      errors: ['云端图片存储配置无效，请检查服务端配置'],
      error: expect.objectContaining({ code: 'cloud_config_invalid', traceId: expect.any(String) })
    }));
    expect(s3SdkMock.paginateListObjectsV2).not.toHaveBeenCalled();
  });

  it('rejects auto as the native AWS S3 region when endpoint is omitted', async () => {
    configureS3TestEnv();
    delete process.env.ASTRO_WHONO_S3_ENDPOINT;

    const { GET } = await import('../src/pages/api/admin/images/list');
    const response = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/images/list?group=all&page=1&limit=60')
    } as never);

    expect(response.status).toBe(500);
    expect(JSON.parse(await response.text())).toEqual(expect.objectContaining({
      ok: false,
      errors: ['云端图片存储配置无效，请检查服务端配置'],
      error: expect.objectContaining({ code: 'cloud_config_invalid', traceId: expect.any(String) })
    }));
    expect(s3SdkMock.paginateListObjectsV2).not.toHaveBeenCalled();
  });

  it.each([
    'http://cdn.example.test',
    'not-a-url',
    'https://user:password@cdn.example.test/media',
    'https://@cdn.example.test/media',
    'https://:@cdn.example.test/media',
    'https://cdn.example.test/media?token=abc',
    'https://cdn.example.test/media?',
    'https://cdn.example.test/media#fragment',
    'https://cdn.example.test/media#'
  ])('requires an HTTPS public base URL for cloud storage (%s)', async (publicBaseUrl) => {
    configureS3TestEnv();
    process.env.ASTRO_WHONO_S3_PUBLIC_BASE_URL = publicBaseUrl;

    const { GET } = await import('../src/pages/api/admin/images/list');
    const response = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/images/list?group=all&page=1&limit=60')
    } as never);

    expect(response.status).toBe(500);
    expect(JSON.parse(await response.text())).toEqual(expect.objectContaining({
      ok: false,
      errors: ['云端图片存储配置无效，请检查服务端配置'],
      error: expect.objectContaining({ code: 'cloud_config_invalid', traceId: expect.any(String) })
    }));
    expect(s3SdkMock.paginateListObjectsV2).not.toHaveBeenCalled();
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

  it('uploads images to configured S3-compatible cloud storage and returns a public url', async () => {
    configureS3TestEnv({ prefix: 'blog', forcePathStyle: false, sessionToken: 'test-session-token' });

    const { POST } = await import('../src/pages/api/admin/images/upload');
    const formData = new FormData();
    formData.set('collection', 'bits');
    formData.set('entryId', 'demo');
    formData.set('image', new File([PNG_1X1], 'Cloud Cover.PNG', { type: 'image/png' }));

    const response = await POST({
      request: createUploadRequest('http://127.0.0.1:4321/api/admin/images/upload', formData),
      url: new URL('http://127.0.0.1:4321/api/admin/images/upload')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result).toEqual(
      expect.objectContaining({
        src: expect.stringMatching(/^https:\/\/cdn\.example\.test\/blog\/bits\/demo\/cloud-cover-[0-9a-f-]+\.png$/),
        path: expect.stringMatching(/^blog\/bits\/demo\/cloud-cover-[0-9a-f-]+\.png$/),
        fileName: expect.stringMatching(/^cloud-cover-[0-9a-f-]+\.png$/),
        width: null,
        height: null,
        size: PNG_1X1.length,
        mimeType: 'image/png'
      })
    );
    expect(s3SdkMock.send).toHaveBeenCalledTimes(1);
    const uploadCommand = s3SdkMock.send.mock.calls[0]?.[0] as {
      constructor: { name: string };
      input: Record<string, unknown>;
    };
    expect(uploadCommand.constructor.name).toBe('PutObjectCommand');
    expect(uploadCommand.input).toEqual({
      Bucket: 'site-images',
      Key: expect.stringMatching(/^blog\/bits\/demo\/cloud-cover-[0-9a-f-]+\.png$/),
      Body: PNG_1X1,
      ContentType: 'image/png'
    });
    expect(s3SdkMock.send.mock.calls[0]?.[1]).toEqual({
      abortSignal: expect.any(AbortSignal)
    });
    expect(s3SdkMock.clientConfigs[0]).toEqual(expect.objectContaining({
      region: 'auto',
      endpoint: 'https://s3.example.test',
      forcePathStyle: false,
      maxAttempts: 2,
      credentials: {
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        sessionToken: 'test-session-token'
      }
    }));
    await expect(readFile(path.join(tempRoot, 'public', 'bits', 'cloud-cover.png'))).rejects.toThrow();
  });

  it('returns a structured 502 response when cloud upload fails', async () => {
    configureS3TestEnv();
    s3SdkMock.send.mockRejectedValueOnce(new Error('S3 upload unavailable'));

    const { POST } = await import('../src/pages/api/admin/images/upload');
    const formData = new FormData();
    formData.set('collection', 'bits');
    formData.set('entryId', 'demo');
    formData.set('image', new File([PNG_1X1], 'Cloud Failure.PNG', { type: 'image/png' }));

    const response = await POST({
      request: createUploadRequest('http://127.0.0.1:4321/api/admin/images/upload', formData),
      url: new URL('http://127.0.0.1:4321/api/admin/images/upload')
    } as never);

    expect(response.status).toBe(502);
    expect(JSON.parse(await response.text())).toEqual(expect.objectContaining({
      ok: false,
      errors: ['云端图片操作失败，请查看服务端日志'],
      error: expect.objectContaining({ code: 'cloud_unknown', outcome: 'failed_known', traceId: expect.any(String) })
    }));
  });

  it('redacts provider network errors and marks an upload outcome as unknown', async () => {
    configureS3TestEnv();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    s3SdkMock.send.mockRejectedValueOnce(Object.assign(
      new Error('signed endpoint https://s3.example.test/?credential=secret'),
      { code: 'ECONNRESET', $metadata: { requestId: 'provider-request-id' } }
    ));

    const { POST } = await import('../src/pages/api/admin/images/upload');
    const formData = new FormData();
    formData.set('collection', 'bits');
    formData.set('entryId', 'demo');
    formData.set('image', new File([PNG_1X1], 'Network Failure.PNG', { type: 'image/png' }));

    const response = await POST({
      request: createUploadRequest('http://127.0.0.1:4321/api/admin/images/upload', formData),
      url: new URL('http://127.0.0.1:4321/api/admin/images/upload')
    } as never);
    const responseText = await response.text();
    const payload = JSON.parse(responseText);

    expect(response.status).toBe(502);
    expect(responseText).not.toContain('credential=secret');
    expect(responseText).not.toContain('provider-request-id');
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('credential=secret');
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('signed endpoint');
    expect(payload.error).toEqual(expect.objectContaining({
      code: 'cloud_provider_unavailable',
      outcome: 'unknown_may_have_succeeded',
      traceId: expect.any(String)
    }));
    consoleError.mockRestore();
  });

  it('aborts a cloud upload at the operation deadline', async () => {
    vi.useFakeTimers();
    configureS3TestEnv();
    s3SdkMock.send.mockReturnValueOnce(new Promise(() => undefined));

    const { POST } = await import('../src/pages/api/admin/images/upload');
    const formData = new FormData();
    formData.set('collection', 'bits');
    formData.set('entryId', 'demo');
    formData.set('image', new File([PNG_1X1], 'Timeout.PNG', { type: 'image/png' }));
    const responsePromise = POST({
      request: createUploadRequest('http://127.0.0.1:4321/api/admin/images/upload', formData),
      url: new URL('http://127.0.0.1:4321/api/admin/images/upload')
    } as never);

    // Multipart parsing and filesystem reads must finish before the cloud deadline
    // is registered. Advancing the clock earlier can leave the upload queue locked.
    await vi.waitFor(() => expect(s3SdkMock.send).toHaveBeenCalledTimes(1));
    const uploadOptions = s3SdkMock.send.mock.calls[0]![1] as { abortSignal: AbortSignal };
    expect(uploadOptions.abortSignal.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(60_000);
    const response = await responsePromise;
    const payload = JSON.parse(await response.text());

    expect(uploadOptions.abortSignal.aborted).toBe(true);
    expect(response.status).toBe(504);
    expect(payload.error).toEqual(expect.objectContaining({
      code: 'cloud_timeout',
      outcome: 'unknown_may_have_succeeded'
    }));
  });

  it('persists a cloud Bits upload through the existing optional-dimensions contract', async () => {
    configureS3TestEnv({ prefix: 'blog', forcePathStyle: false });

    const { POST: upload } = await import('../src/pages/api/admin/images/upload');
    const formData = new FormData();
    formData.set('collection', 'bits');
    formData.set('entryId', 'demo');
    formData.set('image', new File([PNG_1X1], 'Cloud Bits.PNG', { type: 'image/png' }));

    const uploadResponse = await upload({
      request: createUploadRequest('http://127.0.0.1:4321/api/admin/images/upload', formData),
      url: new URL('http://127.0.0.1:4321/api/admin/images/upload')
    } as never);
    expect(uploadResponse.status).toBe(200);
    const uploadPayload = JSON.parse(await uploadResponse.text());
    expect(uploadPayload.result).toEqual(expect.objectContaining({
      src: expect.stringMatching(/^https:\/\/cdn\.example\.test\/blog\/bits\/demo\/cloud-bits-/),
      width: null,
      height: null
    }));

    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST: save } = await import('../src/pages/api/admin/content/entry');
    const current = await readAdminContentEntryEditorPayload('bits', 'demo');
    const nextValues = {
      ...current.values,
      imagesText: JSON.stringify([{ src: uploadPayload.result.src }])
    };
    const saveResponse = await save({
      request: createJsonWriteRequest('http://127.0.0.1:4321/api/admin/content/entry', {
        collection: 'bits',
        entryId: 'demo',
        revision: current.revision,
        frontmatter: nextValues,
        body: current.bodyText
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry')
    } as never);

    expect(saveResponse.status).toBe(200);
    const savePayload = JSON.parse(await saveResponse.text());
    expect(savePayload.ok).toBe(true);
    expect(savePayload.result.changedFields).toContain('images');
    const savedBits = await readFile(path.join(tempRoot, 'src', 'content', 'bits', 'demo.md'), 'utf8');
    expect(savedBits).toContain(`src: ${uploadPayload.result.src}`);
    expect(savedBits).not.toContain('width:');
    expect(savedBits).not.toContain('height:');
  });

  it('uploads memo body images next to the fixed memo source file', async () => {
    const { POST } = await import('../src/pages/api/admin/images/upload');
    const formData = new FormData();
    formData.set('collection', 'memo');
    formData.set('entryId', 'index');
    formData.set('image', new File([PNG_1X1], 'Memo Shot.PNG', { type: 'image/png' }));

    const response = await POST({
      request: createUploadRequest('http://127.0.0.1:4321/api/admin/images/upload', formData),
      url: new URL('http://127.0.0.1:4321/api/admin/images/upload')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result).toEqual(
      expect.objectContaining({
        src: './assets/memo-shot.png',
        path: 'src/content/memo/assets/memo-shot.png',
        fileName: 'memo-shot.png',
        width: 1,
        height: 1,
        mimeType: 'image/png'
      })
    );
    await expect(readFile(path.join(tempRoot, 'src', 'content', 'memo', 'assets', 'memo-shot.png'))).resolves.toEqual(PNG_1X1);
  });

  it('rejects memo image uploads for non-index entries', async () => {
    await writeFile(
      path.join(tempRoot, 'src', 'content', 'memo', 'extra.md'),
      ['---', 'title: Extra Memo', '---', '', 'extra memo body'].join('\n')
    );

    const { POST } = await import('../src/pages/api/admin/images/upload');
    const formData = new FormData();
    formData.set('collection', 'memo');
    formData.set('entryId', 'extra');
    formData.set('image', new File([PNG_1X1], 'Memo Extra.PNG', { type: 'image/png' }));

    const response = await POST({
      request: createUploadRequest('http://127.0.0.1:4321/api/admin/images/upload', formData),
      url: new URL('http://127.0.0.1:4321/api/admin/images/upload')
    } as never);

    expect(response.status).toBe(400);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('memo 仅支持固定源文件')
      ])
    );
  });

  it('rejects about image uploads because about has no upload capability', async () => {
    const { POST } = await import('../src/pages/api/admin/images/upload');
    const formData = new FormData();
    formData.set('collection', 'about');
    formData.set('entryId', 'index');
    formData.set('image', new File([PNG_1X1], 'About Shot.PNG', { type: 'image/png' }));

    const response = await POST({
      request: createUploadRequest('http://127.0.0.1:4321/api/admin/images/upload', formData),
      url: new URL('http://127.0.0.1:4321/api/admin/images/upload')
    } as never);

    expect(response.status).toBe(400);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('当前仅支持随笔正文图片、小记正文图片或絮语配图上传')
      ])
    );
    await expect(readFile(path.join(tempRoot, 'src', 'content', 'about', 'about-shot.png'))).rejects.toThrow();
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
    // Theme Console 站点图标托管目录整体隐藏，即便文件是最新的也不进入 recent。
    await mkdir(path.join(tempRoot, 'public', 'images', 'site'), { recursive: true });
    await writeFile(path.join(tempRoot, 'public', 'images', 'site', 'favicon-64x64-a1b2c3d4.png'), PNG_1X1);
    await touch('public/images/site/favicon-64x64-a1b2c3d4.png', '2026-04-06T00:00:00.000Z');

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
    expect(scopeIndex.recent).not.toContain('public/images/site/favicon-64x64-a1b2c3d4.png');

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

  it('uses one browse snapshot and cloud lastModified for recent scope', async () => {
    configureS3TestEnv();
    s3SdkMock.paginateListObjectsV2.mockReturnValue(createS3Paginator([{
      Contents: [{
        Key: 'uploads/essay/guide/cloud-recent.png',
        LastModified: new Date('2099-01-01T00:00:00.000Z'),
        Size: 12
      }]
    }]));

    const { GET } = await import('../src/pages/api/admin/images/list');
    const response = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/images/list?scope=recent&page=1&limit=60')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.result.items[0]).toEqual(expect.objectContaining({
      path: 'https://cdn.example.test/uploads/essay/guide/cloud-recent.png',
      origin: 'cloud',
      size: 12
    }));
    expect(s3SdkMock.paginateListObjectsV2).toHaveBeenCalledTimes(1);
    expect(fsPromisesMock.stat.mock.calls.some(([target]) => String(target).includes('cdn.example.test'))).toBe(false);
  });

});
