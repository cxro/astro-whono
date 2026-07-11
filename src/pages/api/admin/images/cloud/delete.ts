import type { APIRoute } from 'astro';
import {
  ADMIN_JSON_HEADERS,
  createAdminWriteQueue,
  readAdminJsonRequestBody,
  validateAdminJsonWriteRequest
} from '../../../../../lib/admin-console/admin-api';
import { deleteAdminCloudStorageImage } from '../../../../../lib/admin-console/image-cloud-storage';
import { AdminImageUploadError } from '../../../../../lib/admin-console/image-upload-error';
import { invalidateAdminImageCaches } from '../../../../../lib/admin-console/image-shared';

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

const withAdminCloudImageDeleteLock = createAdminWriteQueue();

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

  const requestError = validateAdminJsonWriteRequest(request, url, 'Admin Images cloud delete', '删除');
  if (requestError) {
    return createJsonResponse(requestError.status, {
      ok: false,
      errors: [requestError.error]
    });
  }

  const bodyResult = await readAdminJsonRequestBody(request, {
    emptyBodyError: '删除请求缺少 JSON 请求体'
  });
  if (!bodyResult.ok) {
    return createJsonResponse(bodyResult.status, {
      ok: false,
      errors: [bodyResult.error]
    });
  }

  const key = typeof bodyResult.body === 'object'
    && bodyResult.body !== null
    && 'key' in bodyResult.body
    && typeof bodyResult.body.key === 'string'
    ? bodyResult.body.key.trim()
    : '';
  if (!key) {
    return createJsonResponse(400, {
      ok: false,
      errors: ['删除请求缺少云端图片 key']
    });
  }

  return withAdminCloudImageDeleteLock(async () => {
    try {
      await deleteAdminCloudStorageImage(key);
      invalidateAdminImageCaches();
      return createJsonResponse(200, {
        ok: true,
        result: { key }
      });
    } catch (error) {
      if (error instanceof AdminImageUploadError) {
        return createJsonResponse(error.status, {
          ok: false,
          errors: [error.message]
        });
      }

      console.error('[astro-whono] Failed to delete cloud image:', error);
      return createJsonResponse(500, {
        ok: false,
        errors: ['云端图片删除失败，请检查 R2 权限或日志']
      });
    }
  });
};
