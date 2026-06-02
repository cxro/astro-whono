import type { APIRoute } from 'astro';
import {
  ADMIN_JSON_HEADERS,
  createAdminWriteQueue,
  validateAdminFormDataWriteRequest
} from '../../../../lib/admin-console/admin-api';
import {
  AdminImageUploadError,
  uploadAdminBitsImage,
  uploadAdminEssayImage
} from '../../../../lib/admin-console/image-upload';
import {
  isAdminContentWriteCollectionKey,
  type AdminContentWriteCollectionKey
} from '../../../../lib/admin-console/content-collections';

const JSON_HEADERS = ADMIN_JSON_HEADERS;
const DEV_ONLY_NOT_FOUND_RESPONSE = new Response('Not Found', { status: 404 });
const METHOD_NOT_ALLOWED_RESPONSE = new Response('Method Not Allowed', {
  status: 405,
  headers: {
    allow: 'POST',
    'cache-control': 'no-store'
  }
});

const createJsonResponse = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: JSON_HEADERS
  });

const getRequiredText = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

const getRequiredFile = (formData: FormData, key: string): File | null => {
  const value = formData.get(key);
  return value instanceof File ? value : null;
};

const withAdminImageUploadLock = createAdminWriteQueue();

const uploaders = {
  essay: uploadAdminEssayImage,
  bits: uploadAdminBitsImage
} as const satisfies Record<AdminContentWriteCollectionKey, typeof uploadAdminEssayImage>;

export const GET: APIRoute = async () => {
  if (!import.meta.env.DEV && !process.env.VITEST) {
    return DEV_ONLY_NOT_FOUND_RESPONSE.clone();
  }

  return METHOD_NOT_ALLOWED_RESPONSE.clone();
};

export const POST: APIRoute = async ({ request, url }) => {
  if (!import.meta.env.DEV && !process.env.VITEST) {
    return DEV_ONLY_NOT_FOUND_RESPONSE.clone();
  }

  const requestError = validateAdminFormDataWriteRequest(request, url, 'Admin Images upload');
  if (requestError) {
    return createJsonResponse(requestError.status, {
      ok: false,
      errors: [requestError.error]
    });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return createJsonResponse(400, {
      ok: false,
      errors: ['上传请求不是合法 multipart/form-data']
    });
  }

  const collection = getRequiredText(formData, 'collection');
  const entryId = getRequiredText(formData, 'entryId');
  const file = getRequiredFile(formData, 'image');
  const errors: string[] = [];

  if (!isAdminContentWriteCollectionKey(collection)) {
    errors.push('当前仅支持随笔正文图片或絮语配图上传');
  }
  if (!entryId) {
    errors.push('上传请求缺少 entryId');
  }
  if (!file) {
    errors.push('上传请求缺少 image 文件');
  }

  if (errors.length > 0 || !file || !isAdminContentWriteCollectionKey(collection)) {
    return createJsonResponse(400, {
      ok: false,
      errors
    });
  }

  return withAdminImageUploadLock(async () => {
    try {
      const result = await uploaders[collection]({ entryId, file });
      return createJsonResponse(200, {
        ok: true,
        result
      });
    } catch (error) {
      if (error instanceof AdminImageUploadError) {
        return createJsonResponse(error.status, {
          ok: false,
          errors: [error.message]
        });
      }

      console.error('[astro-whono] Failed to upload admin image:', error);
      return createJsonResponse(500, {
        ok: false,
        errors: ['图片上传失败，请检查本地文件权限或日志']
      });
    }
  });
};
