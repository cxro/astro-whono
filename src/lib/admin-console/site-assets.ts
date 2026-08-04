import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type AdminSiteFaviconUploadSlot = 'png' | 'appleTouchIcon';

export type AdminSiteFaviconUploadResult = {
  path: string;
  fileName: string;
  width: number;
  height: number;
  size: number;
};

export class AdminSiteAssetUploadError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'AdminSiteAssetUploadError';
    this.status = status;
  }
}

export const ADMIN_SITE_ASSET_DIR = 'public/images/site';
export const ADMIN_SITE_FAVICON_UPLOAD_MAX_BYTES = 256 * 1024;
export const ADMIN_SITE_FAVICON_MIN_EDGE = 16;
export const ADMIN_SITE_FAVICON_MAX_EDGE = 512;

const ADMIN_SITE_FAVICON_UPLOAD_SLOTS = ['png', 'appleTouchIcon'] as const satisfies readonly AdminSiteFaviconUploadSlot[];
const SLOT_FILE_PREFIX: Record<AdminSiteFaviconUploadSlot, string> = {
  png: 'favicon-',
  appleTouchIcon: 'apple-touch-icon-'
};
// 只回收本模块生成的「前缀-WxH-哈希8」命名文件；手工放入的同前缀文件（如 favicon-brand.png）不动。
const SLOT_GENERATED_FILE_RE: Record<AdminSiteFaviconUploadSlot, RegExp> = {
  png: /^favicon-\d+x\d+-[0-9a-f]{8}\.png$/,
  appleTouchIcon: /^apple-touch-icon-\d+x\d+-[0-9a-f]{8}\.png$/
};
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const isAdminSiteFaviconUploadSlot = (value: string): value is AdminSiteFaviconUploadSlot =>
  (ADMIN_SITE_FAVICON_UPLOAD_SLOTS as readonly string[]).includes(value);

const getProjectRoot = (): string => process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT?.trim() || process.cwd();

const readPngDimensions = (buffer: Buffer): { width: number; height: number } | null => {
  // 只解析签名 + IHDR 定长头（宽高在第 16-23 字节），不做完整解码。
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (buffer.toString('latin1', 12, 16) !== 'IHDR') return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
};

const assertFaviconUploadFile = (file: File): void => {
  if (file.size <= 0) {
    throw new AdminSiteAssetUploadError('图标文件为空，请重新选择');
  }
  if (file.size > ADMIN_SITE_FAVICON_UPLOAD_MAX_BYTES) {
    throw new AdminSiteAssetUploadError('图标超过 256KB，请压缩后再上传', 413);
  }
  if (path.extname(file.name).toLowerCase() !== '.png') {
    throw new AdminSiteAssetUploadError('站点图标当前仅支持上传 PNG 文件（SVG 请手动替换 public/favicon.svg）');
  }
  const type = file.type.trim().toLowerCase();
  if (type && type !== 'image/png' && type !== 'application/octet-stream') {
    throw new AdminSiteAssetUploadError('请选择 PNG 图片文件');
  }
};

const cleanupStaleSlotFiles = async (
  directory: string,
  slot: AdminSiteFaviconUploadSlot,
  keepFileNames: ReadonlySet<string>
): Promise<void> => {
  let entries: string[] = [];
  try {
    entries = await readdir(directory);
  } catch {
    return;
  }

  await Promise.all(
    entries
      .filter((entry) => SLOT_GENERATED_FILE_RE[slot].test(entry) && !keepFileNames.has(entry))
      .map(async (entry) => {
        try {
          await unlink(path.join(directory, entry));
        } catch (error) {
          console.warn(`[astro-whono] Failed to remove stale site asset ${entry}:`, error);
        }
      })
  );
};

export const uploadAdminSiteFavicon = async ({
  slot,
  file,
  referencedPaths = []
}: {
  slot: AdminSiteFaviconUploadSlot;
  file: File;
  /** 当前 settings 已引用的 favicon public 路径（/images/site/**），替换时跳过删除。 */
  referencedPaths?: readonly (string | null)[];
}): Promise<AdminSiteFaviconUploadResult> => {
  assertFaviconUploadFile(file);

  const buffer = Buffer.from(await file.arrayBuffer());
  const dimensions = readPngDimensions(buffer);
  if (!dimensions) {
    throw new AdminSiteAssetUploadError('文件不是合法 PNG（签名或 IHDR 校验失败）');
  }

  const { width, height } = dimensions;
  // 无服务端裁剪能力，非方形只能原样渲染；放宽 ~2%（至少 2px）容差，避免 63x64 这类导出误差被拒。
  const edgeDiff = Math.abs(width - height);
  const squareTolerance = Math.max(2, Math.round(Math.max(width, height) * 0.02));
  if (edgeDiff > squareTolerance) {
    throw new AdminSiteAssetUploadError(`站点图标必须接近正方形（宽高偏差不超过 2%），当前为 ${width}x${height}`);
  }
  if (Math.min(width, height) < ADMIN_SITE_FAVICON_MIN_EDGE || Math.max(width, height) > ADMIN_SITE_FAVICON_MAX_EDGE) {
    throw new AdminSiteAssetUploadError(
      `站点图标边长需在 ${ADMIN_SITE_FAVICON_MIN_EDGE}-${ADMIN_SITE_FAVICON_MAX_EDGE}px 之间，当前为 ${width}x${height}`
    );
  }

  // 内容哈希进文件名：路径本身即缓存戳，同内容重复上传天然幂等。
  const contentHash = createHash('sha1').update(buffer).digest('hex').slice(0, 8);
  const fileName = `${SLOT_FILE_PREFIX[slot]}${width}x${height}-${contentHash}.png`;
  const directory = path.join(getProjectRoot(), ...ADMIN_SITE_ASSET_DIR.split('/'));
  const filePath = path.join(directory, fileName);

  await mkdir(directory, { recursive: true });
  if (!existsSync(filePath)) {
    await writeFile(filePath, buffer);
  }

  const keepFileNames = new Set<string>([fileName]);
  for (const referencedPath of referencedPaths) {
    if (typeof referencedPath !== 'string') continue;
    if (!referencedPath.startsWith(`/${ADMIN_SITE_ASSET_DIR.slice('public/'.length)}/`)) continue;
    const referencedFileName = referencedPath.split('/').pop();
    if (referencedFileName) keepFileNames.add(referencedFileName);
  }
  await cleanupStaleSlotFiles(directory, slot, keepFileNames);

  return {
    path: `/${ADMIN_SITE_ASSET_DIR.slice('public/'.length)}/${fileName}`,
    fileName,
    width,
    height,
    size: buffer.length
  };
};
