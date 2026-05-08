<script lang="ts">
import { tick } from 'svelte';
import type {
  AdminContentEditorPayload,
  AdminEssayEditorValues
} from '../../../lib/admin-console/content-shared';
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
  isRecord,
  parseResponseBody,
  type AdminContentIssue,
  type AdminContentWriteResult
} from '../../../scripts/admin-content/entry-transport';
import { createWithBase } from '../../../utils/format';
import { flattenEntryIdToSlug } from '../../../utils/slug-rules';
import ArticleInfoDialog from './ArticleInfoDialog.svelte';

type StatusState = 'idle' | 'loading' | 'ready' | 'ok' | 'warn' | 'error';

type Props = {
  base?: string;
  endpoint: string;
  deleteEndpoint: string;
};

let { base = '/', endpoint, deleteEndpoint }: Props = $props();

let dialog = $state<ArticleInfoDialog | null>(null);
let open = $state(false);
let busy = $state(false);
let loadingEntry = $state(false);
let loadRequestId = 0;
let selectedEntryId = $state('');
let selectedDefaultPublicSlug = $state('');
let selectedTrigger = $state<HTMLElement | null>(null);
let revision = $state('');
let baselineFrontmatter = $state<AdminEssayEditorValues | null>(null);
let frontmatter = $state<AdminEssayEditorValues | null>(null);
let issues = $state<AdminContentIssue[]>([]);
let errors = $state<string[]>([]);
let statusState = $state<StatusState>('idle');
let statusText = $state('等待选择条目');

const cloneFrontmatter = (value: AdminEssayEditorValues): AdminEssayEditorValues => ({
  title: value.title,
  description: value.description,
  date: value.date,
  publishedAt: value.publishedAt,
  tagsText: value.tagsText,
  draft: value.draft,
  archive: value.archive,
  slug: value.slug,
  cover: value.cover,
  badge: value.badge
});

const createEmptyFrontmatter = (): AdminEssayEditorValues => ({
  title: '',
  description: '',
  date: '',
  publishedAt: '',
  tagsText: '',
  draft: false,
  archive: true,
  slug: '',
  cover: '',
  badge: ''
});

const isEqualFrontmatter = (left: AdminEssayEditorValues | null, right: AdminEssayEditorValues | null): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const dirty = $derived(!isEqualFrontmatter(frontmatter, baselineFrontmatter));
const canSave = $derived(Boolean(frontmatter) && dirty && !busy);
const slugPlaceholder = $derived(selectedDefaultPublicSlug || (selectedEntryId ? flattenEntryIdToSlug(selectedEntryId) : ''));
const withBase = $derived(createWithBase(base));

const setStatus = (state: StatusState, text: string) => {
  statusState = state;
  statusText = text;
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
    setStatus('idle', '等待选择条目');
  }
  open = false;
  selectedTrigger = null;
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
  issues = [];
  errors = [];
  setStatus('ready', '已还原到当前加载版本');
};

const closeActionMenus = (except?: HTMLDetailsElement | null) => {
  document.querySelectorAll<HTMLDetailsElement>('.admin-content-item__more[open]').forEach((details) => {
    if (details !== except) details.open = false;
  });
};

const closeActionMenu = (trigger: HTMLElement) => {
  const details = trigger.closest<HTMLDetailsElement>('.admin-content-item__more');
  if (details) details.open = false;
};

const getRowTitle = (trigger: HTMLElement, entryId: string): string => {
  const row = trigger.closest<HTMLElement>('[data-admin-content-item]');
  return row?.querySelector<HTMLElement>('[data-admin-content-row-title]')?.textContent?.trim() || entryId;
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
  busy = true;
  loadingEntry = true;
  open = false;
  selectedEntryId = entryId;
  selectedDefaultPublicSlug = '';
  selectedTrigger = trigger;
  revision = '';
  baselineFrontmatter = null;
  frontmatter = createEmptyFrontmatter();
  issues = [];
  errors = [];
  setStatus('loading', '正在加载文章信息');

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

    if (!response.ok || !isRecord(payload) || payload.ok !== true || !essayPayload) {
      errors = getPayloadErrors(payload).length > 0
        ? getPayloadErrors(payload)
        : ['文章信息加载失败，请进入编辑页处理'];
      issues = getPayloadIssues(payload);
      loadingEntry = false;
      open = false;
      frontmatter = null;
      setStatus('error', '文章信息加载失败');
      return;
    }

    revision = essayPayload.revision;
    selectedDefaultPublicSlug = essayPayload.defaultPublicSlug;
    baselineFrontmatter = cloneFrontmatter(essayPayload.values);
    frontmatter = cloneFrontmatter(essayPayload.values);
    loadingEntry = false;
    await tick();
    if (requestId !== loadRequestId) return;
    setStatus('ready', '文章信息已加载');
  } catch {
    if (requestId !== loadRequestId) return;
    errors = ['文章信息请求失败，请稍后重试'];
    loadingEntry = false;
    open = false;
    frontmatter = null;
    setStatus('error', '文章信息请求失败');
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
  setStatus('loading', '正在保存文章信息');

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

    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      issues = getPayloadIssues(payload);
      errors = getPayloadErrors(payload).length > 0
        ? getPayloadErrors(payload)
        : ['文章信息保存失败，请检查当前表单与磁盘状态'];
      setStatus(response.status === 409 ? 'warn' : 'error', response.status === 409 ? '检测到外部更新' : '文章信息保存失败');
      return;
    }

    const result = getPayloadResult(payload);
    const latestPayload = getPayloadEssayPayload(payload);
    if (!result || !latestPayload) {
      errors = ['保存响应缺少必要结果，请检查开发日志'];
      setStatus('error', '保存响应缺少结果');
      return;
    }

    baselineFrontmatter = cloneFrontmatter(latestPayload.values);
    frontmatter = cloneFrontmatter(latestPayload.values);
    revision = latestPayload.revision;
    syncSelectedRow(result);
    setStatus(result.changed ? 'ok' : 'ready', result.changed ? '文章信息已保存' : '当前文章信息没有变化');
    if (result.changed) {
      restoreFocusAndCloseDialog();
    }
  } catch {
    errors = ['文章信息保存请求失败，请稍后重试'];
    setStatus('error', '保存请求失败');
  } finally {
    busy = false;
  }
};

const deleteEntry = async (trigger: HTMLElement) => {
  if (busy) {
    setStatus('warn', '当前有操作进行中');
    return;
  }

  const rawCollection = trigger.dataset.collection?.trim() ?? '';
  const entryId = trigger.dataset.entryId?.trim() ?? '';
  const expectedRelativePath = trigger.dataset.relativePath?.trim() ?? '';

  if (!isAdminContentDeletableCollectionKey(rawCollection) || !entryId || !expectedRelativePath) {
    errors = ['删除动作缺少必要的条目信息，请刷新列表后重试'];
    setStatus('error', '删除初始化失败');
    return;
  }

  busy = true;
  errors = [];
  issues = [];
  setStatus('loading', '正在读取删除确认信息');

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

    if (!loadResponse.ok || !isRecord(loadPayload) || loadPayload.ok !== true || !entryPayload) {
      errors = getPayloadErrors(loadPayload).length > 0
        ? getPayloadErrors(loadPayload)
        : ['删除确认信息加载失败，请刷新列表后重试'];
      issues = getPayloadIssues(loadPayload);
      setStatus('error', '删除确认失败');
      return;
    }

    if (entryPayload.relativePath !== expectedRelativePath) {
      errors = ['当前列表中的文件路径已过期，请刷新后再删除'];
      setStatus('warn', '列表状态已过期');
      return;
    }

    const title = getRowTitle(trigger, entryId);
    const confirmed = window.confirm([
      `确认删除「${title}」？`,
      '',
      `Collection: ${rawCollection}`,
      `Entry: ${entryId}`,
      `文件: ${entryPayload.relativePath}`,
      '',
      '文件会移动到 .trash/content/ 下，可从回收站手动恢复。'
    ].join('\n'));

    if (!confirmed) {
      setStatus('ready', '已取消删除');
      return;
    }

    setStatus('loading', '正在移动到回收站');
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

    if (!deleteResponse.ok || !isRecord(deletePayload) || deletePayload.ok !== true) {
      errors = getPayloadErrors(deletePayload).length > 0
        ? getPayloadErrors(deletePayload)
        : ['删除失败，请检查响应与控制台日志'];
      issues = getPayloadIssues(deletePayload);
      setStatus(deleteResponse.status === 409 ? 'warn' : 'error', deleteResponse.status === 409 ? '检测到外部更新' : '删除失败');
      return;
    }

    const result = getPayloadDeleteResult(deletePayload);
    if (!result || !result.deleted || !result.trashedPath) {
      errors = ['删除响应缺少回收站路径，请检查开发日志'];
      setStatus('error', '删除响应缺少结果');
      return;
    }

    setStatus('ok', `已移动到回收站：${result.trashedPath}`);
    window.setTimeout(() => {
      window.location.reload();
    }, 480);
  } catch {
    errors = ['删除请求失败，请稍后重试'];
    setStatus('error', '删除请求失败');
  } finally {
    busy = false;
  }
};

const handleClick = (event: MouseEvent) => {
  if (!(event.target instanceof Element)) return;
  const currentMenu = event.target.closest<HTMLDetailsElement>('.admin-content-item__more');
  const summary = event.target.closest<HTMLElement>('.admin-content-item__more > summary');
  if (summary) {
    closeActionMenus(currentMenu);
    return;
  }
  if (!currentMenu) closeActionMenus();

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

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || open) return;
  const openMenu = document.querySelector<HTMLDetailsElement>('.admin-content-item__more[open]');
  if (!openMenu) return;

  event.preventDefault();
  openMenu.open = false;
  openMenu.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
};

$effect(() => {
  document.querySelectorAll<HTMLButtonElement>('[data-admin-content-delete-action]').forEach((button) => {
    button.disabled = busy;
  });
});

$effect(() => {
  document.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleKeydown);
  return () => {
    document.removeEventListener('click', handleClick);
    document.removeEventListener('keydown', handleKeydown);
  };
});
</script>

{#if frontmatter}
  <ArticleInfoDialog
    bind:this={dialog}
    bind:value={frontmatter}
    {open}
    {issues}
    disabled={busy}
    loading={loadingEntry}
    {dirty}
    {canSave}
    {slugPlaceholder}
    onClose={closeDialog}
    onReset={resetToBaseline}
    onSave={() => void saveEditor()}
  />
{/if}

<div class="admin-content-list-action-status" data-state={statusState} role="status" aria-live="polite" aria-atomic="true">
  {statusText}
</div>

{#if errors.length > 0}
  <div class="admin-content-list-action-errors" role="alert">
    {#each errors as error}
      <p>{error}</p>
    {/each}
  </div>
{/if}
