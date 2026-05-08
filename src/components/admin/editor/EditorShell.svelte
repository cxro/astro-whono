<script lang="ts">
import type { AdminEssayEditorValues } from '../../../lib/admin-console/content-shared';
import { shouldGuardAdminNavigation } from '../../../scripts/admin-console/navigation-guard';
import {
  getPayloadErrors,
  getPayloadEssayBody,
  getPayloadEssayValues,
  getPayloadIssues,
  getPayloadPreviewResult,
  getPayloadResult,
  getPayloadRevision,
  isRecord,
  parseResponseBody,
  type AdminContentIssue,
  type AdminContentWriteResult
} from '../../../scripts/admin-content/entry-transport';
import { flattenEntryIdToSlug } from '../../../utils/slug-rules';
import AdminEditorIcon from './AdminEditorIcon.svelte';
import ArticleInfoDialog from './ArticleInfoDialog.svelte';
import BodyEditor from './BodyEditor.svelte';
import ImageInsertDialog from './ImageInsertDialog.svelte';
import {
  createEmptyMarkdownToolbarState,
  isToggleMarkdownTool,
  type MarkdownToolbarCommand,
  type MarkdownToolbarState,
  type MarkdownToolId
} from './markdown-tools';
import PreviewPane from './PreviewPane.svelte';

type StatusState = 'idle' | 'loading' | 'ready' | 'ok' | 'warn' | 'error';

const getPreviewDebounceMs = (source: string): number => {
  const length = source.length;
  if (length >= 12000) return 700;
  if (length >= 6000) return 480;
  if (length >= 3000) return 320;
  return 220;
};

const LEAVE_CONFIRM_MESSAGE = '当前有未保存更改，确定要离开此页吗？';
const ARTICLE_INFO_TRIGGER_SELECTOR = '[data-admin-article-info-trigger]';
const FRONTMATTER_PANEL_ID = 'admin-editor-frontmatter-panel';
const FRONTMATTER_ISSUE_PATHS = new Set(['title', 'date', 'description', 'tags', 'slug', 'badge', 'cover']);

const markdownTools = [
  { id: 'heading', label: '二级标题', icon: 'heading' },
  { id: 'bold', label: '加粗', icon: 'bold' },
  { id: 'italic', label: '斜体', icon: 'italic' },
  { id: 'quote', label: '引用', icon: 'quote' },
  { id: 'link', label: '链接', icon: 'link' },
  { id: 'image', label: '图片', icon: 'image' },
  { id: 'code', label: '行内代码', icon: 'code' },
  { id: 'codeBlock', label: '代码块', icon: 'code-block' },
  { id: 'list', label: '无序列表', icon: 'list' },
  { id: 'orderedList', label: '有序列表', icon: 'ordered-list' },
  { id: 'taskList', label: '任务列表', icon: 'task-list' },
  { id: 'table', label: '表格', icon: 'table' }
] as const;

type Props = {
  endpoint: string;
  previewEndpoint: string;
  imageUploadEndpoint: string;
  collection: 'essay';
  entryId: string;
  defaultPublicSlug: string;
  revision: string;
  initialFrontmatter: AdminEssayEditorValues;
  initialBody: string;
  initialArticleInfoOpen?: boolean;
};

let {
  endpoint,
  previewEndpoint,
  imageUploadEndpoint,
  collection,
  entryId,
  defaultPublicSlug,
  revision,
  initialFrontmatter,
  initialBody,
  initialArticleInfoOpen = false
}: Props = $props();

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

const isEqualFrontmatter = (left: AdminEssayEditorValues, right: AdminEssayEditorValues): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const slugPlaceholder = $derived(defaultPublicSlug || flattenEntryIdToSlug(entryId));

const createInitialSnapshot = () => ({
  revision,
  frontmatter: cloneFrontmatter(initialFrontmatter),
  body: initialBody
});

const initialSnapshot = createInitialSnapshot();

let currentRevision = $state(initialSnapshot.revision);
let baselineFrontmatter = $state(cloneFrontmatter(initialSnapshot.frontmatter));
let baselineBody = $state(initialSnapshot.body);
let frontmatter = $state(cloneFrontmatter(initialSnapshot.frontmatter));
let body = $state(initialSnapshot.body);
let busy = $state(false);
let previewBusy = $state(false);
let statusState = $state<StatusState>('idle');
let statusText = $state('等待编辑');
let errors = $state<string[]>([]);
let issues = $state<AdminContentIssue[]>([]);
let writeResult = $state<AdminContentWriteResult | null>(null);
let previewHtml = $state('');
let previewWarnings = $state<string[]>([]);
let previewElapsedMs = $state<number | null>(null);
let previewCodeHighlight = $state('');
let previewError = $state('');
let previewRequestId = 0;
let previewTimer: number | null = null;
let activePreviewAbortController: AbortController | null = null;
let latestPreviewSource = '';
let previewInitialized = false;
let toolbarCommandId = 0;
let toolbarCommand = $state<MarkdownToolbarCommand | null>(null);
let toolbarState = $state<MarkdownToolbarState>(createEmptyMarkdownToolbarState());
let frontmatterPanelOpen = $state(initialArticleInfoOpen);
let articleInfoDialog = $state<ArticleInfoDialog | null>(null);
let imageInsertOpen = $state(false);

const frontmatterDirty = $derived(!isEqualFrontmatter(frontmatter, baselineFrontmatter));
const bodyDirty = $derived(body !== baselineBody);
const isDirty = $derived(frontmatterDirty || bodyDirty);
const canWriteContent = $derived(!busy && isDirty);
const frontmatterIssueCount = $derived(issues.filter((issue) => FRONTMATTER_ISSUE_PATHS.has(issue.path)).length);

const setStatus = (state: StatusState, text: string) => {
  statusState = state;
  statusText = text;
};

const clearWriteFeedback = () => {
  errors = [];
  issues = [];
  writeResult = null;
};

const isToolbarToolActive = (toolId: MarkdownToolId): boolean =>
  toolId in toolbarState ? toolbarState[toolId as keyof MarkdownToolbarState] : false;

const applyToolbarTool = (toolId: MarkdownToolId) => {
  if (busy) return;
  if (toolId === 'image') {
    imageInsertOpen = true;
    return;
  }

  toolbarCommandId += 1;
  toolbarCommand = { id: toolbarCommandId, kind: 'tool', toolId };
};

const insertMarkdownText = (text: string) => {
  toolbarCommandId += 1;
  toolbarCommand = { id: toolbarCommandId, kind: 'insert', text };
};

const closeImageInsert = () => {
  imageInsertOpen = false;
};

const closeFrontmatterPanel = () => {
  frontmatterPanelOpen = false;
};

const openFrontmatterPanel = (trigger?: HTMLElement | null) => {
  if (!frontmatterPanelOpen) {
    articleInfoDialog?.captureReturnFocus(trigger);
  }
  frontmatterPanelOpen = true;
};

const toggleFrontmatterPanel = (trigger?: HTMLElement | null) => {
  if (frontmatterPanelOpen) {
    closeFrontmatterPanel();
    return;
  }

  openFrontmatterPanel(trigger);
};

const clearPreviewTimer = () => {
  if (previewTimer === null) return;
  window.clearTimeout(previewTimer);
  previewTimer = null;
};

const abortActivePreviewRequest = (invalidate = false) => {
  if (invalidate) previewRequestId += 1;
  activePreviewAbortController?.abort();
  activePreviewAbortController = null;
  if (invalidate) previewBusy = false;
};

const requestContentWrite = async () => {
  busy = true;
  clearWriteFeedback();
  setStatus('loading', '正在写入内容');

  try {
    const requestPayload = {
      collection,
      entryId,
      revision: currentRevision,
      frontmatter,
      ...(bodyDirty ? { body } : {})
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8'
      },
      cache: 'no-store',
      body: JSON.stringify(requestPayload)
    });

    const payload = await parseResponseBody(response);
    const nextRevision = getPayloadRevision(payload);
    if (nextRevision && response.ok) currentRevision = nextRevision;

    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const nextIssues = getPayloadIssues(payload);
      issues = nextIssues;
      errors = getPayloadErrors(payload);
      if (errors.length === 0) {
        errors = ['写入内容失败，请检查响应与控制台日志'];
      }
      if (response.status === 409) {
        window.alert(errors[0] ?? '检测到内容文件已在外部更新，已拒绝覆盖，请刷新当前条目后再保存');
      }
      setStatus(response.status === 409 ? 'warn' : 'error', '写入失败');
      return;
    }

    const result = getPayloadResult(payload);
    if (!result) {
      errors = ['响应体缺少 result 字段，请检查开发日志'];
      setStatus('error', '写入响应缺少结果摘要');
      return;
    }

    writeResult = result;
    const latestValues = getPayloadEssayValues(payload);
    const latestBody = getPayloadEssayBody(payload);
    const nextBaseline = latestValues ? cloneFrontmatter(latestValues) : cloneFrontmatter(frontmatter);
    frontmatter = cloneFrontmatter(nextBaseline);
    baselineFrontmatter = cloneFrontmatter(nextBaseline);
    baselineBody = latestBody ?? body;
    body = baselineBody;

    if (!result.changed) {
      setStatus('ready', '当前内容没有变化');
      return;
    }

    setStatus('ok', '内容已写入');
  } catch {
    errors = ['写入内容请求失败，请稍后重试'];
    setStatus('error', '写入请求失败');
  } finally {
    busy = false;
  }
};

const requestPreview = async () => {
  const requestId = previewRequestId + 1;
  previewRequestId = requestId;
  const sourceSnapshot = body;
  latestPreviewSource = sourceSnapshot;

  activePreviewAbortController?.abort();
  const abortController = new AbortController();
  activePreviewAbortController = abortController;

  previewBusy = true;
  previewError = '';
  previewWarnings = [];
  setStatus('loading', '正在生成预览');

  try {
    const response = await fetch(previewEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8'
      },
      cache: 'no-store',
      signal: abortController.signal,
      body: JSON.stringify({
        collection,
        entryId,
        source: sourceSnapshot
      })
    });

    const payload = await parseResponseBody(response);
    if (requestId !== previewRequestId) return;
    if (sourceSnapshot !== body) {
      return;
    }

    const previewResult = getPayloadPreviewResult(payload);
    if (!response.ok || !isRecord(payload) || payload.ok !== true || !previewResult) {
      const payloadErrors = getPayloadErrors(payload);
      previewError = payloadErrors[0] ?? '预览生成失败，请检查响应与控制台日志';
      setStatus('error', '预览生成失败');
      return;
    }

    previewHtml = previewResult.html;
    previewWarnings = previewResult.warnings;
    previewElapsedMs = previewResult.elapsedMs;
    previewCodeHighlight = previewResult.codeHighlight;
    setStatus(isDirty ? 'warn' : 'ready', isDirty ? '预览已更新，当前存在未写盘修改' : '预览已更新');
  } catch {
    if (abortController.signal.aborted) return;
    if (requestId !== previewRequestId) return;
    previewError = '预览请求失败，请稍后重试';
    setStatus('error', '预览请求失败');
  } finally {
    if (requestId === previewRequestId) {
      previewBusy = false;
      if (activePreviewAbortController === abortController) {
        activePreviewAbortController = null;
      }
    }
  }
};

const resetToBaseline = () => {
  frontmatter = cloneFrontmatter(baselineFrontmatter);
  body = baselineBody;
  clearWriteFeedback();
  setStatus('ready', '已还原到当前载入版本');
};

const handleGuardedNavigationClick = (event: MouseEvent) => {
  if (!isDirty) return;
  if (!(event.target instanceof Element)) return;

  const anchor = event.target.closest('a[href]');
  if (!(anchor instanceof HTMLAnchorElement)) return;

  if (
    !shouldGuardAdminNavigation({
      isDirty,
      currentUrl: window.location.href,
      nextUrl: anchor.href,
      button: event.button,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      target: anchor.target,
      download: anchor.hasAttribute('download')
    })
  ) {
    return;
  }

  if (window.confirm(LEAVE_CONFIRM_MESSAGE)) return;

  event.preventDefault();
  event.stopPropagation();
  setStatus('warn', '已取消页面切换，请先保存或还原当前更改');
};

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (!isDirty) return;

  event.preventDefault();
  Reflect.set(event, 'returnValue', '');
};

const handleArticleInfoTriggerClick = (event: MouseEvent) => {
  if (!(event.target instanceof Element)) return;
  const trigger = event.target.closest(ARTICLE_INFO_TRIGGER_SELECTOR);
  if (!(trigger instanceof HTMLButtonElement)) return;

  event.preventDefault();
  toggleFrontmatterPanel(trigger);
};

$effect(() => {
  document.addEventListener('click', handleGuardedNavigationClick, true);
  document.addEventListener('click', handleArticleInfoTriggerClick);
  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    document.removeEventListener('click', handleGuardedNavigationClick, true);
    document.removeEventListener('click', handleArticleInfoTriggerClick);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
});

$effect(() => {
  const triggers = document.querySelectorAll<HTMLButtonElement>(ARTICLE_INFO_TRIGGER_SELECTOR);
  triggers.forEach((trigger) => {
    trigger.setAttribute('aria-controls', FRONTMATTER_PANEL_ID);
    trigger.setAttribute('aria-expanded', frontmatterPanelOpen ? 'true' : 'false');
    trigger.dataset.state = frontmatterPanelOpen ? 'open' : 'closed';
    trigger.dataset.dirty = frontmatterDirty ? 'true' : 'false';
    trigger.dataset.invalid = frontmatterIssueCount > 0 ? 'true' : 'false';
  });
});

$effect(() => {
  if (frontmatterIssueCount > 0 && !frontmatterPanelOpen) {
    openFrontmatterPanel();
  }
});

$effect(() => {
  const currentBody = body;

  if (!previewInitialized) {
    previewInitialized = true;
    void requestPreview();
    return;
  }

  if (currentBody === latestPreviewSource) {
    clearPreviewTimer();
    return;
  }

  abortActivePreviewRequest(true);
  previewTimer = window.setTimeout(() => {
    previewTimer = null;
    void requestPreview();
  }, getPreviewDebounceMs(currentBody));

  return clearPreviewTimer;
});
</script>

<section class="admin-editor-shell">
  <div class="admin-editor-shell__format-row">
    <div class="admin-editor-markdown-toolbar" role="toolbar" aria-label="Markdown 常用格式">
      {#each markdownTools as tool}
        {@const active = isToolbarToolActive(tool.id)}
        <button
          class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-editor-markdown-toolbar__button"
          class:is-active={active}
          type="button"
          title={tool.label}
          aria-label={tool.label}
          aria-pressed={isToggleMarkdownTool(tool.id) ? active : undefined}
          disabled={busy}
          onclick={() => applyToolbarTool(tool.id)}
        >
          <AdminEditorIcon name={tool.icon} size={16} strokeWidth={2} />
        </button>
      {/each}
    </div>
  </div>

  {#if errors.length > 0}
    <div class="admin-banner admin-banner--error admin-editor-shell__banner" role="alert">
      <div>
        <p class="admin-banner__label">写入异常</p>
        <h3 class="admin-banner__title">内容未写入</h3>
      </div>
      <ul class="admin-banner__list">
        {#each errors as error}
          <li class="admin-banner__list-item">{error}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="admin-editor-shell__layout">
    <div class="admin-editor-shell__workspace">
      <div class="admin-editor-shell__pane admin-editor-shell__pane--body">
        <BodyEditor
          bind:value={body}
          disabled={busy}
          bodyPersistEnabled={true}
          {toolbarCommand}
          onToolbarStateChange={(nextToolbarState) => {
            toolbarState = nextToolbarState;
          }}
        />
      </div>
      <div class="admin-editor-shell__pane admin-editor-shell__pane--preview">
        <PreviewPane
          html={previewHtml}
          loading={previewBusy}
          error={previewError}
          warnings={previewWarnings}
          elapsedMs={previewElapsedMs}
          codeHighlight={previewCodeHighlight}
        />
      </div>
    </div>
  </div>

  <ArticleInfoDialog
    bind:this={articleInfoDialog}
    bind:value={frontmatter}
    open={frontmatterPanelOpen}
    {issues}
    disabled={busy}
    dirty={isDirty}
    canSave={canWriteContent}
    {slugPlaceholder}
    onClose={closeFrontmatterPanel}
    onReset={resetToBaseline}
    onSave={() => void requestContentWrite()}
  />

  {#if writeResult}
    <article class="admin-content-write-preview">
      <p class="admin-content-section-title">写入结果</p>
      <p class="admin-content-copy">
        {writeResult.changed ? `${writeResult.relativePath || '当前条目'} 已更新以下字段。` : '当前内容与磁盘文件一致，不需要写盘。'}
      </p>
      <ul class="admin-content-editor__preview-list">
        {#if writeResult.changedFields.length === 0}
          <li class="admin-content-editor__preview-item">没有检测到字段变化。</li>
        {:else}
          {#each writeResult.changedFields as field}
            <li class="admin-content-editor__preview-item">{field}</li>
          {/each}
        {/if}
      </ul>
    </article>
  {/if}

  <ImageInsertDialog
    open={imageInsertOpen}
    uploadEndpoint={imageUploadEndpoint}
    {entryId}
    disabled={busy}
    onClose={closeImageInsert}
    onInsert={(markdown, result) => {
      insertMarkdownText(markdown);
      setStatus('ok', `已插入图片：${result.fileName}`);
    }}
  />

  <div class="admin-content-toolbar__footer admin-editor-shell__actions">
    <div class="admin-editor-shell__footer-copy">
      <div class="admin-editor-shell__status">
        <p class="admin-status" data-state={statusState} role="status" aria-live="polite" aria-atomic="true">{statusText}</p>
      </div>
    </div>
    <div class="admin-content-actions">
      <button class="admin-btn admin-btn--ghost" type="button" onclick={resetToBaseline} disabled={busy || !isDirty}>
        还原
      </button>
      <button class="admin-btn admin-btn--primary" type="button" onclick={() => void requestContentWrite()} disabled={!canWriteContent}>
        保存内容
      </button>
    </div>
  </div>
</section>
