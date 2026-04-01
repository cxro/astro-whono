import { access, rename, rm, writeFile } from 'node:fs/promises';
import type { APIRoute } from 'astro';
import {
  applyAdminContentWritePlan,
  buildAdminContentWritePlan,
  readAdminContentEntryEditorPayload,
  type AdminContentCollectionKey
} from '../../../../lib/admin-console/content-shared';

type WriteRequestValidation = {
  status: number;
  error: string;
};

type WriteInput = {
  collection?: AdminContentCollectionKey;
  entryId?: string;
  revision?: string;
  frontmatterInput?: unknown;
  errors: string[];
};

type PersistOperation = {
  filePath: string;
  tempPath: string;
  backupPath: string;
  existed: boolean;
  committed: boolean;
  backupCreated: boolean;
};

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

const DEV_ONLY_NOT_FOUND_RESPONSE = new Response('Not Found', { status: 404 });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseHeaderOrigin = (value: string | null): string | null => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const validateAdminWriteRequest = (request: Request, currentUrl: URL): WriteRequestValidation | null => {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) {
    return {
      status: 415,
      error: '仅允许 application/json 请求写入 Content Console frontmatter'
    };
  }

  const currentOrigin = currentUrl.origin;
  const origin = parseHeaderOrigin(request.headers.get('origin'));
  const refererOrigin = parseHeaderOrigin(request.headers.get('referer'));
  const requestOrigin = origin ?? refererOrigin;

  if (!requestOrigin) {
    return {
      status: 403,
      error: '写入请求缺少来源标识，仅允许从当前开发站点同源提交'
    };
  }

  if (requestOrigin !== currentOrigin) {
    return {
      status: 403,
      error: '仅允许从当前开发站点同源写入 Content Console frontmatter'
    };
  }

  return null;
};

const isDryRunWriteRequest = (url: URL): boolean => {
  const rawValue = url.searchParams.get('dryRun')?.trim().toLowerCase();
  return rawValue === '1' || rawValue === 'true';
};

const extractWriteInput = (body: unknown): WriteInput => {
  if (!isRecord(body)) {
    return {
      errors: ['请求体必须是 JSON 对象']
    };
  }

  const errors: string[] = [];
  const collection = typeof body.collection === 'string' ? body.collection.trim() as AdminContentCollectionKey : undefined;
  const entryId = typeof body.entryId === 'string' ? body.entryId.trim() : undefined;
  const revision = typeof body.revision === 'string' ? body.revision.trim() : undefined;

  if (!collection) errors.push('请求体缺少 collection');
  if (!entryId) errors.push('请求体缺少 entryId');
  if (!revision) errors.push('请求体缺少 revision');
  if (!Object.prototype.hasOwnProperty.call(body, 'frontmatter')) {
    errors.push('请求体缺少 frontmatter 字段');
  }

  return {
    ...(collection ? { collection } : {}),
    ...(entryId ? { entryId } : {}),
    ...(revision ? { revision } : {}),
    ...(Object.prototype.hasOwnProperty.call(body, 'frontmatter') ? { frontmatterInput: body.frontmatter } : {}),
    errors
  };
};

const createTransientFilePath = (filePath: string, suffix: 'tmp' | 'bak'): string =>
  `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.${suffix}`;

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const persistContentWrite = async (filePath: string, sourceText: string): Promise<void> => {
  const operation: PersistOperation = {
    filePath,
    tempPath: createTransientFilePath(filePath, 'tmp'),
    backupPath: createTransientFilePath(filePath, 'bak'),
    existed: await fileExists(filePath),
    committed: false,
    backupCreated: false
  };

  await writeFile(operation.tempPath, sourceText, 'utf8');

  try {
    if (operation.existed) {
      await rename(operation.filePath, operation.backupPath);
      operation.backupCreated = true;
    }

    await rename(operation.tempPath, operation.filePath);
    operation.committed = true;

    if (operation.backupCreated) {
      await rm(operation.backupPath, { force: true });
    }
  } catch (error) {
    try {
      if (operation.committed) {
        await rm(operation.filePath, { force: true });
      }
      if (operation.backupCreated) {
        await rename(operation.backupPath, operation.filePath);
      }
    } catch {}

    await rm(operation.tempPath, { force: true }).catch(() => {});
    throw error;
  }
};

let adminContentWriteLock: Promise<void> = Promise.resolve();

const withAdminContentWriteLock = async <T>(task: () => Promise<T>): Promise<T> => {
  const previousLock = adminContentWriteLock;
  let releaseLock!: () => void;
  adminContentWriteLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  await previousLock;
  try {
    return await task();
  } finally {
    releaseLock();
  }
};

export const POST: APIRoute = async ({ request, url }) => {
  if (!import.meta.env.DEV && !process.env.VITEST) {
    return DEV_ONLY_NOT_FOUND_RESPONSE.clone();
  }

  const requestError = validateAdminWriteRequest(request, url);
  if (requestError) {
    return new Response(JSON.stringify({ ok: false, errors: [requestError.error] }, null, 2), {
      status: requestError.status,
      headers: JSON_HEADERS
    });
  }

  const rawBody = await request.text();
  if (!rawBody.trim()) {
    return new Response(JSON.stringify({ ok: false, errors: ['请求体为空，请确认已发送 JSON 字符串'] }, null, 2), {
      status: 400,
      headers: JSON_HEADERS
    });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ ok: false, errors: ['请求体不是合法 JSON'] }, null, 2), {
      status: 400,
      headers: JSON_HEADERS
    });
  }

  const { collection, entryId, revision, frontmatterInput, errors } = extractWriteInput(body);
  if (errors.length > 0 || !collection || !entryId || !revision) {
    return new Response(JSON.stringify({ ok: false, errors }, null, 2), {
      status: 400,
      headers: JSON_HEADERS
    });
  }

  const isDryRun = isDryRunWriteRequest(url);

  return withAdminContentWriteLock(async () => {
    const currentPayload = await readAdminContentEntryEditorPayload(collection, entryId);
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

    const plan = await buildAdminContentWritePlan(collection, entryId, frontmatterInput);
    if (plan.issues.length > 0) {
      return new Response(
        JSON.stringify(
          {
            ok: false,
            errors: Array.from(new Set(plan.issues.map((issue) => issue.message))),
            issues: plan.issues
          },
          null,
          2
        ),
        { status: 400, headers: JSON_HEADERS }
      );
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
      const nextSourceText = applyAdminContentWritePlan(plan.state, plan.patches);
      await persistContentWrite(plan.state.sourcePath, nextSourceText);
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
      console.error('[astro-whono] Failed to persist admin content frontmatter:', error);
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
