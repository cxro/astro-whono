<script lang="ts">
import { tick } from 'svelte';
import { containsMarkdownMath } from '../../../lib/markdown-math';
import { ensureMarkdownMathStylesheet } from '../../../lib/markdown-math-styles';
import {
  ADMIN_EDITOR_DEFAULTS_STORAGE_KEY,
  ADMIN_EDITOR_DISPLAY_PREFERENCE_STORAGE_KEY,
  ADMIN_EDITOR_LAYOUT_STORAGE_KEY,
  ADMIN_EDITOR_SIDE_PANEL_PREFERENCE_STORAGE_KEY,
  readStoredAdminEditorDefaults
} from '../../../lib/admin-console/ui-prefs-keys';
import { closeClosestAdminDetailsMenu } from '../../../scripts/admin-content/details-menu';
import {
  deleteContentEntry as requestContentDelete,
  renderContentPreview,
  saveContentEntry,
  type AdminContentIssue,
  type AdminContentWriteResult
} from './content-editor-client';
import { flattenEntryIdToSlug } from '../../../utils/slug-rules';
import EditorDialogs from './EditorDialogs.svelte';
import EditorFooterActions from './EditorFooterActions.svelte';
import EditorTopControls from './EditorTopControls.svelte';
import EditorWorkspace from './EditorWorkspace.svelte';
import {
  ADMIN_EDITOR_DETAILS_MENU_SELECTORS,
  syncArticleInfoTriggers
} from './editor-page-integration';
import { createEditorPageLifecycle } from './editor-page-lifecycle';
import {
  CONTENT_LIST_DELETE_FEEDBACK_STORAGE_KEY,
  CONTENT_LIST_DELETE_FEEDBACK_VALUE
} from './content-list-feedback';
import {
  buildContentExportHref,
  clearStoredWriteFeedback,
  EDITOR_OUTLINE_TARGET_SCROLL_OFFSET_RATIO,
  EDITOR_SCROLLBAR_VISIBILITY_TIMEOUT_MS,
  getEditorBodyCharCount,
  getEditorScrollSyncToggleLabel,
  getPreviewDebounceMs,
  normalizeEditorBodyValue,
  readStoredWriteFeedback,
  storeWriteFeedback,
  type EditorScrollSource,
  type StatusState
} from './editor-shell-helpers';
import { createEditorShellController } from './editor-shell-controller.svelte';
import type { EditableImageBlock } from './editor-image-blocks';
import type { EditableGalleryBlock } from './editor-gallery-blocks';
import { createEditorScrollSyncController } from './editor-scroll-sync';
import {
  buildEssayOutlineListItems,
  extractMarkdownOutline,
  type MarkdownOutlineJumpCommand,
  type MarkdownOutlineItem
} from './editor-outline-helpers';
import {
  scrollPreviewToOutlineKey as scrollPreviewElementToOutlineKey
} from './editor-outline-scroll';
import {
  createEditorPreviewRequestGuard
} from './editor-preview-request-guard';
import type { MarkdownToolbarCommand } from './markdown-tools';
import { createMarkdownCommandDispatcher } from './editor-markdown-command-dispatcher';
import type { EssayEditorShellProps } from './editor-shell-props';
import { getContentEditorAdapter, isEssayEditorValues } from './content-editor-adapters';

const LEAVE_CONFIRM_MESSAGE = '当前有未保存更改，确定要离开此页吗？';
const ARTICLE_INFO_TRIGGER_SELECTOR = '[data-admin-article-info-trigger]';
const PAGE_ACTIONS_HOST_SELECTOR = '[data-admin-editor-page-actions-host]';
const FRONTMATTER_PANEL_ID = 'admin-editor-frontmatter-panel';
const ARTICLE_INFO_DIALOG_TITLE = '文章信息';
const ARTICLE_INFO_FIELDS_ARIA_LABEL = '随笔字段';
const OUTLINE_PANEL_ID = 'admin-editor-outline-panel';
const SYNTAX_PANEL_ID = 'admin-editor-syntax-panel';
const PREVIEW_OUTLINE_KEY_ATTR = 'data-admin-outline-key';
const WRITE_FEEDBACK_STORAGE_PREFIX = 'astro-whono:admin-editor:write-feedback:';
const WRITE_FEEDBACK_STORAGE_TTL_MS = 60 * 1000;

let {
  endpoint,
  exportEndpoint,
  deleteEndpoint,
  previewEndpoint,
  imageUploadEndpoint,
  returnHref,
  entryId,
  relativePath,
  defaultPublicSlug,
  revision,
  initialFrontmatter,
  initialBody = '',
  essayOutlineItems = [],
  initialArticleInfoOpen = false
}: EssayEditorShellProps = $props();

const collection = 'essay' as const;
const editorAdapter = getContentEditorAdapter(collection);
const slugPlaceholder = $derived(`留空使用默认：${defaultPublicSlug || flattenEntryIdToSlug(entryId)}`);
const bodyEditingEnabled = editorAdapter.capabilities.body;
const previewEnabled = editorAdapter.capabilities.preview;
const imageInsertEnabled = editorAdapter.capabilities.bodyImageInsert;
const galleryInsertEnabled = editorAdapter.capabilities.bodyGalleryInsert;
const essayOutlineEnabled = editorAdapter.capabilities.essayOutline;

const createInitialSnapshot = () => ({
  revision,
  frontmatter: editorAdapter.cloneValues(initialFrontmatter),
  body: bodyEditingEnabled ? normalizeEditorBodyValue(initialBody) : '',
  articleInfoOpen: initialArticleInfoOpen
});

const initialSnapshot = createInitialSnapshot();
const writeFeedbackStorageKey = $derived(`${WRITE_FEEDBACK_STORAGE_PREFIX}${collection}:${entryId}`);

let currentRevision = $state(initialSnapshot.revision);
let baselineFrontmatter = $state(editorAdapter.cloneValues(initialSnapshot.frontmatter));
let baselineBody = $state(initialSnapshot.body);
let frontmatter = $state(editorAdapter.cloneValues(initialSnapshot.frontmatter));
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
const previewRequestGuard = createEditorPreviewRequestGuard();
const readDevAdminEditorDefaults = () =>
  import.meta.env.DEV ? readStoredAdminEditorDefaults(ADMIN_EDITOR_DEFAULTS_STORAGE_KEY) : null;
const shell = createEditorShellController({
  layoutStorageKey: ADMIN_EDITOR_LAYOUT_STORAGE_KEY,
  displayPreferenceStorageKey: ADMIN_EDITOR_DISPLAY_PREFERENCE_STORAGE_KEY,
  sidePanelPreferenceStorageKey: ADMIN_EDITOR_SIDE_PANEL_PREFERENCE_STORAGE_KEY,
  readAdminDefaults: readDevAdminEditorDefaults
});
let toolbarCommand = $state<MarkdownToolbarCommand | null>(null);
let outlineJumpCommand = $state<MarkdownOutlineJumpCommand | null>(null);
let frontmatterPanelOpen = $state(initialSnapshot.articleInfoOpen);
let editorDialogs = $state<EditorDialogs | null>(null);
let imageInsertOpen = $state(false);
let galleryInsertOpen = $state(false);
let editingImageBlock = $state<EditableImageBlock | null>(null);
let editingGalleryBlock = $state<EditableGalleryBlock | null>(null);
const markdownCommandDispatcher = createMarkdownCommandDispatcher({
  isBusy: () => busy,
  onCommand: (command) => {
    toolbarCommand = command;
  }
});
let editorShellEl = $state<HTMLElement | null>(null);
let topActionsEl = $state<HTMLDivElement | null>(null);
let bodyScrollElement = $state<HTMLElement | null>(null);
let previewScrollElement = $state<HTMLElement | null>(null);
let syncScrollEnabled = $state(true);
let writeFeedbackRestored = false;
let pendingPreviewOutlineKey = $state<string | null>(null);
let pendingPreviewOutlineJumpId = 0;
let outlineJumpCommandId = 0;

const bodyLineCount = $derived(body.length === 0 ? 1 : body.split(/\r\n|\r|\n/).length);
const bodyCharCount = $derived(getEditorBodyCharCount(body));
const frontmatterDirty = $derived(!editorAdapter.isEqualValues(frontmatter, baselineFrontmatter));
const bodyDirty = $derived(bodyEditingEnabled && body !== baselineBody);
const isDirty = $derived(frontmatterDirty || bodyDirty);
const canWriteContent = $derived(!busy && isDirty);
const frontmatterIssueCount = $derived(
  issues.filter((issue) => editorAdapter.isFrontmatterIssuePath(issue.path)).length
);
const visibleWriteResult = $derived(!isDirty ? writeResult : null);
const exportHref = $derived(buildContentExportHref(exportEndpoint, collection, entryId));
const scrollSyncAvailable = $derived(
  shell.effectiveViewMode === 'both' && Boolean(bodyScrollElement && previewScrollElement)
);
const scrollSyncToggleLabel = $derived(getEditorScrollSyncToggleLabel({
  available: scrollSyncAvailable,
  enabled: syncScrollEnabled
}));
const scrollSyncControlDisabled = $derived(!scrollSyncAvailable);
const scrollTopControlDisabled = $derived(!bodyScrollElement && !previewScrollElement);
const markdownOutlineItems = $derived(
  essayOutlineEnabled && shell.outlineVisible && shell.outlineActiveTab === 'headings'
    ? extractMarkdownOutline(body)
    : []
);
const outlineListItems = $derived(
  essayOutlineEnabled ? buildEssayOutlineListItems(essayOutlineItems, entryId) : []
);

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

const closeImageInsert = () => {
  imageInsertOpen = false;
  editingImageBlock = null;
};

const handleImageToolRequest = (block: EditableImageBlock | null) => {
  if (!imageInsertEnabled) return;
  editingImageBlock = block;
  imageInsertOpen = true;
};

const openGalleryInsert = () => {
  if (!galleryInsertEnabled) return;
  editingGalleryBlock = null;
  galleryInsertOpen = true;
};

const closeGalleryInsert = () => {
  galleryInsertOpen = false;
  editingGalleryBlock = null;
};

const handleGalleryEditRequest = (block: EditableGalleryBlock) => {
  if (!galleryInsertEnabled) return;
  editingGalleryBlock = block;
  galleryInsertOpen = true;
};

const removeEditingGallery = () => {
  const galleryBlock = editingGalleryBlock;
  if (!galleryBlock) return;

  markdownCommandDispatcher.replaceText(galleryBlock.range, '');
  editingGalleryBlock = null;
};

const setBodyScrollElement = (element: HTMLElement | null) => {
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
  scrollbarVisibilityTimeoutMs: EDITOR_SCROLLBAR_VISIBILITY_TIMEOUT_MS
});

const handleEditorPaneScroll = (source: EditorScrollSource) => {
  scrollSyncController.handlePaneScroll(source);
};

const toggleScrollSync = () => {
  scrollSyncController.toggleEnabled();
};

const scrollEditorPanesToTop = () => {
  scrollSyncController.scrollToTop(shell.effectiveViewMode);
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
    { targetOffsetRatio: EDITOR_OUTLINE_TARGET_SCROLL_OFFSET_RATIO }
  );
  if (!scrolled || !previewElement) return false;

  scrollSyncController.markElementScrolling(previewElement);
  return true;
};

const scrollBodyToOutlineTarget = (item: MarkdownOutlineItem): boolean => {
  if (!bodyScrollElement) return false;

  outlineJumpCommandId += 1;
  outlineJumpCommand = {
    id: outlineJumpCommandId,
    item,
    targetOffsetRatio: EDITOR_OUTLINE_TARGET_SCROLL_OFFSET_RATIO
  };
  return true;
};

const handleBodyOutlineJump = (element: HTMLElement) => {
  scrollSyncController.markElementScrolling(element);
};

const handleOutlineHeadingSelect = (item: MarkdownOutlineItem) => {
  const shouldScrollBody = shell.effectiveViewMode !== 'preview';
  const shouldScrollPreview = shell.effectiveViewMode !== 'edit';
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
      bodyScrolled = scrollBodyToOutlineTarget(item);
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
    || shell.effectiveViewMode === 'edit'
  ) {
    return;
  }

  scrollSyncController.cancelQueued();
  scrollSyncController.setGuarded(true);
  const scrolled = scrollPreviewToOutlineTarget(outlineKey);
  if (scrolled) {
    pendingPreviewOutlineKey = null;
    scrollSyncController.setLastSource('preview');
  } else if (previewRequestGuard.getLatestSource() === body) {
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

const abortActivePreviewRequest = (invalidate = false) => {
  previewRequestGuard.abortActiveRequest({ invalidate });
  if (invalidate) previewBusy = false;
};

const requestContentWrite = async () => {
  busy = true;
  clearWriteFeedback();
  clearStoredWriteFeedback(writeFeedbackStorageKey);
  setStatus('loading', '内容保存中');

  try {
    const saveOutcome = await saveContentEntry({
      endpoint,
      collection,
      entryId,
      revision: currentRevision,
      frontmatter,
      ...(bodyEditingEnabled && bodyDirty ? { body } : {})
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
    const latestValues = isEssayEditorValues(saveOutcome.latestValues) ? saveOutcome.latestValues : null;
    const latestBody = saveOutcome.latestBody;
    const nextBaseline = latestValues
      ? editorAdapter.cloneValues(latestValues)
      : editorAdapter.cloneValues(frontmatter);
    frontmatter = editorAdapter.cloneValues(nextBaseline);
    baselineFrontmatter = editorAdapter.cloneValues(nextBaseline);
    baselineBody = bodyEditingEnabled && latestBody !== null ? normalizeEditorBodyValue(latestBody) : body;
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
  if (!previewEnabled) return;

  const sourceSnapshot = body;
  const previewRequest = previewRequestGuard.beginRequest(sourceSnapshot);

  previewBusy = true;
  previewError = '';
  previewWarnings = [];

  try {
    const previewOutcome = await renderContentPreview({
      endpoint: previewEndpoint,
      collection,
      entryId,
      source: sourceSnapshot,
      signal: previewRequest.signal
    });

    if (!previewRequest.isCurrentForSource(body)) return;

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
    if (previewRequest.signal.aborted || !previewRequest.isCurrent()) return;
    previewError = '预览请求失败，请稍后重试';
    setStatus('error', '预览请求失败');
  } finally {
    if (previewRequest.isCurrent()) {
      previewBusy = false;
      previewRequestGuard.finishRequest(previewRequest);
    }
  }
};

const resetToBaseline = () => {
  frontmatter = editorAdapter.cloneValues(baselineFrontmatter);
  body = baselineBody;
  clearWriteFeedback();
  clearStoredWriteFeedback(writeFeedbackStorageKey);
  clearStatus();
};

const resetFrontmatterToBaseline = () => {
  frontmatter = editorAdapter.cloneValues(baselineFrontmatter);
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
    `确认删除《${editorAdapter.getDeleteTitle(frontmatter, entryId)}》？`,
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
    const deleteOutcome = await requestContentDelete({
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

    baselineFrontmatter = editorAdapter.cloneValues(frontmatter);
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
  shell.restorePreferences();
});

$effect(() => {
  return createEditorPageLifecycle({
    shellElement: editorShellEl,
    actionsElement: topActionsEl,
    pageActionsHostSelector: PAGE_ACTIONS_HOST_SELECTOR,
    onInlineSize: shell.setInlineSize,
    detailsMenuSelectors: ADMIN_EDITOR_DETAILS_MENU_SELECTORS,
    navigationGuard: {
      isDirty: () => isDirty,
      message: LEAVE_CONFIRM_MESSAGE,
      onBlocked: () => {
        setStatus('warn', '请先保存或还原');
      }
    },
    articleInfoTrigger: {
      selector: ARTICLE_INFO_TRIGGER_SELECTOR,
      onToggle: toggleFrontmatterPanel
    }
  });
});

$effect(() => {
  const bodyElement = bodyScrollElement;
  const previewElement = previewScrollElement;
  if (!bodyElement || !previewElement || shell.effectiveViewMode !== 'both') return;

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
  if (!outlineKey || previewBusy || shell.effectiveViewMode === 'edit') return;

  void runPendingPreviewOutlineJump(outlineKey);
});

$effect(() => {
  return () => {
    scrollSyncController.destroy();
    previewRequestGuard.destroy();
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
  shell.syncSyntaxMaximized();
});

$effect(() => {
  syncDirtyStatus();
});

$effect(() => {
  if (previewEnabled && containsMarkdownMath(body)) {
    ensureMarkdownMathStylesheet();
  }
});

$effect(() => {
  if (!previewEnabled) return;

  const currentBody = body;

  if (previewRequestGuard.consumeInitialRequest()) {
    void requestPreview();
    return;
  }

  if (currentBody === previewRequestGuard.getLatestSource()) {
    previewRequestGuard.clearScheduledRequest();
    return;
  }

  abortActivePreviewRequest(true);
  return previewRequestGuard.scheduleRequest(currentBody, getPreviewDebounceMs(currentBody), () => {
    void requestPreview();
  });
});
</script>

<section
  class="admin-editor-shell"
  bind:this={editorShellEl}
  data-layout={shell.layout}
  data-view={shell.viewMode}
  data-effective-view={shell.effectiveViewMode}
  data-side-panel={shell.sidePanelLayout}
>
  <EditorTopControls
    bind:actionMenuElement={topActionsEl}
    {busy}
    bodyToolsEnabled={bodyEditingEnabled}
    outlineOpen={shell.outlineOpen}
    outlineVisible={shell.outlineVisible}
    outlineToggleLabel={shell.outlineToggleLabel}
    outlineControlDisabled={shell.outlineControlDisabled}
    outlinePanelId={OUTLINE_PANEL_ID}
    syntaxOpen={shell.syntaxOpen}
    syntaxVisible={shell.syntaxVisible}
    syntaxToggleLabel={shell.syntaxToggleLabel}
    syntaxControlDisabled={shell.syntaxControlDisabled}
    syntaxPanelId={SYNTAX_PANEL_ID}
    lineNumbersEnabled={shell.lineNumbers}
    lineNumbersToggleLabel={shell.lineNumbersToggleLabel}
    markdownHighlightTheme={shell.markdownHighlightTheme}
    editorLayoutIsSplit={shell.layout === 'split'}
    editorLayoutToggleLabel={shell.layoutToggleLabel}
    editorLayoutToggleIcon={shell.layoutToggleIcon}
    singleViewActive={shell.singleViewActive}
    singleViewReturnLabel={shell.singleViewReturnLabel}
    splitBothIsCompact={shell.splitBothIsCompact}
    compactPaneToggleLabel={shell.compactPaneToggleLabel}
    compactPaneToggleText={shell.compactPaneToggleText}
    editViewToggleLabel={shell.editViewToggleLabel}
    previewViewToggleLabel={shell.previewViewToggleLabel}
    effectiveViewMode={shell.effectiveViewMode}
    onApplyTool={markdownCommandDispatcher.applyTool}
    onApplyHeading={markdownCommandDispatcher.applyHeading}
    onApplyCallout={markdownCommandDispatcher.applyCallout}
    onInsertText={markdownCommandDispatcher.insertText}
    onOpenGallery={openGalleryInsert}
    onToggleOutline={shell.toggleOutline}
    onToggleSyntax={shell.toggleSyntax}
    onToggleLineNumbers={shell.toggleLineNumbers}
    onSelectMarkdownHighlightTheme={shell.selectMarkdownHighlightTheme}
    onToggleLayout={shell.toggleLayout}
    onToggleView={shell.toggleViewMode}
    onReturnToBothView={shell.returnToBothView}
    onToggleCompactPane={shell.toggleCompactPaneMode}
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

  {#if bodyEditingEnabled}
    <EditorWorkspace
      bind:value={body}
      disabled={busy}
      {toolbarCommand}
      {outlineJumpCommand}
      lineNumbersEnabled={shell.lineNumbers}
      markdownHighlightTheme={shell.markdownHighlightTheme}
      effectiveViewMode={shell.effectiveViewMode}
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
      getWriteFieldLabel={editorAdapter.getWriteFieldLabel}
      mediaEditEnabled={imageInsertEnabled}
      galleryEditEnabled={galleryInsertEnabled}
      {previewHtml}
      previewBusy={previewBusy}
      sidePanelsVisible={shell.sidePanelsVisible}
      sidePanelLayout={shell.sidePanelLayout}
      outlinePanelId={OUTLINE_PANEL_ID}
      syntaxPanelId={SYNTAX_PANEL_ID}
      outlineActiveTab={shell.outlineActiveTab}
      {markdownOutlineItems}
      {outlineListItems}
      onBodyScrollElementChange={setBodyScrollElement}
      onBodyOutlineJump={handleBodyOutlineJump}
      onImageToolRequest={handleImageToolRequest}
      onGalleryEditRequest={handleGalleryEditRequest}
      onPreviewScrollElementChange={setPreviewScrollElement}
      onShortcutTool={markdownCommandDispatcher.applyTool}
      onToggleScrollSync={toggleScrollSync}
      onScrollToTop={scrollEditorPanesToTop}
      onOutlineTabChange={shell.setOutlineTab}
      onOutlineHeadingSelect={handleOutlineHeadingSelect}
      onSyntaxMaximizeToggle={shell.toggleSyntaxMaximize}
    />
  {/if}

  <EditorDialogs
    bind:this={editorDialogs}
    bind:frontmatter
    {collection}
    dialogTitle={ARTICLE_INFO_DIALOG_TITLE}
    fieldsAriaLabel={ARTICLE_INFO_FIELDS_ARIA_LABEL}
    frontmatterOpen={frontmatterPanelOpen}
    {relativePath}
    {issues}
    disabled={busy}
    {frontmatterDirty}
    canSave={canWriteContent}
    {slugPlaceholder}
    {imageInsertOpen}
    {galleryInsertOpen}
    imageEditDraft={editingImageBlock?.draft ?? null}
    galleryEditDraft={editingGalleryBlock?.draft ?? null}
    {imageInsertEnabled}
    {galleryInsertEnabled}
    {imageUploadEndpoint}
    {entryId}
    onFrontmatterClose={closeFrontmatterPanel}
    onFrontmatterReset={resetFrontmatterToBaseline}
    onFrontmatterSave={() => void requestContentWrite()}
    onImageClose={closeImageInsert}
    onImageInsert={(text, placement) => {
      const imageBlock = editingImageBlock;
      if (imageBlock) {
        markdownCommandDispatcher.replaceText(imageBlock.range, text, placement);
        editingImageBlock = null;
        return;
      }
      markdownCommandDispatcher.insertText(text, placement);
    }}
    onGalleryClose={closeGalleryInsert}
    onGalleryRemove={removeEditingGallery}
    onGalleryInsert={(text, placement) => {
      const galleryBlock = editingGalleryBlock;
      if (galleryBlock) {
        markdownCommandDispatcher.replaceText(galleryBlock.range, text, placement);
        editingGalleryBlock = null;
        return;
      }
      markdownCommandDispatcher.insertText(text, placement);
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
