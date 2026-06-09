<script lang="ts">
import type {
  AdminContentCollectionKey
} from '../../../lib/admin-console/content-collections';
import type {
  AdminContentWorkspaceEditorValues
} from '../../../lib/admin-console/content-editor-payload';
import { parseEssayDateInput } from '../../../utils/date-only';
import AdminEditorIcon from './AdminEditorIcon.svelte';
import FrontmatterTagsInput from './FrontmatterTagsInput.svelte';
import {
  isBitsEditorValues,
  isEssayEditorValues
} from './content-editor-adapters';

type AdminContentIssue = {
  path: string;
  message: string;
};

type Props = {
  value: AdminContentWorkspaceEditorValues;
  collection?: AdminContentCollectionKey;
  issues?: readonly AdminContentIssue[];
  disabled?: boolean;
  entryId?: string;
  showEntryId?: boolean;
  slugPlaceholder?: string;
  ariaLabel?: string;
  fieldScope?: 'all' | 'bits-summary';
  onEntryIdInput?: (value: string) => void;
  onDirty?: () => void;
};

let {
  value = $bindable(),
  collection = 'essay',
  issues = [],
  disabled = false,
  entryId = '',
  showEntryId = false,
  slugPlaceholder = '',
  ariaLabel = '内容字段',
  fieldScope = 'all',
  onEntryIdInput = () => {},
  onDirty = () => {}
}: Props = $props();

const getIssue = (path: string): string =>
  issues.find((issue) => issue.path === path)?.message ?? '';

const getIssueByPrefix = (prefix: string): string =>
  issues.find((issue) => issue.path.startsWith(prefix))?.message ?? '';

const padDatePart = (value: number): string => String(value).padStart(2, '0');

const formatLocalDateText = (date: Date): string => {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  return `${year}-${month}-${day}`;
};

const getLocalDateText = (): string => formatLocalDateText(new Date());

const getLocalTimezoneOffsetText = (date: Date): string => {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffsetMinutes = Math.abs(offsetMinutes);
  const hours = padDatePart(Math.floor(absoluteOffsetMinutes / 60));
  const minutes = padDatePart(absoluteOffsetMinutes % 60);
  return `${sign}${hours}:${minutes}`;
};

const formatLocalDateTimeWithZoneText = (date: Date): string => {
  const hours = padDatePart(date.getHours());
  const minutes = padDatePart(date.getMinutes());
  const seconds = padDatePart(date.getSeconds());
  return `${formatLocalDateText(date)}T${hours}:${minutes}:${seconds}${getLocalTimezoneOffsetText(date)}`;
};

const getPublishedAtResult = (value: string) => {
  const result = parseEssayDateInput(value);
  return result?.publishedAt ? result : null;
};

const getPublishedAtSyncDate = (value: string): string =>
  getPublishedAtResult(value)?.dateText ?? '';

const getEffectivePublishDateResult = (date: string, publishedAt: string) =>
  getPublishedAtResult(publishedAt) ?? parseEssayDateInput(date);

const getPublishedAtInputIssue = (value: string): string =>
  value.trim() && !getPublishedAtResult(value)
    ? '需填写带时区的合法 ISO 日期时间'
    : '';

const getUpdatedAtInputIssue = (value: string, date: string, publishedAt: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const result = parseEssayDateInput(trimmed);
  if (!result) {
    return '需填写 YYYY-MM-DD 或带时区的合法 ISO 日期时间';
  }

  const publishDateResult = getEffectivePublishDateResult(date, publishedAt);
  return publishDateResult && result.date.valueOf() < publishDateResult.date.valueOf()
    ? '更新日期不能早于发布日期'
    : '';
};

const publishedAtSyncDate = $derived(
  isEssayEditorValues(value) ? getPublishedAtSyncDate(value.publishedAt) : ''
);
const publishedAtSyncMessage = $derived(
  isEssayEditorValues(value) && publishedAtSyncDate && value.date !== publishedAtSyncDate
    ? `发布日期与详细时间不一致，保存后将自动更新发布日期为 ${publishedAtSyncDate}`
    : ''
);
const publishedAtIssue = $derived(
  getIssue('publishedAt') || (isEssayEditorValues(value) ? getPublishedAtInputIssue(value.publishedAt) : '')
);
const updatedAtIssue = $derived(
  getIssue('updatedAt') || (isEssayEditorValues(value) ? getUpdatedAtInputIssue(value.updatedAt, value.date, value.publishedAt) : '')
);

const setPublishedAtNow = () => {
  if (!isEssayEditorValues(value)) return;
  const now = new Date();
  value.date = formatLocalDateText(now);
  value.publishedAt = formatLocalDateTimeWithZoneText(now);
  onDirty?.();
};

const setUpdatedAtToday = () => {
  if (!isEssayEditorValues(value)) return;
  value.updatedAt = getLocalDateText();
  onDirty?.();
};

const bitsImagesIssue = $derived(getIssue('imagesText') || getIssueByPrefix('images['));
</script>

<aside class="admin-editor-frontmatter" aria-label={ariaLabel}>
  <div class="admin-editor-frontmatter__fields">
    {#if collection === 'essay' && isEssayEditorValues(value)}
      <label class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('title'))}>
        <span class="admin-field__label">文章标题</span>
        <input class="admin-field__control" name="title" type="text" bind:value={value.title} {disabled} />
        <p class="admin-content-editor__error" hidden={!getIssue('title')}>{getIssue('title')}</p>
      </label>

      {#if showEntryId}
        <label class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('entryId'))}>
          <span class="admin-field__label">源文件名</span>
          <input
            class="admin-field__control"
            name="entryId"
            type="text"
            value={entryId}
            spellcheck="false"
            {disabled}
            oninput={(event) => onEntryIdInput(event.currentTarget.value)}
          />
          <p class="admin-content-editor__error" hidden={!getIssue('entryId')}>{getIssue('entryId')}</p>
        </label>
      {/if}

      <div class="admin-editor-frontmatter__datetime-grid">
        <div class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('date'))}>
          <label class="admin-field__label" for="admin-essay-date">发布日期</label>
          <input id="admin-essay-date" class="admin-field__control" name="date" type="date" bind:value={value.date} {disabled} />
          <p class="admin-content-editor__error" hidden={!getIssue('date')}>{getIssue('date')}</p>
        </div>

        <div class="admin-field admin-content-editor__field" class:is-invalid={Boolean(publishedAtIssue)}>
          <div class="admin-editor-frontmatter__label-row admin-editor-frontmatter__label-row--with-action">
            <span class="admin-editor-frontmatter__label-help">
              <label class="admin-field__label" for="admin-essay-published-at">详细时间（可选）</label>
              <button
                class="admin-editor-frontmatter__hint-trigger"
                type="button"
                aria-label="详细时间说明"
                aria-describedby="admin-essay-published-at-tip"
              >
                <AdminEditorIcon name="info" size={13} strokeWidth={2} />
              </button>
              <span id="admin-essay-published-at-tip" class="admin-editor-frontmatter__tooltip" role="tooltip">
                按 ISO 日期时间填写，需包含时区，日期需与发布日期一致；留空时仅使用发布日期。
              </span>
            </span>
            <button
              class="admin-editor-frontmatter__text-action"
              type="button"
              onclick={setPublishedAtNow}
              disabled={disabled}
            >
              设为当前
            </button>
          </div>
          <input
            id="admin-essay-published-at"
            class="admin-field__control"
            name="publishedAt"
            type="text"
            bind:value={value.publishedAt}
            placeholder="2024-11-23T18:00:00+08:00"
            aria-describedby="admin-essay-published-at-tip"
            {disabled}
          />
        </div>

        <p class="admin-editor-frontmatter__note admin-editor-frontmatter__note--error admin-editor-frontmatter__note--wide" hidden={!publishedAtIssue}>
          {publishedAtIssue}
        </p>
        <p class="admin-editor-frontmatter__note admin-editor-frontmatter__note--wide" hidden={!publishedAtSyncMessage}>
          {publishedAtSyncMessage}
        </p>
      </div>

      <div class="admin-editor-frontmatter__datetime-grid">
        <label class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('badge'))}>
          <span class="admin-field__label">badge</span>
          <input class="admin-field__control" name="badge" type="text" bind:value={value.badge} {disabled} />
          <p class="admin-content-editor__error" hidden={!getIssue('badge')}>{getIssue('badge')}</p>
        </label>

        <div class="admin-field admin-content-editor__field" class:is-invalid={Boolean(updatedAtIssue)}>
          <div class="admin-editor-frontmatter__label-row admin-editor-frontmatter__label-row--with-action">
            <span class="admin-editor-frontmatter__label-help">
              <label class="admin-field__label" for="admin-essay-updated-at">更新日期（可选）</label>
              <button
                class="admin-editor-frontmatter__hint-trigger"
                type="button"
                aria-label="更新日期说明"
                aria-describedby="admin-essay-updated-at-tip"
              >
                <AdminEditorIcon name="info" size={13} strokeWidth={2} />
              </button>
              <span id="admin-essay-updated-at-tip" class="admin-editor-frontmatter__tooltip" role="tooltip">
                支持 YYYY-MM-DD 或 ISO 日期时间，需包含时区；填写后文章日期显示为“更新于：YYYY-MM-DD”。
              </span>
            </span>
            <button
              class="admin-editor-frontmatter__text-action"
              type="button"
              onclick={setUpdatedAtToday}
              disabled={disabled}
            >
              设为今日
            </button>
          </div>
          <input
            id="admin-essay-updated-at"
            class="admin-field__control"
            name="updatedAt"
            type="text"
            bind:value={value.updatedAt}
            placeholder="2026-01-02"
            aria-describedby="admin-essay-updated-at-tip"
            {disabled}
          />
        </div>

        <p class="admin-editor-frontmatter__note admin-editor-frontmatter__note--error admin-editor-frontmatter__note--wide" hidden={!updatedAtIssue}>
          {updatedAtIssue}
        </p>
      </div>

      <label class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('description'))}>
        <span class="admin-field__label">摘要</span>
        <textarea class="admin-field__control" name="description" bind:value={value.description} rows="3" {disabled}></textarea>
        <p class="admin-content-editor__error" hidden={!getIssue('description')}>{getIssue('description')}</p>
      </label>

      <div class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('slug'))}>
        <label class="admin-field__label" for="admin-essay-slug">公开 URL 别名（可选）</label>
        <input
          id="admin-essay-slug"
          class="admin-field__control"
          name="slug"
          type="text"
          bind:value={value.slug}
          placeholder={slugPlaceholder}
          spellcheck="false"
          {disabled}
        />
        <p class="admin-content-editor__error" hidden={!getIssue('slug')}>{getIssue('slug')}</p>
      </div>

      <label class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('cover'))}>
        <span class="admin-field__label">封面图</span>
        <input class="admin-field__control" name="cover" type="text" bind:value={value.cover} spellcheck="false" {disabled} />
        <p class="admin-content-editor__error" hidden={!getIssue('cover')}>{getIssue('cover')}</p>
      </label>

      <div class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('tags'))}>
        <label class="admin-field__label" for="admin-essay-tags">标签</label>
        <FrontmatterTagsInput
          id="admin-essay-tags"
          bind:value={value.tagsText}
          {disabled}
          invalid={Boolean(getIssue('tags'))}
          onDirty={onDirty}
        />
        <p class="admin-content-editor__error" hidden={!getIssue('tags')}>{getIssue('tags')}</p>
      </div>
    {:else if collection === 'bits' && isBitsEditorValues(value)}
      <label class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('title'))}>
        <span class="admin-field__label">title（可选）</span>
        <input class="admin-field__control" name="title" type="text" bind:value={value.title} oninput={onDirty} {disabled} />
        <p class="admin-content-editor__error" hidden={!getIssue('title')}>{getIssue('title')}</p>
      </label>

      {#if fieldScope !== 'bits-summary'}
        <label class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('date'))}>
          <span class="admin-field__label">date</span>
          <input class="admin-field__control" name="date" type="text" bind:value={value.date} {disabled} />
          <p class="admin-content-editor__error" hidden={!getIssue('date')}>{getIssue('date')}</p>
        </label>
      {/if}

      <label class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('authorName'))}>
        <span class="admin-field__label">author.name</span>
        <input class="admin-field__control" name="authorName" type="text" bind:value={value.authorName} oninput={onDirty} {disabled} />
        <p class="admin-content-editor__error" hidden={!getIssue('authorName')}>{getIssue('authorName')}</p>
      </label>

      <label class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('authorAvatar'))}>
        <span class="admin-field__label">author.avatar</span>
        <input class="admin-field__control" name="authorAvatar" type="text" bind:value={value.authorAvatar} spellcheck="false" oninput={onDirty} {disabled} />
        <p class="admin-content-editor__error" hidden={!getIssue('authorAvatar')}>{getIssue('authorAvatar')}</p>
      </label>

      <label class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('description'))}>
        <span class="admin-field__label">description</span>
        <textarea class="admin-field__control" name="description" bind:value={value.description} rows="3" oninput={onDirty} {disabled}></textarea>
        <p class="admin-content-editor__error" hidden={!getIssue('description')}>{getIssue('description')}</p>
      </label>

      {#if fieldScope !== 'bits-summary'}
        <div class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('tags'))}>
          <label class="admin-field__label" for="admin-bits-tags">tags</label>
          <FrontmatterTagsInput
            id="admin-bits-tags"
            bind:value={value.tagsText}
            {disabled}
            invalid={Boolean(getIssue('tags'))}
            onDirty={onDirty}
          />
          <p class="admin-content-editor__error" hidden={!getIssue('tags')}>{getIssue('tags')}</p>
        </div>

        <label class="admin-field admin-content-editor__field" class:is-invalid={Boolean(bitsImagesIssue)}>
          <span class="admin-field__label">images</span>
          <textarea class="admin-field__control" name="imagesText" bind:value={value.imagesText} rows="8" spellcheck="false" {disabled}></textarea>
          <p class="admin-content-editor__error" hidden={!bitsImagesIssue}>{bitsImagesIssue}</p>
        </label>
      {/if}
    {/if}
  </div>
</aside>
