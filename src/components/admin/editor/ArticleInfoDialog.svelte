<script lang="ts">
import type {
  AdminContentCollectionKey
} from '../../../lib/admin-console/content-collections';
import type {
  AdminContentWorkspaceEditorValues
} from '../../../lib/admin-console/content-editor-payload';
import { createModalDialogFocusController } from '../../../scripts/admin-console/modal-dialog-focus';
import AdminEditorIcon from './AdminEditorIcon.svelte';
import FrontmatterSidebar from './FrontmatterSidebar.svelte';
import { isEssayEditorValues } from './content-editor-adapters';

type AdminContentIssue = {
  path: string;
  message: string;
};

type Props = {
  open: boolean;
  value: AdminContentWorkspaceEditorValues;
  collection?: AdminContentCollectionKey;
  issues?: readonly AdminContentIssue[];
  disabled?: boolean;
  loading?: boolean;
  dirty?: boolean;
  canSave?: boolean;
  entryId?: string;
  showEntryId?: boolean;
  slugPlaceholder?: string;
  relativePath?: string;
  dialogTitle?: string;
  fieldsAriaLabel?: string;
  fieldScope?: 'all' | 'bits-summary';
  showPublishToggles?: boolean;
  draftLocked?: boolean;
  draftLockHelp?: string;
  saveLabel?: string;
  onEntryIdInput?: (value: string) => void;
  onDirty?: () => void;
  onClose: () => void;
  onReset: () => void;
  onSave: () => void;
};

let {
  open,
  value = $bindable(),
  collection = 'essay',
  issues = [],
  disabled = false,
  loading = false,
  dirty = false,
  canSave = false,
  entryId = '',
  showEntryId = false,
  slugPlaceholder = '',
  relativePath = '',
  dialogTitle = '文章信息',
  fieldsAriaLabel = '随笔字段',
  fieldScope = 'all',
  showPublishToggles = true,
  draftLocked = false,
  draftLockHelp = '',
  saveLabel = '保存',
  onEntryIdInput = () => {},
  onDirty = () => {},
  onClose,
  onReset,
  onSave
}: Props = $props();

let panelEl = $state<HTMLElement | null>(null);
let closeButtonEl = $state<HTMLButtonElement | null>(null);
const closeLabel = $derived(`关闭${dialogTitle}`);
const loadingText = $derived(`正在加载${dialogTitle}`);

const closeDialog = () => {
  onClose();
  dialogFocus.restoreFocus();
};

const getInitialFocus = (): HTMLElement | null => {
  if (loading) return closeButtonEl;
  return panelEl?.querySelector<HTMLElement>('.admin-field.is-invalid .admin-frontmatter-tags-input__input:not([disabled])')
    ?? panelEl?.querySelector<HTMLElement>('.admin-field.is-invalid .admin-field__control:not([disabled])')
    ?? panelEl?.querySelector<HTMLElement>('[name="title"]:not([disabled])')
    ?? closeButtonEl;
};

const dialogFocus = createModalDialogFocusController({
  getDialog: () => panelEl,
  getInitialFocus,
  onClose: closeDialog
});

export const captureReturnFocus = (trigger?: Element | null) => {
  dialogFocus.captureReturnFocus(trigger);
};

export const restoreFocus = () => {
  dialogFocus.restoreFocus();
};

$effect(() => {
  if (!open) return;

  dialogFocus.focusInitial();
  document.addEventListener('keydown', dialogFocus.handleKeydown);
  return () => {
    document.removeEventListener('keydown', dialogFocus.handleKeydown);
  };
});
</script>

{#if open}
  <div class="admin-modal admin-editor-frontmatter-popover" role="presentation">
    <button
      class="admin-modal__backdrop admin-editor-frontmatter-popover__backdrop"
      type="button"
      aria-label={closeLabel}
      onclick={closeDialog}
    ></button>
    <div
      bind:this={panelEl}
      id="admin-editor-frontmatter-panel"
      class="admin-modal__panel admin-editor-frontmatter-popover__panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-editor-frontmatter-panel-title"
      tabindex="-1"
    >
      <header class="admin-modal__head admin-editor-frontmatter-popover__head">
        <div class="admin-editor-frontmatter-popover__title-wrap">
          <span class="admin-editor-frontmatter-popover__icon" aria-hidden="true">
            <AdminEditorIcon name="notebook-pen" size={16} strokeWidth={1.9} />
          </span>
          <div class="admin-editor-frontmatter-popover__title-copy">
            <h3 id="admin-editor-frontmatter-panel-title" class="admin-modal__title admin-content-section-title">{dialogTitle}</h3>
            {#if relativePath}
              <code class="admin-editor-frontmatter-popover__source-path" title={relativePath}>{relativePath}</code>
            {/if}
          </div>
        </div>
        <button
          bind:this={closeButtonEl}
          class="admin-btn admin-btn--ghost admin-btn--compact admin-btn--icon admin-editor-frontmatter-popover__close"
          type="button"
          aria-label={closeLabel}
          disabled={disabled}
          onclick={closeDialog}
        >
          <AdminEditorIcon name="close" size={16} strokeWidth={2} />
        </button>
      </header>
      <div class="admin-modal__body">
        {#if loading}
          <div class="admin-editor-frontmatter-popover__loading" role="status" aria-live="polite">
            {loadingText}
          </div>
        {:else}
          <FrontmatterSidebar
            bind:value
            {collection}
            {issues}
            {disabled}
            {entryId}
            {showEntryId}
            {slugPlaceholder}
            ariaLabel={fieldsAriaLabel}
            {fieldScope}
            {onEntryIdInput}
            {onDirty}
          />
        {/if}
      </div>
      <footer
        class="admin-modal__actions admin-editor-frontmatter-popover__actions"
        class:admin-editor-frontmatter-popover__actions--compact={!showPublishToggles}
        class:admin-editor-frontmatter-popover__actions--locked={draftLocked}
      >
        {#if showPublishToggles}
          <div class="admin-editor-frontmatter-popover__publish-state">
            <div class="admin-editor-frontmatter-popover__toggles">
              {#if draftLocked}
                <span class="admin-badge admin-editor-frontmatter-popover__state-badge">草稿</span>
                {#if collection === 'essay' && isEssayEditorValues(value)}
                  <span class="admin-badge admin-editor-frontmatter-popover__state-badge">归档</span>
                {/if}
                {#if draftLockHelp}
                  <p class="admin-editor-frontmatter-popover__hint">{draftLockHelp}</p>
                {/if}
              {:else}
                <label class="admin-toggle-row">
                  <input name="draft" type="checkbox" bind:checked={value.draft} disabled={disabled || loading} onchange={onDirty} />
                  <span>草稿</span>
                </label>
                {#if collection === 'essay' && isEssayEditorValues(value)}
                  <label class="admin-toggle-row">
                    <input name="archive" type="checkbox" bind:checked={value.archive} disabled={disabled || loading} onchange={onDirty} />
                    <span>归档</span>
                  </label>
                {/if}
              {/if}
            </div>
          </div>
        {/if}
        <div class="admin-editor-frontmatter-popover__buttons">
          <button class="admin-btn admin-btn--ghost admin-btn--compact" type="button" onclick={onReset} disabled={disabled || loading || !dirty}>
            还原
          </button>
          <button class="admin-btn admin-btn--primary admin-btn--compact" type="button" onclick={onSave} disabled={loading || !canSave}>
            {saveLabel}
          </button>
        </div>
      </footer>
    </div>
  </div>
{/if}
