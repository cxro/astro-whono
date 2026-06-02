<script lang="ts" module>
export type EditorToolbarPreset = 'full' | 'bits';
</script>

<script lang="ts">
import AdminEditorIcon from './AdminEditorIcon.svelte';
import EmojiPickerPopover from './EmojiPickerPopover.svelte';
import type { EditorPaneMode, EditorViewMode } from './editor-shell-helpers';
import {
  DEFAULT_MARKDOWN_HIGHLIGHT_THEME,
  MARKDOWN_HIGHLIGHT_THEME_OPTIONS,
  getMarkdownHighlightThemeLabel,
  type MarkdownHighlightTheme
} from './editor-markdown-highlight';
import {
  MARKDOWN_DETAILS_INSERT_TOOL,
  MARKDOWN_MATH_INSERT_TOOLS,
  MARKDOWN_MORE_SEPARATOR_INSERT_TOOL,
  type MarkdownMathInsertTool
} from './insert-tools';
import type {
  MarkdownCalloutType,
  MarkdownHeadingLevel,
  MarkdownInsertPlacement,
  MarkdownToolId
} from './markdown-tools';

type LayoutIconName = 'columns-2' | 'rows-2' | 'undo-2';

const toolbarIconSize = 17;
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
const formulaTool = { label: '插入公式', icon: 'sigma' } as const;
const emojiTool = { label: '表情', icon: 'smile' } as const;
const insertTool = { label: '插入', icon: 'plus' } as const;
const galleryTool = { label: '图片画廊', icon: 'images' } as const;
const detailsTool = MARKDOWN_DETAILS_INSERT_TOOL;
const moreSeparatorTool = MARKDOWN_MORE_SEPARATOR_INSERT_TOOL;
const listTool = { label: '列表', icon: 'list' } as const;

const markdownTextTools = [
  { id: 'bold', label: '加粗', icon: 'bold' },
  { id: 'italic', label: '斜体', icon: 'italic' },
  { id: 'strikethrough', label: '删除线', icon: 'strikethrough' }
] as const;
const markdownParagraphTools = [
  { id: 'quote', label: '引用', icon: 'quote' }
] as const;
const markdownInlineMediaTools = [
  { id: 'link', label: '链接', icon: 'link' },
  { id: 'code', label: '行内代码', icon: 'code' },
  { id: 'image', label: '图片', icon: 'image' }
] as const;
const markdownBlockTools = [
  { id: 'codeBlock', label: '代码块', icon: 'code-block' },
  { id: 'table', label: '表格', icon: 'table' }
] as const;
const markdownListTools = [
  { id: 'list', label: '无序列表', icon: 'list' },
  { id: 'orderedList', label: '有序列表', icon: 'ordered-list' },
  { id: 'taskList', label: '任务列表', icon: 'task-list' }
] as const;
const bitsMarkdownTextTools = [
  { id: 'bold', label: '加粗', icon: 'bold' },
  { id: 'italic', label: '斜体', icon: 'italic' }
] as const;
const bitsInlineTools = [
  { id: 'link', label: '链接', icon: 'link' },
  { id: 'code', label: '行内代码', icon: 'code' }
] as const;

type Props = {
  preset?: EditorToolbarPreset;
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
  lineNumbersEnabled?: boolean;
  lineNumbersToggleLabel: string;
  markdownHighlightTheme: MarkdownHighlightTheme;
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
  onInsertText: (text: string, placement?: MarkdownInsertPlacement) => void;
  onOpenGallery: () => void;
  onToggleOutline: () => void;
  onToggleSyntax: () => void;
  onToggleLineNumbers: () => void;
  onSelectMarkdownHighlightTheme: (theme: MarkdownHighlightTheme) => void;
  onToggleLayout: () => void;
  onToggleView: (viewMode: EditorPaneMode) => void;
  onReturnToBothView: () => void;
  onToggleCompactPane: () => void;
};

let {
  preset = 'full',
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
  lineNumbersEnabled = false,
  lineNumbersToggleLabel,
  markdownHighlightTheme,
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
  onInsertText,
  onOpenGallery,
  onToggleOutline,
  onToggleSyntax,
  onToggleLineNumbers,
  onSelectMarkdownHighlightTheme,
  onToggleLayout,
  onToggleView,
  onReturnToBothView,
  onToggleCompactPane
}: Props = $props();

let headingMenuOpen = $state(false);
let headingMenuEl = $state<HTMLDetailsElement | null>(null);
let calloutMenuOpen = $state(false);
let calloutMenuEl = $state<HTMLDetailsElement | null>(null);
let formulaMenuOpen = $state(false);
let formulaMenuEl = $state<HTMLDetailsElement | null>(null);
let emojiMenuOpen = $state(false);
let emojiButtonEl = $state<HTMLButtonElement | null>(null);
let emojiPopoverAnchorEl = $state<HTMLElement | null>(null);
let listMenuOpen = $state(false);
let listMenuEl = $state<HTMLDetailsElement | null>(null);
let insertMenuOpen = $state(false);
let insertMenuEl = $state<HTMLDetailsElement | null>(null);
let insertSummaryEl = $state<HTMLElement | null>(null);
let displayMenuOpen = $state(false);
let displayMenuEl = $state<HTMLDetailsElement | null>(null);

const layoutControlLabel = $derived(singleViewActive ? singleViewReturnLabel : editorLayoutToggleLabel);
const layoutControlIcon = $derived(singleViewActive ? 'undo-2' : editorLayoutToggleIcon);
const layoutControlPressed = $derived(singleViewActive ? undefined : editorLayoutIsSplit ? 'true' : 'false');
const markdownHighlightThemeLabel = $derived(getMarkdownHighlightThemeLabel(markdownHighlightTheme));
const displayMenuTooltipLabel = '编辑器外观';
const displayMenuLabel = $derived(`编辑器外观：${lineNumbersEnabled ? '行号开' : '行号关'}，高亮 ${markdownHighlightThemeLabel}`);
const displayControlPressed = $derived(
  lineNumbersEnabled || markdownHighlightTheme !== DEFAULT_MARKDOWN_HIGHLIGHT_THEME ? 'true' : 'false'
);

const closeHeadingMenu = () => {
  if (headingMenuEl) headingMenuEl.open = false;
  headingMenuOpen = false;
};

const closeCalloutMenu = () => {
  if (calloutMenuEl) calloutMenuEl.open = false;
  calloutMenuOpen = false;
};

const closeFormulaMenu = () => {
  if (formulaMenuEl) formulaMenuEl.open = false;
  formulaMenuOpen = false;
};

const closeEmojiMenu = () => {
  emojiMenuOpen = false;
  emojiPopoverAnchorEl = null;
};

const closeListMenu = () => {
  if (listMenuEl) listMenuEl.open = false;
  listMenuOpen = false;
};

const closeInsertMenu = () => {
  if (insertMenuEl) insertMenuEl.open = false;
  insertMenuOpen = false;
};

const syncHeadingMenuOpen = () => {
  headingMenuOpen = headingMenuEl?.open ?? false;
};

const syncCalloutMenuOpen = () => {
  calloutMenuOpen = calloutMenuEl?.open ?? false;
};

const syncFormulaMenuOpen = () => {
  formulaMenuOpen = formulaMenuEl?.open ?? false;
};

const syncListMenuOpen = () => {
  listMenuOpen = listMenuEl?.open ?? false;
};

const syncInsertMenuOpen = () => {
  insertMenuOpen = insertMenuEl?.open ?? false;
};

const syncDisplayMenuOpen = () => {
  displayMenuOpen = displayMenuEl?.open ?? false;
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

const handleFormulaSummaryClick = (event: MouseEvent) => {
  if (!busy) return;

  event.preventDefault();
  event.stopPropagation();
};

const handleEmojiSummaryClick = (event: MouseEvent) => {
  if (busy) {
    return;
  }

  if (emojiMenuOpen) {
    closeEmojiMenu();
    return;
  }

  openEmojiMenu(event.currentTarget as HTMLElement);
};

const handleListSummaryClick = (event: MouseEvent) => {
  if (!busy) return;

  event.preventDefault();
  event.stopPropagation();
};

const handleInsertSummaryClick = (event: MouseEvent) => {
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

const applyMathTool = (toolId: MarkdownMathInsertTool['id']) => {
  if (busy) return;

  closeFormulaMenu();
  closeInsertMenu();
  onApplyTool(toolId);
};

const openEmojiMenu = (anchorEl: HTMLElement | null = emojiButtonEl) => {
  if (busy) return;

  emojiPopoverAnchorEl = anchorEl ?? emojiButtonEl;
  emojiMenuOpen = true;
};

const openEmojiMenuFromInsertMenu = (event: MouseEvent) => {
  const anchorEl = insertSummaryEl ?? (event.currentTarget as HTMLElement);
  closeInsertMenu();
  openEmojiMenu(anchorEl);
};

const openGalleryDialog = () => {
  if (busy) return;

  closeInsertMenu();
  onOpenGallery();
};

const applyDetailsTool = () => {
  if (busy) return;

  closeFormulaMenu();
  closeInsertMenu();
  onApplyTool(detailsTool.id);
};

const applyMoreSeparatorTool = () => {
  if (busy) return;

  closeInsertMenu();
  onInsertText(moreSeparatorTool.text, moreSeparatorTool.placement);
};

const applyListTool = (toolId: (typeof markdownListTools)[number]['id']) => {
  if (busy) return;

  closeListMenu();
  closeInsertMenu();
  onApplyTool(toolId);
};

const handleLayoutControlClick = () => {
  if (singleViewActive) {
    onReturnToBothView();
    return;
  }

  onToggleLayout();
};

const handleEmojiInsert = (unicode: string) => {
  if (busy) return;

  onInsertText(unicode, 'inline');
};

$effect(() => {
  if (busy && headingMenuOpen) {
    closeHeadingMenu();
  }
  if (busy && calloutMenuOpen) {
    closeCalloutMenu();
  }
  if (busy && formulaMenuOpen) {
    closeFormulaMenu();
  }
  if (busy && emojiMenuOpen) {
    closeEmojiMenu();
  }
  if (busy && listMenuOpen) {
    closeListMenu();
  }
  if (busy && insertMenuOpen) {
    closeInsertMenu();
  }
});
</script>

<div class="admin-editor-shell__format-row">
  <div class="admin-editor-markdown-toolbar" role="toolbar" aria-label="Markdown 常用格式">
    <div class="admin-editor-markdown-toolbar__group" role="group" aria-label="文本样式">
      {#each preset === 'bits' ? bitsMarkdownTextTools : markdownTextTools as tool}
        <button
          class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-editor-markdown-toolbar__button"
          type="button"
          data-tooltip={tool.label}
          aria-label={tool.label}
          disabled={busy}
          onclick={() => onApplyTool(tool.id)}
        >
          <AdminEditorIcon name={tool.icon} size={toolbarIconSize} strokeWidth={2} />
        </button>
      {/each}
    </div>

    <div class="admin-editor-markdown-toolbar__group" role="group" aria-label="段落结构">
      {#if preset === 'full'}
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
            <AdminEditorIcon name={headingTool.icon} size={toolbarIconSize} strokeWidth={2} />
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

        <details
          class="admin-editor-markdown-toolbar__menu admin-editor-markdown-toolbar__menu--list"
          class:is-open={listMenuOpen}
          bind:this={listMenuEl}
          ontoggle={syncListMenuOpen}
        >
          <summary
            class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-editor-markdown-toolbar__button"
            data-tooltip={listTool.label}
            aria-label={listTool.label}
            aria-disabled={busy ? 'true' : undefined}
            onclick={handleListSummaryClick}
          >
            <AdminEditorIcon name={listTool.icon} size={toolbarIconSize} strokeWidth={2} />
          </summary>

          <div
            class="admin-content-menu-panel admin-editor-list-menu"
            id="admin-editor-list-menu"
            aria-label="列表类型"
          >
            {#each markdownListTools as tool}
              <button
                class="admin-content-menu-item admin-editor-insert-menu__item"
                type="button"
                disabled={busy}
                onclick={() => applyListTool(tool.id)}
              >
                <span class="admin-editor-insert-menu__icon" aria-hidden="true">
                  <AdminEditorIcon name={tool.icon} size={15} strokeWidth={2} />
                </span>
                <span class="admin-editor-insert-menu__label">{tool.label}</span>
              </button>
            {/each}
          </div>
        </details>
      {:else}
        <button
          class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-editor-markdown-toolbar__button"
          type="button"
          data-tooltip="无序列表"
          aria-label="无序列表"
          disabled={busy}
          onclick={() => onApplyTool('list')}
        >
          <AdminEditorIcon name="list" size={toolbarIconSize} strokeWidth={2} />
        </button>
      {/if}

      {#each markdownParagraphTools as tool}
        <button
          class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-editor-markdown-toolbar__button"
          type="button"
          data-tooltip={tool.label}
          aria-label={tool.label}
          disabled={busy}
          onclick={() => onApplyTool(tool.id)}
        >
          <AdminEditorIcon name={tool.icon} size={toolbarIconSize} strokeWidth={2} />
        </button>
      {/each}
    </div>

    <div class="admin-editor-markdown-toolbar__group" role="group" aria-label="链接与媒体">
      {#each preset === 'bits' ? bitsInlineTools : markdownInlineMediaTools as tool}
        <button
          class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-editor-markdown-toolbar__button"
          type="button"
          data-tooltip={tool.label}
          aria-label={tool.label}
          disabled={busy}
          onclick={() => onApplyTool(tool.id)}
        >
          <AdminEditorIcon name={tool.icon} size={toolbarIconSize} strokeWidth={2} />
        </button>
      {/each}
      {#if preset === 'full'}
        <button
          class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-editor-markdown-toolbar__button admin-editor-markdown-toolbar__gallery-direct"
          type="button"
          data-tooltip={galleryTool.label}
          aria-label={galleryTool.label}
          disabled={busy}
          onclick={openGalleryDialog}
        >
          <AdminEditorIcon name={galleryTool.icon} size={toolbarIconSize} strokeWidth={2} />
        </button>
      {/if}
    </div>

    {#if preset === 'bits'}
      <div class="admin-editor-markdown-toolbar__group" role="group" aria-label="表情">
        <button
          class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-editor-markdown-toolbar__button"
          type="button"
          data-tooltip={emojiTool.label}
          aria-label={emojiTool.label}
          aria-controls="admin-editor-emoji-picker-menu"
          aria-expanded={emojiMenuOpen ? 'true' : 'false'}
          aria-haspopup="dialog"
          disabled={busy}
          onclick={handleEmojiSummaryClick}
          bind:this={emojiButtonEl}
        >
          <AdminEditorIcon name={emojiTool.icon} size={toolbarIconSize} strokeWidth={2} />
        </button>

        {#if emojiMenuOpen}
          <EmojiPickerPopover
            disabled={busy}
            anchorElement={emojiPopoverAnchorEl ?? emojiButtonEl}
            fallbackFocusElements={[emojiButtonEl]}
            onClose={closeEmojiMenu}
            onInsert={handleEmojiInsert}
          />
        {/if}
      </div>
    {/if}

    {#if preset === 'full'}
      <div class="admin-editor-markdown-toolbar__group" role="group" aria-label="文章结构">
      <button
        class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-editor-markdown-toolbar__button admin-editor-markdown-toolbar__more-direct"
        type="button"
        data-tooltip={moreSeparatorTool.label}
        aria-label={moreSeparatorTool.label}
        disabled={busy}
        onclick={applyMoreSeparatorTool}
      >
        <AdminEditorIcon name={moreSeparatorTool.icon} size={toolbarIconSize} strokeWidth={2} />
      </button>

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
          <AdminEditorIcon name={calloutTool.icon} size={toolbarIconSize} strokeWidth={2} />
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

      <button
        class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-editor-markdown-toolbar__button admin-editor-markdown-toolbar__details-direct"
        type="button"
        data-tooltip={detailsTool.label}
        aria-label={detailsTool.label}
        disabled={busy}
        onclick={applyDetailsTool}
      >
        <AdminEditorIcon name={detailsTool.icon} size={toolbarIconSize} strokeWidth={2} />
      </button>
    </div>

      <div class="admin-editor-markdown-toolbar__group" role="group" aria-label="内容块">
      {#each markdownBlockTools as tool}
        <button
          class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-editor-markdown-toolbar__button"
          type="button"
          data-tooltip={tool.label}
          aria-label={tool.label}
          disabled={busy}
          onclick={() => onApplyTool(tool.id)}
        >
          <AdminEditorIcon name={tool.icon} size={toolbarIconSize} strokeWidth={2} />
        </button>
      {/each}

      <div class="admin-editor-markdown-toolbar__insert-direct" role="group" aria-label="扩展插入">
        <details
          class="admin-editor-markdown-toolbar__menu admin-editor-markdown-toolbar__menu--formula"
          class:is-open={formulaMenuOpen}
          bind:this={formulaMenuEl}
          ontoggle={syncFormulaMenuOpen}
        >
          <summary
            class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-editor-markdown-toolbar__button"
            data-tooltip={formulaTool.label}
            aria-label={formulaTool.label}
            aria-disabled={busy ? 'true' : undefined}
            onclick={handleFormulaSummaryClick}
          >
            <AdminEditorIcon name={formulaTool.icon} size={toolbarIconSize} strokeWidth={2} />
          </summary>

          <div
            class="admin-content-menu-panel admin-editor-formula-menu"
            id="admin-editor-formula-menu"
            aria-label="插入公式"
          >
            {#each MARKDOWN_MATH_INSERT_TOOLS as tool}
              <button
                class="admin-content-menu-item admin-editor-insert-menu__item"
                type="button"
                disabled={busy}
                onclick={() => applyMathTool(tool.id)}
              >
                <span class="admin-editor-insert-menu__icon" aria-hidden="true">
                  <AdminEditorIcon name={tool.icon} size={15} strokeWidth={2} />
                </span>
                <span class="admin-editor-insert-menu__label">{tool.label}</span>
              </button>
            {/each}
          </div>
        </details>

        <button
          class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-editor-markdown-toolbar__button"
          type="button"
          data-tooltip={emojiTool.label}
          aria-label={emojiTool.label}
          aria-controls="admin-editor-emoji-picker-menu"
          aria-expanded={emojiMenuOpen ? 'true' : 'false'}
          aria-haspopup="dialog"
          disabled={busy}
          onclick={handleEmojiSummaryClick}
          bind:this={emojiButtonEl}
        >
          <AdminEditorIcon name={emojiTool.icon} size={toolbarIconSize} strokeWidth={2} />
        </button>

        {#if emojiMenuOpen}
          <EmojiPickerPopover
            disabled={busy}
            anchorElement={emojiPopoverAnchorEl ?? emojiButtonEl}
            fallbackFocusElements={[emojiButtonEl, insertSummaryEl]}
            onClose={closeEmojiMenu}
            onInsert={handleEmojiInsert}
          />
        {/if}
      </div>
    </div>

      <details
      class="admin-editor-markdown-toolbar__menu admin-editor-markdown-toolbar__menu--insert"
      class:is-open={insertMenuOpen}
      bind:this={insertMenuEl}
      ontoggle={syncInsertMenuOpen}
    >
      <summary
        class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-editor-markdown-toolbar__button"
        data-tooltip={insertTool.label}
        aria-label={insertTool.label}
        aria-disabled={busy ? 'true' : undefined}
        onclick={handleInsertSummaryClick}
        bind:this={insertSummaryEl}
      >
        <AdminEditorIcon name={insertTool.icon} size={toolbarIconSize} strokeWidth={2} />
      </summary>

      <div
        class="admin-content-menu-panel admin-editor-insert-menu"
        id="admin-editor-insert-menu"
        aria-label="插入内容"
      >
        <div class="admin-editor-insert-menu__group" role="group" aria-label="媒体">
          <span class="admin-editor-insert-menu__group-label">媒体</span>
          <button
            class="admin-content-menu-item admin-editor-insert-menu__item"
            type="button"
            disabled={busy}
            onclick={openGalleryDialog}
          >
            <span class="admin-editor-insert-menu__icon" aria-hidden="true">
              <AdminEditorIcon name={galleryTool.icon} size={15} strokeWidth={2} />
            </span>
            <span class="admin-editor-insert-menu__label">{galleryTool.label}</span>
          </button>
        </div>

        <div class="admin-editor-insert-menu__group" role="group" aria-label="文章结构">
          <span class="admin-editor-insert-menu__group-label">文章结构</span>
          <button
            class="admin-content-menu-item admin-editor-insert-menu__item"
            type="button"
            disabled={busy}
            onclick={applyMoreSeparatorTool}
          >
            <span class="admin-editor-insert-menu__icon" aria-hidden="true">
              <AdminEditorIcon name={moreSeparatorTool.icon} size={15} strokeWidth={2} />
            </span>
            <span class="admin-editor-insert-menu__label">{moreSeparatorTool.label}</span>
          </button>
        </div>

        <div class="admin-editor-insert-menu__group" role="group" aria-label="内容块">
          <span class="admin-editor-insert-menu__group-label">内容块</span>
          <button
            class="admin-content-menu-item admin-editor-insert-menu__item"
            type="button"
            disabled={busy}
            onclick={applyDetailsTool}
          >
            <span class="admin-editor-insert-menu__icon" aria-hidden="true">
              <AdminEditorIcon name={detailsTool.icon} size={15} strokeWidth={2} />
            </span>
            <span class="admin-editor-insert-menu__label">{detailsTool.label}</span>
          </button>
        </div>

        <div class="admin-editor-insert-menu__group" role="group" aria-label="公式">
          <span class="admin-editor-insert-menu__group-label">公式</span>
          {#each MARKDOWN_MATH_INSERT_TOOLS as tool}
            <button
              class="admin-content-menu-item admin-editor-insert-menu__item"
              type="button"
              disabled={busy}
              onclick={() => applyMathTool(tool.id)}
            >
              <span class="admin-editor-insert-menu__icon" aria-hidden="true">
                <AdminEditorIcon name={tool.icon} size={15} strokeWidth={2} />
              </span>
              <span class="admin-editor-insert-menu__label">{tool.label}</span>
            </button>
          {/each}
        </div>

        <div class="admin-editor-insert-menu__group" role="group" aria-label="列表">
          <span class="admin-editor-insert-menu__group-label">列表</span>
          {#each markdownListTools as tool}
            <button
              class="admin-content-menu-item admin-editor-insert-menu__item"
              type="button"
              disabled={busy}
              onclick={() => applyListTool(tool.id)}
            >
              <span class="admin-editor-insert-menu__icon" aria-hidden="true">
                <AdminEditorIcon name={tool.icon} size={15} strokeWidth={2} />
              </span>
              <span class="admin-editor-insert-menu__label">{tool.label}</span>
            </button>
          {/each}
        </div>

        <div class="admin-editor-insert-menu__group" role="group" aria-label="表情">
          <span class="admin-editor-insert-menu__group-label">表情</span>
          <button
            class="admin-content-menu-item admin-editor-insert-menu__item"
            type="button"
            disabled={busy}
            onclick={openEmojiMenuFromInsertMenu}
          >
            <span class="admin-editor-insert-menu__icon" aria-hidden="true">
              <AdminEditorIcon name={emojiTool.icon} size={15} strokeWidth={2} />
            </span>
            <span class="admin-editor-insert-menu__label">{emojiTool.label}</span>
          </button>
        </div>

        </div>
      </details>
    {/if}
  </div>

  <div class="admin-editor-shell__layout-controls" aria-label="编辑器显示、目录、布局与视图">
    <button
      class="admin-editor-markdown-toolbar__button admin-editor-layout-toggle"
      type="button"
      data-tooltip={layoutControlLabel}
      aria-label={layoutControlLabel}
      aria-pressed={layoutControlPressed}
      onclick={handleLayoutControlClick}
    >
      <AdminEditorIcon name={layoutControlIcon} size={toolbarIconSize} strokeWidth={2} />
    </button>
    <details
      class="admin-editor-markdown-toolbar__menu admin-editor-display-menu"
      class:is-open={displayMenuOpen}
      bind:this={displayMenuEl}
      ontoggle={syncDisplayMenuOpen}
    >
      <summary
        class="admin-editor-markdown-toolbar__button admin-editor-display-toggle"
        data-tooltip={displayMenuTooltipLabel}
        aria-label={displayMenuLabel}
        aria-expanded={displayMenuOpen ? 'true' : 'false'}
        aria-pressed={displayControlPressed}
      >
        <AdminEditorIcon name="m-square" size={toolbarIconSize} strokeWidth={2} />
      </summary>

      <div
        class="admin-content-menu-panel admin-editor-display-menu__panel"
        id="admin-editor-display-menu"
        aria-label="编辑器显示"
      >
        <button
          class="admin-content-menu-item admin-editor-display-menu__line-toggle"
          type="button"
          aria-pressed={lineNumbersEnabled ? 'true' : 'false'}
          onclick={onToggleLineNumbers}
        >
          <span>{lineNumbersToggleLabel}</span>
          <span class="admin-editor-display-menu__state">{lineNumbersEnabled ? 'On' : 'Off'}</span>
        </button>

        <div
          class="admin-editor-display-menu__group"
          role="radiogroup"
          aria-label="Markdown 高亮主题"
        >
          <span class="admin-editor-display-menu__group-label">Markdown 高亮主题</span>
          {#each MARKDOWN_HIGHLIGHT_THEME_OPTIONS as option}
            <label
              class="admin-content-menu-item admin-editor-highlight-menu__item"
              data-selected={markdownHighlightTheme === option.id ? 'true' : undefined}
            >
              <input
                class="admin-editor-highlight-menu__radio"
                type="radio"
                name="admin-editor-markdown-highlight-theme"
                value={option.id}
                checked={markdownHighlightTheme === option.id}
                onchange={() => onSelectMarkdownHighlightTheme(option.id)}
              />
              <span
                class="admin-editor-highlight-menu__swatch"
                data-theme={option.id}
                aria-hidden="true"
              ></span>
              <span class="admin-editor-highlight-menu__text">
                <span class="admin-editor-highlight-menu__description">{option.description}</span>
                <span class="admin-editor-highlight-menu__separator" aria-hidden="true">|</span>
                <span class="admin-editor-highlight-menu__label">{option.label}</span>
              </span>
            </label>
          {/each}
        </div>
      </div>
    </details>
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
        <AdminEditorIcon name="notebook-pen" size={toolbarIconSize} strokeWidth={2} />
      </button>
      <button
        class="admin-editor-markdown-toolbar__button admin-editor-view-toggle"
        type="button"
        data-tooltip={previewViewToggleLabel}
        aria-label={previewViewToggleLabel}
        aria-pressed={effectiveViewMode === 'preview' ? 'true' : 'false'}
        onclick={() => onToggleView('preview')}
      >
        <AdminEditorIcon name="book-open-text" size={toolbarIconSize} strokeWidth={2} />
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
      <AdminEditorIcon name="square-chart-gantt" size={toolbarIconSize} strokeWidth={2} />
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
      <AdminEditorIcon name="square-asterisk" size={toolbarIconSize} strokeWidth={2} />
    </button>
  </div>
</div>
