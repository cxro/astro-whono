import { access, rename, rm, writeFile } from 'node:fs/promises';
import type { AdminContentValidationIssue } from './content-entry-contract';

export type AdminWriteRequestValidation = {
  status: number;
  error: string;
};

export type AdminJsonRequestBodyResult =
  | {
      ok: true;
      body: unknown;
    }
  | {
      ok: false;
      status: 400;
      error: string;
    };

export type AdminFileTransactionEntry<TId extends string = string> = {
  id: TId;
  filePath: string;
  content: string;
};

type AdminFileTransactionOperation<TId extends string> = AdminFileTransactionEntry<TId> & {
  tempPath: string;
  backupPath: string;
  existed: boolean;
  committed: boolean;
  backupCreated: boolean;
};

export const ADMIN_JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

export const createAdminJsonErrorResponse = (
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
      headers: ADMIN_JSON_HEADERS
    }
  );

const parseHeaderOrigin = (value: string | null): string | null => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
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

export const validateAdminJsonWriteRequest = (
  request: Request,
  currentUrl: URL,
  targetLabel: string,
  actionLabel = '写入'
): AdminWriteRequestValidation | null => {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) {
    return {
      status: 415,
      error: `仅允许 application/json 请求${actionLabel} ${targetLabel}`
    };
  }

  const currentOrigin = currentUrl.origin;
  const origin = parseHeaderOrigin(request.headers.get('origin'));
  const refererOrigin = parseHeaderOrigin(request.headers.get('referer'));
  const requestOrigin = origin ?? refererOrigin;

  if (!requestOrigin) {
    return {
      status: 403,
      error: `${actionLabel}请求缺少来源标识，仅允许从当前开发站点同源提交`
    };
  }

  if (requestOrigin !== currentOrigin) {
    return {
      status: 403,
      error: `仅允许从当前开发站点同源${actionLabel} ${targetLabel}`
    };
  }

  return null;
};

export const validateAdminFormDataWriteRequest = (
  request: Request,
  currentUrl: URL,
  targetLabel: string,
  actionLabel = '上传'
): AdminWriteRequestValidation | null => {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return {
      status: 415,
      error: `仅允许 multipart/form-data 请求${actionLabel} ${targetLabel}`
    };
  }

  const currentOrigin = currentUrl.origin;
  const origin = parseHeaderOrigin(request.headers.get('origin'));
  const refererOrigin = parseHeaderOrigin(request.headers.get('referer'));
  const requestOrigin = origin ?? refererOrigin;

  if (!requestOrigin) {
    return {
      status: 403,
      error: `${actionLabel}请求缺少来源标识，仅允许从当前开发站点同源提交`
    };
  }

  if (requestOrigin !== currentOrigin) {
    return {
      status: 403,
      error: `仅允许从当前开发站点同源${actionLabel} ${targetLabel}`
    };
  }

  return null;
};

export const isAdminDryRunRequest = (url: URL): boolean => {
  const rawValue = url.searchParams.get('dryRun')?.trim().toLowerCase();
  return rawValue === '1' || rawValue === 'true';
};

export const readAdminJsonRequestBody = async (
  request: Request,
  {
    emptyBodyError,
    parseTrimmedBody = false
  }: {
    emptyBodyError: string;
    parseTrimmedBody?: boolean;
  }
): Promise<AdminJsonRequestBodyResult> => {
  const rawBody = await request.text();
  const trimmedBody = rawBody.trim();
  if (!trimmedBody) {
    return {
      ok: false,
      status: 400,
      error: emptyBodyError
    };
  }

  try {
    return {
      ok: true,
      body: JSON.parse(parseTrimmedBody ? trimmedBody : rawBody) as unknown
    };
  } catch {
    return {
      ok: false,
      status: 400,
      error: '请求体不是合法 JSON'
    };
  }
};

export const createAdminWriteQueue = (): (<T>(task: () => Promise<T>) => Promise<T>) => {
  let writeLock: Promise<void> = Promise.resolve();

  return async <T>(task: () => Promise<T>): Promise<T> => {
    const previousLock = writeLock;
    let releaseLock!: () => void;
    writeLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    await previousLock;
    try {
      return await task();
    } finally {
      releaseLock();
    }
  };
};

export const persistAdminFileTransaction = async <TId extends string>(
  entries: readonly AdminFileTransactionEntry<TId>[],
  options: {
    beforeWrite?: () => Promise<void>;
  } = {}
): Promise<TId[]> => {
  if (entries.length === 0) return [];

  await options.beforeWrite?.();

  const operations: AdminFileTransactionOperation<TId>[] = [];
  try {
    for (const entry of entries) {
      const tempPath = createTransientFilePath(entry.filePath, 'tmp');
      await writeFile(tempPath, entry.content, 'utf8');
      operations.push({
        ...entry,
        tempPath,
        backupPath: createTransientFilePath(entry.filePath, 'bak'),
        existed: await fileExists(entry.filePath),
        committed: false,
        backupCreated: false
      });
    }

    for (const operation of operations) {
      if (operation.existed) {
        await rename(operation.filePath, operation.backupPath);
        operation.backupCreated = true;
      }
      await rename(operation.tempPath, operation.filePath);
      operation.committed = true;
    }

    await Promise.all(
      operations
        .filter((operation) => operation.backupCreated)
        .map((operation) => rm(operation.backupPath, { force: true }))
    );

    return operations.map((operation) => operation.id);
  } catch (error) {
    for (const operation of [...operations].reverse()) {
      try {
        if (operation.committed) {
          await rm(operation.filePath, { force: true });
          if (operation.backupCreated) {
            await rename(operation.backupPath, operation.filePath);
          }
        } else if (operation.backupCreated) {
          await rename(operation.backupPath, operation.filePath);
        }
      } catch {}

      await rm(operation.tempPath, { force: true }).catch(() => {});
    }

    throw error;
  }
};
