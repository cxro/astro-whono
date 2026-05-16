<script lang="ts">
import AdminEditorIcon from './AdminEditorIcon.svelte';
import type { EditorPaneMode, EditorViewMode } from './editor-shell-helpers';
import type { MarkdownCalloutType, MarkdownHeadingLevel, MarkdownToolId } from './markdown-tools';

type LayoutIconName = 'columns-2' | 'rows-2' | 'undo-2';

const headingTool = { label: '标题', icon: 'heading' } as const;
const calloutTool = { label: '提示块', icon: 'message-square-text' } as const;
const headingLevelItems: readonly { level: MarkdownHeadingLevel; label: string; description: string }[] = [
  { level: 2, label: 'H2', description: '小节标题' },
  { level: 3, label: 'H3', description: '三级标题' },
  { level: 4, label: 'H4', description: '四级标题' },
  { level: 5, label: 'H5', description: '五级标题' }
];
const calloutItems = [
  { type: 'note' },
  { type: 'tip' },
  { type: 'info' },
  { type: 'warning' }
] as const;

const markdownTools = [
  { id: 'bold', label: '加粗', icon: 'bold' },
  { id: 'italic', label: '斜体', icon: 'italic' },
  { id: 'strikethrough', label: '删除线', icon: 'strikethrough' },
  { id: 'link', label: '链接', icon: 'link' },
  { id: 'image', label: '图片', icon: 'image' },
  { id: 'quote', label: '引用', icon: 'quote' },
  { id: 'code', label: '行内代码', icon: 'code' },
  { id: 'codeBlock', label: '代码块', icon: 'code-block' },
  { id: 'list', label: '无序列表', icon: 'list' },
  { id: 'orderedList', label: '有序列表', icon: 'ordered-list' },
  { id: 'taskList', label: '任务列表', icon: 'task-list' },
  { id: 'table', label: '表格', icon: 'table' }
] as const;
const markdownToolsBeforeCallout = markdownTools.slice(0, 6);
const markdownToolsAfterCallout = markdownTools.slice(6);

type Props = {
  busy?: boolean;
  outlineOpen?: boolean;
  outlineVisible?: boolean;
  outlineToggleLabel: string;
  outlineControlDisabled?: boolean;
  outlinePanelId: string;
  syntaxOpen?: boolean;
  syntaxVisible?: boolean;
  syntaxToggleLabel: string;
  syntaxControlDisabled?: boolean;
  syntaxPanelId: string;
  editorLayoutIsSplit?: boolean;
  editorLayoutToggleLabel: string;
  editorLayoutToggleIcon: LayoutIconName;
  singleViewActive?: boolean;
  singleViewReturnLabel: string;
  splitBothIsCompact?: boolean;
  compactPaneToggleLabel: string;
  compactPaneToggleText: string;
  editViewToggleLabel: string;
  previewViewToggleLabel: string;
  effectiveViewMode: EditorViewMode;
  onApplyTool: (toolId: MarkdownToolId) => void;
  onApplyHeading: (level: MarkdownHeadingLevel) => void;
  onApplyCallout: (calloutType: MarkdownCalloutType) => void;
  onToggleOutline: () => void;
  onToggleSyntax: () => void;
  onToggleLayout: () => void;
  onToggleView: (viewMode: EditorPaneMode) => void;
  onReturnToBothView: () => void;
  onToggleCompactPane: () => void;
};

let {
  busy = false,
  outlineOpen = false,
  outlineVisible = outlineOpen,
  outlineToggleLabel,
  outlineControlDisabled = false,
  outlinePanelId,
  syntaxOpen = false,
  syntaxVisible = syntaxOpen,
  syntaxToggleLabel,
  syntaxControlDisabled = false,
  syntaxPanelId,
  editorLayoutIsSplit = false,
  editorLayoutToggleLabel,
  editorLayoutToggleIcon,
  singleViewActive = false,
  singleViewReturnLabel,
  splitBothIsCompact = false,
  compactPaneToggleLabel,
  compactPaneToggleText,
  editViewToggleLabel,
  previewViewToggleLabel,
  effectiveViewMode,
  onApplyTool,
  onApplyHeading,
  onApplyCallout,
  onToggleOutline,
  onToggleSyntax,
  onToggleLayout,
  onToggleView,
  onReturnToBothView,
  onToggleCompactPane
}: Props = $props();

let headingMenuOpen = $state(false);
let headingMenuEl = $state<HTMLDetailsElement | null>(null);
let calloutMenuOpen = $state(false);
let calloutMenuEl = $state<HTMLDetailsElement | null>(null);

const layoutControlLabel = $derived(singleViewActive ? singleViewReturnLabel : editorLayoutToggleLabel);
const layoutControlIcon = $derived(singleViewActive ? 'undo-2' : editorLayoutToggleIcon);
const layoutControlPressed = $derived(singleViewActive ? undefined : editorLayoutIsSplit ? 'true' : 'false');

const closeHeadingMenu = () => {
  if (headingMenuEl) headingMenuEl.open = false;
  headingMenuOpen = false;
};

const closeCalloutMenu = () => {
  if (calloutMenuEl) calloutMenuEl.open = false;
  calloutMenuOpen = false;
};

const syncHeadingMenuOpen = () => {
  headingMenuOpen = headingMenuEl?.open ?? false;
};

const syncCalloutMenuOpen = () => {
  calloutMenuOpen = calloutMenuEl?.open ?? false;
};

const handleHeadingSummaryClick = (event: MouseEvent) => {
  if (!busy) return;

  event.preventDefault();
  event.stopPropagation();
};

const handleCalloutSummaryClick = (event: MouseEvent) => {
  if (!busy) return;

  event.preventDefault();
  event.stopPropagation();
};

const applyHeadingLevel = (level: MarkdownHeadingLevel) => {
  if (busy) return;

  closeHeadingMenu();
  onApplyHeading(level);
};

const applyCalloutType = (calloutType: MarkdownCalloutType) => {
  if (busy) return;

  closeCalloutMenu();
  onApplyCallout(calloutType);
};

const handleLayoutControlClick = () => {
  if (singleViewActive) {
    onReturnToBothView();
    return;
  }

  onToggleLayout();
};

$effect(() => {
  if (busy && headingMenuOpen) {
    closeHeadingMenu();
  }
  if (busy && calloutMenuOpen) {
    closeCalloutMenu();
  }
});
</script>

<div class="admin-editor-shell__format-row">
  <div class="admin-editor-markdown-toolbar" role="toolbar" aria-label="Markdown 常用格式">
    <details
      class="admin-editor-markdown-toolbar__menu admin-editor-markdown-toolbar__menu--heading"
      class:is-open={headingMenuOpen}
      bind:this={headingMenuEl}
      ontoggle={syncHeadingMenuOpen}
    >
      <summary
        class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-editor-markdown-toolbar__button"
        data-tooltip={headingTool.label}
        aria-label={headingTool.label}
        aria-disabled={busy ? 'true' : undefined}
        onclick={handleHeadingSummaryClick}
      >
        <AdminEditorIcon name={headingTool.icon} size={16} strokeWidth={2} />
      </summary>

      <div
        class="admin-content-menu-panel admin-editor-heading-menu"
        id="admin-editor-heading-menu"
        aria-label="标题级别"
      >
        {#each headingLevelItems as item}
          <button
            class="admin-content-menu-item admin-editor-heading-menu__item"
            type="button"
            disabled={busy}
            onclick={() => applyHeadingLevel(item.level)}
          >
            <span class="admin-editor-heading-menu__level">{item.label}</span>
            <span class="admin-editor-heading-menu__text">{item.description}</span>
          </button>
        {/each}
      </div>
    </details>

    {#each markdownToolsBeforeCallout as tool}
      <button
        class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-editor-markdown-toolbar__button"
        type="button"
        data-tooltip={tool.label}
        aria-label={tool.label}
        disabled={busy}
        onclick={() => onApplyTool(tool.id)}
      >
        <AdminEditorIcon name={tool.icon} size={16} strokeWidth={2} />
      </button>
    {/each}

    <details
      class="admin-editor-markdown-toolbar__menu admin-editor-markdown-toolbar__menu--callout"
      class:is-open={calloutMenuOpen}
      bind:this={calloutMenuEl}
      ontoggle={syncCalloutMenuOpen}
    >
      <summary
        class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-editor-markdown-toolbar__button"
        data-tooltip={calloutTool.label}
        aria-label={calloutTool.label}
        aria-disabled={busy ? 'true' : undefined}
        onclick={handleCalloutSummaryClick}
      >
        <AdminEditorIcon name={calloutTool.icon} size={16} strokeWidth={2} />
      </summary>

      <div
        class="admin-content-menu-panel admin-editor-callout-menu"
        id="admin-editor-callout-menu"
        aria-label="提示块类型"
      >
        {#each calloutItems as item}
          <button
            class="admin-content-menu-item admin-editor-callout-menu__item"
            type="button"
            data-callout={item.type}
            disabled={busy}
            onclick={() => applyCalloutType(item.type)}
          >
            <span class="admin-editor-callout-menu__icon" aria-hidden="true"></span>
            <span class="admin-editor-callout-menu__type">{item.type}</span>
          </button>
        {/each}
      </div>
    </details>

    {#each markdownToolsAfterCallout as tool}
      <button
        class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-editor-markdown-toolbar__button"
        type="button"
        data-tooltip={tool.label}
        aria-label={tool.label}
        disabled={busy}
        onclick={() => onApplyTool(tool.id)}
      >
        <AdminEditorIcon name={tool.icon} size={16} strokeWidth={2} />
      </button>
    {/each}
  </div>

  <div class="admin-editor-shell__layout-controls" aria-label="编辑器目录、布局与视图">
    <button
      class="admin-editor-markdown-toolbar__button admin-editor-layout-toggle"
      type="button"
      data-tooltip={layoutControlLabel}
      aria-label={layoutControlLabel}
      aria-pressed={layoutControlPressed}
      onclick={handleLayoutControlClick}
    >
      <AdminEditorIcon name={layoutControlIcon} size={16} strokeWidth={2} />
    </button>
    {#if splitBothIsCompact}
      <button
        class="admin-editor-compact-pane-toggle"
        type="button"
        aria-label={compactPaneToggleLabel}
        onclick={onToggleCompactPane}
      >
        {compactPaneToggleText}
      </button>
    {:else}
      <button
        class="admin-editor-markdown-toolbar__button admin-editor-view-toggle"
        type="button"
        data-tooltip={editViewToggleLabel}
        aria-label={editViewToggleLabel}
        aria-pressed={effectiveViewMode === 'edit' ? 'true' : 'false'}
        onclick={() => onToggleView('edit')}
      >
        <AdminEditorIcon name="notebook-pen" size={16} strokeWidth={2} />
      </button>
      <button
        class="admin-editor-markdown-toolbar__button admin-editor-view-toggle"
        type="button"
        data-tooltip={previewViewToggleLabel}
        aria-label={previewViewToggleLabel}
        aria-pressed={effectiveViewMode === 'preview' ? 'true' : 'false'}
        onclick={() => onToggleView('preview')}
      >
        <AdminEditorIcon name="book-open-text" size={16} strokeWidth={2} />
      </button>
    {/if}
    <button
      class="admin-editor-markdown-toolbar__button admin-editor-outline-toggle"
      type="button"
      data-tooltip={outlineToggleLabel}
      aria-label={outlineToggleLabel}
      aria-controls={outlinePanelId}
      aria-expanded={outlineVisible ? 'true' : 'false'}
      aria-pressed={outlineOpen ? 'true' : 'false'}
      disabled={outlineControlDisabled}
      onclick={onToggleOutline}
    >
      <AdminEditorIcon name="square-chart-gantt" size={16} strokeWidth={2} />
    </button>
    <button
      class="admin-editor-markdown-toolbar__button admin-editor-syntax-toggle"
      type="button"
      data-tooltip={syntaxToggleLabel}
      aria-label={syntaxToggleLabel}
      aria-controls={syntaxPanelId}
      aria-expanded={syntaxVisible ? 'true' : 'false'}
      aria-pressed={syntaxOpen ? 'true' : 'false'}
      disabled={syntaxControlDisabled}
      onclick={onToggleSyntax}
    >
      <AdminEditorIcon name="square-asterisk" size={16} strokeWidth={2} />
    </button>
  </div>
</div>
