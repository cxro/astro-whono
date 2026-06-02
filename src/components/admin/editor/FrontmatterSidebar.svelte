<script lang="ts">
import type {
  AdminContentEditorValues,
  AdminContentWriteCollectionKey
} from '../../../lib/admin-console/content-shared';
import AdminEditorIcon from './AdminEditorIcon.svelte';
import {
  isBitsEditorValues,
  isEssayEditorValues
} from './content-editor-adapters';

type AdminContentIssue = {
  path: string;
  message: string;
};

type Props = {
  value: AdminContentEditorValues;
  collection?: AdminContentWriteCollectionKey;
  issues?: readonly AdminContentIssue[];
  disabled?: boolean;
  slugPlaceholder?: string;
  ariaLabel?: string;
  fieldScope?: 'all' | 'bits-summary';
  onDirty?: () => void;
};

let {
  value = $bindable(),
  collection = 'essay',
  issues = [],
  disabled = false,
  slugPlaceholder = '',
  ariaLabel = '内容字段',
  fieldScope = 'all',
  onDirty
}: Props = $props();

const getIssue = (path: string): string =>
  issues.find((issue) => issue.path === path)?.message ?? '';

const getIssueByPrefix = (prefix: string): string =>
  issues.find((issue) => issue.path.startsWith(prefix))?.message ?? '';

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

      <div class="admin-editor-frontmatter__datetime-grid">
        <div class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('date'))}>
          <label class="admin-field__label" for="admin-essay-date">发布日期</label>
          <input id="admin-essay-date" class="admin-field__control" name="date" type="date" bind:value={value.date} {disabled} />
          <p class="admin-content-editor__error" hidden={!getIssue('date')}>{getIssue('date')}</p>
        </div>

        <div class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('publishedAt'))}>
          <div class="admin-editor-frontmatter__label-row">
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
              按 ISO 格式填写，需包含时区；留空时仅使用发布日期。
            </span>
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
          <p class="admin-content-editor__error" hidden={!getIssue('publishedAt')}>{getIssue('publishedAt')}</p>
        </div>
      </div>

      <label class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('badge'))}>
        <span class="admin-field__label">badge</span>
        <input class="admin-field__control" name="badge" type="text" bind:value={value.badge} {disabled} />
        <p class="admin-content-editor__error" hidden={!getIssue('badge')}>{getIssue('badge')}</p>
      </label>

      <label class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('description'))}>
        <span class="admin-field__label">摘要</span>
        <textarea class="admin-field__control" name="description" bind:value={value.description} rows="3" {disabled}></textarea>
        <p class="admin-content-editor__error" hidden={!getIssue('description')}>{getIssue('description')}</p>
      </label>

      <label class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('slug'))}>
        <span class="admin-field__label">自定义路径</span>
        <input class="admin-field__control" name="slug" type="text" bind:value={value.slug} placeholder={slugPlaceholder} spellcheck="false" {disabled} />
        <p class="admin-content-editor__error" hidden={!getIssue('slug')}>{getIssue('slug')}</p>
      </label>

      <label class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('cover'))}>
        <span class="admin-field__label">封面图</span>
        <input class="admin-field__control" name="cover" type="text" bind:value={value.cover} spellcheck="false" {disabled} />
        <p class="admin-content-editor__error" hidden={!getIssue('cover')}>{getIssue('cover')}</p>
      </label>

      <label class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('tags'))}>
        <span class="admin-field__label">标签（每行一个）</span>
        <textarea class="admin-field__control" name="tags" bind:value={value.tagsText} rows="3" spellcheck="false" {disabled}></textarea>
        <p class="admin-content-editor__error" hidden={!getIssue('tags')}>{getIssue('tags')}</p>
      </label>
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
        <label class="admin-field admin-content-editor__field" class:is-invalid={Boolean(getIssue('tags'))}>
          <span class="admin-field__label">tags（每行一个）</span>
          <textarea class="admin-field__control" name="tags" bind:value={value.tagsText} rows="3" spellcheck="false" {disabled}></textarea>
          <p class="admin-content-editor__error" hidden={!getIssue('tags')}>{getIssue('tags')}</p>
        </label>

        <label class="admin-field admin-content-editor__field" class:is-invalid={Boolean(bitsImagesIssue)}>
          <span class="admin-field__label">images</span>
          <textarea class="admin-field__control" name="imagesText" bind:value={value.imagesText} rows="8" spellcheck="false" {disabled}></textarea>
          <p class="admin-content-editor__error" hidden={!bitsImagesIssue}>{bitsImagesIssue}</p>
        </label>
      {/if}
    {/if}
  </div>
</aside>
