<script lang="ts">
import AdminEditorIcon from './AdminEditorIcon.svelte';
import {
  MARKDOWN_SHORTCUT_EXAMPLES,
  MARKDOWN_SYNTAX_EXAMPLES
} from './markdown-syntax-examples';

type Props = {
  panelId: string;
  maximized?: boolean;
  showMaximizeControl?: boolean;
  onToggleMaximize: () => void;
};

let {
  panelId,
  maximized = false,
  showMaximizeControl = false,
  onToggleMaximize
}: Props = $props();

const maximizeLabel = $derived(maximized ? '恢复上下布局' : '展开语法面板');
const maximizeIcon = $derived(maximized ? 'minimize-2' : 'maximize-2');
</script>

<aside class="admin-editor-syntax-panel" id={panelId} aria-label="Markdown 语法">
  <header class="admin-editor-syntax-panel__header">
    <span class="admin-editor-syntax-panel__title">
      <AdminEditorIcon name="square-asterisk" size={14} strokeWidth={2} />
      <span>Markdown 语法</span>
    </span>
    {#if showMaximizeControl}
      <button
        class="admin-editor-markdown-toolbar__button admin-editor-syntax-panel__maximize"
        type="button"
        data-tooltip={maximizeLabel}
        aria-label={maximizeLabel}
        aria-pressed={maximized ? 'true' : 'false'}
        onclick={onToggleMaximize}
      >
        <AdminEditorIcon name={maximizeIcon} size={15} strokeWidth={2} />
      </button>
    {/if}
  </header>

  <div class="admin-editor-syntax-panel__body">
    <section class="admin-editor-syntax-panel__section" aria-label="Markdown 语法列表">
      <ol class="admin-editor-syntax-panel__list">
        {#each MARKDOWN_SYNTAX_EXAMPLES as example}
          <li class="admin-editor-syntax-panel__item">
            <div class="admin-editor-syntax-panel__row admin-editor-syntax-panel__row--readonly" title={example.syntax}>
              <span class="admin-editor-syntax-panel__icon" aria-hidden="true">
                {#if example.icon}
                  <AdminEditorIcon name={example.icon} size={14} strokeWidth={2} />
                {:else}
                  <span class="admin-editor-syntax-panel__marker">{example.marker}</span>
                {/if}
              </span>
              <span class="admin-editor-syntax-panel__label">{example.label}</span>
              <code class="admin-editor-syntax-panel__code admin-editor-syntax-panel__syntax-code">{example.syntax}</code>
            </div>
          </li>
        {/each}
      </ol>
    </section>

    <section class="admin-editor-syntax-panel__section" aria-labelledby={`${panelId}-shortcuts-title`}>
      <h3 id={`${panelId}-shortcuts-title`} class="admin-editor-syntax-panel__section-title">快捷键</h3>
      <ol class="admin-editor-syntax-panel__list admin-editor-syntax-panel__list--shortcuts">
        {#each MARKDOWN_SHORTCUT_EXAMPLES as shortcut}
          <li class="admin-editor-syntax-panel__item">
            <div class="admin-editor-syntax-panel__row admin-editor-syntax-panel__row--readonly">
              <span class="admin-editor-syntax-panel__icon" aria-hidden="true">
                {#if shortcut.icon}
                  <AdminEditorIcon name={shortcut.icon} size={14} strokeWidth={2} />
                {/if}
              </span>
              <span class="admin-editor-syntax-panel__label">{shortcut.label}</span>
              <kbd class="admin-editor-syntax-panel__code admin-editor-syntax-panel__shortcut">{shortcut.shortcut}</kbd>
            </div>
          </li>
        {/each}
      </ol>
    </section>
  </div>
</aside>
