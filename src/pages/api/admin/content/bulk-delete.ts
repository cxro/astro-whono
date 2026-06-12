import type { APIRoute } from 'astro';
import {
  ADMIN_JSON_HEADERS,
  createAdminJsonErrorResponse,
  readAdminJsonRequestBody,
  validateAdminJsonWriteRequest
} from '../../../../lib/admin-console/admin-api';
import {
  createAdminContentBulkResult as createResult,
  createAdminContentBulkSummary,
  readAdminContentBulkEntriesInput,
  type AdminContentBulkEntryInput,
  type AdminContentBulkResult
} from '../../../../lib/admin-console/content-bulk';
import {
  isAdminContentCollectionKey
} from '../../../../lib/admin-console/content-collections';
import {
  AdminContentEntryResolutionError
} from '../../../../lib/admin-console/content-entry-source';
import {
  AdminContentDeleteConfirmationError,
  deleteAdminContentEntryWithConfirmation,
  getAdminContentDeleteUnsupportedReason
} from '../../../../lib/admin-console/content-delete';
import {
  isAdminContentDeletableCollectionKey
} from '../../../../lib/admin-console/content-delete-contract';
import { withAdminContentWriteLock } from '../../../../lib/admin-console/content-write-lock';

const JSON_HEADERS = ADMIN_JSON_HEADERS;
const DEV_ONLY_NOT_FOUND_RESPONSE = new Response('Not Found', { status: 404 });
const METHOD_NOT_ALLOWED_RESPONSE = new Response('Method Not Allowed', {
  status: 405,
  headers: {
    allow: 'POST',
    'cache-control': 'no-store'
  }
});

const deleteOneEntry = async (entry: AdminContentBulkEntryInput): Promise<AdminContentBulkResult> => {
  if (!isAdminContentCollectionKey(entry.collection)) {
    return createResult(entry, {
      status: 'skipped',
      errors: [`不支持的 content collection：${entry.collection}`],
      errorCodes: ['unsupported_collection']
    });
  }

  if (!isAdminContentDeletableCollectionKey(entry.collection)) {
    return createResult(entry, {
      status: 'skipped',
      errors: [getAdminContentDeleteUnsupportedReason(entry.collection) ?? `当前 collection 暂不支持删除：${entry.collection}`],
      errorCodes: ['unsupported_collection']
    });
  }

  try {
    const result = await deleteAdminContentEntryWithConfirmation(
      entry.collection,
      entry.entryId,
      entry.revision ?? '',
      entry.expectedRelativePath
    );

    return createResult(entry, {
      status: 'succeeded',
      relativePath: result.relativePath,
      trashedPath: result.trashedPath
    });
  } catch (error) {
    if (error instanceof AdminContentDeleteConfirmationError) {
      return createResult(entry, {
        status: 'failed',
        relativePath: error.payload.relativePath,
        errors: [error.message],
        errorCodes: [error.code === 'revision-conflict' ? 'revision_conflict' : 'relative_path_mismatch']
      });
    }

    if (error instanceof AdminContentEntryResolutionError) {
      return createResult(entry, {
        status: 'failed',
        errors: [error.message],
        errorCodes: [error.code === 'source-not-found' ? 'source_not_found' : 'invalid_entry_id']
      });
    }

    console.error('[astro-whono] Failed to bulk delete admin content entry:', error);
    return createResult(entry, {
      status: 'failed',
      errors: ['删除内容文件失败，请检查本地文件权限或日志'],
      errorCodes: ['delete_failed']
    });
  }
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

  const requestError = validateAdminJsonWriteRequest(request, url, 'Content Console bulk delete', '批量删除');
  if (requestError) {
    return createAdminJsonErrorResponse(requestError.status, [requestError.error]);
  }

  const bodyResult = await readAdminJsonRequestBody(request, {
    emptyBodyError: '请求体为空，请确认已发送 JSON 字符串'
  });
  if (!bodyResult.ok) {
    return createAdminJsonErrorResponse(bodyResult.status, [bodyResult.error]);
  }

  const entriesResult = readAdminContentBulkEntriesInput(bodyResult.body, { requireRevision: true });
  if (!entriesResult.ok) {
    return createAdminJsonErrorResponse(400, entriesResult.errors, entriesResult.issues);
  }

  const results = await withAdminContentWriteLock(async () => {
    const nextResults: AdminContentBulkResult[] = [];
    for (const entry of entriesResult.entries) {
      nextResults.push(await deleteOneEntry(entry));
    }
    return nextResults;
  });

  return new Response(
    JSON.stringify(
      {
        ok: true,
        summary: createAdminContentBulkSummary(entriesResult.requested, results),
        results
      },
      null,
      2
    ),
    { headers: JSON_HEADERS }
  );
};
