<script lang="ts">
import AdminEditorIcon from './AdminEditorIcon.svelte';
import type { StatusState } from './editor-shell-helpers';

type Props = {
  element: HTMLDivElement | null;
  statusText?: string;
  statusState?: StatusState;
  canWriteContent?: boolean;
  busy?: boolean;
  dirty?: boolean;
  returnHref: string;
  exportHref: string;
  actionLabel?: string;
  moreLabel?: string;
  saveLabel?: string;
  resetLabel?: string;
  downloadLabel?: string;
  deleteLabel?: string;
  onSave: () => void | Promise<void>;
  onReset: (event: MouseEvent) => void;
  onDownload: (event: MouseEvent) => void;
  onDelete: (event: MouseEvent) => void | Promise<void>;
};

let {
  element = $bindable(null),
  statusText = '',
  statusState = 'idle',
  canWriteContent = false,
  busy = false,
  dirty = false,
  returnHref,
  exportHref,
  actionLabel = '内容操作',
  moreLabel = '更多内容操作',
  saveLabel = '保存内容',
  resetLabel = '还原更改',
  downloadLabel = '下载源文件',
  deleteLabel = '删除内容',
  onSave,
  onReset,
  onDownload,
  onDelete
}: Props = $props();
</script>

<div class="admin-editor-shell__top-actions" aria-label={actionLabel} bind:this={element}>
  {#if statusText}
    <p class="admin-status admin-status--inline" data-state={statusState} role="status" aria-live="polite" aria-atomic="true">{statusText}</p>
  {/if}
  <button class="admin-btn admin-btn--secondary admin-btn--compact" type="button" onclick={() => void onSave()} disabled={!canWriteContent}>
    {saveLabel}
  </button>
  <a class="admin-btn admin-btn--ghost admin-btn--compact" href={returnHref}>返回</a>
  <details class="admin-editor-shell__action-more">
    <summary class="admin-btn admin-btn--ghost admin-btn--compact admin-editor-shell__action-more-trigger" aria-label={moreLabel}>
      <span>更多</span>
      <AdminEditorIcon name="ellipsis" size={14} strokeWidth={2} />
    </summary>
    <div class="admin-content-menu-panel admin-editor-shell__action-menu" aria-label={moreLabel}>
      <button
        class="admin-content-menu-item"
        type="button"
        disabled={busy || !dirty}
        onclick={onReset}
      >
        <AdminEditorIcon name="rotate-ccw" size={14} strokeWidth={2} class="admin-icon" />
        <span>{resetLabel}</span>
      </button>
      <a
        class="admin-content-menu-item"
        href={exportHref}
        download
        onclick={onDownload}
      >
        <AdminEditorIcon name="download" size={14} strokeWidth={2} class="admin-icon" />
        <span>{downloadLabel}</span>
      </a>
      <button
        class="admin-content-menu-item admin-content-menu-item--danger"
        type="button"
        disabled={busy}
        onclick={(event) => void onDelete(event)}
      >
        <AdminEditorIcon name="trash" size={14} strokeWidth={2} class="admin-icon" />
        <span>{deleteLabel}</span>
      </button>
    </div>
  </details>
</div>
