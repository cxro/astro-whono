import type { AdminSettingsExportBundle } from '../../lib/admin-console/settings-data';

export type AdminDataBootstrap = {
  revision: string;
  exportEndpoint: string;
  importEndpoint: string;
};

export type WriteGroup = 'site' | 'shell' | 'home' | 'page' | 'ui';

export type WriteFieldChangeKind = 'added' | 'removed' | 'updated';

export type WriteFieldChange = {
  path: string;
  kind: WriteFieldChangeKind;
  before: string;
  after: string;
};

export type WriteResult = {
  changed: boolean;
  written: boolean;
  changedCount: number;
  changedPaths: string[];
  changes: WriteFieldChange[];
};

export type WriteResultsMap = Partial<Record<WriteGroup, WriteResult>>;

export type PreviewState = 'idle' | 'ready' | 'loading' | 'diff' | 'clean' | 'applied' | 'error' | 'warn';

export type AdminDataStatusState = 'idle' | 'loading' | 'ok' | 'warn' | 'error' | 'ready';

export const GROUP_ORDER: readonly WriteGroup[] = ['site', 'shell', 'home', 'page', 'ui'];

export const GROUP_LABELS: Record<WriteGroup, string> = {
  site: 'Site',
  shell: 'Sidebar',
  home: 'Home',
  page: 'Inner Pages',
  ui: 'Reading / Code'
};

export const GROUP_FILES: Record<WriteGroup, string> = {
  site: 'src/data/settings/site.json',
  shell: 'src/data/settings/shell.json',
  home: 'src/data/settings/home.json',
  page: 'src/data/settings/page.json',
  ui: 'src/data/settings/ui.json'
};

export const PREVIEW_BADGE_LABELS: Record<PreviewState, string> = {
  idle: 'AWAITING_INPUT',
  ready: 'FILE_READY',
  loading: 'PROCESSING',
  diff: 'DIFF_READY',
  clean: 'NO_CHANGES',
  applied: 'APPLIED',
  error: 'ERROR',
  warn: 'REVISION_CONFLICT'
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

const isWriteFieldChangeKind = (value: unknown): value is WriteFieldChangeKind =>
  value === 'added' || value === 'removed' || value === 'updated';

const getWriteFieldChanges = (value: unknown): WriteFieldChange[] =>
  Array.isArray(value)
    ? value.reduce<WriteFieldChange[]>((changes, item) => {
        if (!isRecord(item)) return changes;

        const path = typeof item.path === 'string' ? item.path.trim() : '';
        if (!path || !isWriteFieldChangeKind(item.kind)) return changes;

        changes.push({
          path,
          kind: item.kind,
          before: typeof item.before === 'string' ? item.before : '',
          after: typeof item.after === 'string' ? item.after : ''
        });
        return changes;
      }, [])
    : [];

export const parseBootstrap = (value: string): AdminDataBootstrap | null => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) return null;

    const revision = typeof parsed.revision === 'string' ? parsed.revision.trim() : '';
    const exportEndpoint = typeof parsed.exportEndpoint === 'string' ? parsed.exportEndpoint.trim() : '';
    const importEndpoint = typeof parsed.importEndpoint === 'string' ? parsed.importEndpoint.trim() : '';

    if (!revision || !exportEndpoint || !importEndpoint) return null;

    return {
      revision,
      exportEndpoint,
      importEndpoint
    };
  } catch {
    return null;
  }
};

export const getPayloadErrors = (value: unknown): string[] =>
  isRecord(value) ? getStringArray(value.errors) : [];

export const getPayloadRevision = (value: unknown): string | null => {
  if (!isRecord(value) || !isRecord(value.payload)) return null;

  const revision = value.payload.revision;
  return typeof revision === 'string' && revision.trim().length > 0 ? revision.trim() : null;
};

export const getPayloadResults = (value: unknown): WriteResultsMap | null => {
  if (!isRecord(value) || !isRecord(value.results)) return null;

  const resultMap: WriteResultsMap = {};
  for (const group of GROUP_ORDER) {
    const current = value.results[group];
    if (!isRecord(current)) continue;
    const changedPaths = getStringArray(current.changedPaths);
    const changes = getWriteFieldChanges(current.changes);
    const changedCount = typeof current.changedCount === 'number' && Number.isInteger(current.changedCount) && current.changedCount >= 0
      ? current.changedCount
      : Math.max(changedPaths.length, changes.length);
    const normalizedChangedCount = Math.max(changedCount, changedPaths.length, changes.length);

    resultMap[group] = {
      changed: current.changed === true && normalizedChangedCount > 0,
      written: current.written === true,
      changedCount: normalizedChangedCount,
      changedPaths,
      changes
    };
  }

  return resultMap;
};

export const getWriteResultChangedFieldCount = (result: WriteResult | null | undefined): number =>
  result ? Math.max(result.changedCount, result.changedPaths.length, result.changes.length) : 0;

export const hasWriteResultChanges = (result: WriteResult | null | undefined): result is WriteResult =>
  result?.changed === true && getWriteResultChangedFieldCount(result) > 0;

export const parseResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

export const getDownloadFileName = (response: Response): string => {
  const contentDisposition = response.headers.get('content-disposition') ?? '';
  const match = contentDisposition.match(/filename="([^"]+)"/i);
  return match?.[1]?.trim() || 'astro-whono-settings-export.json';
};

export const getBundleKey = (bundle: AdminSettingsExportBundle | null): string =>
  bundle ? JSON.stringify(bundle.manifest) : '';
