import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  AdminContentEntryResolutionError,
  resolveAdminContentEntrySourcePath
} from './content-shared';
import {
  invalidateAdminImageCaches,
  readAdminLocalImageInspectionMeta
} from './image-shared';
import { getAdminImageFieldValue } from './image-params';

export type AdminImageUploadResult = {
  src: string;
  path: string;
  fileName: string;
  width: number | null;
  height: number | null;
  size: number | null;
  mimeType: string | null;
};

export class AdminImageUploadError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'AdminImageUploadError';
    this.status = status;
  }
}

const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpg', '.jpeg', '.png', '.svg', '.webp']);
const ADMIN_IMAGE_UPLOAD_MAX_BYTES = 12 * 1024 * 1024;

const getProjectRoot = (): string => process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT?.trim() || process.cwd();

const toRelativeProjectPath = (filePath: string): string =>
  path.relative(getProjectRoot(), filePath).replace(/\\/g, '/');

const normalizeFileBaseName = (value: string): string => {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return normalized || 'image';
};

const getSafeImageFileName = (fileName: string): string => {
  const extension = path.extname(fileName).toLowerCase();
  if (!SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    throw new AdminImageUploadError('仅支持 avif / gif / jpg / jpeg / png / svg / webp 图片');
  }

  const baseName = normalizeFileBaseName(path.basename(fileName, path.extname(fileName)));
  return `${baseName}${extension}`;
};

const assertUploadFile = (file: File): void => {
  if (file.size <= 0) {
    throw new AdminImageUploadError('图片文件为空，请重新选择');
  }

  if (file.size > ADMIN_IMAGE_UPLOAD_MAX_BYTES) {
    throw new AdminImageUploadError('图片超过 12MB，请压缩后再上传', 413);
  }

  const type = file.type.trim().toLowerCase();
  if (type && !type.startsWith('image/') && type !== 'application/octet-stream') {
    throw new AdminImageUploadError('请选择图片文件');
  }
};

const resolveEssayUploadDirectory = (sourcePath: string): string => {
  const parsed = path.parse(sourcePath);
  return parsed.name === 'index'
    ? path.join(parsed.dir, 'assets')
    : path.join(parsed.dir, `${parsed.name}-assets`);
};

const resolveBitsUploadDirectory = (): string => path.join(getProjectRoot(), 'public', 'bits');

const toMarkdownRelativeImageSrc = (sourcePath: string, assetPath: string): string => {
  const relative = path.relative(path.dirname(sourcePath), assetPath).replace(/\\/g, '/');
  return relative.startsWith('.') ? relative : `./${relative}`;
};

const createCandidateFileName = (safeFileName: string, index: number): string => {
  if (index <= 1) return safeFileName;
  const extension = path.extname(safeFileName);
  const baseName = safeFileName.slice(0, -extension.length);
  return `${baseName}-${index}${extension}`;
};

const writeUniqueImageFile = async (
  directory: string,
  safeFileName: string,
  buffer: Buffer
): Promise<string> => {
  await mkdir(directory, { recursive: true });

  for (let index = 1; index <= 999; index += 1) {
    const candidatePath = path.join(directory, createCandidateFileName(safeFileName, index));
    if (existsSync(candidatePath)) continue;

    try {
      await writeFile(candidatePath, buffer, { flag: 'wx' });
      return candidatePath;
    } catch (error) {
      if (isRecord(error) && error.code === 'EEXIST') continue;
      throw error;
    }
  }

  throw new AdminImageUploadError('无法生成可用文件名，请重命名图片后再上传', 409);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const uploadAdminEssayImage = async ({
  entryId,
  file
}: {
  entryId: string;
  file: File;
}): Promise<AdminImageUploadResult> => {
  assertUploadFile(file);

  let sourcePath: string;
  try {
    sourcePath = resolveAdminContentEntrySourcePath('essay', entryId);
  } catch (error) {
    if (error instanceof AdminContentEntryResolutionError) {
      throw new AdminImageUploadError(error.message, error.code === 'source-not-found' ? 404 : 400);
    }
    throw error;
  }

  const safeFileName = getSafeImageFileName(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const assetPath = await writeUniqueImageFile(resolveEssayUploadDirectory(sourcePath), safeFileName, buffer);
  const relativePath = toRelativeProjectPath(assetPath);

  invalidateAdminImageCaches();
  const meta = await readAdminLocalImageInspectionMeta(relativePath);
  invalidateAdminImageCaches();

  return {
    src: toMarkdownRelativeImageSrc(sourcePath, assetPath),
    path: relativePath,
    fileName: path.basename(assetPath),
    width: meta.width,
    height: meta.height,
    size: meta.size,
    mimeType: meta.mimeType ?? (file.type.trim() || null)
  };
};

export const uploadAdminBitsImage = async ({
  entryId,
  file
}: {
  entryId: string;
  file: File;
}): Promise<AdminImageUploadResult> => {
  assertUploadFile(file);

  try {
    resolveAdminContentEntrySourcePath('bits', entryId);
  } catch (error) {
    if (error instanceof AdminContentEntryResolutionError) {
      throw new AdminImageUploadError(error.message, error.code === 'source-not-found' ? 404 : 400);
    }
    throw error;
  }

  const safeFileName = getSafeImageFileName(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const assetPath = await writeUniqueImageFile(resolveBitsUploadDirectory(), safeFileName, buffer);
  const relativePath = toRelativeProjectPath(assetPath);
  const src = getAdminImageFieldValue('bits.images', relativePath, 'public');
  if (!src) {
    throw new AdminImageUploadError('无法生成 bits.images 可保存的图片路径');
  }

  invalidateAdminImageCaches();
  const meta = await readAdminLocalImageInspectionMeta(relativePath);
  invalidateAdminImageCaches();

  return {
    src,
    path: relativePath,
    fileName: path.basename(assetPath),
    width: meta.width,
    height: meta.height,
    size: meta.size,
    mimeType: meta.mimeType ?? (file.type.trim() || null)
  };
};
