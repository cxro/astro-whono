<script lang="ts">
import type { Snippet } from 'svelte';
import type {
  AdminContentIssue,
  AdminContentWriteResult
} from './content-editor-client';
import type {
  EditorSidePanelLayout,
  EditorViewMode
} from './editor-shell-helpers';
import type {
  EditorOutlineListItem,
  EditorOutlineTab,
  MarkdownOutlineJumpCommand,
  MarkdownOutlineItem
} from './editor-outline-helpers';
import type {
  MarkdownToolbarCommand,
  MarkdownToolId
} from './markdown-tools';
import type { EditableImageBlock } from './editor-image-blocks';
import type { EditableGalleryBlock } from './editor-gallery-blocks';
import type { MarkdownHighlightTheme } from './editor-markdown-highlight';
import BodyEditor from './BodyEditor.svelte';
import EditorSidePanels from './EditorSidePanels.svelte';
import PreviewPane from './PreviewPane.svelte';
import PreviewStatusBar from './PreviewStatusBar.svelte';

type Props = {
  value: string;
  disabled?: boolean;
  toolbarCommand?: MarkdownToolbarCommand | null;
  outlineJumpCommand?: MarkdownOutlineJumpCommand | null;
  lineNumbersEnabled?: boolean;
  markdownHighlightTheme: MarkdownHighlightTheme;
  effectiveViewMode: EditorViewMode;
  bodyLineCount: number;
  bodyCharCount: number;
  errors: readonly string[];
  issues: readonly AdminContentIssue[];
  previewError: string;
  previewWarnings: readonly string[];
  writeResult: AdminContentWriteResult | null;
  syncScrollEnabled: boolean;
  scrollSyncToggleLabel: string;
  scrollSyncControlDisabled: boolean;
  scrollTopControlDisabled: boolean;
  getWriteFieldLabel: (field: string) => string;
  mediaEditEnabled?: boolean;
  galleryEditEnabled?: boolean;
  previewHtml: string;
  previewBusy: boolean;
  sidePanelsVisible: boolean;
  sidePanelLayout: EditorSidePanelLayout;
  outlinePanelId: string;
  syntaxPanelId: string;
  outlineActiveTab: EditorOutlineTab;
  markdownOutlineItems: readonly MarkdownOutlineItem[];
  outlineListItems: readonly EditorOutlineListItem[];
  outlineHeadingsEnabled?: boolean;
  outlineHeadingsTabLabel?: string;
  outlineListTabLabel?: string;
  outlineHeadingsEmptyText?: string;
  outlineListEmptyText?: string;
  outlinePanelLabel?: string;
  onBodyScrollElementChange: (element: HTMLElement | null) => void;
  onBodyOutlineJump: (element: HTMLElement) => void;
  onImageToolRequest: (block: EditableImageBlock | null) => void;
  onGalleryEditRequest: (block: EditableGalleryBlock) => void;
  onBodyChange?: (value: string) => void;
  onPreviewScrollElementChange: (element: HTMLElement | null) => void;
  onShortcutTool: (toolId: MarkdownToolId) => void;
  onToggleScrollSync: () => void;
  onScrollToTop: () => void;
  onOutlineTabChange: (tab: EditorOutlineTab) => void;
  onOutlineHeadingSelect: (item: MarkdownOutlineItem) => void;
  onSyntaxMaximizeToggle: () => void;
  bodyHeaderContent?: Snippet;
  bodyFooterContent?: Snippet;
  previewContent?: Snippet;
};

let {
  value = $bindable(''),
  disabled = false,
  toolbarCommand = null,
  outlineJumpCommand = null,
  lineNumbersEnabled = false,
  markdownHighlightTheme,
  effectiveViewMode,
  bodyLineCount,
  bodyCharCount,
  errors,
  issues,
  previewError,
  previewWarnings,
  writeResult,
  syncScrollEnabled,
  scrollSyncToggleLabel,
  scrollSyncControlDisabled,
  scrollTopControlDisabled,
  getWriteFieldLabel,
  mediaEditEnabled = true,
  galleryEditEnabled = true,
  previewHtml,
  previewBusy,
  sidePanelsVisible,
  sidePanelLayout,
  outlinePanelId,
  syntaxPanelId,
  outlineActiveTab,
  markdownOutlineItems,
  outlineListItems,
  outlineHeadingsEnabled = true,
  outlineHeadingsTabLabel = '文章目录',
  outlineListTabLabel = '文章列表',
  outlineHeadingsEmptyText = '暂无 H2/H3 标题',
  outlineListEmptyText = '暂无文章',
  outlinePanelLabel = '编辑器目录',
  onBodyScrollElementChange,
  onBodyOutlineJump,
  onImageToolRequest,
  onGalleryEditRequest,
  onBodyChange = () => {},
  onPreviewScrollElementChange,
  onShortcutTool,
  onToggleScrollSync,
  onScrollToTop,
  onOutlineTabChange,
  onOutlineHeadingSelect,
  onSyntaxMaximizeToggle,
  bodyHeaderContent,
  bodyFooterContent,
  previewContent
}: Props = $props();
</script>

<div class="admin-editor-shell__layout">
  <div class="admin-editor-shell__workspace">
    <div
      class="admin-editor-shell__pane admin-editor-shell__pane--body"
      data-markdown-highlight-theme={markdownHighlightTheme}
      data-line-numbers={lineNumbersEnabled ? 'true' : undefined}
      data-body-composer={bodyHeaderContent || bodyFooterContent ? 'true' : undefined}
      hidden={effectiveViewMode === 'preview'}
    >
      {#if bodyHeaderContent}
        {@render bodyHeaderContent()}
      {/if}
      <BodyEditor
        bind:value
        {disabled}
        {toolbarCommand}
        {outlineJumpCommand}
        {lineNumbersEnabled}
        onScrollElementChange={onBodyScrollElementChange}
        onOutlineJump={onBodyOutlineJump}
        {mediaEditEnabled}
        {galleryEditEnabled}
        {onImageToolRequest}
        {onGalleryEditRequest}
        onChange={onBodyChange}
        onShortcutTool={onShortcutTool}
      />
      {#if bodyFooterContent}
        {@render bodyFooterContent()}
      {/if}
    </div>
    <PreviewStatusBar
      {bodyLineCount}
      {bodyCharCount}
      {errors}
      {issues}
      {previewError}
      {previewWarnings}
      {writeResult}
      {syncScrollEnabled}
      {scrollSyncToggleLabel}
      {scrollSyncControlDisabled}
      {scrollTopControlDisabled}
      {getWriteFieldLabel}
      onToggleScrollSync={onToggleScrollSync}
      onScrollToTop={onScrollToTop}
    />
    <div class="admin-editor-shell__pane admin-editor-shell__pane--preview" hidden={effectiveViewMode === 'edit'}>
      {#if previewContent}
        {@render previewContent()}
      {:else}
        <PreviewPane
          html={previewHtml}
          loading={previewBusy}
          error={previewError}
          onScrollElementChange={onPreviewScrollElementChange}
        />
      {/if}
    </div>
  </div>
  {#if sidePanelsVisible}
    <EditorSidePanels
      layout={sidePanelLayout}
      {outlinePanelId}
      {syntaxPanelId}
      activeTab={outlineActiveTab}
      headings={markdownOutlineItems}
      listItems={outlineListItems}
      {outlineHeadingsEnabled}
      {outlineHeadingsTabLabel}
      {outlineListTabLabel}
      {outlineHeadingsEmptyText}
      {outlineListEmptyText}
      {outlinePanelLabel}
      onTabChange={onOutlineTabChange}
      onHeadingSelect={onOutlineHeadingSelect}
      onSyntaxMaximizeToggle={onSyntaxMaximizeToggle}
    />
  {/if}
</div>
