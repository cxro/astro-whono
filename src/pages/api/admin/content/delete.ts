import type { APIRoute } from 'astro';
import {
  ADMIN_JSON_HEADERS,
  readAdminJsonRequestBody,
  validateAdminJsonWriteRequest
} from '../../../../lib/admin-console/admin-api';
import {
  ADMIN_CONTENT_COLLECTION_KEYS,
  isAdminContentCollectionKey
} from '../../../../lib/admin-console/content-collections';
import type { AdminContentValidationIssue } from '../../../../lib/admin-console/content-entry-contract';
import {
  AdminContentEntryResolutionError
} from '../../../../lib/admin-console/content-entry-source';
import {
  AdminContentDeleteConfirmationError,
  deleteAdminContentEntryWithConfirmation,
  getAdminContentDeleteUnsupportedReason
} from '../../../../lib/admin-console/content-delete';
import {
  isAdminContentDeletableCollectionKey,
  type AdminContentDeletableCollectionKey
} from '../../../../lib/admin-console/content-delete-contract';
import { withAdminContentWriteLock } from '../../../../lib/admin-console/content-write-lock';

type DeleteInput = {
  collection?: AdminContentDeletableCollectionKey;
  entryId?: string;
  revision?: string;
  expectedRelativePath?: string;
  errors: string[];
  issues: AdminContentValidationIssue[];
};

const JSON_HEADERS = ADMIN_JSON_HEADERS;
const DEV_ONLY_NOT_FOUND_RESPONSE = new Response('Not Found', { status: 404 });
const METHOD_NOT_ALLOWED_RESPONSE = new Response('Method Not Allowed', {
  status: 405,
  headers: {
    allow: 'POST',
    'cache-control': 'no-store'
  }
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const createJsonErrorResponse = (
  status: number,
  errors: readonly string[],
  issues: readonly AdminContentValidationIssue[] = []
): Response =>
  new Response(
    JSON.stringify(
      {
        ok: false,
        errors,
        ...(issues.length > 0 ? { issues } : {})
      },
      null,
      2
    ),
    {
      status,
      headers: JSON_HEADERS
    }
  );

const createEntryResolutionErrorResponse = (error: unknown): Response | null => {
  if (!(error instanceof AdminContentEntryResolutionError)) return null;

  return createJsonErrorResponse(
    error.code === 'source-not-found' ? 404 : 400,
    [error.message],
    [{ path: 'entryId', message: error.message }]
  );
};

const extractDeleteInput = (body: unknown): DeleteInput => {
  if (!isRecord(body)) {
    return {
      errors: ['请求体必须是 JSON 对象'],
      issues: [{ path: 'body', message: '请求体必须是 JSON 对象' }]
    };
  }

  const errors: string[] = [];
  const issues: AdminContentValidationIssue[] = [];
  const rawCollection = typeof body.collection === 'string' ? body.collection.trim() : '';
  const entryId = typeof body.entryId === 'string' ? body.entryId.trim() : undefined;
  const revision = typeof body.revision === 'string' ? body.revision.trim() : undefined;
  const expectedRelativePath = typeof body.expectedRelativePath === 'string'
    ? body.expectedRelativePath.trim()
    : undefined;
  let collection: AdminContentDeletableCollectionKey | undefined;

  if (!rawCollection) {
    const message = '请求体缺少 collection';
    errors.push(message);
    issues.push({ path: 'collection', message });
  } else if (!isAdminContentCollectionKey(rawCollection)) {
    const message = `不支持的 content collection：${rawCollection}；仅支持 ${ADMIN_CONTENT_COLLECTION_KEYS.join(' / ')}`;
    errors.push(message);
    issues.push({ path: 'collection', message });
  } else if (!isAdminContentDeletableCollectionKey(rawCollection)) {
    const message = getAdminContentDeleteUnsupportedReason(rawCollection) ?? `当前 collection 暂不支持删除：${rawCollection}`;
    errors.push(message);
    issues.push({ path: 'collection', message });
  } else {
    collection = rawCollection;
  }

  if (!entryId) {
    const message = '请求体缺少 entryId';
    errors.push(message);
    issues.push({ path: 'entryId', message });
  }

  if (!revision) {
    const message = '请求体缺少 revision';
    errors.push(message);
    issues.push({ path: 'revision', message });
  }

  if (!expectedRelativePath) {
    const message = '请求体缺少 expectedRelativePath';
    errors.push(message);
    issues.push({ path: 'expectedRelativePath', message });
  }

  return {
    ...(collection ? { collection } : {}),
    ...(entryId ? { entryId } : {}),
    ...(revision ? { revision } : {}),
    ...(expectedRelativePath ? { expectedRelativePath } : {}),
    errors,
    issues
  };
};

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

  const requestError = validateAdminJsonWriteRequest(request, url, 'Content Console entry', '删除');
  if (requestError) {
    return createJsonErrorResponse(requestError.status, [requestError.error]);
  }

  const bodyResult = await readAdminJsonRequestBody(request, {
    emptyBodyError: '请求体为空，请确认已发送 JSON 字符串'
  });
  if (!bodyResult.ok) {
    return createJsonErrorResponse(bodyResult.status, [bodyResult.error]);
  }

  const { collection, entryId, revision, expectedRelativePath, errors, issues } = extractDeleteInput(bodyResult.body);
  if (errors.length > 0 || !collection || !entryId || !revision || !expectedRelativePath) {
    return createJsonErrorResponse(400, errors, issues);
  }

  return withAdminContentWriteLock(async () => {
    try {
      const result = await deleteAdminContentEntryWithConfirmation(collection, entryId, revision, expectedRelativePath);
      return new Response(
        JSON.stringify(
          {
            ok: true,
            result
          },
          null,
          2
        ),
        { headers: JSON_HEADERS }
      );
    } catch (error) {
      if (error instanceof AdminContentDeleteConfirmationError) {
        return new Response(
          JSON.stringify(
            {
              ok: false,
              errors: [error.message],
              payload: error.payload
            },
            null,
            2
          ),
          { status: 409, headers: JSON_HEADERS }
        );
      }

      const errorResponse = createEntryResolutionErrorResponse(error);
      if (errorResponse) return errorResponse;

      console.error('[astro-whono] Failed to delete admin content entry:', error);
      return createJsonErrorResponse(500, ['删除内容文件失败，请检查本地文件权限或日志']);
    }
  });
};
