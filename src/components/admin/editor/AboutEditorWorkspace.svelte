<script lang="ts">
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
  renderContentPreview,
  saveContentEntry,
  type AdminContentPreviewResult,
  type AdminContentIssue,
  type AdminContentWriteResult
} from './content-editor-client';
import { getContentEditorAdapter } from './content-editor-adapters';
import EditorFooterActions from './EditorFooterActions.svelte';
import EditorTopControls from './EditorTopControls.svelte';
import EditorWorkspace from './EditorWorkspace.svelte';
import { ADMIN_EDITOR_DETAILS_MENU_SELECTORS } from './editor-page-integration';
import { createEditorPageLifecycle } from './editor-page-lifecycle';
import {
  buildContentExportHref,
  EDITOR_OUTLINE_TARGET_SCROLL_OFFSET_RATIO,
  EDITOR_SCROLLBAR_VISIBILITY_TIMEOUT_MS,
  getEditorBodyCharCount,
  getEditorScrollSyncToggleLabel,
  getPreviewDebounceMs,
  normalizeEditorBodyValue,
  type EditorScrollSource,
  type StatusState
} from './editor-shell-helpers';
import {
  createEditorShellController,
  createFallbackOutlineTabNormalizer
} from './editor-shell-controller.svelte';
import {
  extractMarkdownOutline,
  type MarkdownOutlineJumpCommand,
  type MarkdownOutlineItem
} from './editor-outline-helpers';
import type { MarkdownToolbarCommand } from './markdown-tools';
import { createEditorScrollSyncController } from './editor-scroll-sync';
import { createMarkdownCommandDispatcher } from './editor-markdown-command-dispatcher';
import { createEditorPreviewRequestGuard } from './editor-preview-request-guard';
import { FIXED_PAGE_EDITOR_COPY } from './fixed-page-editor-copy';
import type { AboutEditorIslandProps } from './about-editor-island-props';

const PAGE_ACTIONS_HOST_SELECTOR = '[data-admin-editor-page-actions-host]';
const OUTLINE_PANEL_ID = 'admin-about-editor-outline-panel';
const SYNTAX_PANEL_ID = 'admin-about-editor-syntax-panel';
const ABOUT_EDITOR_SIDE_PANEL_PREFERENCE_STORAGE_KEY = `${ADMIN_EDITOR_SIDE_PANEL_PREFERENCE_STORAGE_KEY}:about`;

let {
  endpoint,
  exportEndpoint,
  previewEndpoint,
  returnHref,
  entryId,
  revision,
  initialBody
}: AboutEditorIslandProps = $props();

const editorAdapter = getContentEditorAdapter('about');
const collection = 'about' as const;
const exportHref = $derived(buildContentExportHref(exportEndpoint, collection, entryId));

const createInitialSnapshot = () => ({
  revision,
  body: normalizeEditorBodyValue(initialBody)
});

const initialSnapshot = createInitialSnapshot();

let topActionsEl = $state<HTMLDivElement | null>(null);
let currentRevision = $state(initialSnapshot.revision);
let baselineBody = $state(initialSnapshot.body);
let body = $state(initialSnapshot.body);
let busy = $state(false);
let statusState = $state<StatusState>('idle');
let statusText = $state('');
let errors = $state<string[]>([]);
let issues = $state<AdminContentIssue[]>([]);
let writeResult = $state<AdminContentWriteResult | null>(null);
let previewResult = $state<AdminContentPreviewResult | null>(null);
let previewBusy = $state(false);
let previewError = $state('');
let previewWarnings = $state<string[]>([]);
const previewRequestGuard = createEditorPreviewRequestGuard();
const readDevAdminEditorDefaults = () =>
  import.meta.env.DEV ? readStoredAdminEditorDefaults(ADMIN_EDITOR_DEFAULTS_STORAGE_KEY) : null;
const shell = createEditorShellController({
  layoutStorageKey: ADMIN_EDITOR_LAYOUT_STORAGE_KEY,
  displayPreferenceStorageKey: ADMIN_EDITOR_DISPLAY_PREFERENCE_STORAGE_KEY,
  sidePanelPreferenceStorageKey: ABOUT_EDITOR_SIDE_PANEL_PREFERENCE_STORAGE_KEY,
  readAdminDefaults: readDevAdminEditorDefaults,
  normalizeOutlineTab: createFallbackOutlineTabNormalizer('essays', 'headings')
});
let toolbarCommand = $state<MarkdownToolbarCommand | null>(null);
let outlineJumpCommand = $state<MarkdownOutlineJumpCommand | null>(null);
let editorShellEl = $state<HTMLElement | null>(null);
let bodyScrollElement = $state<HTMLElement | null>(null);
let previewScrollElement = $state<HTMLElement | null>(null);
let syncScrollEnabled = $state(true);
let outlineJumpCommandId = 0;

const markdownCommandDispatcher = createMarkdownCommandDispatcher({
  isBusy: () => busy,
  onCommand: (command) => {
    toolbarCommand = command;
  }
});

const bodyDirty = $derived(body !== baselineBody);
const dirty = $derived(bodyDirty);
const canWriteContent = $derived(!busy && dirty);
const bodyLineCount = $derived(body.length === 0 ? 1 : body.split(/\r\n|\r|\n/).length);
const bodyCharCount = $derived(getEditorBodyCharCount(body));
const visibleWriteResult = $derived(!dirty ? writeResult : null);
const markdownOutlineItems = $derived(
  shell.outlineVisible && shell.outlineActiveTab === 'headings'
    ? extractMarkdownOutline(body)
    : []
);
const outlineListItems = $derived([]);
const previewHtml = $derived(previewResult?.html ?? '');
const previewSnapshotKey = $derived(body);
const scrollSyncAvailable = $derived(
  shell.effectiveViewMode === 'both' && Boolean(bodyScrollElement && previewScrollElement)
);
const scrollSyncToggleLabel = $derived(getEditorScrollSyncToggleLabel({
  available: scrollSyncAvailable,
  enabled: syncScrollEnabled
}));
const scrollSyncControlDisabled = $derived(!scrollSyncAvailable);
const scrollTopControlDisabled = $derived(!bodyScrollElement && !previewScrollElement);

const setStatus = (state: StatusState, text: string) => {
  statusState = state;
  statusText = text;
};

const clearWriteFeedback = () => {
  errors = [];
  issues = [];
  writeResult = null;
};

const markDirty = () => {
  clearWriteFeedback();
  if (statusState === 'error' || statusState === 'warn') return;
  if (dirty) setStatus('idle', '');
};

const handleImageToolRequest = () => {
  setStatus('warn', FIXED_PAGE_EDITOR_COPY.unsupportedImageInsert);
};

const openGalleryInsert = () => {
  setStatus('warn', FIXED_PAGE_EDITOR_COPY.unsupportedGalleryInsert);
};

const handleGalleryEditRequest = () => {
  setStatus('warn', FIXED_PAGE_EDITOR_COPY.unsupportedGalleryInsert);
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
  if (shell.effectiveViewMode === 'preview') return;

  scrollSyncController.cancelQueued();
  const bodyScrolled = scrollBodyToOutlineTarget(item);
  if (bodyScrolled) {
    scrollSyncController.setLastSource('body');
  }
};

const abortActivePreviewRequest = (invalidate = false) => {
  previewRequestGuard.abortActiveRequest({ invalidate });
  if (invalidate) previewBusy = false;
};

const resetToBaseline = () => {
  body = baselineBody;
  clearWriteFeedback();
  setStatus('idle', '');
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

const commitLatestBody = (latestBody: string | null) => {
  const nextBody = latestBody === null ? body : normalizeEditorBodyValue(latestBody);
  body = nextBody;
  baselineBody = nextBody;
};

const applyLatestBodyBaseline = (latestBody: string | null) => {
  if (latestBody === null) return false;

  baselineBody = normalizeEditorBodyValue(latestBody);
  return true;
};

const requestContentWrite = async () => {
  busy = true;
  clearWriteFeedback();
  setStatus('loading', FIXED_PAGE_EDITOR_COPY.saving);

  try {
    const saveOutcome = await saveContentEntry({
      endpoint,
      collection,
      entryId,
      revision: currentRevision,
      body
    });

    if (saveOutcome.revision && saveOutcome.responseOk) currentRevision = saveOutcome.revision;

    if (!saveOutcome.responseOk || !saveOutcome.payloadOk) {
      issues = saveOutcome.issues;
      const nextErrors = saveOutcome.errors.length > 0
        ? saveOutcome.errors
        : [FIXED_PAGE_EDITOR_COPY.saveFallbackError];
      if (saveOutcome.status === 409 && applyLatestBodyBaseline(saveOutcome.latestBody)) {
        if (saveOutcome.revision) currentRevision = saveOutcome.revision;
        errors = [
          ...nextErrors,
          '已载入磁盘最新版本作为冲突基线，当前编辑内容仍保留。请核对后再次保存，或通过“还原更改”载入磁盘版本。'
        ];
        setStatus('warn', '检测到外部更新，草稿已保留');
        return;
      }

      errors = nextErrors;
      setStatus(saveOutcome.status === 409 ? 'warn' : 'error', saveOutcome.status === 409 ? '检测到外部更新' : '保存失败');
      return;
    }

    const result = saveOutcome.result;
    if (!result) {
      errors = ['响应体缺少 result 字段，请检查开发日志'];
      setStatus('error', '写入响应异常');
      return;
    }

    writeResult = result;
    commitLatestBody(saveOutcome.latestBody);
    setStatus(result.changed ? 'ok' : 'ready', result.changed ? FIXED_PAGE_EDITOR_COPY.saved : '当前没有变更');
  } catch {
    errors = ['保存请求失败，请稍后重试'];
    setStatus('error', '保存请求失败');
  } finally {
    busy = false;
  }
};

const requestPreview = async (snapshotKey: string) => {
  const previewRequest = previewRequestGuard.beginRequest(snapshotKey);

  previewBusy = true;
  previewError = '';
  previewWarnings = [];

  try {
    const previewOutcome = await renderContentPreview({
      endpoint: previewEndpoint,
      collection,
      entryId,
      source: snapshotKey,
      signal: previewRequest.signal
    });

    if (!previewRequest.isCurrentForSource(previewSnapshotKey)) return;

    const nextPreviewResult = previewOutcome.result;
    if (!previewOutcome.responseOk || !previewOutcome.payloadOk || !nextPreviewResult) {
      issues = previewOutcome.issues;
      previewError = previewOutcome.errors[0] ?? '预览生成失败，请检查响应与控制台日志';
      return;
    }

    issues = [];
    previewResult = nextPreviewResult;
    previewWarnings = nextPreviewResult.warnings;
  } catch {
    if (previewRequest.signal.aborted || !previewRequest.isCurrent()) return;
    previewError = '预览请求失败，请稍后重试';
  } finally {
    if (previewRequest.isCurrent()) {
      previewBusy = false;
      previewRequestGuard.finishRequest(previewRequest);
    }
  }
};

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
      isDirty: () => dirty,
      message: FIXED_PAGE_EDITOR_COPY.leaveConfirm,
      onBlocked: () => {
        setStatus('warn', '请先保存或还原');
      }
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
  shell.syncSyntaxMaximized();
});

$effect(() => {
  if (containsMarkdownMath(body)) {
    ensureMarkdownMathStylesheet();
  }
});

$effect(() => {
  return () => {
    scrollSyncController.destroy();
    previewRequestGuard.destroy();
  };
});

$effect(() => {
  const snapshotKey = previewSnapshotKey;
  if (previewRequestGuard.consumeInitialRequest()) {
    void requestPreview(snapshotKey);
    return;
  }

  if (snapshotKey === previewRequestGuard.getLatestSource()) {
    previewRequestGuard.clearScheduledRequest();
    return;
  }

  abortActivePreviewRequest(true);
  return previewRequestGuard.scheduleRequest(
    snapshotKey,
    Math.max(320, getPreviewDebounceMs(body)),
    requestPreview
  );
});

</script>

<section
  class="admin-about-editor admin-editor-shell"
  bind:this={editorShellEl}
  data-admin-about-editor-workspace
  data-layout={shell.layout}
  data-view={shell.viewMode}
  data-effective-view={shell.effectiveViewMode}
  data-side-panel={shell.sidePanelLayout}
>
  <EditorTopControls
    bind:actionMenuElement={topActionsEl}
    {busy}
    toolbarPreset="full"
    imageToolEnabled={editorAdapter.capabilities.bodyImageInsert}
    galleryToolEnabled={editorAdapter.capabilities.bodyGalleryInsert}
    aboutDirectiveToolsEnabled
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
    {dirty}
    {returnHref}
    {exportHref}
    actionLabel={FIXED_PAGE_EDITOR_COPY.actionLabel}
    moreLabel={FIXED_PAGE_EDITOR_COPY.moreLabel}
    saveLabel={FIXED_PAGE_EDITOR_COPY.saveLabel}
    downloadLabel="下载源文件"
    showDelete={editorAdapter.capabilities.delete}
    onSave={requestContentWrite}
    onReset={handleActionMenuReset}
    onDownload={handleActionMenuDownload}
  />

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
    mediaEditEnabled={editorAdapter.capabilities.bodyImageInsert}
    galleryEditEnabled={editorAdapter.capabilities.bodyGalleryInsert}
    aboutDirectiveHighlightEnabled
    {previewHtml}
    {previewBusy}
    previewArticleClass="about-body"
    sidePanelsVisible={shell.sidePanelsVisible}
    sidePanelLayout={shell.sidePanelLayout}
    outlinePanelId={OUTLINE_PANEL_ID}
    syntaxPanelId={SYNTAX_PANEL_ID}
    outlineActiveTab={shell.outlineActiveTab}
    {markdownOutlineItems}
    {outlineListItems}
    outlineListEnabled={false}
    outlineHeadingsTabLabel={FIXED_PAGE_EDITOR_COPY.outlineHeadingsTabLabel}
    outlineHeadingsTabIcon="square-chart-gantt"
    outlineHeadingsEmptyText="暂无 H2/H3 标题"
    outlinePanelLabel={FIXED_PAGE_EDITOR_COPY.outlinePanelLabel}
    onBodyScrollElementChange={setBodyScrollElement}
    onBodyOutlineJump={handleBodyOutlineJump}
    onImageToolRequest={handleImageToolRequest}
    onGalleryEditRequest={handleGalleryEditRequest}
    onBodyChange={markDirty}
    onPreviewScrollElementChange={setPreviewScrollElement}
    onShortcutTool={markdownCommandDispatcher.applyTool}
    onToggleScrollSync={toggleScrollSync}
    onScrollToTop={scrollEditorPanesToTop}
    onOutlineTabChange={shell.setOutlineTab}
    onOutlineHeadingSelect={handleOutlineHeadingSelect}
    onSyntaxMaximizeToggle={shell.toggleSyntaxMaximize}
  />

  <EditorFooterActions
    {statusText}
    {statusState}
    {busy}
    {dirty}
    {canWriteContent}
    saveLabel={FIXED_PAGE_EDITOR_COPY.saveLabel}
    onReset={resetToBaseline}
    onSave={requestContentWrite}
  />
</section>
