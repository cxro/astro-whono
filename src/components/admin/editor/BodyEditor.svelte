<script lang="ts">
import {
  buildMarkdownCalloutText,
  getMarkdownShortcutTool,
  type MarkdownCalloutType,
  type MarkdownHeadingLevel,
  type MarkdownToolbarCommand,
  type MarkdownToolId
} from './markdown-tools';

type Props = {
  value: string;
  disabled?: boolean;
  toolbarCommand?: MarkdownToolbarCommand | null;
  onScrollElementChange?: (element: HTMLTextAreaElement | null) => void;
  onShortcutTool?: (toolId: MarkdownToolId) => void;
};

let {
  value = $bindable(''),
  disabled = false,
  toolbarCommand = null,
  onScrollElementChange,
  onShortcutTool
}: Props = $props();

let textareaEl = $state<HTMLTextAreaElement | null>(null);
let appliedToolbarCommandId = 0;

const focusTextarea = () => {
  textareaEl?.focus();
};

const commitTextareaValue = (nextSelectionStart: number, nextSelectionEnd = nextSelectionStart) => {
  if (!textareaEl) return;
  value = textareaEl.value;
  textareaEl.setSelectionRange(nextSelectionStart, nextSelectionEnd);
  focusTextarea();
};

const wrapSelection = (before: string, after: string, placeholder: string) => {
  if (!textareaEl) return;
  focusTextarea();

  const start = textareaEl.selectionStart ?? 0;
  const end = textareaEl.selectionEnd ?? start;
  const selected = start === end ? placeholder : value.slice(start, end);
  const next = `${before}${selected}${after}`;
  const innerStart = start + before.length;
  const innerEnd = innerStart + selected.length;

  textareaEl.setRangeText(next, start, end, 'select');
  commitTextareaValue(innerStart, innerEnd);
};

const wrapBlockSelection = (before: string, after: string, placeholder: string) => {
  if (!textareaEl) return;
  focusTextarea();

  const start = textareaEl.selectionStart ?? 0;
  const end = textareaEl.selectionEnd ?? start;
  const selected = start === end ? placeholder : value.slice(start, end);
  const previousChar = start > 0 ? value[start - 1] : '\n';
  const nextChar = end < value.length ? value[end] : '\n';
  const lead = previousChar === '\n' ? '' : '\n';
  const trail = nextChar === '\n' ? '' : '\n';
  const next = `${lead}${before}${selected}${after}${trail}`;
  const innerStart = start + lead.length + before.length;
  const innerEnd = innerStart + selected.length;

  textareaEl.setRangeText(next, start, end, 'select');
  commitTextareaValue(innerStart, innerEnd);
};

const toggleLinePrefix = (prefix: string) => {
  if (!textareaEl) return;
  focusTextarea();

  const start = textareaEl.selectionStart ?? 0;
  const end = textareaEl.selectionEnd ?? start;
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndIndex = value.indexOf('\n', end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const segment = value.slice(lineStart, lineEnd);
  const lines = segment.split('\n');
  const shouldRemove = segment.length > 0 && lines.every((line) => line.length === 0 || line.startsWith(prefix));
  const next = lines
    .map((line) => {
      if (shouldRemove) return line.startsWith(prefix) ? line.slice(prefix.length) : line;
      return `${prefix}${line}`;
    })
    .join('\n');

  textareaEl.setRangeText(next, lineStart, lineEnd, 'select');
  commitTextareaValue(lineStart, lineStart + next.length);
};

const setHeadingLevel = (level: MarkdownHeadingLevel) => {
  if (!textareaEl) return;
  focusTextarea();

  const prefix = `${'#'.repeat(level)} `;
  const start = textareaEl.selectionStart ?? 0;
  const end = textareaEl.selectionEnd ?? start;
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndIndex = value.indexOf('\n', end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const segment = value.slice(lineStart, lineEnd);
  const next = segment
    .split('\n')
    .map((line) => {
      const headingMatch = line.match(/^( {0,3})#{1,6}(?:[ \t]+(.*))?$/);
      if (headingMatch) {
        const [, indent, text] = headingMatch;
        return `${indent}${prefix}${text ?? ''}`;
      }

      const leadingWhitespace = line.match(/^\s*/)?.[0] ?? '';
      const leadingSpaces = line.match(/^ */)?.[0] ?? '';
      if (leadingWhitespace.includes('\t') || leadingSpaces.length > 3) {
        const strippedLine = line.replace(/^\s+/, '');
        return `${prefix}${strippedLine.replace(/^#{1,6}\s+/, '')}`;
      }

      return `${leadingSpaces}${prefix}${line.slice(leadingSpaces.length)}`;
    })
    .join('\n');

  textareaEl.setRangeText(next, lineStart, lineEnd, 'select');
  commitTextareaValue(lineStart, lineStart + next.length);
};

const insertCallout = (calloutType: MarkdownCalloutType) => {
  insertText(buildMarkdownCalloutText(calloutType));
};

const toggleOrderedList = () => {
  if (!textareaEl) return;
  focusTextarea();

  const start = textareaEl.selectionStart ?? 0;
  const end = textareaEl.selectionEnd ?? start;
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndIndex = value.indexOf('\n', end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const segment = value.slice(lineStart, lineEnd);
  const lines = segment.split('\n');
  const shouldRemove = segment.length > 0 && lines.every((line) => line.length === 0 || /^\d+\.\s+/.test(line));
  const next = lines
    .map((line, index) => {
      if (shouldRemove) return line.replace(/^\d+\.\s+/, '');
      return `${index + 1}. ${line}`;
    })
    .join('\n');

  textareaEl.setRangeText(next, lineStart, lineEnd, 'select');
  commitTextareaValue(lineStart, lineStart + next.length);
};

const insertText = (text: string) => {
  if (!textareaEl) return;
  focusTextarea();

  const start = textareaEl.selectionStart ?? 0;
  const end = textareaEl.selectionEnd ?? start;
  textareaEl.setRangeText(text, start, end, 'end');
  commitTextareaValue(start + text.length);
};

const applyMarkdownTool = (toolId: MarkdownToolId) => {
  if (disabled) return;

  switch (toolId) {
    case 'bold':
      wrapSelection('**', '**', 'text');
      break;
    case 'italic':
      wrapSelection('*', '*', 'text');
      break;
    case 'strikethrough':
      wrapSelection('~~', '~~', 'text');
      break;
    case 'code':
      wrapSelection('`', '`', 'code');
      break;
    case 'quote':
      toggleLinePrefix('> ');
      break;
    case 'link':
      wrapSelection('[', '](url)', 'text');
      break;
    case 'image':
      break;
    case 'codeBlock':
      wrapBlockSelection('```text\n', '\n```', 'code');
      break;
    case 'list':
      toggleLinePrefix('- ');
      break;
    case 'orderedList':
      toggleOrderedList();
      break;
    case 'taskList':
      toggleLinePrefix('- [ ] ');
      break;
    case 'table':
      insertText('\n| Column | Column |\n| --- | --- |\n| Cell | Cell |\n');
      break;
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  if (disabled) return;

  const toolId = getMarkdownShortcutTool(event);
  if (!toolId) return;

  event.preventDefault();
  if (onShortcutTool) {
    onShortcutTool(toolId);
    return;
  }

  applyMarkdownTool(toolId);
};

$effect(() => {
  const command = toolbarCommand;
  if (!command || command.id === appliedToolbarCommandId) return;

  appliedToolbarCommandId = command.id;
  if (command.kind === 'insert') {
    insertText(command.text);
  } else if (command.kind === 'heading') {
    setHeadingLevel(command.level);
  } else if (command.kind === 'callout') {
    insertCallout(command.calloutType);
  } else {
    applyMarkdownTool(command.toolId);
  }
});

$effect(() => {
  onScrollElementChange?.(textareaEl);

  return () => {
    onScrollElementChange?.(null);
  };
});
</script>

<section class="admin-editor-body" aria-label="Markdown body editor">
  <label class="admin-field admin-editor-body__field">
    <span class="admin-sr-only">Markdown 正文</span>
    <textarea
      class="admin-field__control admin-editor-body__textarea"
      name="body"
      bind:value
      bind:this={textareaEl}
      spellcheck="false"
      {disabled}
      onkeydown={handleKeydown}
    ></textarea>
  </label>
</section>
