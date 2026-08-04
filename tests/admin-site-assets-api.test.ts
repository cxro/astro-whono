import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resetThemeSettingsCache } from '../src/lib/theme-settings';

/* 只需通过签名 + IHDR 解析：签名、IHDR 长度/类型/宽高，其余字节留空即可。 */
const createPngBuffer = (width: number, height: number): Buffer => {
  const buffer = Buffer.alloc(8 + 4 + 4 + 13 + 4 + 12);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'latin1');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer[24] = 8;
  buffer[25] = 6;
  return buffer;
};

const createUploadRequest = (formData: FormData): Request =>
  new Request('http://127.0.0.1:4321/api/admin/site-assets/upload/', {
    method: 'POST',
    headers: {
      origin: 'http://127.0.0.1:4321'
    },
    body: formData
  });

const createFaviconFormData = (
  slot: string,
  buffer: Buffer,
  fileName = 'logo.png',
  type = 'image/png'
): FormData => {
  const formData = new FormData();
  formData.set('slot', slot);
  formData.set('image', new File([new Uint8Array(buffer)], fileName, { type }));
  return formData;
};

const postUpload = async (formData: FormData) => {
  const { POST } = await import('../src/pages/api/admin/site-assets/upload');
  const request = createUploadRequest(formData);
  const response = await POST({ request, url: new URL(request.url) } as never);
  return {
    status: response.status,
    payload: JSON.parse(await response.text()) as {
      ok: boolean;
      errors?: string[];
      result?: { path: string; fileName: string; width: number; height: number; size: number };
    }
  };
};

describe('admin site assets api', () => {
  let tempRoot = '';
  const siteAssetDir = (): string => path.join(tempRoot, 'public', 'images', 'site');
  const originalSettingsFlag = process.env.ASTRO_WHONO_INTERNAL_TEST_SETTINGS;
  const originalSettingsDir = process.env.ASTRO_WHONO_INTERNAL_TEST_SETTINGS_DIR;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-site-assets-api-'));
    process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT = tempRoot;
    await mkdir(path.join(tempRoot, 'public'), { recursive: true });
    resetThemeSettingsCache();
  });

  afterEach(async () => {
    delete process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT;
    if (originalSettingsFlag === undefined) {
      delete process.env.ASTRO_WHONO_INTERNAL_TEST_SETTINGS;
    } else {
      process.env.ASTRO_WHONO_INTERNAL_TEST_SETTINGS = originalSettingsFlag;
    }
    if (originalSettingsDir === undefined) {
      delete process.env.ASTRO_WHONO_INTERNAL_TEST_SETTINGS_DIR;
    } else {
      process.env.ASTRO_WHONO_INTERNAL_TEST_SETTINGS_DIR = originalSettingsDir;
    }
    resetThemeSettingsCache();
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('uploads a square png favicon under a content-hash file name', async () => {
    const { status, payload } = await postUpload(createFaviconFormData('png', createPngBuffer(64, 64)));

    expect(status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.result?.path).toMatch(/^\/images\/site\/favicon-64x64-[0-9a-f]{8}\.png$/);
    expect(payload.result?.width).toBe(64);
    expect(payload.result?.height).toBe(64);
    expect(existsSync(path.join(siteAssetDir(), payload.result?.fileName ?? ''))).toBe(true);
  });

  it('keeps the same file name for identical content and uses the slot-specific prefix', async () => {
    const first = await postUpload(createFaviconFormData('png', createPngBuffer(64, 64)));
    const second = await postUpload(createFaviconFormData('png', createPngBuffer(64, 64)));
    const touchIcon = await postUpload(createFaviconFormData('appleTouchIcon', createPngBuffer(180, 180)));

    expect(second.payload.result?.fileName).toBe(first.payload.result?.fileName);
    expect(touchIcon.payload.result?.path).toMatch(/^\/images\/site\/apple-touch-icon-180x180-[0-9a-f]{8}\.png$/);
  });

  it('removes stale generated files but keeps referenced and manual files', async () => {
    await mkdir(siteAssetDir(), { recursive: true });
    await writeFile(path.join(siteAssetDir(), 'favicon-32x32-aaaaaaaa.png'), createPngBuffer(32, 32));
    await writeFile(path.join(siteAssetDir(), 'favicon-16x16-bbbbbbbb.png'), createPngBuffer(16, 16));
    await writeFile(path.join(siteAssetDir(), 'apple-touch-icon-180x180-cccccccc.png'), createPngBuffer(180, 180));
    await writeFile(path.join(siteAssetDir(), 'favicon-brand.png'), createPngBuffer(32, 32));

    const settingsDir = path.join(tempRoot, 'settings');
    await mkdir(settingsDir, { recursive: true });
    await writeFile(
      path.join(settingsDir, 'site.json'),
      `${JSON.stringify({ favicon: { svg: null, png: '/images/site/favicon-32x32-aaaaaaaa.png', appleTouchIcon: null } }, null, 2)}\n`,
      'utf8'
    );
    process.env.ASTRO_WHONO_INTERNAL_TEST_SETTINGS = '1';
    process.env.ASTRO_WHONO_INTERNAL_TEST_SETTINGS_DIR = settingsDir;
    resetThemeSettingsCache();

    const { payload } = await postUpload(createFaviconFormData('png', createPngBuffer(64, 64)));
    const entries = await readdir(siteAssetDir());

    expect(entries).toContain(payload.result?.fileName);
    expect(entries).toContain('favicon-32x32-aaaaaaaa.png');
    expect(entries).toContain('apple-touch-icon-180x180-cccccccc.png');
    // 手工放入的非「前缀-WxH-哈希8」命名文件不参与回收
    expect(entries).toContain('favicon-brand.png');
    expect(entries).not.toContain('favicon-16x16-bbbbbbbb.png');
  });

  it('rejects non-square, undersized and oversized icons', async () => {
    const nonSquare = await postUpload(createFaviconFormData('png', createPngBuffer(64, 32)));
    expect(nonSquare.status).toBe(400);
    expect(nonSquare.payload.errors?.[0]).toContain('正方形');

    // ~2%（至少 2px）容差内的导出误差可接受
    const nearlySquare = await postUpload(createFaviconFormData('png', createPngBuffer(64, 63)));
    expect(nearlySquare.status).toBe(200);
    expect(nearlySquare.payload.result?.path).toMatch(/^\/images\/site\/favicon-64x63-[0-9a-f]{8}\.png$/);

    const beyondTolerance = await postUpload(createFaviconFormData('png', createPngBuffer(64, 60)));
    expect(beyondTolerance.status).toBe(400);
    expect(beyondTolerance.payload.errors?.[0]).toContain('正方形');

    const tooSmall = await postUpload(createFaviconFormData('png', createPngBuffer(8, 8)));
    expect(tooSmall.status).toBe(400);
    expect(tooSmall.payload.errors?.[0]).toContain('16-512px');

    const tooLarge = await postUpload(createFaviconFormData('png', createPngBuffer(1024, 1024)));
    expect(tooLarge.status).toBe(400);
    expect(tooLarge.payload.errors?.[0]).toContain('16-512px');
  });

  it('rejects files that are not valid png payloads', async () => {
    const fakePng = Buffer.from('not a png at all, definitely long enough to pass length checks');
    const { status, payload } = await postUpload(createFaviconFormData('png', fakePng));

    expect(status).toBe(400);
    expect(payload.errors?.[0]).toContain('PNG');
  });

  it('rejects unsupported slots including svg phase-1', async () => {
    const svgSlot = await postUpload(createFaviconFormData('svg', createPngBuffer(64, 64)));
    expect(svgSlot.status).toBe(400);
    expect(svgSlot.payload.errors?.[0]).toContain('png / appleTouchIcon');

    const bogusSlot = await postUpload(createFaviconFormData('logo', createPngBuffer(64, 64)));
    expect(bogusSlot.status).toBe(400);
  });

  it('rejects oversized uploads with 413', async () => {
    const oversized = Buffer.alloc(256 * 1024 + 1);
    createPngBuffer(64, 64).copy(oversized, 0);
    const { status } = await postUpload(createFaviconFormData('png', oversized));

    expect(status).toBe(413);
  });
});
