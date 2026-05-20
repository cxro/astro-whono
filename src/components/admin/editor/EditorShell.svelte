<script lang="ts">
import { tick } from 'svelte';
import {
  cloneFrontmatter,
  isEqualFrontmatter
} from '../../../lib/admin-console/essay-editor-values';
import {
  ADMIN_EDITOR_DEFAULTS_STORAGE_KEY,
  ADMIN_EDITOR_LAYOUT_STORAGE_KEY,
  ADMIN_EDITOR_SIDE_PANEL_PREFERENCE_STORAGE_KEY,
  readStoredAdminEditorDefaults
} from '../../../lib/admin-console/ui-prefs-keys';
import { closeClosestAdminDetailsMenu } from '../../../scripts/admin-content/details-menu';
import {
  deleteEssayEntry,
  renderEssayPreview,
  saveEssayEntry,
  type AdminContentIssue,
  type AdminContentWriteResult
} from './essay-editor-client';
import { flattenEntryIdToSlug } from '../../../utils/slug-rules';
import EditorDialogs from './EditorDialogs.svelte';
import EditorFooterActions from './EditorFooterActions.svelte';
import EditorTopControls from './EditorTopControls.svelte';
import EditorWorkspace from './EditorWorkspace.svelte';
import {
  bindArticleInfoTrigger,
  bindEditorDetailsMenus,
  bindEditorNavigationGuard,
  mountEditorPageActionsPortal,
  observeElementInlineSize,
  syncArticleInfoTriggers
} from './editor-page-integration';
import {
  CONTENT_LIST_DELETE_FEEDBACK_STORAGE_KEY,
  CONTENT_LIST_DELETE_FEEDBACK_VALUE
} from './content-list-feedback';
import {
  buildContentExportHref,
  clearStoredWriteFeedback,
  getEditorSidePanelLayout,
  getPreviewDebounceMs,
  getWriteFieldLabel,
  normalizeEditorTextareaValue,
  readStoredEditorLayout,
  readStoredEditorSidePanelPreference,
  readStoredWriteFeedback,
  resolveEditorLayoutPreference,
  resolveEditorSidePanelPreference,
  storeEditorLayout,
  storeEditorSidePanelPreference,
  storeWriteFeedback,
  type EditorLayoutMode,
  type EditorPaneMode,
  type EditorScrollSource,
  type EditorSidePanelLayout,
  type EditorViewMode,
  type StatusState
} from './editor-shell-helpers';
import { createEditorScrollSyncController } from './editor-scroll-sync';
import {
  buildEssayOutlineListItems,
  extractMarkdownOutline,
  type EditorOutlineTab,
  type MarkdownOutlineItem
} from './editor-outline-helpers';
import {
  scrollPreviewToOutlineKey as scrollPreviewElementToOutlineKey,
  scrollTextareaToOutlineItem as scrollTextareaElementToOutlineItem
} from './editor-outline-scroll';
import type { MarkdownToolbarCommand } from './markdown-tools';
import { createMarkdownCommandDispatcher } from './editor-markdown-command-dispatcher';
import type { EditorShellProps } from './editor-shell-props';

const LEAVE_CONFIRM_MESSAGE = '当前有未保存更改，确定要离开此页吗？';
const ARTICLE_INFO_TRIGGER_SELECTOR = '[data-admin-article-info-trigger]';
const PAGE_ACTIONS_HOST_SELECTOR = '[data-admin-editor-page-actions-host]';
const FRONTMATTER_PANEL_ID = 'admin-editor-frontmatter-panel';
const OUTLINE_PANEL_ID = 'admin-editor-outline-panel';
const SYNTAX_PANEL_ID = 'admin-editor-syntax-panel';
const FRONTMATTER_ISSUE_PATHS = new Set(['title', 'date', 'publishedAt', 'description', 'tags', 'slug', 'badge', 'cover']);
const PREVIEW_OUTLINE_KEY_ATTR = 'data-admin-outline-key';
// 无编辑器默认项或显式偏好时优先 split，窄容器视觉回退由 effective view 派生。
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
}: EditorShellProps = $props();

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
let syntaxWantedOpen = $state(false);
let syntaxMaximized = $state(false);
let editorLayoutRestored = false;
let editorSidePanelPreferenceRestored = false;
let previewRequestId = 0;
let previewTimer: number | null = null;
let activePreviewAbortController: AbortController | null = null;
let latestPreviewSource = '';
let previewInitialized = false;
let toolbarCommand = $state<MarkdownToolbarCommand | null>(null);
let frontmatterPanelOpen = $state(initialSnapshot.articleInfoOpen);
let editorDialogs = $state<EditorDialogs | null>(null);
let imageInsertOpen = $state(false);
const markdownCommandDispatcher = createMarkdownCommandDispatcher({
  isBusy: () => busy,
  onCommand: (command) => {
    toolbarCommand = command;
  },
  onOpenImageInsert: () => {
    imageInsertOpen = true;
  }
});
let editorShellEl = $state<HTMLElement | null>(null);
let editorShellInlineSize = $state(0);
let topActionsEl = $state<HTMLDivElement | null>(null);
let bodyScrollElement = $state<HTMLTextAreaElement | null>(null);
let previewScrollElement = $state<HTMLElement | null>(null);
let syncScrollEnabled = $state(true);
let writeFeedbackRestored = false;
let pendingPreviewOutlineKey = $state<string | null>(null);
let pendingPreviewOutlineJumpId = 0;

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
const sidePanelsAvailable = $derived(isOutlineAvailableForInlineSize(editorShellInlineSize));
const sidePanelLayout: EditorSidePanelLayout = $derived(
  getEditorSidePanelLayout({
    outlineOpen: outlineWantedOpen,
    syntaxOpen: syntaxWantedOpen,
    syntaxMaximized,
    available: sidePanelsAvailable
  })
);
const sidePanelsVisible = $derived(sidePanelLayout !== 'none');
const outlineVisible = $derived(sidePanelLayout === 'outline' || sidePanelLayout === 'stacked');
const syntaxVisible = $derived(
  sidePanelLayout === 'syntax' || sidePanelLayout === 'stacked' || sidePanelLayout === 'syntaxMaximized'
);
const syntaxMaximizeAllowed = $derived(outlineWantedOpen && syntaxWantedOpen);
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
const outlineControlDisabled = $derived(!outlineWantedOpen && !sidePanelsAvailable);
const syntaxToggleLabel = $derived(syntaxWantedOpen ? '关闭语法实例' : '打开语法实例');
const syntaxControlDisabled = $derived(!syntaxWantedOpen && !sidePanelsAvailable);
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
  if (!readDevAdminEditorDefaults()) {
    storeEditorLayout(ADMIN_EDITOR_LAYOUT_STORAGE_KEY, nextLayout);
  }
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

const storeCurrentSidePanelPreference = (
  preference: Partial<{
    outlineOpen: boolean;
    outlineActiveTab: EditorOutlineTab;
    syntaxOpen: boolean;
  }> = {}
) => {
  if (readDevAdminEditorDefaults()) return;

  storeEditorSidePanelPreference(ADMIN_EDITOR_SIDE_PANEL_PREFERENCE_STORAGE_KEY, {
    outlineOpen: preference.outlineOpen ?? outlineWantedOpen,
    outlineActiveTab: preference.outlineActiveTab ?? outlineActiveTab,
    syntaxOpen: preference.syntaxOpen ?? syntaxWantedOpen
  });
};

const toggleOutline = () => {
  if (outlineWantedOpen) {
    outlineWantedOpen = false;
    storeCurrentSidePanelPreference({ outlineOpen: false });
    return;
  }

  outlineWantedOpen = true;
  storeCurrentSidePanelPreference({ outlineOpen: true });
};

const toggleSyntax = () => {
  if (syntaxWantedOpen) {
    syntaxWantedOpen = false;
    syntaxMaximized = false;
    storeCurrentSidePanelPreference({ syntaxOpen: false });
    return;
  }

  syntaxWantedOpen = true;
  syntaxMaximized = false;
  storeCurrentSidePanelPreference({ syntaxOpen: true });
};

const toggleSyntaxMaximize = () => {
  if (!syntaxMaximizeAllowed) return;
  syntaxMaximized = !syntaxMaximized;
};

const setOutlineTab = (tab: EditorOutlineTab) => {
  outlineActiveTab = tab;
  storeCurrentSidePanelPreference({ outlineActiveTab: tab });
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

const scrollSyncController = createEditorScrollSyncController({
  getScrollElement,
  isEnabled: () => syncScrollEnabled,
  setEnabled: (enabled) => {
    syncScrollEnabled = enabled;
  },
  isAvailable: () => scrollSyncAvailable,
  scrollbarVisibilityTimeoutMs: SCROLLBAR_VISIBILITY_TIMEOUT_MS
});

const handleEditorPaneScroll = (source: EditorScrollSource) => {
  scrollSyncController.handlePaneScroll(source);
};

const toggleScrollSync = () => {
  scrollSyncController.toggleEnabled();
};

const scrollEditorPanesToTop = () => {
  scrollSyncController.scrollToTop(effectiveViewMode);
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

  scrollSyncController.markElementScrolling(previewElement);
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

  scrollSyncController.markElementScrolling(textarea);
  return true;
};

const handleOutlineHeadingSelect = (item: MarkdownOutlineItem) => {
  const shouldScrollBody = effectiveViewMode !== 'preview';
  const shouldScrollPreview = effectiveViewMode !== 'edit';
  let bodyScrolled = false;
  let previewScrolled = false;

  scrollSyncController.cancelQueued();
  scrollSyncController.setGuarded(true);

  try {
    if (shouldScrollPreview) {
      previewScrolled = scrollPreviewToOutlineTarget(item.key);
      pendingPreviewOutlineKey = previewScrolled ? null : item.key;
    }

    if (shouldScrollBody) {
      bodyScrolled = scrollTextareaToOutlineTarget(item);
    }
  } finally {
    scrollSyncController.releaseGuard(2);
  }

  if (bodyScrolled) {
    scrollSyncController.setLastSource('body');
    return;
  }

  if (previewScrolled) {
    scrollSyncController.setLastSource('preview');
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

  scrollSyncController.cancelQueued();
  scrollSyncController.setGuarded(true);
  const scrolled = scrollPreviewToOutlineTarget(outlineKey);
  if (scrolled) {
    pendingPreviewOutlineKey = null;
    scrollSyncController.setLastSource('preview');
  } else if (latestPreviewSource === body) {
    pendingPreviewOutlineKey = null;
  }
  scrollSyncController.releaseGuard(2);
};

const closeFrontmatterPanel = () => {
  frontmatterPanelOpen = false;
};

const openFrontmatterPanel = (trigger?: HTMLElement | null) => {
  if (!frontmatterPanelOpen) {
    editorDialogs?.captureReturnFocus(trigger);
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
    const saveOutcome = await saveEssayEntry({
      endpoint,
      collection,
      entryId,
      revision: currentRevision,
      frontmatter,
      ...(bodyDirty ? { body } : {})
    });

    if (saveOutcome.revision && saveOutcome.responseOk) currentRevision = saveOutcome.revision;

    if (!saveOutcome.responseOk || !saveOutcome.payloadOk) {
      issues = saveOutcome.issues;
      errors = saveOutcome.errors;
      if (errors.length === 0) {
        errors = ['保存失败，检查控制台日志'];
      }
      if (saveOutcome.status === 409) {
        window.alert(errors[0] ?? '检测到内容文件已在外部更新，已拒绝覆盖，请刷新当前条目后再保存');
      }
      setStatus(saveOutcome.status === 409 ? 'warn' : 'error', '保存失败');
      return;
    }

    const result = saveOutcome.result;
    if (!result) {
      errors = ['响应体缺少 result 字段，请检查开发日志'];
      setStatus('error', '保存失败');
      return;
    }

    writeResult = result;
    const latestValues = saveOutcome.latestValues;
    const latestBody = saveOutcome.latestBody;
    const nextBaseline = latestValues ? cloneFrontmatter(latestValues) : cloneFrontmatter(frontmatter);
    frontmatter = cloneFrontmatter(nextBaseline);
    baselineFrontmatter = cloneFrontmatter(nextBaseline);
    baselineBody = latestBody !== null ? normalizeEditorTextareaValue(latestBody) : body;
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
    const previewOutcome = await renderEssayPreview({
      endpoint: previewEndpoint,
      collection,
      entryId,
      source: sourceSnapshot,
      signal: abortController.signal
    });

    if (requestId !== previewRequestId) return;
    if (sourceSnapshot !== body) {
      return;
    }

    const previewResult = previewOutcome.result;
    if (!previewOutcome.responseOk || !previewOutcome.payloadOk || !previewResult) {
      const payloadErrors = previewOutcome.errors;
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

const readDevAdminEditorDefaults = () =>
  import.meta.env.DEV ? readStoredAdminEditorDefaults(ADMIN_EDITOR_DEFAULTS_STORAGE_KEY) : null;

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
    const deleteOutcome = await deleteEssayEntry({
      endpoint: deleteEndpoint,
      collection,
      entryId,
      revision: currentRevision,
      expectedRelativePath: relativePath
    });
    if (deleteOutcome.revision) currentRevision = deleteOutcome.revision;

    if (!deleteOutcome.responseOk || !deleteOutcome.payloadOk) {
      errors = deleteOutcome.errors;
      issues = deleteOutcome.issues;
      setStatus(deleteOutcome.status === 409 ? 'warn' : 'error', deleteOutcome.errors[0] ?? '删除失败');
      return;
    }

    const result = deleteOutcome.result;
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
  explicitEditorLayout = resolveEditorLayoutPreference(
    readStoredEditorLayout(ADMIN_EDITOR_LAYOUT_STORAGE_KEY),
    readDevAdminEditorDefaults()
  );
});

$effect(() => {
  if (editorSidePanelPreferenceRestored) return;
  editorSidePanelPreferenceRestored = true;

  const storedSidePanelPreference = resolveEditorSidePanelPreference(
    readStoredEditorSidePanelPreference(ADMIN_EDITOR_SIDE_PANEL_PREFERENCE_STORAGE_KEY),
    readDevAdminEditorDefaults()
  );
  if (!storedSidePanelPreference) return;

  outlineWantedOpen = storedSidePanelPreference.outlineOpen;
  outlineActiveTab = storedSidePanelPreference.outlineActiveTab;
  syntaxWantedOpen = storedSidePanelPreference.syntaxOpen;
});

$effect(() => {
  return observeElementInlineSize({
    element: editorShellEl,
    onInlineSize: (nextInlineSize) => {
      editorShellInlineSize = nextInlineSize;
    }
  });
});

$effect(() => {
  return mountEditorPageActionsPortal({
    actionsEl: topActionsEl,
    hostSelector: PAGE_ACTIONS_HOST_SELECTOR
  });
});

$effect(() => {
  const cleanupDetailsMenus = bindEditorDetailsMenus({
    selectors: [
      '.admin-editor-shell__preview-detail',
      '.admin-editor-markdown-toolbar__menu',
      '.admin-editor-shell__action-more'
    ]
  });
  const cleanupNavigationGuard = bindEditorNavigationGuard({
    isDirty: () => isDirty,
    message: LEAVE_CONFIRM_MESSAGE,
    onBlocked: () => {
      setStatus('warn', '请先保存或还原');
    }
  });
  const cleanupArticleInfoTrigger = bindArticleInfoTrigger({
    selector: ARTICLE_INFO_TRIGGER_SELECTOR,
    onToggle: toggleFrontmatterPanel
  });

  return () => {
    cleanupDetailsMenus();
    cleanupNavigationGuard();
    cleanupArticleInfoTrigger();
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
      scrollSyncController.queueLastSource();
    }
  };

  bodyElement.addEventListener('scroll', handleBodyScroll, { passive: true });
  previewElement.addEventListener('scroll', handlePreviewScroll, { passive: true });
  previewElement.addEventListener('load', handlePreviewContentLoad, true);

  if (syncScrollEnabled) {
    scrollSyncController.queueLastSource();
  }

  return () => {
    bodyElement.removeEventListener('scroll', handleBodyScroll);
    previewElement.removeEventListener('scroll', handlePreviewScroll);
    previewElement.removeEventListener('load', handlePreviewContentLoad, true);
    scrollSyncController.clearElement(bodyElement);
    scrollSyncController.clearElement(previewElement);
  };
});

$effect(() => {
  const outlineKey = pendingPreviewOutlineKey;
  if (!outlineKey || previewBusy || effectiveViewMode === 'edit') return;

  void runPendingPreviewOutlineJump(outlineKey);
});

$effect(() => {
  return () => {
    scrollSyncController.destroy();
  };
});

$effect(() => {
  syncArticleInfoTriggers({
    selector: ARTICLE_INFO_TRIGGER_SELECTOR,
    panelId: FRONTMATTER_PANEL_ID,
    open: frontmatterPanelOpen,
    dirty: frontmatterDirty,
    invalid: frontmatterIssueCount > 0
  });
});

$effect(() => {
  if (frontmatterIssueCount > 0 && !frontmatterPanelOpen) {
    openFrontmatterPanel();
  }
});

$effect(() => {
  if (!syntaxMaximizeAllowed && syntaxMaximized) {
    syntaxMaximized = false;
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
  data-side-panel={sidePanelLayout}
>
  <EditorTopControls
    bind:actionMenuElement={topActionsEl}
    {busy}
    outlineOpen={outlineWantedOpen}
    {outlineVisible}
    {outlineToggleLabel}
    {outlineControlDisabled}
    outlinePanelId={OUTLINE_PANEL_ID}
    syntaxOpen={syntaxWantedOpen}
    {syntaxVisible}
    {syntaxToggleLabel}
    {syntaxControlDisabled}
    syntaxPanelId={SYNTAX_PANEL_ID}
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
    onApplyTool={markdownCommandDispatcher.applyTool}
    onApplyHeading={markdownCommandDispatcher.applyHeading}
    onApplyCallout={markdownCommandDispatcher.applyCallout}
    onToggleOutline={toggleOutline}
    onToggleSyntax={toggleSyntax}
    onToggleLayout={toggleEditorLayout}
    onToggleView={toggleEditorViewMode}
    onReturnToBothView={returnToBothView}
    onToggleCompactPane={toggleCompactPaneMode}
    {statusText}
    {statusState}
    {canWriteContent}
    dirty={isDirty}
    {returnHref}
    {exportHref}
    onSave={requestContentWrite}
    onReset={handleActionMenuReset}
    onDownload={handleActionMenuDownload}
    onDelete={deleteContentEntry}
  />

  <EditorWorkspace
    bind:value={body}
    disabled={busy}
    {toolbarCommand}
    {effectiveViewMode}
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
    {previewHtml}
    previewBusy={previewBusy}
    {sidePanelsVisible}
    {sidePanelLayout}
    outlinePanelId={OUTLINE_PANEL_ID}
    syntaxPanelId={SYNTAX_PANEL_ID}
    {outlineActiveTab}
    {markdownOutlineItems}
    {essayOutlineListItems}
    onBodyScrollElementChange={setBodyScrollElement}
    onPreviewScrollElementChange={setPreviewScrollElement}
    onShortcutTool={markdownCommandDispatcher.applyTool}
    onToggleScrollSync={toggleScrollSync}
    onScrollToTop={scrollEditorPanesToTop}
    onOutlineTabChange={setOutlineTab}
    onOutlineHeadingSelect={handleOutlineHeadingSelect}
    onSyntaxMaximizeToggle={toggleSyntaxMaximize}
  />

  <EditorDialogs
    bind:this={editorDialogs}
    bind:frontmatter
    frontmatterOpen={frontmatterPanelOpen}
    {relativePath}
    {issues}
    disabled={busy}
    {frontmatterDirty}
    canSave={canWriteContent}
    {slugPlaceholder}
    {imageInsertOpen}
    {imageUploadEndpoint}
    {entryId}
    onFrontmatterClose={closeFrontmatterPanel}
    onFrontmatterReset={resetFrontmatterToBaseline}
    onFrontmatterSave={() => void requestContentWrite()}
    onImageClose={closeImageInsert}
    onImageInsert={(markdown) => {
      markdownCommandDispatcher.insertText(markdown);
    }}
  />

  <EditorFooterActions
    {statusText}
    {statusState}
    {busy}
    dirty={isDirty}
    {canWriteContent}
    onReset={resetToBaseline}
    onSave={requestContentWrite}
  />
</section>
