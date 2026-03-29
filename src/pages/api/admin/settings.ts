import { existsSync } from 'node:fs';
import { access, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { APIRoute } from 'astro';
import {
  getEditableThemeSettingsState,
  getThemeSettings,
  getThemeSettingsDir,
  getThemeSettingsFilePath,
  resetThemeSettingsCache,
  type EditableThemeSettings,
  type ThemeSettingsFileGroup
} from '../../../lib/theme-settings';
import {
  canonicalizeAdminThemeSettings,
  createAdminThemeSettingsCanonicalMismatchIssues,
  createAdminWritableThemeSettingsGroups,
  getAdminFooterStartYearMax,
  validateAdminThemeSettings
} from '../../../lib/admin-console/shared';

const WRITABLE_GROUPS = ['site', 'shell', 'home', 'page', 'ui'] as const satisfies readonly ThemeSettingsFileGroup[];
type WritableGroup = (typeof WRITABLE_GROUPS)[number];

type PersistEntry = {
  group: WritableGroup;
  filePath: string;
  data: unknown;
};

type PersistOperation = PersistEntry & {
  tempPath: string;
  backupPath: string;
  existed: boolean;
  committed: boolean;
  backupCreated: boolean;
};

type WriteRequestValidation = {
  status: number;
  error: string;
};

type WriteResult = {
  changed: boolean;
  written: boolean;
};

type WriteInput = {
  revision?: string;
  settingsInput?: unknown;
  errors: string[];
};

const FOOTER_START_YEAR_MAX = getAdminFooterStartYearMax();

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

const DEV_ONLY_NOT_FOUND_RESPONSE = new Response('Not Found', { status: 404 });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const createJsonBody = (data: unknown): string => `${JSON.stringify(data, null, 2)}\n`;

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

const hasProjectFile = (relativePath: string): boolean => existsSync(join(process.cwd(), relativePath));

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
      error: 'Only application/json requests are allowed to write Theme Console settings'
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
      error: '仅允许从当前开发站点同源写入 Theme Console 配置'
    };
  }

  return null;
};

const isDryRunWriteRequest = (url: URL): boolean => {
  const rawValue = url.searchParams.get('dryRun')?.trim().toLowerCase();
  return rawValue === '1' || rawValue === 'true';
};

const createResults = (changedGroups: readonly WritableGroup[]): Record<WritableGroup, WriteResult> => {
  const changedSet = new Set(changedGroups);
  return {
    site: { changed: changedSet.has('site'), written: false },
    shell: { changed: changedSet.has('shell'), written: false },
    home: { changed: changedSet.has('home'), written: false },
    page: { changed: changedSet.has('page'), written: false },
    ui: { changed: changedSet.has('ui'), written: false }
  };
};

const extractWriteInput = (body: unknown): WriteInput => {
  if (!isRecord(body)) {
    return {
      errors: ['请求体必须是 JSON 对象']
    };
  }

  const errors: string[] = [];
  const revision = typeof body.revision === 'string' ? body.revision.trim() : '';
  if (!revision) {
    errors.push('请求体缺少 revision');
  }

  if (!Object.prototype.hasOwnProperty.call(body, 'settings')) {
    errors.push('请求体缺少 settings 字段');
  }

  return {
    ...(revision ? { revision } : {}),
    ...(Object.prototype.hasOwnProperty.call(body, 'settings') ? { settingsInput: body.settings } : {}),
    errors
  };
};

const createPersistEntries = (
  groups: ReturnType<typeof createAdminWritableThemeSettingsGroups>,
  writtenGroups: readonly WritableGroup[]
): PersistEntry[] =>
  writtenGroups.map((group) => ({
    group,
    filePath: getThemeSettingsFilePath(group),
    data: groups[group]
  }));

const persistSettingsTransaction = async (entries: PersistEntry[]): Promise<WritableGroup[]> => {
  if (entries.length === 0) return [];

  await mkdir(getThemeSettingsDir(), { recursive: true });

  const operations: PersistOperation[] = [];
  for (const entry of entries) {
    const tempPath = createTransientFilePath(entry.filePath, 'tmp');
    await writeFile(tempPath, createJsonBody(entry.data), 'utf8');
    operations.push({
      ...entry,
      tempPath,
      backupPath: createTransientFilePath(entry.filePath, 'bak'),
      existed: await fileExists(entry.filePath),
      committed: false,
      backupCreated: false
    });
  }

  try {
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

    return operations.map((operation) => operation.group);
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

// DEV 后台保存是低频操作，串行化写入可保证 revision 校验与实际提交处于同一临界区。
let adminSettingsWriteLock: Promise<void> = Promise.resolve();

const withAdminSettingsWriteLock = async <T>(task: () => Promise<T>): Promise<T> => {
  const previousLock = adminSettingsWriteLock;
  let releaseLock!: () => void;
  adminSettingsWriteLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  await previousLock;
  try {
    return await task();
  } finally {
    releaseLock();
  }
};

const validateIncomingSettingsSnapshot = (
  settingsInput: unknown
): { canonicalSettings?: EditableThemeSettings; errors: string[] } => {
  if (!isRecord(settingsInput)) {
    return {
      errors: ['settings 必须是 JSON 对象']
    };
  }

  const canonicalSettings = canonicalizeAdminThemeSettings(settingsInput, {
    footerStartYearMax: FOOTER_START_YEAR_MAX
  });
  const issues = [
    ...validateAdminThemeSettings(canonicalSettings, {
      footerStartYearMax: FOOTER_START_YEAR_MAX,
      localFileExists: hasProjectFile
    }),
    ...createAdminThemeSettingsCanonicalMismatchIssues(settingsInput, canonicalSettings, {
      mode: 'exact',
      messagePrefix: '配置必须以完整 canonical snapshot 提交'
    })
  ];

  return {
    canonicalSettings,
    errors: Array.from(new Set(issues.map((issue) => issue.message)))
  };
};

const getChangedGroups = (
  currentSettings: EditableThemeSettings,
  nextSettings: EditableThemeSettings
): {
  nextGroups: ReturnType<typeof createAdminWritableThemeSettingsGroups>;
  changedGroups: WritableGroup[];
} => {
  const currentGroups = createAdminWritableThemeSettingsGroups(currentSettings);
  const nextGroups = createAdminWritableThemeSettingsGroups(nextSettings);
  const changedGroups = WRITABLE_GROUPS.filter(
    (group) => JSON.stringify(currentGroups[group]) !== JSON.stringify(nextGroups[group])
  );

  return {
    nextGroups,
    changedGroups
  };
};

export const GET: APIRoute = async () => {
  if (!import.meta.env.DEV) {
    return DEV_ONLY_NOT_FOUND_RESPONSE.clone();
  }

  const payload = getEditableThemeSettingsState();
  return new Response(JSON.stringify(payload, null, 2), {
    status: payload.ok === false ? 500 : 200,
    headers: JSON_HEADERS
  });
};

export const POST: APIRoute = async ({ request, url }) => {
  if (!import.meta.env.DEV) {
    return DEV_ONLY_NOT_FOUND_RESPONSE.clone();
  }

  const isDryRun = isDryRunWriteRequest(url);
  const requestError = validateAdminWriteRequest(request, url);
  if (requestError) {
    return new Response(
      JSON.stringify(
        {
          ok: false,
          errors: [requestError.error],
          results: createResults([])
        },
        null,
        2
      ),
      { status: requestError.status, headers: JSON_HEADERS }
    );
  }

  const rawBody = await request.text();
  const trimmedBody = rawBody.trim();
  if (!trimmedBody) {
    return new Response(
      JSON.stringify(
        {
          ok: false,
          errors: ['请求体为空，请确认前端请求地址未发生重定向且已发送 JSON 字符串']
        },
        null,
        2
      ),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(trimmedBody);
  } catch {
    return new Response(JSON.stringify({ ok: false, errors: ['请求体不是合法 JSON'] }, null, 2), {
      status: 400,
      headers: JSON_HEADERS
    });
  }

  const { revision, settingsInput, errors: writeInputErrors } = extractWriteInput(body);
  if (writeInputErrors.length > 0 || !revision) {
    return new Response(
      JSON.stringify(
        {
          ok: false,
          errors: writeInputErrors,
          results: createResults([])
        },
        null,
        2
      ),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  return withAdminSettingsWriteLock(async () => {
    const currentResolved = getThemeSettings();
    const editableState = getEditableThemeSettingsState(currentResolved);
    if (!editableState.ok) {
      return new Response(JSON.stringify(editableState, null, 2), {
        status: 409,
        headers: JSON_HEADERS
      });
    }

    if (revision !== editableState.payload.revision) {
      resetThemeSettingsCache();
      const latestResolved = getThemeSettings();
      const latestEditableState = getEditableThemeSettingsState(latestResolved);
      if (!latestEditableState.ok) {
        return new Response(JSON.stringify(latestEditableState, null, 2), {
          status: 409,
          headers: JSON_HEADERS
        });
      }

      return new Response(
        JSON.stringify(
          {
            ok: false,
            errors: ['检测到配置已在外部更新，已拒绝覆盖并同步最新配置，请确认后再保存'],
            results: createResults([]),
            payload: latestEditableState.payload
          },
          null,
          2
        ),
        { status: 409, headers: JSON_HEADERS }
      );
    }

    const { canonicalSettings, errors } = validateIncomingSettingsSnapshot(settingsInput);
    if (!canonicalSettings || errors.length > 0) {
      return new Response(
        JSON.stringify(
          {
            ok: false,
            errors,
            results: createResults([])
          },
          null,
          2
        ),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    const { nextGroups, changedGroups } = getChangedGroups(editableState.payload.settings, canonicalSettings);
    const results = createResults(changedGroups);

    if (isDryRun) {
      return new Response(
        JSON.stringify(
          {
            ok: true,
            dryRun: true,
            results
          },
          null,
          2
        ),
        { headers: JSON_HEADERS }
      );
    }

    if (changedGroups.length === 0) {
      return new Response(
        JSON.stringify(
          {
            ok: true,
            results,
            payload: editableState.payload
          },
          null,
          2
        ),
        { headers: JSON_HEADERS }
      );
    }

    const entries = createPersistEntries(nextGroups, changedGroups);

    try {
      const committedGroups = await persistSettingsTransaction(entries);
      for (const group of committedGroups) {
        results[group].written = true;
      }

      resetThemeSettingsCache();
      const latestResolved = getThemeSettings();
      const latestEditableState = getEditableThemeSettingsState(latestResolved);
      if (!latestEditableState.ok) {
        console.error('[astro-whono] Settings persisted but failed to reload editable payload:', latestEditableState);
        return new Response(
          JSON.stringify(
            {
              ok: false,
              errors: ['配置文件已写入，但重新读取 settings JSON 失败，请先修复损坏文件后再刷新后台'],
              results
            },
            null,
            2
          ),
          { status: 500, headers: JSON_HEADERS }
        );
      }

      return new Response(
        JSON.stringify(
          {
            ok: true,
            results,
            payload: latestEditableState.payload
          },
          null,
          2
        ),
        { headers: JSON_HEADERS }
      );
    } catch (error) {
      console.error('[astro-whono] Failed to persist admin settings:', error);
      return new Response(
        JSON.stringify(
          {
            ok: false,
            errors: ['写入配置文件失败，请检查本地文件权限或日志'],
            results
          },
          null,
          2
        ),
        { status: 500, headers: JSON_HEADERS }
      );
    }
  });
};
