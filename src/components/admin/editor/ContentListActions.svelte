<script lang="ts">
import { onMount, tick } from 'svelte';
import type {
  AdminContentEditorPayload,
  AdminEssayEditorValues
} from '../../../lib/admin-console/content-editor-payload';
import {
  cloneFrontmatter,
  isEqualFrontmatter
} from '../../../lib/admin-console/essay-editor-values';
import {
  isAdminContentDeletableCollectionKey,
  type AdminContentDeletableCollectionKey
} from '../../../lib/admin-console/content-delete-contract';
import {
  getPayloadDeleteResult,
  getPayloadEditorPayload,
  getPayloadErrors,
  getPayloadEssayPayload,
  getPayloadIssues,
  getPayloadResult,
  getPayloadRevision,
  isPayloadOk,
  parseResponseBody,
  type AdminContentIssue,
  type AdminContentWriteResult
} from '../../../scripts/admin-content/entry-transport';
import {
  closeClosestAdminDetailsMenu,
  initAdminDetailsMenus
} from '../../../scripts/admin-content/details-menu';
import { createWithBase } from '../../../utils/format';
import {
  ESSAY_PUBLIC_SLUG_RE,
  contentSourceEntryIdToPublicEntryId,
  flattenEntryIdToSlug
} from '../../../utils/slug-rules';
import ArticleInfoDialog from './ArticleInfoDialog.svelte';
import {
  CONTENT_LIST_DELETE_FEEDBACK_STORAGE_KEY,
  CONTENT_LIST_DELETE_FEEDBACK_VALUE
} from './content-list-feedback';
import { createContentEntry } from './content-editor-client';

type StatusState = 'idle' | 'loading' | 'ready' | 'ok' | 'warn' | 'error';
type StatusOptions = {
  autoClear?: boolean;
};
type DialogMode = 'edit' | 'create';

type Props = {
  base?: string;
  endpoint: string;
  createEndpoint: string;
  deleteEndpoint: string;
};

const STATUS_FEEDBACK_VISIBLE_MS = 2_000;

let { base = '/', endpoint, createEndpoint, deleteEndpoint }: Props = $props();

let dialog = $state<ArticleInfoDialog | null>(null);
let open = $state(false);
let dialogMode = $state<DialogMode>('edit');
let busy = $state(false);
let loadingEntry = $state(false);
let loadRequestId = 0;
let selectedEntryId = $state('');
let selectedDefaultPublicSlug = $state('');
let selectedTrigger = $state<HTMLElement | null>(null);
let createEntryId = $state('');
let createEntryIdEdited = $state(false);
let revision = $state('');
let baselineFrontmatter = $state<AdminEssayEditorValues | null>(null);
let frontmatter = $state<AdminEssayEditorValues | null>(null);
let issues = $state<AdminContentIssue[]>([]);
let errors = $state<string[]>([]);
let statusState = $state<StatusState>('idle');
let statusText = $state('');
let statusFeedbackClearTimer: number | null = null;

const createEmptyFrontmatter = (): AdminEssayEditorValues => ({
  title: '',
  description: '',
  date: '',
  publishedAt: '',
  updatedAt: '',
  tagsText: '',
  draft: false,
  archive: true,
  slug: '',
  cover: '',
  badge: ''
});

const createNewEssayFrontmatter = (): AdminEssayEditorValues => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return {
    ...createEmptyFrontmatter(),
    date: `${now.getFullYear()}-${month}-${day}`,
    draft: true
  };
};

const dirty = $derived(!isEqualFrontmatter(frontmatter, baselineFrontmatter));
const canSave = $derived(
  Boolean(frontmatter)
  && !busy
  && (
    dialogMode === 'create'
      ? createEntryId.trim().length > 0 && (frontmatter?.title.trim().length ?? 0) > 0
      : dirty
  )
);
const withBase = $derived(createWithBase(base));

const getShortDateSlugPart = (date: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return 'yymmdd';

  const year = match[1] ?? '0000';
  const month = match[2] ?? '00';
  const day = match[3] ?? '00';
  return `${year.slice(-2)}${month}${day}`;
};

const getCreateSlugFallbackPlaceholder = (): string =>
  `essay-${getShortDateSlugPart(frontmatter?.date ?? '')}-xxxx`;

const getCreateSlugPlaceholderPreview = (): string => {
  const candidate = flattenEntryIdToSlug(contentSourceEntryIdToPublicEntryId(createEntryId) || createEntryId);
  return ESSAY_PUBLIC_SLUG_RE.test(candidate) ? candidate : getCreateSlugFallbackPlaceholder();
};

const getCreateSlugPlaceholder = (): string =>
  `留空自动生成：${getCreateSlugPlaceholderPreview()}`;

const getEditSlugPlaceholder = (): string => {
  const fallbackSlug = selectedEntryId ? flattenEntryIdToSlug(selectedEntryId) : '';
  const defaultSlug = selectedDefaultPublicSlug || fallbackSlug;
  return defaultSlug ? `留空使用默认：${defaultSlug}` : '';
};

const slugPlaceholder = $derived(
  dialogMode === 'create'
    ? getCreateSlugPlaceholder()
    : getEditSlugPlaceholder()
);

const clearStatusFeedbackTimer = () => {
  if (statusFeedbackClearTimer === null) return;
  window.clearTimeout(statusFeedbackClearTimer);
  statusFeedbackClearTimer = null;
};

const clearStatus = () => {
  clearStatusFeedbackTimer();
  statusState = 'idle';
  statusText = '';
};

const setStatus = (state: StatusState, text: string, { autoClear = false }: StatusOptions = {}) => {
  clearStatusFeedbackTimer();
  statusState = state;
  statusText = text;

  if (!autoClear || !text) return;
  statusFeedbackClearTimer = window.setTimeout(() => {
    statusFeedbackClearTimer = null;
    if (statusState === state && statusText === text) {
      clearStatus();
    }
  }, STATUS_FEEDBACK_VISIBLE_MS);
};

const deriveEssayEntryIdFromTitle = (title: string): string => {
  const trimmed = title.trim();
  if (!trimmed) return '';
  return contentSourceEntryIdToPublicEntryId(trimmed) || 'untitled';
};

const syncCreateEntryIdFromTitle = () => {
  if (dialogMode !== 'create' || createEntryIdEdited || !frontmatter) return;
  createEntryId = deriveEssayEntryIdFromTitle(frontmatter.title);
};

const updateCreateEntryId = (value: string) => {
  createEntryId = value;
  createEntryIdEdited = true;
  setStatus('ready', '源文件名已修改', { autoClear: true });
};

const takeStoredDeleteFeedback = (): boolean => {
  try {
    const value = window.sessionStorage.getItem(CONTENT_LIST_DELETE_FEEDBACK_STORAGE_KEY);
    window.sessionStorage.removeItem(CONTENT_LIST_DELETE_FEEDBACK_STORAGE_KEY);
    return value === CONTENT_LIST_DELETE_FEEDBACK_VALUE;
  } catch {
    return false;
  }
};

const buildEntryEndpoint = (collection: AdminContentDeletableCollectionKey, entryId: string): string => {
  const url = new URL(endpoint, window.location.href);
  url.searchParams.set('collection', collection);
  url.searchParams.set('entryId', entryId);
  return url.toString();
};

const closeDialog = () => {
  if (loadingEntry) {
    loadRequestId += 1;
    loadingEntry = false;
    busy = false;
    clearStatus();
  }
  open = false;
  selectedTrigger = null;
};

const openCreateDialog = async (trigger: HTMLElement) => {
  if (busy) {
    errors = [];
    setStatus('warn', '操作进行中');
    return;
  }

  const nextFrontmatter = createNewEssayFrontmatter();
  dialogMode = 'create';
  busy = false;
  loadingEntry = false;
  open = false;
  selectedEntryId = '';
  selectedDefaultPublicSlug = '';
  selectedTrigger = trigger;
  createEntryId = '';
  createEntryIdEdited = false;
  revision = '';
  baselineFrontmatter = cloneFrontmatter(nextFrontmatter);
  frontmatter = cloneFrontmatter(nextFrontmatter);
  issues = [];
  errors = [];
  clearStatus();

  await tick();
  dialog?.captureReturnFocus(trigger);
  open = true;
};

const restoreFocusAndCloseDialog = () => {
  const trigger = selectedTrigger;
  open = false;
  dialog?.restoreFocus();
  selectedTrigger = null;

  if (!dialog && trigger && document.contains(trigger)) {
    window.setTimeout(() => {
      trigger.focus({ preventScroll: true });
    }, 0);
  }
};

const resetToBaseline = () => {
  if (!baselineFrontmatter) return;
  frontmatter = cloneFrontmatter(baselineFrontmatter);
  if (dialogMode === 'create') {
    createEntryId = '';
    createEntryIdEdited = false;
  }
  issues = [];
  errors = [];
  setStatus('ready', '已还原', { autoClear: true });
};

const closeActionMenu = (trigger: HTMLElement) => {
  closeClosestAdminDetailsMenu(trigger, '.admin-content-item__more');
};

const getRowTitle = (trigger: HTMLElement, entryId: string): string => {
  const row = trigger.closest<HTMLElement>('[data-admin-content-item]');
  return row?.querySelector<HTMLElement>('[data-admin-content-row-title]')?.textContent?.trim() || entryId;
};

const getRowCollectionLabel = (trigger: HTMLElement): string =>
  trigger
    .closest<HTMLElement>('.admin-content-module')
    ?.querySelector<HTMLElement>('.admin-content-module__head h3 span')
    ?.textContent
    ?.trim()
  || '该分类';

const removeDeletedRowFromList = (trigger: HTMLElement): void => {
  const row = trigger.closest<HTMLElement>('[data-admin-content-item]');
  const list = row?.parentElement;
  if (!row || !list) return;

  const collectionLabel = getRowCollectionLabel(trigger);
  row.remove();

  if (list.children.length > 0) return;

  const empty = document.createElement('p');
  empty.className = 'admin-content-empty';
  empty.textContent = `${collectionLabel}中没有符合当前筛选条件的内容。`;
  list.replaceWith(empty);
};

const getDeletePayload = (
  payload: unknown,
  collection: AdminContentDeletableCollectionKey,
  entryId: string
): AdminContentEditorPayload | null => {
  const entryPayload = getPayloadEditorPayload(payload);
  if (!entryPayload || entryPayload.collection !== collection || entryPayload.entryId !== entryId) return null;
  if (typeof entryPayload.revision !== 'string' || typeof entryPayload.relativePath !== 'string') return null;
  return entryPayload;
};

const getEssayPublicHref = (value: AdminEssayEditorValues): string | null => {
  if (value.draft === true) return null;
  const slug = value.slug.trim() || selectedDefaultPublicSlug || flattenEntryIdToSlug(selectedEntryId);
  return withBase(`/archive/${slug}/`);
};

const syncSelectedRow = (result: AdminContentWriteResult) => {
  if (!result.changed || !selectedTrigger || !frontmatter) return;

  const row = selectedTrigger.closest<HTMLElement>('[data-admin-content-item]');
  const titleEl = row?.querySelector<HTMLElement>('[data-admin-content-row-title]');
  const dateEl = row?.querySelector<HTMLElement>('[data-admin-content-row-date]');
  const draftEl = row?.querySelector<HTMLElement>('[data-admin-content-row-draft]');
  const archiveEl = row?.querySelector<HTMLElement>('[data-admin-content-row-archive]');
  const publicLinkEl = row?.querySelector<HTMLAnchorElement>('[data-admin-content-row-public-link]');
  const publicHref = getEssayPublicHref(frontmatter);

  if (titleEl) titleEl.textContent = frontmatter.title || selectedEntryId;
  if (dateEl) dateEl.textContent = frontmatter.date || '未设置日期';
  if (draftEl) draftEl.hidden = frontmatter.draft !== true;
  if (archiveEl) archiveEl.hidden = frontmatter.archive !== false;
  if (publicLinkEl) {
    if (publicHref) {
      publicLinkEl.href = publicHref;
      publicLinkEl.classList.remove('is-disabled');
      publicLinkEl.removeAttribute('aria-disabled');
      publicLinkEl.removeAttribute('title');
    } else {
      publicLinkEl.removeAttribute('href');
      publicLinkEl.classList.add('is-disabled');
      publicLinkEl.setAttribute('aria-disabled', 'true');
      publicLinkEl.title = frontmatter.draft === true ? 'draft 条目默认不暴露公开页' : '当前条目未生成公开页链接';
    }
    publicLinkEl.tabIndex = publicHref ? 0 : -1;
  }
};

const openEditor = async (entryId: string, trigger: HTMLElement) => {
  const requestId = loadRequestId + 1;
  loadRequestId = requestId;
  dialogMode = 'edit';
  busy = true;
  loadingEntry = true;
  open = false;
  selectedEntryId = entryId;
  selectedDefaultPublicSlug = '';
  selectedTrigger = trigger;
  createEntryId = '';
  createEntryIdEdited = false;
  revision = '';
  baselineFrontmatter = null;
  frontmatter = createEmptyFrontmatter();
  issues = [];
  errors = [];
  setStatus('loading', '正在加载');

  await tick();
  if (requestId !== loadRequestId) return;
  dialog?.captureReturnFocus(trigger);
  open = true;

  try {
    const response = await fetch(buildEntryEndpoint('essay', entryId), {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      cache: 'no-store'
    });

    const payload = await parseResponseBody(response);
    const essayPayload = getPayloadEssayPayload(payload);
    if (requestId !== loadRequestId) return;

    if (!response.ok || !isPayloadOk(payload) || !essayPayload) {
      const payloadErrors = getPayloadErrors(payload);
      errors = payloadErrors;
      issues = getPayloadIssues(payload);
      loadingEntry = false;
      open = false;
      frontmatter = null;
      setStatus('error', payloadErrors.length > 0 ? '加载失败' : '加载失败，可进入编辑页处理');
      return;
    }

    revision = essayPayload.revision;
    selectedDefaultPublicSlug = essayPayload.defaultPublicSlug;
    baselineFrontmatter = cloneFrontmatter(essayPayload.values);
    frontmatter = cloneFrontmatter(essayPayload.values);
    loadingEntry = false;
    await tick();
    if (requestId !== loadRequestId) return;
    clearStatus();
  } catch {
    if (requestId !== loadRequestId) return;
    errors = [];
    loadingEntry = false;
    open = false;
    frontmatter = null;
    setStatus('error', '加载失败，请稍后重试');
  } finally {
    if (requestId === loadRequestId) {
      loadingEntry = false;
      busy = false;
    }
  }
};

const saveEditor = async () => {
  if (!frontmatter || !selectedEntryId || busy) return;

  busy = true;
  issues = [];
  errors = [];
  setStatus('loading', '正在保存');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8'
      },
      cache: 'no-store',
      body: JSON.stringify({
        collection: 'essay',
        entryId: selectedEntryId,
        revision,
        frontmatter
      })
    });

    const payload = await parseResponseBody(response);
    const nextRevision = getPayloadRevision(payload);
    if (nextRevision && response.ok) revision = nextRevision;

    if (!response.ok || !isPayloadOk(payload)) {
      issues = getPayloadIssues(payload);
      const payloadErrors = getPayloadErrors(payload);
      errors = payloadErrors;
      const state = response.status === 409 ? 'warn' : 'error';
      const fallbackText = response.status === 409 ? '检测到外部更新' : '保存失败，请检查当前表单与磁盘状态';
      setStatus(state, payloadErrors.length > 0 ? (response.status === 409 ? '检测到外部更新' : '保存失败') : fallbackText);
      return;
    }

    const result = getPayloadResult(payload);
    const latestPayload = getPayloadEssayPayload(payload);
    if (!result || !latestPayload) {
      errors = [];
      setStatus('error', '保存响应异常，请检查开发日志');
      return;
    }

    baselineFrontmatter = cloneFrontmatter(latestPayload.values);
    frontmatter = cloneFrontmatter(latestPayload.values);
    revision = latestPayload.revision;
    syncSelectedRow(result);
    setStatus(result.changed ? 'ok' : 'ready', result.changed ? '已保存' : '没有变化', { autoClear: true });
    if (result.changed) {
      restoreFocusAndCloseDialog();
    }
  } catch {
    errors = [];
    setStatus('error', '保存请求失败，请稍后重试');
  } finally {
    busy = false;
  }
};

const saveCreate = async () => {
  if (!frontmatter || busy) return;

  busy = true;
  issues = [];
  errors = [];
  frontmatter.draft = true;
  setStatus('loading', '正在创建');

  try {
    const outcome = await createContentEntry({
      endpoint: createEndpoint,
      collection: 'essay',
      entryId: createEntryId,
      frontmatter
    });

    if (!outcome.responseOk || !outcome.payloadOk || !outcome.editHref) {
      issues = outcome.issues;
      errors = outcome.errors;
      setStatus('error', outcome.errors.length > 0 ? '创建失败' : '创建响应异常，请检查开发日志');
      return;
    }

    setStatus('ok', '已创建，进入编辑页');
    window.location.assign(withBase(outcome.editHref));
  } catch {
    errors = [];
    setStatus('error', '创建请求失败，请稍后重试');
  } finally {
    busy = false;
  }
};

const saveDialog = () => {
  if (dialogMode === 'create') {
    void saveCreate();
    return;
  }
  void saveEditor();
};

const deleteEntry = async (trigger: HTMLElement) => {
  if (busy) {
    errors = [];
    setStatus('warn', '操作进行中');
    return;
  }

  const rawCollection = trigger.dataset.collection?.trim() ?? '';
  const entryId = trigger.dataset.entryId?.trim() ?? '';
  const expectedRelativePath = trigger.dataset.relativePath?.trim() ?? '';

  if (!isAdminContentDeletableCollectionKey(rawCollection) || !entryId || !expectedRelativePath) {
    errors = [];
    setStatus('error', '删除信息不完整，请刷新后重试');
    return;
  }

  busy = true;
  errors = [];
  issues = [];
  setStatus('loading', '正在确认删除');

  try {
    // 列表中的 revision 可能已经过期，确认前先读取一次最新文件状态。
    const loadResponse = await fetch(buildEntryEndpoint(rawCollection, entryId), {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      cache: 'no-store'
    });
    const loadPayload = await parseResponseBody(loadResponse);
    const entryPayload = getDeletePayload(loadPayload, rawCollection, entryId);

    if (!loadResponse.ok || !isPayloadOk(loadPayload) || !entryPayload) {
      const payloadErrors = getPayloadErrors(loadPayload);
      errors = payloadErrors;
      issues = getPayloadIssues(loadPayload);
      setStatus('error', payloadErrors.length > 0 ? '删除确认失败' : '删除确认失败，请刷新后重试');
      return;
    }

    if (entryPayload.relativePath !== expectedRelativePath) {
      errors = [];
      setStatus('warn', '列表已过期，请刷新后再删除');
      return;
    }

    const title = getRowTitle(trigger, entryId);
    const confirmed = window.confirm([
      `确认删除《${title}》？`,
      '',
      `类型：${getRowCollectionLabel(trigger)}`,
      `源文件：${entryPayload.relativePath}`,
      '',
      '文件会移到 .trash/content/，之后可从回收站手动恢复。'
    ].join('\n'));

    if (!confirmed) {
      setStatus('ready', '已取消删除', { autoClear: true });
      return;
    }

    setStatus('loading', '正在删除');
    const deleteResponse = await fetch(deleteEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8'
      },
      cache: 'no-store',
      body: JSON.stringify({
        collection: rawCollection,
        entryId,
        revision: entryPayload.revision,
        expectedRelativePath: entryPayload.relativePath
      })
    });
    const deletePayload = await parseResponseBody(deleteResponse);

    if (!deleteResponse.ok || !isPayloadOk(deletePayload)) {
      const payloadErrors = getPayloadErrors(deletePayload);
      errors = payloadErrors;
      issues = getPayloadIssues(deletePayload);
      const state = deleteResponse.status === 409 ? 'warn' : 'error';
      const fallbackText = deleteResponse.status === 409 ? '检测到外部更新' : '删除失败，请检查控制台日志';
      setStatus(state, payloadErrors.length > 0 ? (deleteResponse.status === 409 ? '检测到外部更新' : '删除失败') : fallbackText);
      return;
    }

    const result = getPayloadDeleteResult(deletePayload);
    if (!result || !result.deleted || !result.trashedPath) {
      errors = [];
      setStatus('error', '删除响应异常，请检查开发日志');
      return;
    }

    removeDeletedRowFromList(trigger);
    setStatus('ok', '已移到回收站', { autoClear: true });
  } catch {
    errors = [];
    setStatus('error', '删除请求失败，请稍后重试');
  } finally {
    busy = false;
  }
};

const handleClick = (event: MouseEvent) => {
  if (!(event.target instanceof Element)) return;

  const createTrigger = event.target.closest<HTMLElement>('[data-admin-content-create-action]');
  if (createTrigger) {
    event.preventDefault();
    void openCreateDialog(createTrigger);
    return;
  }

  const deleteTrigger = event.target.closest<HTMLElement>('[data-admin-content-delete-action]');
  if (deleteTrigger) {
    event.preventDefault();
    closeActionMenu(deleteTrigger);
    void deleteEntry(deleteTrigger);
    return;
  }

  const trigger = event.target.closest<HTMLElement>('[data-admin-content-info-action]');
  if (!trigger) return;

  const entryId = trigger.dataset.entryId?.trim() ?? '';
  if (!entryId) return;

  event.preventDefault();
  closeActionMenu(trigger);
  void openEditor(entryId, trigger);
};

onMount(() => {
  if (takeStoredDeleteFeedback()) {
    setStatus('ok', '已移到回收站', { autoClear: true });
  }

  return clearStatusFeedbackTimer;
});

$effect(() => {
  document.querySelectorAll<HTMLButtonElement>('[data-admin-content-create-action]').forEach((button) => {
    button.disabled = busy;
  });
  document.querySelectorAll<HTMLButtonElement>('[data-admin-content-delete-action]').forEach((button) => {
    button.disabled = busy;
  });
});

$effect(() => {
  if (frontmatter?.title) {
    syncCreateEntryIdFromTitle();
  }
});

$effect(() => {
  const cleanupDetailsMenus = initAdminDetailsMenus({
    selector: '.admin-content-item__more'
  });
  document.addEventListener('click', handleClick);
  return () => {
    cleanupDetailsMenus();
    document.removeEventListener('click', handleClick);
  };
});
</script>

{#if frontmatter}
  <ArticleInfoDialog
    bind:this={dialog}
    bind:value={frontmatter}
    collection="essay"
    {open}
    {issues}
    disabled={busy}
    loading={loadingEntry}
    {dirty}
    {canSave}
    entryId={dialogMode === 'create' ? createEntryId : selectedEntryId}
    showEntryId={dialogMode === 'create'}
    {slugPlaceholder}
    dialogTitle={dialogMode === 'create' ? '新增文章' : '文章信息'}
    fieldsAriaLabel="随笔字段"
    draftLocked={dialogMode === 'create'}
    draftLockHelp={dialogMode === 'create' ? '默认草稿，完善正文后发布。' : ''}
    saveLabel={dialogMode === 'create' ? '创建' : '保存'}
    onEntryIdInput={updateCreateEntryId}
    onClose={closeDialog}
    onReset={resetToBaseline}
    onSave={saveDialog}
  />
{/if}

<div class="admin-content-action-feedback">
  <p class="admin-status admin-content-action-status" data-state={statusState} role="status" aria-live="polite" aria-atomic="true">
    {statusText}
  </p>

  {#if errors.length > 0}
    <div class="admin-content-action-errors" role="alert">
      {#each errors as error}
        <p>{error}</p>
      {/each}
    </div>
  {/if}
</div>
