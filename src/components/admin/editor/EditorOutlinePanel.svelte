<script lang="ts">
import { tick } from 'svelte';
import AdminEditorIcon from './AdminEditorIcon.svelte';
import type {
  EditorOutlineListItem,
  EditorOutlineTab,
  MarkdownOutlineItem
} from './editor-outline-helpers';

type Props = {
  panelId: string;
  activeTab: EditorOutlineTab;
  headings: readonly MarkdownOutlineItem[];
  listItems: readonly EditorOutlineListItem[];
  headingsEnabled?: boolean;
  headingsTabLabel?: string;
  listTabLabel?: string;
  headingsEmptyText?: string;
  listEmptyText?: string;
  panelLabel?: string;
  onTabChange: (tab: EditorOutlineTab) => void;
  onHeadingSelect: (item: MarkdownOutlineItem) => void;
};

let {
  panelId,
  activeTab,
  headings,
  listItems,
  headingsEnabled = true,
  headingsTabLabel = '文章目录',
  listTabLabel = '文章列表',
  headingsEmptyText = '暂无 H2/H3 标题',
  listEmptyText = '暂无文章',
  panelLabel = '编辑器目录',
  onTabChange,
  onHeadingSelect
}: Props = $props();

const tabs = $derived([
  ...(headingsEnabled ? [{ id: 'headings' as const, label: headingsTabLabel }] : []),
  { id: 'essays' as const, label: listTabLabel }
]);
const effectiveActiveTab = $derived(
  headingsEnabled && activeTab === 'headings' ? 'headings' : 'essays'
);
const getTabId = (tab: EditorOutlineTab) => `${panelId}-${tab}-tab`;
const getPanelId = (tab: EditorOutlineTab) => `${panelId}-${tab}-panel`;

const headingHasChildren = (items: readonly MarkdownOutlineItem[], index: number): boolean =>
  items[index]?.level === 2 && items[index + 1]?.level === 3;

const selectTab = async (tab: EditorOutlineTab, options: { focus?: boolean } = {}) => {
  onTabChange(tab);
  if (!options.focus) return;

  await tick();
  document.getElementById(getTabId(tab))?.focus();
};

const selectRelativeTab = (currentTab: EditorOutlineTab, direction: -1 | 1) => {
  const currentIndex = tabs.findIndex((tab) => tab.id === currentTab);
  const safeCurrentIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (safeCurrentIndex + direction + tabs.length) % tabs.length;
  void selectTab(tabs[nextIndex]?.id ?? currentTab, { focus: true });
};

const handleTabKeydown = (event: KeyboardEvent, tab: EditorOutlineTab) => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    selectRelativeTab(tab, -1);
    return;
  }

  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    selectRelativeTab(tab, 1);
    return;
  }

  if (event.key === 'Home') {
    event.preventDefault();
    void selectTab(tabs[0]?.id ?? tab, { focus: true });
    return;
  }

  if (event.key === 'End') {
    event.preventDefault();
    void selectTab(tabs[tabs.length - 1]?.id ?? tab, { focus: true });
  }
};
</script>

<aside class="admin-editor-outline-panel" id={panelId} aria-label={panelLabel}>
  <div
    class="admin-editor-outline-panel__tabs"
    data-single={tabs.length === 1 ? 'true' : undefined}
    role="tablist"
    aria-label="目录面板"
  >
    {#each tabs as tab}
      <button
        class="admin-editor-outline-panel__tab"
        class:is-active={effectiveActiveTab === tab.id}
        id={getTabId(tab.id)}
        type="button"
        role="tab"
        aria-selected={effectiveActiveTab === tab.id ? 'true' : 'false'}
        aria-controls={getPanelId(tab.id)}
        tabindex={effectiveActiveTab === tab.id ? 0 : -1}
        onclick={() => onTabChange(tab.id)}
        onkeydown={(event) => handleTabKeydown(event, tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  {#if effectiveActiveTab === 'headings'}
    <div
      class="admin-editor-outline-panel__body"
      id={getPanelId('headings')}
      role="tabpanel"
      aria-labelledby={getTabId('headings')}
    >
      {#if headings.length > 0}
        <ol class="admin-editor-outline-panel__list admin-editor-outline-panel__list--headings">
          {#each headings as item, index (item.key)}
            <li class="admin-editor-outline-panel__heading-item" data-level={item.level}>
              <button
                class="admin-editor-outline-panel__heading-button"
                type="button"
                title={item.label}
                onclick={() => onHeadingSelect(item)}
              >
                <span class="admin-editor-outline-panel__heading-marker" aria-hidden="true">
                  {#if item.level === 2}
                    <AdminEditorIcon
                      name={headingHasChildren(headings, index) ? 'tree-palm' : 'tree-pine'}
                      size={13}
                      strokeWidth={2.2}
                    />
                  {:else}
                    <span class="admin-editor-outline-panel__heading-dot"></span>
                  {/if}
                </span>
                <span class="admin-editor-outline-panel__heading-label">{item.label}</span>
                <span class="admin-editor-outline-panel__line">L{item.line}</span>
              </button>
            </li>
          {/each}
        </ol>
      {:else}
        <p class="admin-editor-outline-panel__empty">{headingsEmptyText}</p>
      {/if}
    </div>
  {:else}
    <div
      class="admin-editor-outline-panel__body"
      id={getPanelId('essays')}
      role="tabpanel"
      aria-labelledby={getTabId('essays')}
    >
      {#if listItems.length > 0}
        <ol class="admin-editor-outline-panel__list admin-editor-outline-panel__list--essays">
          {#each listItems as item (item.entryId)}
            <li class="admin-editor-outline-panel__essay-item">
              {#if item.active}
                <span
                  class="admin-editor-outline-panel__essay-link is-active"
                  aria-current="page"
                  title={item.title}
                >
                  <span class="admin-editor-outline-panel__essay-title">{item.title}</span>
                  <span class="admin-editor-outline-panel__essay-meta">{item.sourceError ? '异常' : item.dateLabel}</span>
                </span>
              {:else}
                <a
                  class="admin-editor-outline-panel__essay-link"
                  href={item.editHref}
                  title={item.title}
                >
                  <span class="admin-editor-outline-panel__essay-title">{item.title}</span>
                  <span class="admin-editor-outline-panel__essay-meta">{item.sourceError ? '异常' : item.dateLabel}</span>
                </a>
              {/if}
            </li>
          {/each}
        </ol>
      {:else}
        <p class="admin-editor-outline-panel__empty">{listEmptyText}</p>
      {/if}
    </div>
  {/if}
</aside>
