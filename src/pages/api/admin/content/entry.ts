import type { APIRoute } from 'astro';
import {
  ADMIN_JSON_HEADERS,
  isAdminDryRunRequest,
  persistAdminFileTransaction,
  readAdminJsonRequestBody,
  validateAdminJsonWriteRequest
} from '../../../../lib/admin-console/admin-api';
import {
  ADMIN_CONTENT_COLLECTION_KEYS,
  AdminContentEntryResolutionError,
  applyAdminContentWritePlan,
  buildAdminContentWritePlan,
  getAdminContentReadOnlyReason,
  isAdminContentCollectionKey,
  isAdminContentWriteCollectionKey,
  readAdminContentEntryEditorPayload,
  type AdminContentValidationIssue,
  type AdminContentWriteCollectionKey
} from '../../../../lib/admin-console/content-shared';
import { withAdminContentWriteLock } from '../../../../lib/admin-console/content-write-lock';

type WriteInput = {
  collection?: AdminContentWriteCollectionKey;
  entryId?: string;
  revision?: string;
  frontmatterInput?: unknown;
  bodyInput?: string;
  errors: string[];
  issues: AdminContentValidationIssue[];
};

const JSON_HEADERS = ADMIN_JSON_HEADERS;

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

const DEV_ONLY_NOT_FOUND_RESPONSE = new Response('Not Found', { status: 404 });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const extractWriteInput = (body: unknown): WriteInput => {
  if (!isRecord(body)) {
    return {
      errors: ['请求体必须是 JSON 对象'],
      issues: [{ path: 'body', message: '请求体必须是 JSON 对象' }]
    };
  }

  const errors: string[] = [];
  const issues: AdminContentValidationIssue[] = [];
  let collection: AdminContentWriteCollectionKey | undefined;
  const rawCollection = typeof body.collection === 'string' ? body.collection.trim() : '';
  const entryId = typeof body.entryId === 'string' ? body.entryId.trim() : undefined;
  const revision = typeof body.revision === 'string' ? body.revision.trim() : undefined;
  const hasFrontmatter = hasOwn(body, 'frontmatter');
  const hasBody = hasOwn(body, 'body');

  if (!rawCollection) {
    const message = '请求体缺少 collection';
    errors.push(message);
    issues.push({ path: 'collection', message });
  } else if (!isAdminContentCollectionKey(rawCollection)) {
    const message = `不支持的 content collection：${rawCollection}；仅支持 ${ADMIN_CONTENT_COLLECTION_KEYS.join(' / ')}`;
    errors.push(message);
    issues.push({ path: 'collection', message });
  } else if (!isAdminContentWriteCollectionKey(rawCollection)) {
    const message = getAdminContentReadOnlyReason(rawCollection) ?? `当前 collection 暂不支持写盘：${rawCollection}`;
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

  if (!hasFrontmatter) {
    const message = '请求体缺少 frontmatter 字段';
    errors.push(message);
    issues.push({ path: 'frontmatter', message });
  } else if (!isRecord(body.frontmatter)) {
    const message = 'frontmatter 必须是对象';
    errors.push(message);
    issues.push({ path: 'frontmatter', message });
  }

  if (hasBody && typeof body.body !== 'string') {
    const message = 'body 必须是 Markdown 字符串';
    errors.push(message);
    issues.push({ path: 'body', message });
  }

  if (hasBody && rawCollection && rawCollection !== 'essay' && rawCollection !== 'bits') {
    const message = '当前仅 essay / bits 支持正文写盘';
    errors.push(message);
    issues.push({ path: 'body', message });
  }

  return {
    ...(collection ? { collection } : {}),
    ...(entryId ? { entryId } : {}),
    ...(revision ? { revision } : {}),
    ...(hasFrontmatter ? { frontmatterInput: body.frontmatter } : {}),
    ...(hasBody && typeof body.body === 'string' ? { bodyInput: body.body } : {}),
    errors,
    issues
  };
};

const createEntryResolutionErrorResponse = (error: unknown): Response | null => {
  if (!(error instanceof AdminContentEntryResolutionError)) return null;

  return createJsonErrorResponse(
    error.code === 'source-not-found' ? 404 : 400,
    [error.message],
    [{ path: 'entryId', message: error.message }]
  );
};

export const GET: APIRoute = async ({ url }) => {
  if (!import.meta.env.DEV && !process.env.VITEST) {
    return DEV_ONLY_NOT_FOUND_RESPONSE.clone();
  }

  const collection = url.searchParams.get('collection')?.trim() ?? '';
  const entryId = url.searchParams.get('entryId')?.trim() ?? '';

  if (!collection) {
    return createJsonErrorResponse(400, ['查询参数缺少 collection'], [{ path: 'collection', message: '查询参数缺少 collection' }]);
  }

  if (!isAdminContentCollectionKey(collection)) {
    return createJsonErrorResponse(
      400,
      [`不支持的 content collection：${collection}；仅支持 ${ADMIN_CONTENT_COLLECTION_KEYS.join(' / ')}`],
      [{ path: 'collection', message: `不支持的 content collection：${collection}` }]
    );
  }

  if (!entryId) {
    return createJsonErrorResponse(400, ['查询参数缺少 entryId'], [{ path: 'entryId', message: '查询参数缺少 entryId' }]);
  }

  try {
    const payload = await readAdminContentEntryEditorPayload(collection, entryId);
    return new Response(JSON.stringify({ ok: true, payload }, null, 2), {
      headers: JSON_HEADERS
    });
  } catch (error) {
    const errorResponse = createEntryResolutionErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
};

export const POST: APIRoute = async ({ request, url }) => {
  if (!import.meta.env.DEV && !process.env.VITEST) {
    return DEV_ONLY_NOT_FOUND_RESPONSE.clone();
  }

  const requestError = validateAdminJsonWriteRequest(request, url, 'Content Console entry');
  if (requestError) {
    return createJsonErrorResponse(requestError.status, [requestError.error]);
  }

  const bodyResult = await readAdminJsonRequestBody(request, {
    emptyBodyError: '请求体为空，请确认已发送 JSON 字符串'
  });
  if (!bodyResult.ok) {
    return createJsonErrorResponse(bodyResult.status, [bodyResult.error]);
  }

  const { collection, entryId, revision, frontmatterInput, bodyInput, errors, issues } = extractWriteInput(bodyResult.body);
  if (errors.length > 0 || !collection || !entryId || !revision) {
    return createJsonErrorResponse(400, errors, issues);
  }

  const isDryRun = isAdminDryRunRequest(url);

  return withAdminContentWriteLock(async () => {
    let currentPayload: Awaited<ReturnType<typeof readAdminContentEntryEditorPayload>>;
    try {
      currentPayload = await readAdminContentEntryEditorPayload(collection, entryId);
    } catch (error) {
      const errorResponse = createEntryResolutionErrorResponse(error);
      if (errorResponse) return errorResponse;
      throw error;
    }

    if (currentPayload.revision !== revision) {
      return new Response(
        JSON.stringify(
          {
            ok: false,
            errors: ['检测到内容文件已在外部更新，已拒绝覆盖，请刷新当前条目后再保存'],
            payload: currentPayload
          },
          null,
          2
        ),
        { status: 409, headers: JSON_HEADERS }
      );
    }

    let plan: Awaited<ReturnType<typeof buildAdminContentWritePlan>>;
    try {
      plan = await buildAdminContentWritePlan(collection, entryId, frontmatterInput, bodyInput);
    } catch (error) {
      const errorResponse = createEntryResolutionErrorResponse(error);
      if (errorResponse) return errorResponse;
      throw error;
    }

    if (plan.issues.length > 0) {
      return createJsonErrorResponse(400, Array.from(new Set(plan.issues.map((issue) => issue.message))), plan.issues);
    }

    const result = {
      changed: plan.changedFields.length > 0,
      written: false,
      changedFields: plan.changedFields,
      relativePath: currentPayload.relativePath
    };

    if (isDryRun) {
      return new Response(JSON.stringify({ ok: true, dryRun: true, result }, null, 2), {
        headers: JSON_HEADERS
      });
    }

    if (plan.changedFields.length === 0) {
      return new Response(JSON.stringify({ ok: true, result, payload: currentPayload }, null, 2), {
        headers: JSON_HEADERS
      });
    }

    try {
      const nextSourceText = applyAdminContentWritePlan(plan.state, plan.patches, plan.bodyText);
      await persistAdminFileTransaction([
        {
          id: 'entry',
          filePath: plan.state.sourcePath,
          content: nextSourceText
        }
      ]);
      const latestPayload = await readAdminContentEntryEditorPayload(collection, entryId);

      return new Response(
        JSON.stringify(
          {
            ok: true,
            result: {
              ...result,
              written: true
            },
            payload: latestPayload
          },
          null,
          2
        ),
        { headers: JSON_HEADERS }
      );
    } catch (error) {
      console.error('[astro-whono] Failed to persist admin content entry:', error);
      return new Response(
        JSON.stringify(
          {
            ok: false,
            errors: ['写入内容文件失败，请检查本地文件权限或日志'],
            result
          },
          null,
          2
        ),
        { status: 500, headers: JSON_HEADERS }
      );
    }
  });
};
