import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { APIRoute } from 'astro';
import {
  ADMIN_JSON_HEADERS,
  isAdminDryRunRequest,
  persistAdminFileTransaction,
  readAdminJsonRequestBody,
  validateAdminJsonWriteRequest,
  withAdminSettingsWriteLock,
  type AdminFileTransactionEntry
} from '../../../lib/admin-console/admin-api';
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
  getAdminThemeSettingsChangePreviews,
  createAdminThemeSettingsCanonicalMismatchIssues,
  createAdminWritableThemeSettingsGroups,
  fillAdminThemeSettingsCompatibilityDefaults,
  getAdminFooterStartYearMax,
  getAdminThemeSettingsMismatchPaths,
  validateAdminThemeSettings,
  type AdminThemeSettingsChangePreview
} from '../../../lib/admin-console/theme-shared';

const WRITABLE_GROUPS = ['site', 'shell', 'home', 'page', 'ui'] as const satisfies readonly ThemeSettingsFileGroup[];
type WritableGroup = (typeof WRITABLE_GROUPS)[number];

type WriteResult = {
  changed: boolean;
  written: boolean;
  changedCount: number;
  changedPaths: string[];
  changes: AdminThemeSettingsChangePreview[];
};

type WriteInput = {
  revision?: string;
  settingsInput?: unknown;
  errors: string[];
};

const FOOTER_START_YEAR_MAX = getAdminFooterStartYearMax();

const JSON_HEADERS = ADMIN_JSON_HEADERS;

const DEV_ONLY_NOT_FOUND_RESPONSE = new Response('Not Found', { status: 404 });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const createJsonBody = (data: unknown): string => `${JSON.stringify(data, null, 2)}\n`;

const hasProjectFile = (relativePath: string): boolean => existsSync(join(process.cwd(), relativePath));

type WriteResultDetail = {
  changedCount: number;
  changedPaths: string[];
  changes: AdminThemeSettingsChangePreview[];
};

type WriteResultDetails = Record<WritableGroup, WriteResultDetail>;

const createEmptyWriteResultDetails = (): WriteResultDetails => ({
  site: { changedCount: 0, changedPaths: [], changes: [] },
  shell: { changedCount: 0, changedPaths: [], changes: [] },
  home: { changedCount: 0, changedPaths: [], changes: [] },
  page: { changedCount: 0, changedPaths: [], changes: [] },
  ui: { changedCount: 0, changedPaths: [], changes: [] }
});

const createResults = (details: WriteResultDetails = createEmptyWriteResultDetails()): Record<WritableGroup, WriteResult> => {
  return {
    site: { changed: details.site.changedCount > 0, written: false, ...details.site },
    shell: { changed: details.shell.changedCount > 0, written: false, ...details.shell },
    home: { changed: details.home.changedCount > 0, written: false, ...details.home },
    page: { changed: details.page.changedCount > 0, written: false, ...details.page },
    ui: { changed: details.ui.changedCount > 0, written: false, ...details.ui }
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
): AdminFileTransactionEntry<WritableGroup>[] =>
  writtenGroups.map((group) => ({
    id: group,
    filePath: getThemeSettingsFilePath(group),
    content: createJsonBody(groups[group])
  }));

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
  const compatibleSettingsInput = fillAdminThemeSettingsCompatibilityDefaults(settingsInput, canonicalSettings);
  const issues = [
    ...validateAdminThemeSettings(canonicalSettings, {
      footerStartYearMax: FOOTER_START_YEAR_MAX,
      localFileExists: hasProjectFile
    }),
    ...createAdminThemeSettingsCanonicalMismatchIssues(compatibleSettingsInput, canonicalSettings, {
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
  details: WriteResultDetails;
  changedGroups: WritableGroup[];
} => {
  const currentGroups = createAdminWritableThemeSettingsGroups(currentSettings);
  const nextGroups = createAdminWritableThemeSettingsGroups(nextSettings);
  const details = WRITABLE_GROUPS.reduce<WriteResultDetails>((acc, group) => {
    const changes = getAdminThemeSettingsChangePreviews(currentGroups[group], nextGroups[group], 'exact');
    const changedPaths = changes.length > 0
      ? changes.map((change) => change.path)
      : getAdminThemeSettingsMismatchPaths(currentGroups[group], nextGroups[group], 'exact');
    acc[group] = {
      changedCount: changedPaths.length,
      changedPaths,
      changes
    };
    return acc;
  }, createEmptyWriteResultDetails());
  const changedGroups = WRITABLE_GROUPS.filter((group) => details[group].changedCount > 0);

  return {
    nextGroups,
    details,
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

  const isDryRun = isAdminDryRunRequest(url);
  const requestError = validateAdminJsonWriteRequest(request, url, 'Theme Console 配置');
  if (requestError) {
    return new Response(
      JSON.stringify(
        {
          ok: false,
          errors: [requestError.error],
          results: createResults()
        },
        null,
        2
      ),
      { status: requestError.status, headers: JSON_HEADERS }
    );
  }

  const bodyResult = await readAdminJsonRequestBody(request, {
    emptyBodyError: '请求体为空，请确认前端请求地址未发生重定向且已发送 JSON 字符串',
    parseTrimmedBody: true
  });
  if (!bodyResult.ok) {
    return new Response(
      JSON.stringify(
        {
          ok: false,
          errors: [bodyResult.error]
        },
        null,
        2
      ),
      { status: bodyResult.status, headers: JSON_HEADERS }
    );
  }

  const { revision, settingsInput, errors: writeInputErrors } = extractWriteInput(bodyResult.body);
  if (writeInputErrors.length > 0 || !revision) {
    return new Response(
      JSON.stringify(
        {
            ok: false,
            errors: writeInputErrors,
            results: createResults()
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
            results: createResults(),
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
            results: createResults()
          },
          null,
          2
        ),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    const { nextGroups, details, changedGroups } = getChangedGroups(editableState.payload.settings, canonicalSettings);
    const results = createResults(details);

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
      const committedGroups = await persistAdminFileTransaction(entries, {
        beforeWrite: async () => {
          await mkdir(getThemeSettingsDir(), { recursive: true });
        }
      });
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
