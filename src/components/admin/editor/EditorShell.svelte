<script lang="ts">
import { tick } from 'svelte';
import type { AdminEssayEditorValues } from '../../../lib/admin-console/content-shared';
import {
  cloneFrontmatter,
  isEqualFrontmatter
} from '../../../lib/admin-console/essay-editor-values';
import { shouldGuardAdminNavigation } from '../../../scripts/admin-console/navigation-guard';
import {
  closeClosestAdminDetailsMenu,
  initAdminDetailsMenus
} from '../../../scripts/admin-content/details-menu';
import {
  getPayloadDeleteResult,
  getPayloadErrors,
  getPayloadEssayBody,
  getPayloadEssayValues,
  getPayloadIssues,
  getPayloadPreviewResult,
  getPayloadResult,
  getPayloadRevision,
  isPayloadOk,
  parseResponseBody,
  type AdminContentIssue,
  type AdminContentWriteResult
} from '../../../scripts/admin-content/entry-transport';
import { flattenEntryIdToSlug } from '../../../utils/slug-rules';
import ArticleInfoDialog from './ArticleInfoDialog.svelte';
import BodyEditor from './BodyEditor.svelte';
import EditorActionMenu from './EditorActionMenu.svelte';
import EditorOutlinePanel from './EditorOutlinePanel.svelte';
import EditorToolbar from './EditorToolbar.svelte';
import ImageInsertDialog from './ImageInsertDialog.svelte';
import {
  CONTENT_LIST_DELETE_FEEDBACK_STORAGE_KEY,
  CONTENT_LIST_DELETE_FEEDBACK_VALUE
} from './content-list-feedback';
import {
  buildContentExportHref,
  clearAllScrollbarVisibilityTimers,
  clearScrollbarVisibilityTimer,
  clearStoredWriteFeedback,
  getOppositeScrollSource,
  getPreviewDebounceMs,
  getScrollableDistance,
  getScrollRatio,
  getWriteFieldLabel,
  markScrollElementScrolling,
  normalizeEditorTextareaValue,
  readStoredEditorLayout,
  readStoredEditorOutlineState,
  readStoredWriteFeedback,
  storeEditorLayout,
  storeEditorOutlineState,
  storeWriteFeedback,
  type EditorLayoutMode,
  type EditorPaneMode,
  type EditorScrollSource,
  type EditorViewMode,
  type StatusState
} from './editor-shell-helpers';
import {
  buildEssayOutlineListItems,
  extractMarkdownOutline,
  type EditorOutlineEssaySourceItem,
  type EditorOutlineTab,
  type MarkdownOutlineItem
} from './editor-outline-helpers';
import {
  scrollPreviewToOutlineKey as scrollPreviewElementToOutlineKey,
  scrollTextareaToOutlineItem as scrollTextareaElementToOutlineItem
} from './editor-outline-scroll';
import { type MarkdownHeadingLevel, type MarkdownToolbarCommand, type MarkdownToolId } from './markdown-tools';
import PreviewStatusBar from './PreviewStatusBar.svelte';
import PreviewPane from './PreviewPane.svelte';

const LEAVE_CONFIRM_MESSAGE = '当前有未保存更改，确定要离开此页吗？';
const ARTICLE_INFO_TRIGGER_SELECTOR = '[data-admin-article-info-trigger]';
const ADMIN_SIDEBAR_TOGGLE_ID = 'admin-sidebar-toggle';
const PAGE_ACTIONS_HOST_SELECTOR = '[data-admin-editor-page-actions-host]';
const FRONTMATTER_PANEL_ID = 'admin-editor-frontmatter-panel';
const OUTLINE_PANEL_ID = 'admin-editor-outline-panel';
const FRONTMATTER_ISSUE_PATHS = new Set(['title', 'date', 'publishedAt', 'description', 'tags', 'slug', 'badge', 'cover']);
const EDITOR_LAYOUT_STORAGE_KEY = 'astro-whono:admin-editor:layout';
const EDITOR_OUTLINE_STATE_STORAGE_KEY = 'astro-whono:admin-editor:outline-state';
const PREVIEW_OUTLINE_KEY_ATTR = 'data-admin-outline-key';
// 无显式偏好时优先 split，窄容器视觉回退由 effective view 派生。
const DEFAULT_EDITOR_LAYOUT_INTENT: EditorLayoutMode = 'split';
// 940px 是双 pane 与工具按钮保持可读后的最低稳定宽度；CSS 只消费 data-effective-view。
const EDITOR_SPLIT_MIN_INLINE_SIZE = 940;
const EDITOR_OUTLINE_VISIBLE_MIN_INLINE_SIZE = {
  // 目录是辅助导航；split + both 下允许主工作区轻微压缩，低于视觉验收线再收起。
  splitBoth: 996,
  // 单区/stacked 只有一个主要内容面板，可以比双栏模式更晚收起目录。
  linear: 900
} as const;
const WRITE_FEEDBACK_STORAGE_PREFIX = 'astro-whono:admin-editor:write-feedback:';
const WRITE_FEEDBACK_STORAGE_TTL_MS = 60 * 1000;
const SCROLLBAR_VISIBILITY_TIMEOUT_MS = 800;
const OUTLINE_TARGET_SCROLL_OFFSET_RATIO = 0.18;

type Props = {
  endpoint: string;
  exportEndpoint: string;
  deleteEndpoint: string;
  previewEndpoint: string;
  imageUploadEndpoint: string;
  returnHref: string;
  collection: 'essay';
  entryId: string;
  relativePath: string;
  defaultPublicSlug: string;
  revision: string;
  initialFrontmatter: AdminEssayEditorValues;
  initialBody: string;
  essayOutlineItems?: EditorOutlineEssaySourceItem[];
  initialArticleInfoOpen?: boolean;
};

let {
  endpoint,
  exportEndpoint,
  deleteEndpoint,
  previewEndpoint,
  imageUploadEndpoint,
  returnHref,
  collection,
  entryId,
  relativePath,
  defaultPublicSlug,
  revision,
  initialFrontmatter,
  initialBody,
  essayOutlineItems = [],
  initialArticleInfoOpen = false
}: Props = $props();

const slugPlaceholder = $derived(defaultPublicSlug || flattenEntryIdToSlug(entryId));

const createInitialSnapshot = () => ({
  revision,
  frontmatter: cloneFrontmatter(initialFrontmatter),
  body: normalizeEditorTextareaValue(initialBody),
  articleInfoOpen: initialArticleInfoOpen
});

const initialSnapshot = createInitialSnapshot();
const writeFeedbackStorageKey = $derived(`${WRITE_FEEDBACK_STORAGE_PREFIX}${collection}:${entryId}`);

let currentRevision = $state(initialSnapshot.revision);
let baselineFrontmatter = $state(cloneFrontmatter(initialSnapshot.frontmatter));
let baselineBody = $state(initialSnapshot.body);
let frontmatter = $state(cloneFrontmatter(initialSnapshot.frontmatter));
let body = $state(initialSnapshot.body);
let busy = $state(false);
let previewBusy = $state(false);
let statusState = $state<StatusState>('idle');
let statusText = $state('');
let errors = $state<string[]>([]);
let issues = $state<AdminContentIssue[]>([]);
let writeResult = $state<AdminContentWriteResult | null>(null);
let previewHtml = $state('');
let previewWarnings = $state<string[]>([]);
let previewError = $state('');
let explicitEditorLayout = $state<EditorLayoutMode | null>(null);
let editorViewMode = $state<EditorViewMode>('both');
let compactPaneMode = $state<EditorPaneMode>('edit');
let outlineWantedOpen = $state(false);
let outlineActiveTab = $state<EditorOutlineTab>('headings');
let editorLayoutRestored = false;
let editorOutlineStateRestored = false;
let previewRequestId = 0;
let previewTimer: number | null = null;
let activePreviewAbortController: AbortController | null = null;
let latestPreviewSource = '';
let adminSidebarExpanded = $state(false);
let outlineSidebarCollapseAttempted = false;
let outlineSidebarCollapseCheckFrame: number | null = null;
let previewInitialized = false;
let toolbarCommandId = 0;
let toolbarCommand = $state<MarkdownToolbarCommand | null>(null);
let frontmatterPanelOpen = $state(initialSnapshot.articleInfoOpen);
let articleInfoDialog = $state<ArticleInfoDialog | null>(null);
let imageInsertOpen = $state(false);
let editorShellEl = $state<HTMLElement | null>(null);
let editorShellInlineSize = $state(0);
let topActionsEl = $state<HTMLDivElement | null>(null);
let bodyScrollElement = $state<HTMLTextAreaElement | null>(null);
let previewScrollElement = $state<HTMLElement | null>(null);
let syncScrollEnabled = $state(true);
let writeFeedbackRestored = false;
let lastScrollSource: EditorScrollSource = 'body';
let pendingScrollSyncSource: EditorScrollSource | null = null;
let pendingPreviewOutlineKey = $state<string | null>(null);
let pendingPreviewOutlineJumpId = 0;
let scrollSyncFrame: number | null = null;
let scrollSyncReleaseFrame: number | null = null;
let applyingScrollSync = false;
const scrollbarVisibilityTimers = new Map<HTMLElement, number>();

const getOutlineMinInlineSize = (layout: EditorLayoutMode, viewMode: EditorViewMode): number =>
  layout === 'split' && viewMode === 'both'
    ? EDITOR_OUTLINE_VISIBLE_MIN_INLINE_SIZE.splitBoth
    : EDITOR_OUTLINE_VISIBLE_MIN_INLINE_SIZE.linear;

const isOutlineAvailableForInlineSize = (inlineSize: number): boolean => {
  const splitBothWouldBeCompact =
    editorLayout === 'split'
    && editorViewMode === 'both'
    && inlineSize > 0
    && inlineSize < EDITOR_SPLIT_MIN_INLINE_SIZE;
  return !splitBothWouldBeCompact && inlineSize >= getOutlineMinInlineSize(editorLayout, editorViewMode);
};

const syncAdminSidebarExpandedState = () => {
  if (typeof document === 'undefined') return;
  adminSidebarExpanded = document.documentElement.dataset.adminSidebar === 'expanded';
};

const collapseExpandedAdminSidebar = (): boolean => {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement;
  if (root.dataset.adminSidebar !== 'expanded') return false;

  const button = document.getElementById(ADMIN_SIDEBAR_TOGGLE_ID);
  if (!(button instanceof HTMLButtonElement)) return false;

  button.click();
  syncAdminSidebarExpandedState();
  return root.getAttribute('data-admin-sidebar') === 'collapsed';
};

const queueOutlineAvailabilityCheck = () => {
  if (typeof window === 'undefined') return;
  if (outlineSidebarCollapseCheckFrame !== null) {
    window.cancelAnimationFrame(outlineSidebarCollapseCheckFrame);
  }

  outlineSidebarCollapseCheckFrame = window.requestAnimationFrame(() => {
    outlineSidebarCollapseCheckFrame = null;
    const nextInlineSize = editorShellEl?.getBoundingClientRect().width ?? editorShellInlineSize;
    editorShellInlineSize = nextInlineSize;
  });
};

const bodyLineCount = $derived(body.length === 0 ? 1 : body.split(/\r\n|\r|\n/).length);
const bodyCharCount = $derived(body.length);
const frontmatterDirty = $derived(!isEqualFrontmatter(frontmatter, baselineFrontmatter));
const bodyDirty = $derived(body !== baselineBody);
const isDirty = $derived(frontmatterDirty || bodyDirty);
const canWriteContent = $derived(!busy && isDirty);
const frontmatterIssueCount = $derived(issues.filter((issue) => FRONTMATTER_ISSUE_PATHS.has(issue.path)).length);
const visibleWriteResult = $derived(!isDirty ? writeResult : null);
const editorLayout = $derived(explicitEditorLayout ?? DEFAULT_EDITOR_LAYOUT_INTENT);
const splitWidthIsCompact = $derived(
  editorShellInlineSize > 0 && editorShellInlineSize < EDITOR_SPLIT_MIN_INLINE_SIZE
);
const splitBothIsCompact = $derived(
  editorLayout === 'split' && editorViewMode === 'both' && splitWidthIsCompact
);
const stackedCanReturnToCompact = $derived(
  editorLayout === 'stacked' && editorViewMode === 'both' && splitWidthIsCompact
);
const effectiveViewMode: EditorViewMode = $derived(splitBothIsCompact ? compactPaneMode : editorViewMode);
const outlineAvailable = $derived(isOutlineAvailableForInlineSize(editorShellInlineSize));
const outlineVisible = $derived(outlineWantedOpen && outlineAvailable);
const singleViewActive = $derived(editorViewMode !== 'both');
const editorLayoutToggleLabel = $derived(
  splitBothIsCompact
    ? '展开上下双区'
    : stackedCanReturnToCompact
      ? '返回单区视图'
      : editorLayout === 'split'
        ? '切换到上下布局'
        : '切换到左右布局'
);
const editorLayoutToggleIcon = $derived(
  stackedCanReturnToCompact ? 'undo-2' : editorLayout === 'split' ? 'rows-2' : 'columns-2'
);
const singleViewReturnLabel = '返回编辑与预览双区视图';
const editViewToggleLabel = $derived(
  editorViewMode === 'edit'
    ? '取消仅编辑视图'
    : splitBothIsCompact
      ? '当前宽度显示编辑区；点击固定为仅编辑'
      : '仅显示编辑区'
);
const previewViewToggleLabel = $derived(editorViewMode === 'preview' ? '取消仅预览视图' : '仅显示预览区');
const compactPaneToggleText = $derived(compactPaneMode === 'edit' ? '预览' : '编辑');
const compactPaneToggleLabel = $derived(compactPaneMode === 'edit' ? '显示预览区' : '显示编辑区');
const outlineToggleLabel = $derived(outlineWantedOpen ? '关闭目录' : '打开目录');
const outlineControlDisabled = $derived(!outlineWantedOpen && !outlineAvailable && !adminSidebarExpanded);
const exportHref = $derived(buildContentExportHref(exportEndpoint, collection, entryId));
const scrollSyncAvailable = $derived(
  effectiveViewMode === 'both' && Boolean(bodyScrollElement && previewScrollElement)
);
const scrollSyncToggleLabel = $derived(
  scrollSyncAvailable ? (syncScrollEnabled ? '关闭同步滚动' : '开启同步滚动') : '单视图下不可同步滚动'
);
const scrollSyncControlDisabled = $derived(!scrollSyncAvailable);
const scrollTopControlDisabled = $derived(!bodyScrollElement && !previewScrollElement);
const markdownOutlineItems = $derived(
  outlineVisible && outlineActiveTab === 'headings'
    ? extractMarkdownOutline(body)
    : []
);
const essayOutlineListItems = $derived(buildEssayOutlineListItems(essayOutlineItems, entryId));

const setStatus = (state: StatusState, text: string) => {
  statusState = state;
  statusText = text;
};

const clearStatus = () => {
  setStatus('idle', '');
};

const storeContentListDeleteFeedback = () => {
  try {
    window.sessionStorage.setItem(CONTENT_LIST_DELETE_FEEDBACK_STORAGE_KEY, CONTENT_LIST_DELETE_FEEDBACK_VALUE);
  } catch {
    // 跳转后的轻提示只改善反馈可见性，不应影响删除主流程。
  }
};

const clearWriteFeedback = () => {
  errors = [];
  issues = [];
  writeResult = null;
};

const syncDirtyStatus = () => {
  if (busy || statusState === 'warn' || statusState === 'error') return;

  if (isDirty) {
    clearStatus();
  }
};

const toggleEditorLayout = () => {
  if (singleViewActive) return;

  const nextLayout = editorLayout === 'split' ? 'stacked' : 'split';
  explicitEditorLayout = nextLayout;
  storeEditorLayout(EDITOR_LAYOUT_STORAGE_KEY, nextLayout);
};

const toggleEditorViewMode = (viewMode: Exclude<EditorViewMode, 'both'>) => {
  editorViewMode = editorViewMode === viewMode ? 'both' : viewMode;
};

const returnToBothView = () => {
  editorViewMode = 'both';
};

const toggleCompactPaneMode = () => {
  compactPaneMode = compactPaneMode === 'edit' ? 'preview' : 'edit';
};

const storeCurrentOutlineState = (state: Partial<{ open: boolean; activeTab: EditorOutlineTab }> = {}) => {
  storeEditorOutlineState(EDITOR_OUTLINE_STATE_STORAGE_KEY, {
    open: state.open ?? outlineWantedOpen,
    activeTab: state.activeTab ?? outlineActiveTab
  });
};

const toggleOutline = () => {
  if (outlineWantedOpen) {
    outlineWantedOpen = false;
    storeCurrentOutlineState({ open: false });
    return;
  }

  outlineWantedOpen = true;
  storeCurrentOutlineState({ open: true });

  if (outlineAvailable) {
    return;
  }

  if (collapseExpandedAdminSidebar()) {
    outlineSidebarCollapseAttempted = true;
    queueOutlineAvailabilityCheck();
  }
};

const setOutlineTab = (tab: EditorOutlineTab) => {
  outlineActiveTab = tab;
  storeCurrentOutlineState({ activeTab: tab });
};

const applyToolbarTool = (toolId: MarkdownToolId) => {
  if (busy) return;
  if (toolId === 'image') {
    imageInsertOpen = true;
    return;
  }

  toolbarCommandId += 1;
  toolbarCommand = { id: toolbarCommandId, kind: 'tool', toolId };
};

const applyHeadingLevel = (level: MarkdownHeadingLevel) => {
  if (busy) return;

  toolbarCommandId += 1;
  toolbarCommand = { id: toolbarCommandId, kind: 'heading', level };
};

const insertMarkdownText = (text: string) => {
  toolbarCommandId += 1;
  toolbarCommand = { id: toolbarCommandId, kind: 'insert', text };
};

const closeImageInsert = () => {
  imageInsertOpen = false;
};

const setBodyScrollElement = (element: HTMLTextAreaElement | null) => {
  bodyScrollElement = element;
};

const setPreviewScrollElement = (element: HTMLElement | null) => {
  previewScrollElement = element;
};

const getScrollElement = (source: EditorScrollSource): HTMLElement | null =>
  source === 'body' ? bodyScrollElement : previewScrollElement;

const cancelQueuedScrollSync = () => {
  if (scrollSyncFrame === null) return;
  window.cancelAnimationFrame(scrollSyncFrame);
  scrollSyncFrame = null;
  pendingScrollSyncSource = null;
};

const releaseScrollSyncGuard = (frameDelay = 1) => {
  if (scrollSyncReleaseFrame !== null) {
    window.cancelAnimationFrame(scrollSyncReleaseFrame);
  }

  let remainingFrames = Math.max(1, frameDelay);
  const releaseOnFrame = () => {
    remainingFrames -= 1;
    if (remainingFrames > 0) {
      scrollSyncReleaseFrame = window.requestAnimationFrame(releaseOnFrame);
      return;
    }

    applyingScrollSync = false;
    scrollSyncReleaseFrame = null;
  };

  scrollSyncReleaseFrame = window.requestAnimationFrame(releaseOnFrame);
};

const applyScrollSync = (source: EditorScrollSource) => {
  const sourceElement = getScrollElement(source);
  const targetElement = getScrollElement(getOppositeScrollSource(source));
  if (!sourceElement || !targetElement) return;

  const scrollRatio = getScrollRatio(sourceElement);
  applyingScrollSync = true;
  targetElement.scrollTop = getScrollableDistance(targetElement) * scrollRatio;
  releaseScrollSyncGuard();
};

const queueScrollSync = (source: EditorScrollSource) => {
  pendingScrollSyncSource = source;
  if (scrollSyncFrame !== null) return;

  scrollSyncFrame = window.requestAnimationFrame(() => {
    const queuedSource = pendingScrollSyncSource;
    scrollSyncFrame = null;
    pendingScrollSyncSource = null;

    if (!queuedSource || !syncScrollEnabled || !scrollSyncAvailable) return;
    applyScrollSync(queuedSource);
  });
};

const handleEditorPaneScroll = (source: EditorScrollSource) => {
  const sourceElement = getScrollElement(source);
  if (sourceElement) {
    markScrollElementScrolling(scrollbarVisibilityTimers, sourceElement, SCROLLBAR_VISIBILITY_TIMEOUT_MS);
  }

  if (applyingScrollSync) return;

  lastScrollSource = source;
  if (!syncScrollEnabled || !scrollSyncAvailable) return;

  queueScrollSync(source);
};

const toggleScrollSync = () => {
  if (!scrollSyncAvailable) return;

  const nextEnabled = !syncScrollEnabled;
  syncScrollEnabled = nextEnabled;

  if (nextEnabled) {
    queueScrollSync(lastScrollSource);
  }
};

const scrollEditorPanesToTop = () => {
  const scrollElements = [
    effectiveViewMode === 'preview' ? null : bodyScrollElement,
    effectiveViewMode === 'edit' ? null : previewScrollElement
  ].filter(
    (element): element is HTMLElement => element !== null
  );
  if (scrollElements.length === 0) return;

  lastScrollSource = effectiveViewMode === 'preview' ? 'preview' : 'body';
  cancelQueuedScrollSync();
  applyingScrollSync = true;
  scrollElements.forEach((element) => {
    element.scrollTop = 0;
  });
  releaseScrollSyncGuard();
};

const waitForAnimationFrame = (): Promise<void> =>
  new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

const scrollPreviewToOutlineTarget = (outlineKey: string): boolean => {
  const previewElement = previewScrollElement;
  const scrolled = scrollPreviewElementToOutlineKey(
    previewElement,
    outlineKey,
    PREVIEW_OUTLINE_KEY_ATTR,
    { targetOffsetRatio: OUTLINE_TARGET_SCROLL_OFFSET_RATIO }
  );
  if (!scrolled || !previewElement) return false;

  markScrollElementScrolling(scrollbarVisibilityTimers, previewElement, SCROLLBAR_VISIBILITY_TIMEOUT_MS);
  return true;
};

const scrollTextareaToOutlineTarget = (item: MarkdownOutlineItem): boolean => {
  const textarea = bodyScrollElement;
  const scrolled = scrollTextareaElementToOutlineItem(
    textarea,
    body,
    item,
    { targetOffsetRatio: OUTLINE_TARGET_SCROLL_OFFSET_RATIO }
  );
  if (!scrolled || !textarea) return false;

  markScrollElementScrolling(scrollbarVisibilityTimers, textarea, SCROLLBAR_VISIBILITY_TIMEOUT_MS);
  return true;
};

const handleOutlineHeadingSelect = (item: MarkdownOutlineItem) => {
  const shouldScrollBody = effectiveViewMode !== 'preview';
  const shouldScrollPreview = effectiveViewMode !== 'edit';
  let bodyScrolled = false;
  let previewScrolled = false;

  cancelQueuedScrollSync();
  applyingScrollSync = true;

  try {
    if (shouldScrollPreview) {
      previewScrolled = scrollPreviewToOutlineTarget(item.key);
      pendingPreviewOutlineKey = previewScrolled ? null : item.key;
    }

    if (shouldScrollBody) {
      bodyScrolled = scrollTextareaToOutlineTarget(item);
    }
  } finally {
    releaseScrollSyncGuard(2);
  }

  if (bodyScrolled) {
    lastScrollSource = 'body';
    return;
  }

  if (previewScrolled) {
    lastScrollSource = 'preview';
  }
};

const runPendingPreviewOutlineJump = async (outlineKey: string) => {
  const jumpId = pendingPreviewOutlineJumpId + 1;
  pendingPreviewOutlineJumpId = jumpId;

  await tick();
  await waitForAnimationFrame();

  if (
    jumpId !== pendingPreviewOutlineJumpId
    || pendingPreviewOutlineKey !== outlineKey
    || previewBusy
    || effectiveViewMode === 'edit'
  ) {
    return;
  }

  cancelQueuedScrollSync();
  applyingScrollSync = true;
  const scrolled = scrollPreviewToOutlineTarget(outlineKey);
  if (scrolled) {
    pendingPreviewOutlineKey = null;
    lastScrollSource = 'preview';
  } else if (latestPreviewSource === body) {
    pendingPreviewOutlineKey = null;
  }
  releaseScrollSyncGuard(2);
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
  clearStoredWriteFeedback(writeFeedbackStorageKey);
  setStatus('loading', '内容保存中');

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

    if (!response.ok || !isPayloadOk(payload)) {
      const nextIssues = getPayloadIssues(payload);
      issues = nextIssues;
      errors = getPayloadErrors(payload);
      if (errors.length === 0) {
        errors = ['保存失败，检查控制台日志'];
      }
      if (response.status === 409) {
        window.alert(errors[0] ?? '检测到内容文件已在外部更新，已拒绝覆盖，请刷新当前条目后再保存');
      }
      setStatus(response.status === 409 ? 'warn' : 'error', '保存失败');
      return;
    }

    const result = getPayloadResult(payload);
    if (!result) {
      errors = ['响应体缺少 result 字段，请检查开发日志'];
      setStatus('error', '保存失败');
      return;
    }

    writeResult = result;
    const latestValues = getPayloadEssayValues(payload);
    const latestBody = getPayloadEssayBody(payload);
    const nextBaseline = latestValues ? cloneFrontmatter(latestValues) : cloneFrontmatter(frontmatter);
    frontmatter = cloneFrontmatter(nextBaseline);
    baselineFrontmatter = cloneFrontmatter(nextBaseline);
    baselineBody = latestBody ? normalizeEditorTextareaValue(latestBody) : body;
    body = baselineBody;

    const nextStatusState: StatusState = result.changed ? 'ok' : 'idle';
    const nextStatusText = result.changed ? '内容已保存' : '';
    if (result.changed) {
      storeWriteFeedback(writeFeedbackStorageKey, result, nextStatusState, nextStatusText);
    }
    setStatus(nextStatusState, nextStatusText);
  } catch {
    errors = ['保存请求失败，请稍后重试'];
    setStatus('error', '保存失败');
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
    if (!response.ok || !isPayloadOk(payload) || !previewResult) {
      const payloadErrors = getPayloadErrors(payload);
      previewError = payloadErrors[0] ?? '预览生成失败，请检查响应与控制台日志';
      setStatus('error', '预览生成失败');
      return;
    }

    previewHtml = previewResult.html;
    previewWarnings = previewResult.warnings;
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
  clearStoredWriteFeedback(writeFeedbackStorageKey);
  clearStatus();
};

const resetFrontmatterToBaseline = () => {
  frontmatter = cloneFrontmatter(baselineFrontmatter);
  clearWriteFeedback();
  clearStoredWriteFeedback(writeFeedbackStorageKey);
  clearStatus();
};

const closeActionMenu = (target: EventTarget | null) => {
  if (target instanceof HTMLElement) {
    closeClosestAdminDetailsMenu(target, '.admin-editor-shell__action-more');
  }
};

const handleActionMenuReset = (event: MouseEvent) => {
  closeActionMenu(event.currentTarget);
  resetToBaseline();
};

const handleActionMenuDownload = (event: MouseEvent) => {
  closeActionMenu(event.currentTarget);
};

const deleteContentEntry = async (event: MouseEvent) => {
  closeActionMenu(event.currentTarget);

  if (busy) {
    setStatus('warn', '操作进行中');
    return;
  }

  const confirmed = window.confirm([
    `确认删除《${frontmatter.title || entryId}》？`,
    '',
    `源文件：${relativePath}`,
    ...(isDirty ? ['', '当前未保存改动不会写入文件，删除会移动当前源文件。'] : []),
    '',
    '文件会移到 .trash/content/，之后可从回收站手动恢复。'
  ].join('\n'));
  if (!confirmed) {
    return;
  }

  busy = true;
  clearWriteFeedback();
  setStatus('loading', '正在移动到回收站');

  try {
    const deleteResponse = await fetch(deleteEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8'
      },
      cache: 'no-store',
      body: JSON.stringify({
        collection,
        entryId,
        revision: currentRevision,
        expectedRelativePath: relativePath
      })
    });
    const payload = await parseResponseBody(deleteResponse);
    const nextRevision = getPayloadRevision(payload);
    if (nextRevision) currentRevision = nextRevision;

    if (!deleteResponse.ok || !isPayloadOk(payload)) {
      const payloadErrors = getPayloadErrors(payload);
      errors = payloadErrors;
      issues = getPayloadIssues(payload);
      setStatus(deleteResponse.status === 409 ? 'warn' : 'error', payloadErrors[0] ?? '删除失败');
      return;
    }

    const result = getPayloadDeleteResult(payload);
    if (!result || !result.deleted || !result.trashedPath) {
      errors = [];
      issues = [];
      setStatus('error', '删除响应异常，请检查开发日志');
      return;
    }

    baselineFrontmatter = cloneFrontmatter(frontmatter);
    baselineBody = body;
    storeContentListDeleteFeedback();
    window.location.assign(returnHref || '/admin/content/');
  } catch {
    errors = [];
    issues = [];
    setStatus('error', '删除请求失败，请稍后重试');
  } finally {
    busy = false;
  }
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
  setStatus('warn', '请先保存或还原');
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
  if (writeFeedbackRestored) return;
  writeFeedbackRestored = true;

  const storedFeedback = readStoredWriteFeedback(writeFeedbackStorageKey, WRITE_FEEDBACK_STORAGE_TTL_MS);
  if (!storedFeedback) return;

  writeResult = storedFeedback.result;
  setStatus(storedFeedback.statusState, storedFeedback.statusText);
  clearStoredWriteFeedback(writeFeedbackStorageKey);
});

$effect(() => {
  if (editorLayoutRestored) return;
  editorLayoutRestored = true;
  explicitEditorLayout = readStoredEditorLayout(EDITOR_LAYOUT_STORAGE_KEY);
});

$effect(() => {
  if (editorOutlineStateRestored) return;
  editorOutlineStateRestored = true;

  const storedOutlineState = readStoredEditorOutlineState(EDITOR_OUTLINE_STATE_STORAGE_KEY);
  if (!storedOutlineState) return;

  outlineWantedOpen = storedOutlineState.open;
  outlineActiveTab = storedOutlineState.activeTab;
});

$effect(() => {
  const shellEl = editorShellEl;
  if (!shellEl || typeof ResizeObserver === 'undefined') return;

  const syncShellInlineSize = (nextInlineSize?: number) => {
    editorShellInlineSize = nextInlineSize ?? shellEl.getBoundingClientRect().width;
  };
  const observer = new ResizeObserver((entries) => {
    syncShellInlineSize(entries[0]?.contentRect.width);
  });

  syncShellInlineSize();
  observer.observe(shellEl);
  return () => {
    observer.disconnect();
  };
});

$effect(() => {
  if (typeof document === 'undefined') return;
  const actionsEl = topActionsEl;
  const host = document.querySelector<HTMLElement>(PAGE_ACTIONS_HOST_SELECTOR);
  if (!actionsEl || !host) return;

  const placeholder = document.createComment('admin-editor-page-actions');
  const originalParent = actionsEl.parentNode;
  const originalNextSibling = actionsEl.nextSibling;
  originalParent?.insertBefore(placeholder, actionsEl);
  host.append(actionsEl);

  return () => {
    if (placeholder.parentNode) {
      placeholder.replaceWith(actionsEl);
      return;
    }

    originalParent?.insertBefore(actionsEl, originalNextSibling);
  };
});

$effect(() => {
  const cleanupDetailsMenus = [
    initAdminDetailsMenus({
      selector: '.admin-editor-shell__preview-detail'
    }),
    initAdminDetailsMenus({
      selector: '.admin-editor-markdown-toolbar__heading'
    }),
    initAdminDetailsMenus({
      selector: '.admin-editor-shell__action-more'
    })
  ];

  document.addEventListener('click', handleGuardedNavigationClick, true);
  document.addEventListener('click', handleArticleInfoTriggerClick);
  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    cleanupDetailsMenus.forEach((cleanup) => cleanup());
    document.removeEventListener('click', handleGuardedNavigationClick, true);
    document.removeEventListener('click', handleArticleInfoTriggerClick);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
});

$effect(() => {
  const bodyElement = bodyScrollElement;
  const previewElement = previewScrollElement;
  if (!bodyElement || !previewElement || effectiveViewMode !== 'both') return;

  const handleBodyScroll = () => {
    handleEditorPaneScroll('body');
  };

  const handlePreviewScroll = () => {
    handleEditorPaneScroll('preview');
  };

  const handlePreviewContentLoad = () => {
    if (syncScrollEnabled && scrollSyncAvailable) {
      queueScrollSync(lastScrollSource);
    }
  };

  bodyElement.addEventListener('scroll', handleBodyScroll, { passive: true });
  previewElement.addEventListener('scroll', handlePreviewScroll, { passive: true });
  previewElement.addEventListener('load', handlePreviewContentLoad, true);

  if (syncScrollEnabled) {
    queueScrollSync(lastScrollSource);
  }

  return () => {
    bodyElement.removeEventListener('scroll', handleBodyScroll);
    previewElement.removeEventListener('scroll', handlePreviewScroll);
    previewElement.removeEventListener('load', handlePreviewContentLoad, true);
    clearScrollbarVisibilityTimer(scrollbarVisibilityTimers, bodyElement);
    clearScrollbarVisibilityTimer(scrollbarVisibilityTimers, previewElement);
  };
});

$effect(() => {
  const outlineKey = pendingPreviewOutlineKey;
  if (!outlineKey || previewBusy || effectiveViewMode === 'edit') return;

  void runPendingPreviewOutlineJump(outlineKey);
});

$effect(() => {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

  const root = document.documentElement;
  syncAdminSidebarExpandedState();
  const observer = new MutationObserver(syncAdminSidebarExpandedState);
  observer.observe(root, {
    attributes: true,
    attributeFilter: ['data-admin-sidebar']
  });

  return () => {
    observer.disconnect();
  };
});

$effect(() => {
  return () => {
    if (outlineSidebarCollapseCheckFrame !== null) {
      window.cancelAnimationFrame(outlineSidebarCollapseCheckFrame);
      outlineSidebarCollapseCheckFrame = null;
    }
    cancelQueuedScrollSync();
    if (scrollSyncReleaseFrame !== null) {
      window.cancelAnimationFrame(scrollSyncReleaseFrame);
      scrollSyncReleaseFrame = null;
    }
    clearAllScrollbarVisibilityTimers(scrollbarVisibilityTimers);
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
  if (!outlineWantedOpen) {
    outlineSidebarCollapseAttempted = false;
    return;
  }

  if (outlineAvailable) {
    outlineSidebarCollapseAttempted = false;
    return;
  }

  if (!outlineSidebarCollapseAttempted && collapseExpandedAdminSidebar()) {
    outlineSidebarCollapseAttempted = true;
    queueOutlineAvailabilityCheck();
    return;
  }
});

$effect(() => {
  syncDirtyStatus();
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

<section
  class="admin-editor-shell"
  bind:this={editorShellEl}
  data-layout={editorLayout}
  data-view={editorViewMode}
  data-effective-view={effectiveViewMode}
  data-outline={outlineVisible ? 'open' : 'closed'}
>
  <EditorToolbar
    {busy}
    outlineOpen={outlineWantedOpen}
    {outlineVisible}
    {outlineToggleLabel}
    {outlineControlDisabled}
    outlinePanelId={OUTLINE_PANEL_ID}
    editorLayoutIsSplit={editorLayout === 'split'}
    {editorLayoutToggleLabel}
    {editorLayoutToggleIcon}
    {singleViewActive}
    {singleViewReturnLabel}
    {splitBothIsCompact}
    {compactPaneToggleLabel}
    {compactPaneToggleText}
    {editViewToggleLabel}
    {previewViewToggleLabel}
    {effectiveViewMode}
    onApplyTool={applyToolbarTool}
    onApplyHeading={applyHeadingLevel}
    onToggleOutline={toggleOutline}
    onToggleLayout={toggleEditorLayout}
    onToggleView={toggleEditorViewMode}
    onReturnToBothView={returnToBothView}
    onToggleCompactPane={toggleCompactPaneMode}
  />

  <EditorActionMenu
    bind:element={topActionsEl}
    {statusText}
    {statusState}
    {canWriteContent}
    {busy}
    dirty={isDirty}
    {returnHref}
    {exportHref}
    onSave={requestContentWrite}
    onReset={handleActionMenuReset}
    onDownload={handleActionMenuDownload}
    onDelete={deleteContentEntry}
  />

  <div class="admin-editor-shell__layout">
    <div class="admin-editor-shell__workspace">
      <div class="admin-editor-shell__pane admin-editor-shell__pane--body" hidden={effectiveViewMode === 'preview'}>
        <BodyEditor
          bind:value={body}
          disabled={busy}
          {toolbarCommand}
          onScrollElementChange={setBodyScrollElement}
        />
      </div>
      <PreviewStatusBar
        {bodyLineCount}
        {bodyCharCount}
        {errors}
        {issues}
        {previewError}
        {previewWarnings}
        writeResult={visibleWriteResult}
        {syncScrollEnabled}
        {scrollSyncToggleLabel}
        {scrollSyncControlDisabled}
        {scrollTopControlDisabled}
        {getWriteFieldLabel}
        onToggleScrollSync={toggleScrollSync}
        onScrollToTop={scrollEditorPanesToTop}
      />
      <div class="admin-editor-shell__pane admin-editor-shell__pane--preview" hidden={effectiveViewMode === 'edit'}>
        <PreviewPane
          html={previewHtml}
          loading={previewBusy}
          error={previewError}
          onScrollElementChange={setPreviewScrollElement}
        />
      </div>
    </div>
    {#if outlineVisible}
      <EditorOutlinePanel
        panelId={OUTLINE_PANEL_ID}
        activeTab={outlineActiveTab}
        headings={markdownOutlineItems}
        essays={essayOutlineListItems}
        onTabChange={setOutlineTab}
        onHeadingSelect={handleOutlineHeadingSelect}
      />
    {/if}
  </div>

  <ArticleInfoDialog
    bind:this={articleInfoDialog}
    bind:value={frontmatter}
    open={frontmatterPanelOpen}
    {relativePath}
    {issues}
    disabled={busy}
    dirty={frontmatterDirty}
    canSave={canWriteContent}
    {slugPlaceholder}
    onClose={closeFrontmatterPanel}
    onReset={resetFrontmatterToBaseline}
    onSave={() => void requestContentWrite()}
  />

  <ImageInsertDialog
    open={imageInsertOpen}
    uploadEndpoint={imageUploadEndpoint}
    {entryId}
    disabled={busy}
    onClose={closeImageInsert}
    onInsert={(markdown) => {
      insertMarkdownText(markdown);
    }}
  />

  <div class="admin-content-toolbar__footer admin-editor-shell__actions">
    <div class="admin-editor-shell__footer-copy">
      {#if statusText}
        <div class="admin-editor-shell__status">
          <p class="admin-status admin-status--inline" data-state={statusState} role="status" aria-live="polite" aria-atomic="true">{statusText}</p>
        </div>
      {/if}
    </div>
    <div class="admin-content-actions">
      <button class="admin-btn admin-btn--ghost admin-btn--compact" type="button" onclick={resetToBaseline} disabled={busy || !isDirty}>
        还原
      </button>
      <button class="admin-btn admin-btn--secondary admin-btn--compact" type="button" onclick={() => void requestContentWrite()} disabled={!canWriteContent}>
        保存内容
      </button>
    </div>
  </div>
</section>
