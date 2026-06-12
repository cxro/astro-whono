<script lang="ts">
import { onMount } from 'svelte';
import {
  isAdminContentDeletableCollectionKey,
  isAdminContentDraftStatusCollectionKey,
  isAdminContentExportableCollectionKey
} from '../../../lib/admin-console/content-collections';
import {
  ADMIN_CONTENT_BULK_ENTRY_LIMIT,
  createAdminContentBulkSummary,
  isAdminContentBulkSummary,
  type AdminContentBulkResult,
  type AdminContentBulkResultStatus,
  type AdminContentBulkSummary
} from '../../../lib/admin-console/content-bulk';
import {
  getPayloadEditorPayload,
  getPayloadErrors,
  getStringArray,
  isPayloadOk,
  isRecord,
  parseResponseBody
} from '../../../scripts/admin-content/entry-transport';
import { initAdminDetailsMenus } from '../../../scripts/admin-content/details-menu';
import AdminEditorIcon from './AdminEditorIcon.svelte';
import ContentBulkResultDialog from './ContentBulkResultDialog.svelte';
import {
  clearContentBulkResultDialog,
  readContentBulkResultDialog,
  storeContentBulkResultDialog,
  type ContentBulkResultDialog as ContentBulkResultDialogModel,
  type ContentBulkResultDialogKind
} from './content-bulk-result-feedback';
import { dispatchAdminContentStatus } from './content-action-status-events';
import type { AdminStatusFeedbackOptions, StatusState } from './content-action-feedback';

// 该组件仅用于 DEV 内容控制台；生产构建不会加载批量管理 UI。

type BulkEntry = {
  collection: string;
  entryId: string;
  expectedRelativePath: string;
  title: string;
};

type BulkResult = AdminContentBulkResult & {
  errors: string[];
  errorCodes: string[];
  changedFields: string[];
  title?: string;
};

type ResultDialog = ContentBulkResultDialogModel;

type ResultDialogOptions = {
  kind: ContentBulkResultDialogKind;
  title: string;
  requested: number;
  results: BulkResult[];
  summary?: AdminContentBulkSummary | null;
  truncated?: boolean;
  note?: string;
};

type ExportHeaderSummary = {
  results: BulkResult[];
  summary: AdminContentBulkSummary;
  truncated: boolean;
};

type Props = {
  entryEndpoint: string;
  statusEndpoint: string;
  deleteEndpoint: string;
  exportEndpoint: string;
};

let { entryEndpoint, statusEndpoint, deleteEndpoint, exportEndpoint }: Props = $props();

const RESULT_DETAIL_LIMIT = 5;
const DELETE_PREFETCH_CONCURRENCY = 8;
const RELOAD_FALLBACK_DELAY_MS = 2_000;

let selected = $state<BulkEntry[]>([]);
let busy = $state(false);
let reloading = $state(false);
let resultDialog = $state<ResultDialog | null>(null);
let menuEl = $state<HTMLDetailsElement | null>(null);

const selectedCount = $derived(selected.length);
const actionsDisabled = $derived(busy || reloading);
const statusCount = $derived(selected.filter((entry) => isAdminContentDraftStatusCollectionKey(entry.collection)).length);
const deleteCount = $derived(selected.filter((entry) => isAdminContentDeletableCollectionKey(entry.collection)).length);
const exportCount = $derived(selected.filter((entry) => isAdminContentExportableCollectionKey(entry.collection)).length);

const getEntryKey = (entry: { collection: string; entryId: string }): string =>
  `${entry.collection}\u0000${entry.entryId}`;

const getErrorMessageFromCodes = (codes: readonly string[]): string => {
  if (codes.includes('relative_path_mismatch')) return '列表已过期，请刷新后重试';
  if (codes.includes('source_not_found')) return '源文件不存在，请刷新后重试';
  if (codes.includes('invalid_entry_id')) return '内容无效，请刷新后重试';
  if (codes.includes('unsupported_collection')) return '当前内容类型暂不支持此操作';
  if (codes.includes('export_failed')) return '导出内容源文件失败，请检查本地文件权限或日志';
  return codes.join(', ');
};

const getSelectedEntries = (): BulkEntry[] =>
  Array.from(document.querySelectorAll<HTMLInputElement>('[data-admin-content-bulk-entry]:checked'))
    .filter((checkbox) => !checkbox.disabled)
    .map((checkbox) => {
      const entryId = checkbox.dataset.entryId?.trim() ?? '';
      return {
        collection: checkbox.dataset.collection?.trim() ?? '',
        entryId,
        expectedRelativePath: checkbox.dataset.relativePath?.trim() ?? '',
        title: checkbox.dataset.title?.trim() || entryId
      };
    })
    .filter((entry) => entry.collection && entry.entryId && entry.expectedRelativePath);

const refreshSelected = () => {
  selected = getSelectedEntries();
  // 列表刷新前保留完成提示，避免选中项变化时提前清空状态。
  if (selected.length === 0 && !reloading) {
    clearStatus();
    menuEl?.removeAttribute('open');
  }
};

const resetSelectedCheckboxes = () => {
  document.querySelectorAll<HTMLInputElement>('[data-admin-content-bulk-entry]:checked')
    .forEach((checkbox) => {
      checkbox.checked = false;
    });
};

const clearSelection = () => {
  resetSelectedCheckboxes();
  refreshSelected();
};

const clearStatus = () => {
  dispatchAdminContentStatus('idle', '');
};

const setStatus = (
  state: StatusState,
  text: string,
  options: AdminStatusFeedbackOptions = {}
) => {
  dispatchAdminContentStatus(state, text, options);
};

const toRequestEntry = (entry: BulkEntry) => ({
  collection: entry.collection,
  entryId: entry.entryId,
  expectedRelativePath: entry.expectedRelativePath
});

// 与服务端共用同一上限，超限时提前拦截，避免整单 400。
const exceedsBulkLimit = (count: number): boolean => {
  if (count <= ADMIN_CONTENT_BULK_ENTRY_LIMIT) return false;
  setStatus('warn', `一次最多处理 ${ADMIN_CONTENT_BULK_ENTRY_LIMIT} 条，请减少选中数量`, { autoClear: true });
  return true;
};

const parseBulkResult = (value: unknown): BulkResult | null => {
  if (!isRecord(value)) return null;
  const collection = typeof value.collection === 'string' ? value.collection.trim() : '';
  const entryId = typeof value.entryId === 'string' ? value.entryId.trim() : '';
  const status = typeof value.status === 'string' ? value.status.trim() : '';
  if (!collection || !entryId || !isBulkResultStatus(status)) return null;

  const relativePath = typeof value.relativePath === 'string' ? value.relativePath.trim() : '';
  const trashedPath = typeof value.trashedPath === 'string' ? value.trashedPath.trim() : '';
  return {
    collection,
    entryId,
    status,
    errors: getStringArray(value.errors),
    errorCodes: getStringArray(value.errorCodes),
    changedFields: getStringArray(value.changedFields),
    ...(relativePath ? { relativePath } : {}),
    ...(trashedPath ? { trashedPath } : {})
  };
};

const isBulkResultStatus = (value: string): value is AdminContentBulkResultStatus =>
  value === 'succeeded' || value === 'unchanged' || value === 'skipped' || value === 'failed';

const parseBulkResults = (value: unknown): BulkResult[] =>
  isRecord(value) && Array.isArray(value.results)
    ? value.results.map(parseBulkResult).filter((result): result is BulkResult => Boolean(result))
    : [];

const parseBulkSummary = (value: unknown): AdminContentBulkSummary | null =>
  isRecord(value) && isAdminContentBulkSummary(value.summary) ? value.summary : null;

const hasSucceededResult = (results: readonly BulkResult[]): boolean =>
  results.some((result) => result.status === 'succeeded');

const isResultDetail = (result: BulkResult): boolean =>
  result.status === 'failed' || result.status === 'skipped';

const getResultDetailMessage = (result: BulkResult): string =>
  result.errors.length > 0
    ? result.errors.join('；')
    : getErrorMessageFromCodes(result.errorCodes) || result.status;

const createResultDialogDetails = (
  results: readonly BulkResult[]
): Pick<ResultDialog, 'details' | 'extraDetailCount'> => {
  const details: ResultDialog['details'] = [];
  let detailCount = 0;

  for (const result of results) {
    if (!isResultDetail(result)) continue;
    detailCount += 1;
    if (details.length >= RESULT_DETAIL_LIMIT) continue;
    details.push({
      title: result.title || result.entryId,
      message: getResultDetailMessage(result)
    });
  }

  return {
    details,
    extraDetailCount: Math.max(0, detailCount - details.length)
  };
};

const createResultDialog = ({
  kind,
  title,
  requested,
  results,
  summary,
  truncated = false,
  note
}: ResultDialogOptions): ResultDialog => ({
  kind,
  title,
  summary: summary ?? createAdminContentBulkSummary(requested, results),
  ...createResultDialogDetails(results),
  ...(note ? { note } : {}),
  truncated
});

const showResult = (options: ResultDialogOptions) => {
  resultDialog = createResultDialog(options);
  menuEl?.removeAttribute('open');
};

// 批量写入成功后等待内容列表刷新，再恢复结果弹窗，避免当前页和刷新后重复展示。
// 若列表没有自动刷新，延迟触发一次刷新，保证用户能看到最新列表和本次结果。
const reloadWithResult = (options: ResultDialogOptions) => {
  storeContentBulkResultDialog(createResultDialog(options));
  menuEl?.removeAttribute('open');
  reloading = true;
  setStatus('loading', '已完成，正在刷新列表…');
  window.setTimeout(() => window.location.reload(), RELOAD_FALLBACK_DELAY_MS);
};

const attachEntryTitles = (results: BulkResult[], entries: readonly BulkEntry[]): BulkResult[] => {
  const titleByKey = new Map(entries.map((entry) => [getEntryKey(entry), entry.title]));
  return results.map((result) => ({
    ...result,
    title: titleByKey.get(getEntryKey(result)) ?? result.entryId
  }));
};

const postJson = async (endpoint: string, payload: unknown) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8'
    },
    cache: 'no-store',
    body: JSON.stringify(payload)
  });
  return {
    response,
    payload: await parseResponseBody(response)
  };
};

const runStatus = async (targetDraft: boolean) => {
  if (actionsDisabled) return;
  const entries = selected;
  if (entries.length === 0 || statusCount === 0) {
    setStatus('warn', '没有可更新状态的内容', { autoClear: true });
    return;
  }
  if (exceedsBulkLimit(entries.length)) return;

  busy = true;
  setStatus('loading', targetDraft ? '正在改为草稿' : '正在发布');
  try {
    const { response, payload } = await postJson(statusEndpoint, {
      targetDraft,
      entries: entries.map(toRequestEntry)
    });
    const results = attachEntryTitles(parseBulkResults(payload), entries);
    if (!response.ok || !isPayloadOk(payload)) {
      const errors = getPayloadErrors(payload);
      setStatus('error', errors[0] ?? '批量状态更新失败');
      showResult({
        kind: 'status',
        title: targetDraft ? '批量改草稿' : '批量发布',
        requested: entries.length,
        results
      });
      return;
    }

    const dialogOptions: ResultDialogOptions = {
      kind: 'status',
      title: targetDraft ? '批量改草稿' : '批量发布',
      requested: entries.length,
      results,
      summary: parseBulkSummary(payload)
    };
    if (hasSucceededResult(results)) {
      reloadWithResult(dialogOptions);
      return;
    }
    clearStatus();
    showResult(dialogOptions);
  } catch {
    setStatus('error', '批量状态请求失败，请稍后重试');
  } finally {
    busy = false;
  }
};

const buildEntryEndpoint = (entry: BulkEntry): string => {
  const url = new URL(entryEndpoint, window.location.href);
  url.searchParams.set('collection', entry.collection);
  url.searchParams.set('entryId', entry.entryId);
  return url.toString();
};

const createPrefetchFailure = (entry: BulkEntry, message: string, code: string): BulkResult => ({
  collection: entry.collection,
  entryId: entry.entryId,
  title: entry.title,
  status: 'failed',
  errors: [message],
  errorCodes: [code],
  changedFields: []
});

const prefetchDeleteEntries = async (entries: readonly BulkEntry[]) => {
  const deletable: Array<BulkEntry & { revision: string }> = [];
  const rejected: BulkResult[] = [];

  for (let startIndex = 0; startIndex < entries.length; startIndex += DELETE_PREFETCH_CONCURRENCY) {
    const batch = entries.slice(startIndex, startIndex + DELETE_PREFETCH_CONCURRENCY);
    await Promise.all(batch.map(async (entry) => {
      if (!isAdminContentDeletableCollectionKey(entry.collection)) {
        rejected.push({
          collection: entry.collection,
          entryId: entry.entryId,
          title: entry.title,
          status: 'skipped',
          errors: [`当前 collection 暂不支持删除：${entry.collection}`],
          errorCodes: ['unsupported_collection'],
          changedFields: []
        });
        return;
      }

      try {
        const response = await fetch(buildEntryEndpoint(entry), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store'
        });
        const payload = await parseResponseBody(response);
        const entryPayload = getPayloadEditorPayload(payload);
        if (!response.ok || !isPayloadOk(payload) || !entryPayload || entryPayload.collection !== entry.collection) {
          rejected.push(createPrefetchFailure(entry, getPayloadErrors(payload)[0] ?? '删除确认失败，请刷新后重试', 'prefetch_failed'));
          return;
        }

        if (entryPayload.relativePath !== entry.expectedRelativePath) {
          rejected.push(createPrefetchFailure(entry, '列表已过期，请刷新后再删除', 'relative_path_mismatch'));
          return;
        }

        deletable.push({
          ...entry,
          revision: entryPayload.revision,
          expectedRelativePath: entryPayload.relativePath
        });
      } catch {
        rejected.push(createPrefetchFailure(entry, '删除确认请求失败，请稍后重试', 'prefetch_failed'));
      }
    }));
  }

  return { deletable, rejected };
};

const confirmBulkDelete = (count: number): boolean => {
  return window.confirm([
    `确认删除 ${count} 个文件？`,
    '',
    '文件会移到 .trash/content/，之后可从回收站手动恢复。'
  ].join('\n'));
};

const runDelete = async () => {
  if (actionsDisabled) return;
  const entries = selected;
  if (entries.length === 0 || deleteCount === 0) {
    setStatus('warn', '没有可删除的文件', { autoClear: true });
    return;
  }
  if (exceedsBulkLimit(entries.length)) return;

  busy = true;
  setStatus('loading', '正在确认删除');
  try {
    const { deletable, rejected } = await prefetchDeleteEntries(entries);
    if (deletable.length === 0) {
      setStatus('warn', '没有可删除的文件', { autoClear: true });
      showResult({
        kind: 'delete',
        title: '批量删除',
        requested: entries.length,
        results: rejected
      });
      return;
    }

    if (!confirmBulkDelete(deletable.length)) {
      setStatus('ready', '已取消删除', { autoClear: true });
      return;
    }

    setStatus('loading', '正在删除');
    const { response, payload } = await postJson(deleteEndpoint, {
      entries: deletable.map((entry) => ({
        ...toRequestEntry(entry),
        revision: entry.revision
      }))
    });
    const serverResults = attachEntryTitles(parseBulkResults(payload), entries);
    const results = [...rejected, ...serverResults];
    if (!response.ok || !isPayloadOk(payload)) {
      setStatus('error', getPayloadErrors(payload)[0] ?? '批量删除失败');
      showResult({
        kind: 'delete',
        title: '批量删除',
        requested: entries.length,
        results
      });
      return;
    }

    const dialogOptions: ResultDialogOptions = {
      kind: 'delete',
      title: '批量删除',
      requested: entries.length,
      results
    };
    if (hasSucceededResult(serverResults)) {
      reloadWithResult(dialogOptions);
      return;
    }
    clearStatus();
    showResult(dialogOptions);
  } catch {
    setStatus('error', '批量删除请求失败，请稍后重试');
  } finally {
    busy = false;
  }
};

const getDownloadFileName = (response: Response): string => {
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  return match?.[1] ?? 'admin-content-export.zip';
};

const triggerDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const parseExportHeaderSummary = (
  response: Response,
  requested: number,
  entries: readonly BulkEntry[]
): ExportHeaderSummary | null => {
  const rawHeader = response.headers.get('x-admin-content-bulk-export-summary');
  if (!rawHeader) return null;

  try {
    const value = JSON.parse(decodeURIComponent(rawHeader)) as unknown;
    if (!isRecord(value)) return null;
    const succeeded = typeof value.succeeded === 'number' ? value.succeeded : 0;
    const failed = typeof value.failed === 'number' ? value.failed : 0;
    const skipped = typeof value.skipped === 'number' ? value.skipped : 0;
    const titleByKey = new Map(entries.map((entry) => [getEntryKey(entry), entry.title]));
    const results = Array.isArray(value.items)
      ? value.items
        .filter(isRecord)
        .map((item): BulkResult | null => {
          const collection = typeof item.collection === 'string' ? item.collection.trim() : '';
          const entryId = typeof item.entryId === 'string' ? item.entryId.trim() : '';
          const status = typeof item.status === 'string' && isBulkResultStatus(item.status) ? item.status : 'failed';
          if (!collection || !entryId) return null;
          const errorCodes = getStringArray(item.errorCodes);
          return {
            collection,
            entryId,
            status,
            title: titleByKey.get(getEntryKey({ collection, entryId })) ?? entryId,
            errors: errorCodes.length > 0 ? [getErrorMessageFromCodes(errorCodes)] : [],
            errorCodes,
            changedFields: []
          };
        })
        .filter((item): item is BulkResult => Boolean(item))
      : [];

    return {
      results,
      summary: {
        requested,
        processed: succeeded + failed + skipped,
        succeeded,
        unchanged: 0,
        skipped,
        failed
      },
      truncated: value.truncated === true
    };
  } catch {
    return null;
  }
};

const runExport = async () => {
  if (actionsDisabled) return;
  const entries = selected;
  if (entries.length === 0 || exportCount === 0) {
    setStatus('warn', '没有可下载的文件', { autoClear: true });
    return;
  }
  if (exceedsBulkLimit(entries.length)) return;

  busy = true;
  setStatus('loading', '正在打包下载');
  try {
    const response = await fetch(exportEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/zip, application/json',
        'Content-Type': 'application/json; charset=utf-8'
      },
      cache: 'no-store',
      body: JSON.stringify({
        entries: entries.map(toRequestEntry)
      })
    });

    if (!response.ok) {
      const payload = await parseResponseBody(response);
      const results = attachEntryTitles(parseBulkResults(payload), entries);
      setStatus('error', getPayloadErrors(payload)[0] ?? '批量下载失败');
      showResult({
        kind: 'export',
        title: '批量下载',
        requested: entries.length,
        results,
        summary: parseBulkSummary(payload)
      });
      return;
    }

    const headerSummary = parseExportHeaderSummary(response, entries.length, entries);
    const blob = await response.blob();
    triggerDownload(blob, getDownloadFileName(response));
    clearStatus();
    if (headerSummary) {
      showResult({
        kind: 'export',
        title: '批量下载',
        requested: entries.length,
        results: headerSummary.results,
        summary: headerSummary.summary,
        truncated: headerSummary.truncated
      });
    } else {
      showResult({
        kind: 'export',
        title: '批量下载',
        requested: entries.length,
        results: [],
        summary: {
          requested: entries.length,
          processed: entries.length,
          succeeded: entries.length,
          unchanged: 0,
          skipped: 0,
          failed: 0
        },
        note: '已保存为 zip 文件。'
      });
    }
  } catch {
    setStatus('error', '批量下载请求失败，请稍后重试');
  } finally {
    busy = false;
  }
};

const closeResultDialog = () => {
  resultDialog = null;
  clearContentBulkResultDialog();
};

const handleDocumentChange = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) return;
  if (!event.target.matches('[data-admin-content-bulk-entry]')) return;
  refreshSelected();
};

onMount(() => {
  resetSelectedCheckboxes();
  refreshSelected();
  // 列表刷新后恢复上一次批量结果；用户关闭前继续保留，避免连续刷新丢失提示。
  resultDialog = readContentBulkResultDialog();
  const cleanupDetailsMenus = initAdminDetailsMenus({
    selector: '.admin-content-bulk-menu'
  });
  document.addEventListener('change', handleDocumentChange);
  return () => {
    cleanupDetailsMenus();
    document.removeEventListener('change', handleDocumentChange);
  };
});

</script>

{#if selectedCount > 0}
  <div class="admin-content-bulk-actions">
    <span class="admin-content-bulk-separator" aria-hidden="true">｜</span>
    <details class="admin-content-bulk-menu" bind:this={menuEl}>
      <summary class="admin-content-bulk-trigger">
        <span>批量操作</span>
        <span class="admin-content-bulk-trigger__count">{selectedCount}</span>
      </summary>
      <div class="admin-content-bulk-menu__panel" aria-label="批量操作">
        <button class="admin-content-menu-item" type="button" disabled={actionsDisabled || statusCount === 0} onclick={() => void runStatus(false)}>
          <AdminEditorIcon name="check" size={14} />
          <span>发布</span>
          <span class="admin-content-bulk-menu__count">{statusCount}</span>
        </button>
        <button class="admin-content-menu-item" type="button" disabled={actionsDisabled || statusCount === 0} onclick={() => void runStatus(true)}>
          <AdminEditorIcon name="lock" size={14} />
          <span>改草稿</span>
          <span class="admin-content-bulk-menu__count">{statusCount}</span>
        </button>
        <button class="admin-content-menu-item" type="button" disabled={actionsDisabled || exportCount === 0} onclick={() => void runExport()}>
          <AdminEditorIcon name="download" size={14} />
          <span>下载</span>
          <span class="admin-content-bulk-menu__count">{exportCount}</span>
        </button>
        <button class="admin-content-menu-item admin-content-menu-item--danger" type="button" disabled={actionsDisabled || deleteCount === 0} onclick={() => void runDelete()}>
          <AdminEditorIcon name="trash" size={14} />
          <span>删除</span>
          <span class="admin-content-bulk-menu__count">{deleteCount}</span>
        </button>
      </div>
    </details>
    <button class="admin-content-bulk-clear" type="button" disabled={actionsDisabled} onclick={clearSelection}>取消</button>
  </div>
{/if}

{#if resultDialog}
  <ContentBulkResultDialog dialog={resultDialog} onClose={closeResultDialog} />
{/if}
