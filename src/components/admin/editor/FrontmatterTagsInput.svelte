<script lang="ts">
import AdminEditorIcon from './AdminEditorIcon.svelte';

type Props = {
  id: string;
  value: string;
  inputName?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
  ariaDescribedby?: string | undefined;
  onDirty?: (() => void) | undefined;
};

let {
  id,
  value = $bindable(''),
  inputName = 'tagDraft',
  placeholder = '输入后回车',
  disabled = false,
  invalid = false,
  ariaLabel = '标签',
  ariaDescribedby,
  onDirty
}: Props = $props();

let inputValue = $state('');
let inputEl = $state<HTMLInputElement | null>(null);
let committedValue = $state(value);

const splitTagsText = (text: string): string[] =>
  text
    .split(/\r\n|\r|\n/)
    .map((tag) => tag.trim())
    .filter(Boolean);

const tags = $derived(splitTagsText(value));

const commitTags = (nextTags: readonly string[]) => {
  const nextValue = nextTags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .join('\n');
  if (nextValue === value) return;

  value = nextValue;
  committedValue = nextValue;
  onDirty?.();
};

const addTags = (rawTags: readonly string[]): boolean => {
  const nextTags = rawTags
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (nextTags.length === 0) return false;

  commitTags([...tags, ...nextTags]);
  return true;
};

const commitInput = (): boolean => {
  const added = addTags([inputValue]);
  if (added) inputValue = '';
  return added;
};

const removeTagAt = (index: number) => {
  commitTags(tags.filter((_, tagIndex) => tagIndex !== index));
  inputEl?.focus();
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    commitInput();
    return;
  }

  if (event.key === 'Backspace' && inputValue.length === 0 && tags.length > 0) {
    event.preventDefault();
    removeTagAt(tags.length - 1);
  }
};

const handlePaste = (event: ClipboardEvent) => {
  const clipboardText = event.clipboardData?.getData('text/plain') ?? '';
  if (!/\r|\n/.test(clipboardText)) return;

  event.preventDefault();
  const pastedTags = clipboardText.split(/\r\n|\r|\n/);
  const inputDraft = inputValue.trim();
  const added = addTags(inputDraft ? [inputDraft, ...pastedTags] : pastedTags);
  if (added) inputValue = '';
};

const focusInput = () => {
  if (disabled) return;
  inputEl?.focus();
};

const handleControlPointerdown = (event: PointerEvent) => {
  const target = event.target;
  if (target instanceof Element && target.closest('.admin-frontmatter-tags-input__remove')) return;
  if (event.target === inputEl) return;
  focusInput();
};

$effect(() => {
  if (value === committedValue) return;
  committedValue = value;
  inputValue = '';
});
</script>

<div
  class="admin-field__control admin-frontmatter-tags-input"
  data-disabled={disabled ? 'true' : undefined}
  data-invalid={invalid ? 'true' : undefined}
  aria-disabled={disabled ? 'true' : undefined}
  aria-label={ariaLabel}
  aria-describedby={ariaDescribedby}
  role="group"
  onpointerdown={handleControlPointerdown}
>
  {#each tags as tag, index (index)}
    <span class="admin-frontmatter-tags-input__item">
      <span class="admin-frontmatter-tags-input__item-text">{tag}</span>
      <button
        class="admin-frontmatter-tags-input__remove"
        type="button"
        aria-label={`删除标签 ${tag}`}
        disabled={disabled}
        onclick={(event) => {
          event.stopPropagation();
          removeTagAt(index);
        }}
      >
        <AdminEditorIcon name="close" size={12} strokeWidth={2.2} />
      </button>
    </span>
  {/each}

  <input
    bind:this={inputEl}
    id={id}
    class="admin-frontmatter-tags-input__input"
    name={inputName}
    type="text"
    bind:value={inputValue}
    {placeholder}
    spellcheck="false"
    autocomplete="off"
    aria-invalid={invalid ? 'true' : undefined}
    aria-describedby={ariaDescribedby}
    {disabled}
    onkeydown={handleKeydown}
    onpaste={handlePaste}
    onblur={commitInput}
  />
</div>
