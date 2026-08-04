import type { APIRoute } from 'astro';
import {
  ADMIN_JSON_HEADERS,
  validateAdminFormDataWriteRequest,
  withAdminSettingsWriteLock
} from '../../../../lib/admin-console/admin-api';
import {
  AdminSiteAssetUploadError,
  isAdminSiteFaviconUploadSlot,
  uploadAdminSiteFavicon
} from '../../../../lib/admin-console/site-assets';
import { getThemeSettings, resetThemeSettingsCache } from '../../../../lib/theme-settings';

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

const withAdminSiteAssetUploadLock = withAdminSettingsWriteLock;

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

  const requestError = validateAdminFormDataWriteRequest(request, url, 'Admin site asset upload');
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

  const slot = getRequiredText(formData, 'slot');
  const file = getRequiredFile(formData, 'image');
  const errors: string[] = [];

  if (!isAdminSiteFaviconUploadSlot(slot)) {
    errors.push('站点图标当前仅支持 png / appleTouchIcon 槽位上传（SVG 请手动替换 public/favicon.svg）');
  }
  if (!file) {
    errors.push('上传请求缺少 image 文件');
  }

  if (errors.length > 0 || !file || !isAdminSiteFaviconUploadSlot(slot)) {
    return createJsonResponse(400, {
      ok: false,
      errors
    });
  }

  return withAdminSiteAssetUploadLock(async () => {
    try {
      // 临界区内重读，避免缓存快照落后于刚完成的 settings 保存。
      resetThemeSettingsCache();
      const currentFavicon = getThemeSettings().settings.site.favicon;
      const result = await uploadAdminSiteFavicon({
        slot,
        file,
        referencedPaths: [currentFavicon.svg, currentFavicon.png, currentFavicon.appleTouchIcon]
      });
      return createJsonResponse(200, {
        ok: true,
        result
      });
    } catch (error) {
      if (error instanceof AdminSiteAssetUploadError) {
        return createJsonResponse(error.status, {
          ok: false,
          errors: [error.message]
        });
      }

      console.error('[astro-whono] Failed to upload admin site asset:', error);
      return createJsonResponse(500, {
        ok: false,
        errors: ['站点图标上传失败，请检查本地文件权限或日志']
      });
    }
  });
};
