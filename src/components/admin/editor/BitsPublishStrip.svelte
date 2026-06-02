<script lang="ts">
import type { AdminBitsEditorValues } from '../../../lib/admin-console/content-shared';
import type { AdminContentIssue } from './content-editor-client';
import AdminEditorIcon from './AdminEditorIcon.svelte';
import {
  mergeBitsPublishTagsText,
  splitBitsPublishTagsText
} from './bits-publish-tags';

type Props = {
  value: AdminBitsEditorValues;
  issues?: readonly AdminContentIssue[];
  disabled?: boolean;
  onDirty?: () => void;
};

let {
  value = $bindable(),
  issues = [],
  disabled = false,
  onDirty
}: Props = $props();

const DEFAULT_BITS_DATETIME_OFFSET = '+08:00';
const BITS_DATETIME_RE = /^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const pad2 = (value: number): string => String(value).padStart(2, '0');

let currentDateTimeUndoValue = $state<string | null>(null);
let currentDateTimeAppliedValue = $state<string | null>(null);

const normalizeOffset = (offset: string | undefined): string => {
  if (!offset) return DEFAULT_BITS_DATETIME_OFFSET;
  if (offset === 'Z') return offset;
  return offset.includes(':') ? offset : `${offset.slice(0, 3)}:${offset.slice(3)}`;
};

const getDateTimeParts = (dateText: string) => {
  const match = dateText.trim().match(BITS_DATETIME_RE);
  return {
    date: match?.[1] ?? '',
    time: match?.[2] ?? '',
    offset: normalizeOffset(match?.[3])
  };
};

const buildDateTimeText = (dateText: string, timeText: string, offset: string): string => {
  if (!dateText) return '';
  return `${dateText}T${timeText || '00:00'}:00${offset}`;
};

const formatDateOffset = (date: Date): string => {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  return `${sign}${pad2(Math.floor(absoluteOffset / 60))}:${pad2(absoluteOffset % 60)}`;
};

const formatLocalBitsDateTime = (date = new Date()): string => {
  const dateText = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const timeText = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  return buildDateTimeText(dateText, timeText, formatDateOffset(date));
};

const dateTimeParts = $derived(getDateTimeParts(value.date));
const tagsParts = $derived(splitBitsPublishTagsText(value.tagsText));
const getIssue = (path: string): string =>
  issues.find((issue) => issue.path === path)?.message ?? '';
const dateIssue = $derived(getIssue('date'));
const tagsIssue = $derived(getIssue('tags'));
const currentDateTimeApplied = $derived(
  currentDateTimeUndoValue !== null && currentDateTimeAppliedValue === value.date
);

const updateValue = <TKey extends keyof AdminBitsEditorValues>(
  key: TKey,
  nextValue: AdminBitsEditorValues[TKey]
) => {
  value = {
    ...value,
    [key]: nextValue
  };
  onDirty?.();
};

const clearCurrentDateTimeUndo = () => {
  currentDateTimeUndoValue = null;
  currentDateTimeAppliedValue = null;
};

const updateDatePart = (nextDate: string) => {
  clearCurrentDateTimeUndo();
  updateValue('date', buildDateTimeText(nextDate.trim(), dateTimeParts.time, dateTimeParts.offset));
};

const updateTimePart = (nextTime: string) => {
  clearCurrentDateTimeUndo();
  updateValue('date', buildDateTimeText(dateTimeParts.date, nextTime.trim(), dateTimeParts.offset));
};

const updateLocationText = (nextLocation: string) => {
  updateValue('tagsText', mergeBitsPublishTagsText(nextLocation, tagsParts.inlineTagsText));
};

const updateInlineTagsText = (nextTags: string) => {
  updateValue('tagsText', mergeBitsPublishTagsText(tagsParts.locationText, nextTags));
};

const useCurrentDateTime = () => {
  const nextValue = formatLocalBitsDateTime();
  currentDateTimeUndoValue = value.date;
  currentDateTimeAppliedValue = nextValue;
  updateValue('date', nextValue);
};

const undoCurrentDateTime = () => {
  if (currentDateTimeUndoValue === null) return;
  const previousValue = currentDateTimeUndoValue;
  clearCurrentDateTimeUndo();
  updateValue('date', previousValue);
};
</script>

<section class="admin-bits-publish" aria-label="发布信息">
  <div class="admin-bits-publish-strip" aria-label="发布属性">
    <div class="admin-bits-publish-time-group" aria-label="发布时间">
      <label class="admin-bits-publish-field admin-bits-publish-field--date" class:is-invalid={Boolean(dateIssue)}>
        <span class="admin-bits-publish-field__label">日期</span>
        <input
          class="admin-bits-publish-field__control"
          type="date"
          value={dateTimeParts.date}
          {disabled}
          aria-invalid={dateIssue ? 'true' : undefined}
          oninput={(event) => updateDatePart(event.currentTarget.value)}
        />
      </label>

      <label class="admin-bits-publish-field admin-bits-publish-field--time" class:is-invalid={Boolean(dateIssue)}>
        <span class="admin-bits-publish-field__label">时间</span>
        <input
          class="admin-bits-publish-field__control"
          type="time"
          value={dateTimeParts.time}
          {disabled}
          aria-invalid={dateIssue ? 'true' : undefined}
          oninput={(event) => updateTimePart(event.currentTarget.value)}
        />
      </label>

      <div class="admin-bits-publish-current" aria-label="写入当前时间快捷操作">
        <button
          class="admin-bits-publish-current__text"
          class:is-active={currentDateTimeApplied}
          type="button"
          {disabled}
          title={currentDateTimeApplied ? '重新写入当前日期和时间' : '写入当前日期和时间'}
          onclick={useCurrentDateTime}
        >写入当前时间</button>

        {#if currentDateTimeApplied}
          <button
            class="admin-bits-publish-current__icon"
            type="button"
            {disabled}
            title="撤回当前时间"
            aria-label="撤回当前时间"
            onclick={undoCurrentDateTime}
          >
            <AdminEditorIcon name="undo-2" size={14} strokeWidth={2.1} />
          </button>
        {/if}
      </div>
    </div>

    <div class="admin-bits-publish-tags-group" aria-label="标签与地点">
      <label class="admin-bits-publish-field admin-bits-publish-field--tags" class:is-invalid={Boolean(tagsIssue)}>
        <span class="admin-bits-publish-field__label">标签</span>
        <input
          class="admin-bits-publish-field__control"
          type="text"
          value={tagsParts.inlineTagsText}
          {disabled}
          placeholder="#摄影 #建筑"
          aria-invalid={tagsIssue ? 'true' : undefined}
          oninput={(event) => updateInlineTagsText(event.currentTarget.value)}
        />
      </label>

      <label class="admin-bits-publish-field admin-bits-publish-field--location" class:is-invalid={Boolean(tagsIssue)}>
        <span class="admin-bits-publish-field__label">地点</span>
        <input
          class="admin-bits-publish-field__control"
          type="text"
          value={tagsParts.locationText}
          {disabled}
          placeholder="(可选)"
          aria-invalid={tagsIssue ? 'true' : undefined}
          oninput={(event) => updateLocationText(event.currentTarget.value)}
        />
      </label>
    </div>
  </div>
</section>
