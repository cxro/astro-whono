<script lang="ts">
import {
  clampEditorSidePanelStackedRatio,
  DEFAULT_EDITOR_SIDE_PANEL_STACKED_RATIO,
  EDITOR_SIDE_PANEL_STACKED_RATIO_STEP,
  getEditorSidePanelStackedRatioBounds,
  getEditorSidePanelStackedRatioFromPointer,
  type EditorSidePanelLayout
} from './editor-shell-helpers';
import EditorOutlinePanel from './EditorOutlinePanel.svelte';
import EditorSyntaxPanel from './EditorSyntaxPanel.svelte';
import type {
  EditorOutlineListItem,
  EditorOutlineTab,
  MarkdownOutlineItem
} from './editor-outline-helpers';

type Props = {
  layout: EditorSidePanelLayout;
  outlinePanelId: string;
  syntaxPanelId: string;
  activeTab: EditorOutlineTab;
  headings: readonly MarkdownOutlineItem[];
  listItems: readonly EditorOutlineListItem[];
  outlineHeadingsEnabled?: boolean;
  outlineHeadingsTabLabel?: string;
  outlineListTabLabel?: string;
  outlineHeadingsEmptyText?: string;
  outlineListEmptyText?: string;
  outlinePanelLabel?: string;
  onTabChange: (tab: EditorOutlineTab) => void;
  onHeadingSelect: (item: MarkdownOutlineItem) => void;
  onSyntaxMaximizeToggle: () => void;
};

let {
  layout,
  outlinePanelId,
  syntaxPanelId,
  activeTab,
  headings,
  listItems,
  outlineHeadingsEnabled = true,
  outlineHeadingsTabLabel = '文章目录',
  outlineListTabLabel = '文章列表',
  outlineHeadingsEmptyText = '暂无 H2/H3 标题',
  outlineListEmptyText = '暂无文章',
  outlinePanelLabel = '编辑器目录',
  onTabChange,
  onHeadingSelect,
  onSyntaxMaximizeToggle
}: Props = $props();

let sidePanelsEl = $state<HTMLDivElement | null>(null);
let sidePanelsBlockSize = $state(0);
let outlineStackedRatio = $state(DEFAULT_EDITOR_SIDE_PANEL_STACKED_RATIO);
let resizing = $state(false);
let resizePointerId: number | null = null;

const outlineVisible = $derived(layout === 'outline' || layout === 'stacked');
const syntaxVisible = $derived(layout === 'syntax' || layout === 'stacked' || layout === 'syntaxMaximized');
const syntaxMaximized = $derived(layout === 'syntaxMaximized');
const showSyntaxMaximizeControl = $derived(layout === 'stacked' || layout === 'syntaxMaximized');
const stackedRatioBounds = $derived(getEditorSidePanelStackedRatioBounds(sidePanelsBlockSize));
const stackedOutlineRatio = $derived(clampEditorSidePanelStackedRatio(outlineStackedRatio, sidePanelsBlockSize));
const stackedSyntaxRatio = $derived(100 - stackedOutlineRatio);
const sidePanelsStyle = $derived(
  layout === 'stacked'
    ? [
        `--admin-editor-side-panels-outline-row: ${stackedOutlineRatio}fr`,
        `--admin-editor-side-panels-syntax-row: ${stackedSyntaxRatio}fr`,
        `--admin-editor-side-panels-resize-block-start: ${stackedOutlineRatio}%`
      ].join('; ')
    : undefined
);

const setDocumentResizeState = (active: boolean) => {
  if (typeof document === 'undefined') return;
  if (active) {
    document.documentElement.dataset.adminEditorSidePanelResizing = 'true';
    return;
  }

  delete document.documentElement.dataset.adminEditorSidePanelResizing;
};

const setStackedRatioFromPointer = (clientY: number) => {
  const rect = sidePanelsEl?.getBoundingClientRect();
  if (!rect) return;

  outlineStackedRatio = getEditorSidePanelStackedRatioFromPointer(rect.top, rect.height, clientY);
};

const stopResize = (event?: PointerEvent) => {
  if (event && resizePointerId !== null && event.pointerId !== resizePointerId) return;
  if (event?.currentTarget instanceof HTMLElement && resizePointerId !== null) {
    if (event.currentTarget.hasPointerCapture(resizePointerId)) {
      event.currentTarget.releasePointerCapture(resizePointerId);
    }
  }

  resizing = false;
  resizePointerId = null;
  setDocumentResizeState(false);
};

const startResize = (event: PointerEvent) => {
  if (layout !== 'stacked') return;

  resizing = true;
  resizePointerId = event.pointerId;
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  setDocumentResizeState(true);
  setStackedRatioFromPointer(event.clientY);
  event.preventDefault();
};

const handleResizeMove = (event: PointerEvent) => {
  if (!resizing || event.pointerId !== resizePointerId) return;
  setStackedRatioFromPointer(event.clientY);
  event.preventDefault();
};

const setStackedRatio = (ratio: number) => {
  outlineStackedRatio = clampEditorSidePanelStackedRatio(ratio, sidePanelsBlockSize);
};

const handleResizeKeydown = (event: KeyboardEvent) => {
  if (layout !== 'stacked') return;

  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    event.preventDefault();
    setStackedRatio(stackedOutlineRatio - EDITOR_SIDE_PANEL_STACKED_RATIO_STEP);
    return;
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    event.preventDefault();
    setStackedRatio(stackedOutlineRatio + EDITOR_SIDE_PANEL_STACKED_RATIO_STEP);
    return;
  }

  if (event.key === 'Home') {
    event.preventDefault();
    setStackedRatio(stackedRatioBounds.min);
    return;
  }

  if (event.key === 'End') {
    event.preventDefault();
    setStackedRatio(stackedRatioBounds.max);
  }
};

$effect(() => {
  const element = sidePanelsEl;
  if (!element || typeof ResizeObserver === 'undefined') return;

  const syncBlockSize = (nextBlockSize?: number) => {
    sidePanelsBlockSize = nextBlockSize ?? element.getBoundingClientRect().height;
  };
  const observer = new ResizeObserver((entries) => {
    syncBlockSize(entries[0]?.contentRect.height);
  });

  syncBlockSize();
  observer.observe(element);
  return () => {
    observer.disconnect();
  };
});

$effect(() => {
  if (layout !== 'stacked' && resizing) stopResize();
});

$effect(() => {
  return () => {
    setDocumentResizeState(false);
  };
});
</script>

<div
  class="admin-editor-side-panels"
  bind:this={sidePanelsEl}
  data-layout={layout}
  data-resizing={resizing ? 'true' : undefined}
  style={sidePanelsStyle}
  aria-label="编辑器辅助面板"
>
  {#if outlineVisible}
    <div class="admin-editor-side-panels__panel admin-editor-side-panels__panel--outline">
      <EditorOutlinePanel
        panelId={outlinePanelId}
        {activeTab}
        {headings}
        {listItems}
        headingsEnabled={outlineHeadingsEnabled}
        headingsTabLabel={outlineHeadingsTabLabel}
        listTabLabel={outlineListTabLabel}
        headingsEmptyText={outlineHeadingsEmptyText}
        listEmptyText={outlineListEmptyText}
        panelLabel={outlinePanelLabel}
        onTabChange={onTabChange}
        onHeadingSelect={onHeadingSelect}
      />
    </div>
  {/if}

  {#if layout === 'stacked'}
    <!-- WAI-ARIA APG window splitter pattern uses a focusable separator with range values. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      class="admin-editor-side-panels__resize"
      role="separator"
      tabindex="0"
      aria-label="调整目录和语法面板高度"
      aria-controls={outlinePanelId}
      aria-orientation="horizontal"
      aria-valuemin={Math.round(stackedRatioBounds.min)}
      aria-valuemax={Math.round(stackedRatioBounds.max)}
      aria-valuenow={Math.round(stackedOutlineRatio)}
      aria-valuetext={`${Math.round(stackedOutlineRatio)}%`}
      onpointerdown={startResize}
      onpointermove={handleResizeMove}
      onpointerup={stopResize}
      onpointercancel={stopResize}
      onkeydown={handleResizeKeydown}
    ></div>
  {/if}

  {#if syntaxVisible}
    <div class="admin-editor-side-panels__panel admin-editor-side-panels__panel--syntax">
      <EditorSyntaxPanel
        panelId={syntaxPanelId}
        maximized={syntaxMaximized}
        showMaximizeControl={showSyntaxMaximizeControl}
        onToggleMaximize={onSyntaxMaximizeToggle}
      />
    </div>
  {/if}
</div>
