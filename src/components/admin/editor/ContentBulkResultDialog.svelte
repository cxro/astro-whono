<script lang="ts">
import { createModalDialogFocusController } from '../../../scripts/admin-console/modal-dialog-focus';
import AdminEditorIcon from './AdminEditorIcon.svelte';
import type {
  ContentBulkResultDialog as ResultDialog,
  ContentBulkResultDialogKind
} from './content-bulk-result-feedback';

type Props = {
  dialog: ResultDialog;
  onClose: () => void;
};

let { dialog, onClose }: Props = $props();

let panelEl = $state<HTMLElement | null>(null);
let closeButtonEl = $state<HTMLButtonElement | null>(null);

const getResultDialogUnit = (kind: ContentBulkResultDialogKind): string =>
  kind === 'status' ? '内容' : '文件';

const getResultHandledCount = (dialog: ResultDialog): number =>
  dialog.summary.succeeded + dialog.summary.unchanged;

const getResultUnhandledCount = (dialog: ResultDialog): number =>
  dialog.summary.skipped + dialog.summary.failed;

const getResultDialogLead = (dialog: ResultDialog): string => {
  const handled = getResultHandledCount(dialog);
  const unhandled = getResultUnhandledCount(dialog);
  if (unhandled > 0 && handled > 0) return `${dialog.title}完成，部分${getResultDialogUnit(dialog.kind)}未处理。`;
  if (unhandled > 0 && dialog.kind === 'export') return `${dialog.title}未完成，未生成下载文件。`;
  if (unhandled > 0 && dialog.kind === 'delete') return `${dialog.title}未完成，文件未移入回收站。`;
  if (unhandled > 0) return `${dialog.title}未完成，列表状态未更新。`;
  if (dialog.note) return `${dialog.title}完成，${dialog.note}`;
  if (dialog.kind === 'export') return `${dialog.title}完成，已保存为 zip 文件。`;
  if (dialog.kind === 'delete') return `${dialog.title}完成，文件已移入回收站。`;
  return `${dialog.title}完成，列表将显示最新状态。`;
};

const getResultDialogDescription = (dialog: ResultDialog): string => {
  const succeeded = dialog.summary.succeeded;
  const unchanged = dialog.summary.unchanged;
  const unhandled = getResultUnhandledCount(dialog);
  const parts = [`共处理 ${dialog.summary.processed} 个`];
  if (succeeded > 0) parts.push(`成功 ${succeeded} 个`);
  if (unchanged > 0) parts.push(`无需修改 ${unchanged} 个`);
  if (unhandled > 0) parts.push(`未处理 ${unhandled} 个`);
  return `${parts.join('，')}。`;
};

const getResultDialogState = (dialog: ResultDialog): 'default' | 'warn' =>
  getResultHandledCount(dialog) === 0 && getResultUnhandledCount(dialog) > 0 ? 'warn' : 'default';

const getResultDialogIconName = (dialog: ResultDialog): 'check-mark' | 'triangle-alert' =>
  getResultDialogState(dialog) === 'warn' ? 'triangle-alert' : 'check-mark';

const closeDialog = () => {
  onClose();
  dialogFocus.restoreFocus();
};

const dialogFocus = createModalDialogFocusController({
  getDialog: () => panelEl,
  getInitialFocus: () => closeButtonEl,
  onClose: closeDialog
});

$effect(() => {
  if (!dialog) return;

  dialogFocus.captureReturnFocus();
  dialogFocus.focusInitial();
  document.addEventListener('keydown', dialogFocus.handleKeydown);
  return () => {
    document.removeEventListener('keydown', dialogFocus.handleKeydown);
  };
});
</script>

<div class="admin-modal admin-content-bulk-result-dialog" role="presentation">
  <div class="admin-modal__backdrop" aria-hidden="true"></div>
  <div bind:this={panelEl} class="admin-modal__panel" role="dialog" aria-modal="true" aria-labelledby="admin-content-bulk-result-title" tabindex="-1">
    <header class="admin-modal__head">
      <h2 id="admin-content-bulk-result-title" class="admin-modal__title">{dialog.title}</h2>
    </header>
    <div class="admin-modal__body">
      <div class="admin-content-bulk-result__message">
        <span class="admin-content-bulk-result__icon" data-state={getResultDialogState(dialog)} aria-hidden="true">
          <AdminEditorIcon name={getResultDialogIconName(dialog)} size={10} strokeWidth={3} />
        </span>
        <p class="admin-content-bulk-result__lead">
          {getResultDialogLead(dialog)}
        </p>
        <p class="admin-content-bulk-result__description">{getResultDialogDescription(dialog)}</p>
      </div>
      {#if dialog.details.length > 0}
        <ol class="admin-content-bulk-result__details">
          {#each dialog.details as detail}
            <li>
              <span>{detail.title}</span>
              <span>{detail.message}</span>
            </li>
          {/each}
        </ol>
        {#if dialog.extraDetailCount > 0}
          <p class="admin-content-bulk-result__more">还有 {dialog.extraDetailCount} 个{getResultDialogUnit(dialog.kind)}</p>
        {:else if dialog.truncated}
          <p class="admin-content-bulk-result__more">还有更多{getResultDialogUnit(dialog.kind)}</p>
        {/if}
      {:else if dialog.truncated}
        <p class="admin-content-bulk-result__more">还有更多{getResultDialogUnit(dialog.kind)}</p>
      {/if}
    </div>
    <footer class="admin-modal__actions">
      <button bind:this={closeButtonEl} class="admin-btn admin-btn--primary admin-btn--compact" type="button" onclick={closeDialog}>知道了</button>
    </footer>
  </div>
</div>
