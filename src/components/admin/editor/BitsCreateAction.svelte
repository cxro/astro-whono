<script lang="ts">
import { onMount } from 'svelte';
import { createModalDialogFocusController } from '../../../scripts/admin-console/modal-dialog-focus';
import { createWithBase } from '../../../utils/format';
import AdminEditorIcon from './AdminEditorIcon.svelte';
import {
  createAdminStatusFeedback,
  type StatusState
} from './content-action-feedback';
import { createContentEntry, type AdminContentIssue } from './content-editor-client';

type Props = {
  base?: string;
  createEndpoint: string;
};

const CREATE_TRIGGER_SELECTOR = '[data-admin-content-bits-create-action]';
const BITS_CREATE_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const BITS_CREATE_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ENTRY_ID_CONFLICT_MESSAGE = '此时间已使用，请调整创建时间';
const pad2 = (value: number): string => String(value).padStart(2, '0');

let { base = '/', createEndpoint }: Props = $props();

let open = $state(false);
let busy = $state(false);
let dateValue = $state('');
let timeValue = $state('');
let createActionLabel = $state('新建内容');
let issues = $state<AdminContentIssue[]>([]);
let statusState = $state<StatusState>('idle');
let statusText = $state('');
let panelEl = $state<HTMLElement | null>(null);
let dateInputEl = $state<HTMLInputElement | null>(null);
let closeButtonEl = $state<HTMLButtonElement | null>(null);

const withBase = $derived(createWithBase(base));
const dialogTitle = $derived(createActionLabel);
const closeLabel = $derived(`关闭${dialogTitle}`);
const canCreate = $derived(dateValue.trim().length > 0 && timeValue.trim().length > 0 && !busy);

const formatLocalDateInput = (date = new Date()): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const formatLocalTimeInput = (date = new Date()): string =>
  `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const formatLocalOffset = (date: Date): string => {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  return `${sign}${pad2(Math.floor(absoluteOffset / 60))}:${pad2(absoluteOffset % 60)}`;
};

const getSelectedLocalDate = (dateText: string, timeText: string): Date | null => {
  const dateMatch = BITS_CREATE_DATE_RE.exec(dateText.trim());
  const timeMatch = BITS_CREATE_TIME_RE.exec(timeText.trim());
  if (!dateMatch || !timeMatch) return null;

  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
};

const buildLocalBitsCreateDateTime = (dateText: string, timeText: string): string => {
  const selectedDate = getSelectedLocalDate(dateText, timeText) ?? new Date();
  return `${dateText.trim()}T${timeText.trim()}:00${formatLocalOffset(selectedDate)}`;
};

const deriveBitsEntryIdPreview = (dateText: string, timeText: string): string => {
  const dateMatch = BITS_CREATE_DATE_RE.exec(dateText.trim());
  const timeMatch = BITS_CREATE_TIME_RE.exec(timeText.trim());
  if (!dateMatch || !timeMatch) return 'bits-YYYY-MM-DD-HHmm';

  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;
  return `bits-${year}-${month}-${day}-${hour}${minute}`;
};

const isValidDate = (value: string): boolean => {
  const match = BITS_CREATE_DATE_RE.exec(value.trim());
  if (!match) return false;

  const [, year, month, day] = match;
  const normalized = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return normalized.getUTCFullYear() === Number(year)
    && normalized.getUTCMonth() + 1 === Number(month)
    && normalized.getUTCDate() === Number(day);
};

const sourceFilePreview = $derived(`${deriveBitsEntryIdPreview(dateValue, timeValue)}.md`);
const dateIssue = $derived(
  issues.find((issue) => issue.path === 'date')?.message
  ?? (issues.some((issue) => issue.path === 'entryId') ? ENTRY_ID_CONFLICT_MESSAGE : '')
);
const statusFeedback = createAdminStatusFeedback({
  getState: () => statusState,
  getText: () => statusText,
  setStatus: (state, text) => {
    statusState = state;
    statusText = text;
  }
});
const clearStatus = statusFeedback.clearStatus;
const setStatus = statusFeedback.setStatus;

const closeDialog = () => {
  if (busy) return;

  open = false;
  issues = [];
  clearStatus();
  dialogFocus.restoreFocus();
};

const dialogFocus = createModalDialogFocusController({
  getDialog: () => panelEl,
  getInitialFocus: () => dateInputEl ?? closeButtonEl,
  onClose: closeDialog
});

const openCreateDialog = (trigger: HTMLElement) => {
  if (busy) {
    setStatus('warn', '操作进行中');
    return;
  }

  createActionLabel = trigger.dataset.createActionLabel?.trim() || '新建内容';
  const now = new Date();
  dateValue = formatLocalDateInput(now);
  timeValue = formatLocalTimeInput(now);
  issues = [];
  clearStatus();
  dialogFocus.captureReturnFocus(trigger);
  open = true;
};

const saveCreate = async () => {
  if (!canCreate || busy) return;

  busy = true;
  issues = [];
  setStatus('loading', '正在创建');

  if (!isValidDate(dateValue) || !BITS_CREATE_TIME_RE.test(timeValue.trim())) {
    setStatus('error', '请填写合法发布时间');
    busy = false;
    return;
  }

  try {
    const outcome = await createContentEntry({
      endpoint: createEndpoint,
      collection: 'bits',
      frontmatter: {
        date: buildLocalBitsCreateDateTime(dateValue, timeValue)
      }
    });

    if (!outcome.responseOk || !outcome.payloadOk || !outcome.editHref) {
      issues = outcome.issues;
      setStatus('error', outcome.errors.length > 0 ? '创建失败' : '创建响应异常，请检查开发日志');
      return;
    }

    setStatus('ok', '已创建，进入编辑页');
    window.location.assign(withBase(outcome.editHref));
  } catch {
    setStatus('error', '创建请求失败，请稍后重试');
  } finally {
    busy = false;
  }
};

const handleClick = (event: MouseEvent) => {
  if (!(event.target instanceof Element)) return;

  const trigger = event.target.closest<HTMLElement>(CREATE_TRIGGER_SELECTOR);
  if (!trigger) return;

  event.preventDefault();
  openCreateDialog(trigger);
};

onMount(() => {
  document.addEventListener('click', handleClick);
  return () => {
    statusFeedback.dispose();
    document.removeEventListener('click', handleClick);
  };
});

$effect(() => {
  document.querySelectorAll<HTMLButtonElement>(CREATE_TRIGGER_SELECTOR).forEach((button) => {
    button.disabled = busy;
  });
});

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
  <div class="admin-modal admin-editor-frontmatter-popover admin-content-bits-create-dialog" role="presentation">
    <button
      class="admin-modal__backdrop admin-editor-frontmatter-popover__backdrop"
      type="button"
      aria-label={closeLabel}
      onclick={closeDialog}
    ></button>
    <div
      bind:this={panelEl}
      class="admin-modal__panel admin-editor-frontmatter-popover__panel admin-content-bits-create-dialog__panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-content-bits-create-title"
      tabindex="-1"
    >
      <form
        class="admin-content-bits-create-dialog__form"
        onsubmit={(event) => {
          event.preventDefault();
          void saveCreate();
        }}
      >
        <header class="admin-modal__head admin-editor-frontmatter-popover__head">
          <div class="admin-editor-frontmatter-popover__title-wrap">
            <span class="admin-editor-frontmatter-popover__icon" aria-hidden="true">
              <AdminEditorIcon name="pencil" size={16} strokeWidth={1.9} />
            </span>
            <div class="admin-editor-frontmatter-popover__title-copy">
              <h3 id="admin-content-bits-create-title" class="admin-modal__title admin-content-section-title">{dialogTitle}</h3>
            </div>
          </div>
          <button
            bind:this={closeButtonEl}
            class="admin-btn admin-btn--ghost admin-btn--compact admin-btn--icon admin-editor-frontmatter-popover__close"
            type="button"
            aria-label={closeLabel}
            disabled={busy}
            onclick={closeDialog}
          >
            <AdminEditorIcon name="close" size={16} strokeWidth={2} />
          </button>
        </header>

        <div class="admin-modal__body">
          <div class="admin-editor-frontmatter" aria-label="新增字段">
            <div class="admin-editor-frontmatter__fields">
              <div class="admin-editor-frontmatter__datetime-grid">
                <label class="admin-field admin-content-editor__field" class:is-invalid={Boolean(dateIssue)}>
                  <span class="admin-field__label">发布时间</span>
                  <input
                    bind:this={dateInputEl}
                    class="admin-field__control"
                    name="date"
                    type="date"
                    required
                    bind:value={dateValue}
                    disabled={busy}
                    aria-invalid={dateIssue ? 'true' : undefined}
                  />
                </label>

                <label class="admin-field admin-content-editor__field" class:is-invalid={Boolean(dateIssue)}>
                  <span class="admin-field__label">时间（24小时）</span>
                  <input
                    class="admin-field__control"
                    name="time"
                    type="time"
                    step="60"
                    required
                    bind:value={timeValue}
                    disabled={busy}
                    aria-invalid={dateIssue ? 'true' : undefined}
                  />
                </label>
              </div>

              <p class="admin-editor-frontmatter__note admin-editor-frontmatter__note--error" hidden={!dateIssue}>
                {dateIssue}
              </p>

              <div class="admin-field admin-content-editor__field">
                <span class="admin-field__label">源文件</span>
                <code class="admin-field__control admin-content-bits-create-dialog__source">{sourceFilePreview}</code>
              </div>
            </div>
          </div>
        </div>

        <footer class="admin-modal__actions admin-content-bits-create-dialog__actions">
          <div class="admin-content-bits-create-dialog__publish-state">
            <div class="admin-content-bits-create-dialog__toggles">
              <span class="admin-badge admin-content-bits-create-dialog__state-badge">草稿</span>
            </div>
          </div>
          <div class="admin-content-bits-create-dialog__buttons">
            <button class="admin-btn admin-btn--ghost admin-btn--compact" type="button" disabled={busy} onclick={closeDialog}>
              取消
            </button>
            <button class="admin-btn admin-btn--primary admin-btn--compact" type="submit" disabled={!canCreate}>
              创建
            </button>
          </div>
        </footer>
      </form>
    </div>
  </div>
{/if}

<div class="admin-content-action-feedback">
  <p class="admin-status admin-content-action-status" data-state={statusState} role="status" aria-live="polite" aria-atomic="true">
    {statusText}
  </p>
</div>
