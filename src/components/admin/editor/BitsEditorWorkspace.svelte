<script lang="ts">
import { onMount } from 'svelte';
import type { AdminBitsEditorValues } from '../../../lib/admin-console/content-editor-payload';
import {
  buildBitsCardViewModel,
  type BitsCardAuthorInput
} from '../../../lib/bits-card-view-model';
import {
  ADMIN_EDITOR_DEFAULTS_STORAGE_KEY,
  ADMIN_EDITOR_DISPLAY_PREFERENCE_STORAGE_KEY,
  ADMIN_EDITOR_LAYOUT_STORAGE_KEY,
  ADMIN_EDITOR_SIDE_PANEL_PREFERENCE_STORAGE_KEY,
  readStoredAdminEditorDefaults
} from '../../../lib/admin-console/ui-prefs-keys';
import { closeClosestAdminDetailsMenu } from '../../../scripts/admin-content/details-menu';
import { createAdminImagePicker, type AdminImagePickerController } from '../../../scripts/admin-shared/image-picker';
import {
  CONTENT_LIST_DELETE_FEEDBACK_STORAGE_KEY,
  CONTENT_LIST_DELETE_FEEDBACK_VALUE
} from './content-list-feedback';
import {
  deleteContentEntry as requestContentDelete,
  renderContentPreview,
  saveContentEntry,
  type AdminContentIssue,
  type AdminContentWriteResult
} from './content-editor-client';
import {
  getContentEditorAdapter,
  isBitsEditorValues
} from './content-editor-adapters';
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
  ADMIN_EDITOR_DETAILS_MENU_SELECTORS,
  syncArticleInfoTriggers
} from './editor-page-integration';
import { createEditorPageLifecycle } from './editor-page-lifecycle';
import {
  createEditorShellController,
  createFixedOutlineTabNormalizer
} from './editor-shell-controller.svelte';
import {
  buildEditorOutlineListItems,
  type EditorOutlineListSourceItem,
  type MarkdownOutlineJumpCommand,
  type MarkdownOutlineItem
} from './editor-outline-helpers';
import type { MarkdownToolbarCommand } from './markdown-tools';
import { createEditorScrollSyncController } from './editor-scroll-sync';
import { createMarkdownCommandDispatcher } from './editor-markdown-command-dispatcher';
import { createEditorPreviewRequestGuard } from './editor-preview-request-guard';
import ArticleInfoDialog from './ArticleInfoDialog.svelte';
import EditorFooterActions from './EditorFooterActions.svelte';
import EditorTopControls from './EditorTopControls.svelte';
import EditorWorkspace from './EditorWorkspace.svelte';
import BitsImageRowsEditor from './BitsImageRowsEditor.svelte';
import BitsPublishStrip from './BitsPublishStrip.svelte';
import BitsPreviewPane from './BitsPreviewPane.svelte';
import {
  getEditableBitsImageRows,
  serializeBitsImageRows,
  type BitsImageRowDraft
} from './bits-image-rows';
import {
  getBitsEditorAuthor,
  getBitsEditorImages,
  getBitsEditorTags
} from './bits-editor-values';

type Props = {
  endpoint: string;
  exportEndpoint: string;
  deleteEndpoint: string;
  previewEndpoint: string;
  imageUploadEndpoint: string;
  returnHref: string;
  entryId: string;
  relativePath: string;
  defaultPublicSlug: string;
  revision: string;
  initialFrontmatter: AdminBitsEditorValues;
  initialBody: string;
  defaultAuthor: BitsCardAuthorInput;
  bitsOutlineItems?: EditorOutlineListSourceItem[];
};

const LEAVE_CONFIRM_MESSAGE = '当前内容尚未保存，确认离开此页面？';
const BITS_INFO_TRIGGER_SELECTOR = '[data-admin-bits-info-trigger]';
const PAGE_ACTIONS_HOST_SELECTOR = '[data-admin-editor-page-actions-host]';
const BITS_INFO_PANEL_ID = 'admin-editor-frontmatter-panel';
const OUTLINE_PANEL_ID = 'admin-bits-editor-outline-panel';
const SYNTAX_PANEL_ID = 'admin-bits-editor-syntax-panel';
const BITS_EDITOR_SIDE_PANEL_PREFERENCE_STORAGE_KEY = `${ADMIN_EDITOR_SIDE_PANEL_PREFERENCE_STORAGE_KEY}:bits`;
const BITS_INFO_FIELD_PATHS = [
  'title',
  'description',
  'draft',
  'authorName',
  'authorAvatar'
] as const satisfies readonly (keyof AdminBitsEditorValues)[];
type BitsInfoFieldPath = (typeof BITS_INFO_FIELD_PATHS)[number];

const isBitsInfoFieldPath = (path: string): path is BitsInfoFieldPath =>
  BITS_INFO_FIELD_PATHS.includes(path as BitsInfoFieldPath);

const getBitsInfoValues = (values: AdminBitsEditorValues): Pick<AdminBitsEditorValues, BitsInfoFieldPath> => ({
  title: values.title,
  description: values.description,
  draft: values.draft,
  authorName: values.authorName,
  authorAvatar: values.authorAvatar
});
const editorAdapter = getContentEditorAdapter('bits');

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
  initialBody,
  defaultAuthor,
  bitsOutlineItems = []
}: Props = $props();

const normalizeBitsValues = (values: AdminBitsEditorValues): AdminBitsEditorValues => {
  const rows = getEditableBitsImageRows(values.imagesText);
  return {
    ...values,
    imagesText: serializeBitsImageRows(rows)
  };
};

const cloneBitsValues = (values: AdminBitsEditorValues): AdminBitsEditorValues => {
  const cloned = editorAdapter.cloneValues(values);
  return normalizeBitsValues(cloned);
};

const createInitialSnapshot = () => {
  const frontmatter = cloneBitsValues(initialFrontmatter);
  return {
    revision,
    frontmatter,
    body: normalizeEditorBodyValue(initialBody),
    imageRows: getEditableBitsImageRows(frontmatter.imagesText)
  };
};

const initialSnapshot = createInitialSnapshot();
const exportHref = $derived(buildContentExportHref(exportEndpoint, 'bits', entryId));

let topActionsEl = $state<HTMLDivElement | null>(null);
let imagePicker = $state<AdminImagePickerController | null>(null);
let currentRevision = $state(initialSnapshot.revision);
let baselineFrontmatter = $state(cloneBitsValues(initialSnapshot.frontmatter));
let baselineBody = $state(initialSnapshot.body);
let frontmatter = $state(cloneBitsValues(initialSnapshot.frontmatter));
let body = $state(initialSnapshot.body);
let imageRows = $state<BitsImageRowDraft[]>(initialSnapshot.imageRows);
let busy = $state(false);
let imageUploadPending = $state(false);
let statusState = $state<StatusState>('idle');
let statusText = $state('');
let errors = $state<string[]>([]);
let issues = $state<AdminContentIssue[]>([]);
let writeResult = $state<AdminContentWriteResult | null>(null);
let previewHtml = $state('');
let previewBusy = $state(false);
let previewError = $state('');
let previewWarnings = $state<string[]>([]);
let bitsInfoOpen = $state(false);
let bitsInfoDialog = $state<ArticleInfoDialog | null>(null);
const previewRequestGuard = createEditorPreviewRequestGuard();
const readDevAdminEditorDefaults = () =>
  import.meta.env.DEV ? readStoredAdminEditorDefaults(ADMIN_EDITOR_DEFAULTS_STORAGE_KEY) : null;
const shell = createEditorShellController({
  layoutStorageKey: ADMIN_EDITOR_LAYOUT_STORAGE_KEY,
  displayPreferenceStorageKey: ADMIN_EDITOR_DISPLAY_PREFERENCE_STORAGE_KEY,
  sidePanelPreferenceStorageKey: BITS_EDITOR_SIDE_PANEL_PREFERENCE_STORAGE_KEY,
  readAdminDefaults: readDevAdminEditorDefaults,
  initialOutlineTab: 'essays',
  normalizeOutlineTab: createFixedOutlineTabNormalizer('essays')
});
let toolbarCommand = $state<MarkdownToolbarCommand | null>(null);
let outlineJumpCommand = $state<MarkdownOutlineJumpCommand | null>(null);
let editorShellEl = $state<HTMLElement | null>(null);
let bodyScrollElement = $state<HTMLElement | null>(null);
let previewScrollElement = $state<HTMLElement | null>(null);
let syncScrollEnabled = $state(true);
let outlineJumpCommandId = 0;

const markdownCommandDispatcher = createMarkdownCommandDispatcher({
  isBusy: () => editorBusy,
  onCommand: (command) => {
    toolbarCommand = command;
  }
});

const imageRowsText = $derived(serializeBitsImageRows(imageRows));
const currentFrontmatter = $derived({
  ...frontmatter,
  imagesText: imageRowsText
});
const frontmatterDirty = $derived(!editorAdapter.isEqualValues(currentFrontmatter, baselineFrontmatter));
const bitsInfoDirty = $derived(
  BITS_INFO_FIELD_PATHS.some((field) => frontmatter[field] !== baselineFrontmatter[field])
);
const bitsInfoIssueCount = $derived(
  issues.filter((issue) => isBitsInfoFieldPath(issue.path)).length
);
const bodyDirty = $derived(body !== baselineBody);
const dirty = $derived(frontmatterDirty || bodyDirty);
const editorBusy = $derived(busy || imageUploadPending);
const canWriteContent = $derived(!editorBusy && dirty);
const previewViewModel = $derived(buildBitsCardViewModel({
  id: entryId,
  slug: defaultPublicSlug,
  bodyText: body,
  tags: getBitsEditorTags(frontmatter.tagsText),
  date: frontmatter.date,
  images: getBitsEditorImages(imageRows),
  author: getBitsEditorAuthor(frontmatter),
  defaultAuthor,
  base: import.meta.env.BASE_URL ?? '/',
  draft: frontmatter.draft
}));
const bodyLineCount = $derived(body.length === 0 ? 1 : body.split(/\r\n|\r|\n/).length);
const bodyCharCount = $derived(getEditorBodyCharCount(body));
const visibleWriteResult = $derived(!dirty ? writeResult : null);
const markdownOutlineItems: readonly MarkdownOutlineItem[] = $derived([]);
const outlineListItems = $derived(
  buildEditorOutlineListItems(bitsOutlineItems, entryId)
);
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
  setStatus('warn', '正文图片请在卡片图片区维护');
};

const openGalleryInsert = () => {
  setStatus('warn', '正文暂不提供图片画廊');
};

const handleGalleryEditRequest = () => {
  setStatus('warn', '正文暂不提供图片画廊');
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
  frontmatter = cloneBitsValues(baselineFrontmatter);
  body = baselineBody;
  imageRows = getEditableBitsImageRows(frontmatter.imagesText);
  clearWriteFeedback();
  setStatus('idle', '');
};

const resetBitsInfoToBaseline = () => {
  frontmatter = {
    ...frontmatter,
    ...getBitsInfoValues(baselineFrontmatter)
  };
  clearWriteFeedback();
  setStatus('idle', '');
};

const closeBitsInfoPanel = () => {
  bitsInfoOpen = false;
};

const openBitsInfoPanel = (trigger?: HTMLElement | null) => {
  if (!bitsInfoOpen) {
    bitsInfoDialog?.captureReturnFocus(trigger);
  }
  bitsInfoOpen = true;
};

const toggleBitsInfoPanel = (trigger?: HTMLElement | null) => {
  if (bitsInfoOpen) {
    closeBitsInfoPanel();
    return;
  }

  openBitsInfoPanel(trigger);
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

const commitLatestValues = (latestValues: AdminBitsEditorValues | null, latestBody: string | null) => {
  const nextValues = cloneBitsValues(latestValues ?? currentFrontmatter);
  const nextBody = latestBody === null ? body : normalizeEditorBodyValue(latestBody);
  frontmatter = cloneBitsValues(nextValues);
  baselineFrontmatter = cloneBitsValues(nextValues);
  body = nextBody;
  baselineBody = nextBody;
  imageRows = getEditableBitsImageRows(nextValues.imagesText);
};

const applyLatestBaseline = (latestValues: AdminBitsEditorValues | null, latestBody: string | null) => {
  if (!isBitsEditorValues(latestValues) || latestBody === null) return false;

  baselineFrontmatter = cloneBitsValues(latestValues);
  baselineBody = normalizeEditorBodyValue(latestBody);
  return true;
};

const requestContentWrite = async () => {
  busy = true;
  clearWriteFeedback();
  setStatus('loading', '正在保存内容');

  try {
    const saveOutcome = await saveContentEntry({
      endpoint,
      collection: 'bits',
      entryId,
      revision: currentRevision,
      frontmatter: currentFrontmatter,
      ...(bodyDirty ? { body } : {})
    });

    if (saveOutcome.revision && saveOutcome.responseOk) currentRevision = saveOutcome.revision;

    if (!saveOutcome.responseOk || !saveOutcome.payloadOk) {
      issues = saveOutcome.issues;
      const nextErrors = saveOutcome.errors.length > 0
        ? saveOutcome.errors
        : ['保存失败，请检查当前内容与磁盘状态'];
      if (saveOutcome.status === 409 && applyLatestBaseline(
        isBitsEditorValues(saveOutcome.latestValues) ? saveOutcome.latestValues : null,
        saveOutcome.latestBody
      )) {
        if (saveOutcome.revision) currentRevision = saveOutcome.revision;
        errors = [
          ...nextErrors,
          '已载入磁盘最新版本作为冲突基线，当前编辑内容仍保留。请核对后再次保存，或通过“还原更改”载入磁盘版本。'
        ];
        setStatus('warn', '检测到外部更新，草稿已保留');
        return;
      }

      errors = nextErrors;
      setStatus(saveOutcome.status === 409 ? 'warn' : 'error', saveOutcome.status === 409 ? '检测到外部更新' : '写入失败');
      return;
    }

    const result = saveOutcome.result;
    if (!result) {
      errors = ['响应体缺少 result 字段，请检查开发日志'];
      setStatus('error', '写入响应异常');
      return;
    }

    writeResult = result;
    commitLatestValues(isBitsEditorValues(saveOutcome.latestValues) ? saveOutcome.latestValues : null, saveOutcome.latestBody);
    setStatus(result.changed ? 'ok' : 'ready', result.changed ? '内容已保存' : '当前没有变更');
  } catch {
    errors = ['保存请求失败，请稍后重试'];
    setStatus('error', '保存请求失败');
  } finally {
    busy = false;
  }
};

const requestPreview = async (sourceSnapshot: string) => {
  const previewRequest = previewRequestGuard.beginRequest(sourceSnapshot);

  previewBusy = true;
  previewError = '';
  previewWarnings = [];

  try {
    const previewOutcome = await renderContentPreview({
      endpoint: previewEndpoint,
      collection: 'bits',
      entryId,
      source: sourceSnapshot,
      signal: previewRequest.signal
    });

    if (!previewRequest.isCurrentForSource(body)) return;

    const previewResult = previewOutcome.result;
    if (!previewOutcome.responseOk || !previewOutcome.payloadOk || !previewResult) {
      previewError = previewOutcome.errors[0] ?? '预览生成失败，请检查响应与控制台日志';
      return;
    }

    previewHtml = previewResult.html;
    previewWarnings = previewResult.warnings;
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

const storeContentListDeleteFeedback = () => {
  try {
    window.sessionStorage.setItem(CONTENT_LIST_DELETE_FEEDBACK_STORAGE_KEY, CONTENT_LIST_DELETE_FEEDBACK_VALUE);
  } catch {
    // 删除后的列表反馈只改善返回体验，不影响删除主流程。
  }
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
    ...(dirty ? ['', '当前未保存改动不会写入文件，删除会移动当前源文件。'] : []),
    '',
    '文件会移到 .trash/content/，之后可从回收站手动恢复。'
  ].join('\n'));
  if (!confirmed) return;

  busy = true;
  clearWriteFeedback();
  setStatus('loading', '正在移动到回收站');

  try {
    const deleteOutcome = await requestContentDelete({
      endpoint: deleteEndpoint,
      collection: 'bits',
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
      errors = ['删除响应异常，请检查开发日志'];
      issues = [];
      setStatus('error', '删除响应异常');
      return;
    }

    baselineFrontmatter = cloneBitsValues(currentFrontmatter);
    baselineBody = body;
    storeContentListDeleteFeedback();
    window.location.assign(returnHref || '/admin/content/');
  } catch {
    errors = ['删除请求失败，请稍后重试'];
    issues = [];
    setStatus('error', '删除请求失败');
  } finally {
    busy = false;
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
      isDirty: () => dirty || imageUploadPending,
      message: LEAVE_CONFIRM_MESSAGE,
      onBlocked: () => {
        setStatus('warn', imageUploadPending ? '请等待图片上传完成' : '请先保存或还原');
      }
    },
    articleInfoTrigger: {
      selector: BITS_INFO_TRIGGER_SELECTOR,
      onToggle: toggleBitsInfoPanel
    }
  });
});

$effect(() => {
  syncArticleInfoTriggers({
    selector: BITS_INFO_TRIGGER_SELECTOR,
    panelId: BITS_INFO_PANEL_ID,
    open: bitsInfoOpen,
    dirty: bitsInfoDirty,
    invalid: bitsInfoIssueCount > 0
  });
});

$effect(() => {
  if (bitsInfoIssueCount > 0 && !bitsInfoOpen) {
    openBitsInfoPanel();
  }
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
  return () => {
    scrollSyncController.destroy();
    previewRequestGuard.destroy();
  };
});

$effect(() => {
  const bodySnapshot = body;
  const shouldRenderFull = previewViewModel.body.shouldRenderFull;

  if (!shouldRenderFull) {
    abortActivePreviewRequest(true);
    previewRequestGuard.setLatestSource(bodySnapshot);
    previewHtml = '';
    previewError = '';
    previewWarnings = [];
    return;
  }

  if (previewRequestGuard.consumeInitialRequest()) {
    void requestPreview(bodySnapshot);
    return;
  }

  if (bodySnapshot === previewRequestGuard.getLatestSource()) {
    previewRequestGuard.clearScheduledRequest();
    return;
  }

  abortActivePreviewRequest(true);
  return previewRequestGuard.scheduleRequest(
    bodySnapshot,
    Math.max(320, getPreviewDebounceMs(bodySnapshot)),
    requestPreview
  );
});

onMount(() => {
  imagePicker = createAdminImagePicker();
});
</script>

<section
  class="admin-bits-editor admin-editor-shell"
  bind:this={editorShellEl}
  data-admin-bits-editor-workspace
  data-layout={shell.layout}
  data-view={shell.viewMode}
  data-effective-view={shell.effectiveViewMode}
  data-side-panel={shell.sidePanelLayout}
>
  <EditorTopControls
    bind:actionMenuElement={topActionsEl}
    busy={editorBusy}
    toolbarPreset="bits"
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
    actionLabel="内容操作"
    moreLabel="更多内容操作"
    saveLabel="保存内容"
    downloadLabel="下载源文件"
    deleteLabel="删除内容"
    onSave={requestContentWrite}
    onReset={handleActionMenuReset}
    onDownload={handleActionMenuDownload}
    onDelete={deleteContentEntry}
  />

  <EditorWorkspace
    bind:value={body}
    disabled={editorBusy}
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
    {previewHtml}
    {previewBusy}
    sidePanelsVisible={shell.sidePanelsVisible}
    sidePanelLayout={shell.sidePanelLayout}
    outlinePanelId={OUTLINE_PANEL_ID}
    syntaxPanelId={SYNTAX_PANEL_ID}
    outlineActiveTab={shell.outlineActiveTab}
    {markdownOutlineItems}
    {outlineListItems}
    outlineHeadingsEnabled={false}
    outlineListTabLabel="动态列表"
    outlineListEmptyText="暂无絮语"
    outlinePanelLabel="动态辅助目录"
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
  >
    {#snippet bodyFooterContent()}
      <BitsPublishStrip
        bind:value={frontmatter}
        {issues}
        disabled={editorBusy}
        onDirty={markDirty}
      />

      <section class="admin-bits-assets">
        <BitsImageRowsEditor
          bind:rows={imageRows}
          {issues}
          disabled={editorBusy}
          uploadEndpoint={imageUploadEndpoint}
          {entryId}
          picker={imagePicker}
          onStatus={setStatus}
          onDirty={markDirty}
          onUploadPendingChange={(pending) => {
            imageUploadPending = pending;
          }}
        />
      </section>
    {/snippet}

    {#snippet previewContent()}
      <BitsPreviewPane
        viewModel={previewViewModel}
        {previewHtml}
        {previewBusy}
        {previewError}
        onScrollElementChange={setPreviewScrollElement}
      />
    {/snippet}
  </EditorWorkspace>

  <ArticleInfoDialog
    bind:this={bitsInfoDialog}
    bind:value={frontmatter}
    collection="bits"
    open={bitsInfoOpen}
    {issues}
    disabled={editorBusy}
    dirty={bitsInfoDirty}
    canSave={!editorBusy && bitsInfoDirty}
    dialogTitle="修改信息"
    fieldsAriaLabel="标题、摘要与作者"
    bitsDefaultAuthor={defaultAuthor}
    fieldScope="bits-summary"
    onDirty={markDirty}
    onClose={closeBitsInfoPanel}
    onReset={resetBitsInfoToBaseline}
    onSave={() => void requestContentWrite()}
  />

  <EditorFooterActions
    {statusText}
    {statusState}
    busy={editorBusy}
    {dirty}
    {canWriteContent}
    onReset={resetToBaseline}
    onSave={requestContentWrite}
  />
</section>
