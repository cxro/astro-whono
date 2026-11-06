import {
  buildMarkdownCalloutText,
  type MarkdownHeadingLevel,
  type MarkdownToolbarCommand,
  type MarkdownToolId
} from './markdown-tools';
import {
  MARKDOWN_DETAILS_BODY_PLACEHOLDER,
  MARKDOWN_DETAILS_SUMMARY_PLACEHOLDER,
  buildMarkdownDetailsText,
  getMarkdownDirectiveFence
} from './insert-tools';

export type EditorTextSelection = {
  from: number;
  to: number;
};

export type MarkdownTextEdit = {
  from: number;
  to: number;
  insert: string;
  selection: EditorTextSelection;
};

const clampOffset = (value: string, offset: number): number =>
  Math.min(value.length, Math.max(0, Number.isFinite(offset) ? offset : 0));

const getBoundedSelection = (value: string, selection: EditorTextSelection): EditorTextSelection => {
  const from = clampOffset(value, Math.min(selection.from, selection.to));
  const to = clampOffset(value, Math.max(selection.from, selection.to));
  return { from, to };
};

const normalizeMarkdownInsert = (value: string): string =>
  value.replace(/\r\n?/g, '\n');

const createNoopEdit = (value: string, selection: EditorTextSelection): MarkdownTextEdit => {
  const boundedSelection = getBoundedSelection(value, selection);
  return {
    from: boundedSelection.from,
    to: boundedSelection.from,
    insert: '',
    selection: boundedSelection
  };
};

const replaceRange = (
  from: number,
  to: number,
  insert: string,
  selection: EditorTextSelection
): MarkdownTextEdit => ({
  from,
  to,
  insert: normalizeMarkdownInsert(insert),
  selection
});

const getSelectedText = (value: string, selection: EditorTextSelection, placeholder: string): string =>
  selection.from === selection.to ? placeholder : value.slice(selection.from, selection.to);

const getSelectedLineRange = (value: string, selection: EditorTextSelection) => {
  const lineStart = value.lastIndexOf('\n', Math.max(0, selection.from - 1)) + 1;
  const lineEndIndex = value.indexOf('\n', selection.to);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  return { lineStart, lineEnd };
};

const wrapSelection = (
  value: string,
  selection: EditorTextSelection,
  before: string,
  after: string,
  placeholder: string
): MarkdownTextEdit => {
  const boundedSelection = getBoundedSelection(value, selection);
  const selected = getSelectedText(value, boundedSelection, placeholder);
  const insert = `${before}${selected}${after}`;
  const innerStart = boundedSelection.from + before.length;
  const innerEnd = innerStart + selected.length;

  return replaceRange(boundedSelection.from, boundedSelection.to, insert, {
    from: innerStart,
    to: innerEnd
  });
};

const wrapBlockSelection = (
  value: string,
  selection: EditorTextSelection,
  before: string,
  after: string,
  placeholder: string
): MarkdownTextEdit => {
  const boundedSelection = getBoundedSelection(value, selection);
  const selected = getSelectedText(value, boundedSelection, placeholder);
  const previousChar = boundedSelection.from > 0 ? value[boundedSelection.from - 1] : '\n';
  const nextChar = boundedSelection.to < value.length ? value[boundedSelection.to] : '\n';
  const lead = previousChar === '\n' ? '' : '\n';
  const trail = nextChar === '\n' ? '' : '\n';
  const insert = `${lead}${before}${selected}${after}${trail}`;
  const innerStart = boundedSelection.from + lead.length + before.length;
  const innerEnd = innerStart + selected.length;

  return replaceRange(boundedSelection.from, boundedSelection.to, insert, {
    from: innerStart,
    to: innerEnd
  });
};

const toggleLinePrefix = (
  value: string,
  selection: EditorTextSelection,
  prefix: string
): MarkdownTextEdit => {
  const boundedSelection = getBoundedSelection(value, selection);
  const { lineStart, lineEnd } = getSelectedLineRange(value, boundedSelection);
  const segment = value.slice(lineStart, lineEnd);
  const lines = segment.split('\n');
  const shouldRemove = segment.length > 0 && lines.every((line) => line.length === 0 || line.startsWith(prefix));
  const insert = lines
    .map((line) => {
      if (shouldRemove) return line.startsWith(prefix) ? line.slice(prefix.length) : line;
      return `${prefix}${line}`;
    })
    .join('\n');

  return replaceRange(lineStart, lineEnd, insert, {
    from: lineStart,
    to: lineStart + insert.length
  });
};

const setHeadingLevel = (
  value: string,
  selection: EditorTextSelection,
  level: MarkdownHeadingLevel
): MarkdownTextEdit => {
  const boundedSelection = getBoundedSelection(value, selection);
  const prefix = `${'#'.repeat(level)} `;
  const { lineStart, lineEnd } = getSelectedLineRange(value, boundedSelection);
  const segment = value.slice(lineStart, lineEnd);
  const insert = segment
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

  return replaceRange(lineStart, lineEnd, insert, {
    from: lineStart,
    to: lineStart + insert.length
  });
};

const toggleOrderedList = (
  value: string,
  selection: EditorTextSelection
): MarkdownTextEdit => {
  const boundedSelection = getBoundedSelection(value, selection);
  const { lineStart, lineEnd } = getSelectedLineRange(value, boundedSelection);
  const segment = value.slice(lineStart, lineEnd);
  const lines = segment.split('\n');
  const shouldRemove = segment.length > 0 && lines.every((line) => line.length === 0 || /^\d+\.\s+/.test(line));
  const insert = lines
    .map((line, index) => {
      if (shouldRemove) return line.replace(/^\d+\.\s+/, '');
      return `${index + 1}. ${line}`;
    })
    .join('\n');

  return replaceRange(lineStart, lineEnd, insert, {
    from: lineStart,
    to: lineStart + insert.length
  });
};

export const insertMarkdownText = (
  value: string,
  selection: EditorTextSelection,
  text: string
): MarkdownTextEdit => {
  const boundedSelection = getBoundedSelection(value, selection);
  const insert = normalizeMarkdownInsert(text);
  return replaceRange(boundedSelection.from, boundedSelection.to, insert, {
    from: boundedSelection.from + insert.length,
    to: boundedSelection.from + insert.length
  });
};

const getMarkdownBlockLead = (before: string): string => {
  if (before.length === 0 || before.endsWith('\n\n')) return '';
  return before.endsWith('\n') ? '\n' : '\n\n';
};

const getMarkdownBlockTrail = (after: string): string => {
  if (after.length === 0) return '\n';
  if (after.startsWith('\n\n')) return '';
  return after.startsWith('\n') ? '\n' : '\n\n';
};

const trimMarkdownBoundaryNewlines = (value: string): string =>
  value.replace(/^\n+|\n+$/g, '');

export const insertMarkdownBlock = (
  value: string,
  selection: EditorTextSelection,
  text: string
): MarkdownTextEdit => {
  const boundedSelection = getBoundedSelection(value, selection);
  const block = normalizeMarkdownInsert(text).trim();
  if (!block) return createNoopEdit(value, boundedSelection);

  const before = value.slice(0, boundedSelection.from);
  const after = value.slice(boundedSelection.to);
  const lead = getMarkdownBlockLead(before);
  const trail = getMarkdownBlockTrail(after);
  const insert = `${lead}${block}${trail}`;
  const cursor = boundedSelection.from + insert.length;

  return replaceRange(boundedSelection.from, boundedSelection.to, insert, {
    from: cursor,
    to: cursor
  });
};

const insertMarkdownDetailsBlock = (
  value: string,
  selection: EditorTextSelection
): MarkdownTextEdit => {
  const boundedSelection = getBoundedSelection(value, selection);
  const selected = boundedSelection.from === boundedSelection.to
    ? MARKDOWN_DETAILS_BODY_PLACEHOLDER
    : trimMarkdownBoundaryNewlines(
        normalizeMarkdownInsert(value.slice(boundedSelection.from, boundedSelection.to))
      );
  const block = buildMarkdownDetailsText(selected || MARKDOWN_DETAILS_BODY_PLACEHOLDER);
  const before = value.slice(0, boundedSelection.from);
  const after = value.slice(boundedSelection.to);
  const lead = getMarkdownBlockLead(before);
  const trail = getMarkdownBlockTrail(after);
  const insert = `${lead}${block}${trail}`;
  const summaryOffset = insert.indexOf(MARKDOWN_DETAILS_SUMMARY_PLACEHOLDER);
  const summaryStart = boundedSelection.from + summaryOffset;

  return replaceRange(boundedSelection.from, boundedSelection.to, insert, {
    from: summaryStart,
    to: summaryStart + MARKDOWN_DETAILS_SUMMARY_PLACEHOLDER.length
  });
};

// 单行选区用行内 :spoiler[...]，多行选区包成 :::spoiler 块。
const wrapSpoilerSelection = (value: string, selection: EditorTextSelection): MarkdownTextEdit => {
  const boundedSelection = getBoundedSelection(value, selection);
  const selected = value.slice(boundedSelection.from, boundedSelection.to);
  if (!selected.includes('\n')) {
    return wrapSelection(value, boundedSelection, ':spoiler[', ']', 'text');
  }
  const fence = getMarkdownDirectiveFence(selected);
  return wrapBlockSelection(value, boundedSelection, `${fence}spoiler\n`, `\n${fence}`, 'text');
};

export const replaceMarkdownText = (
  value: string,
  range: EditorTextSelection,
  text: string,
  placement?: 'inline' | 'block'
): MarkdownTextEdit => {
  if (placement === 'block') {
    return insertMarkdownBlock(value, range, text);
  }
  return insertMarkdownText(value, range, text);
};

export const applyMarkdownToolToText = (
  value: string,
  selection: EditorTextSelection,
  toolId: MarkdownToolId
): MarkdownTextEdit => {
  switch (toolId) {
    case 'bold':
      return wrapSelection(value, selection, '**', '**', 'text');
    case 'italic':
      return wrapSelection(value, selection, '*', '*', 'text');
    case 'strikethrough':
      return wrapSelection(value, selection, '~~', '~~', 'text');
    case 'highlight':
      return wrapSelection(value, selection, '==', '==', 'text');
    case 'spoiler':
      return wrapSpoilerSelection(value, selection);
    case 'code':
      return wrapSelection(value, selection, '`', '`', 'code');
    case 'quote':
      return toggleLinePrefix(value, selection, '> ');
    case 'link':
      return wrapSelection(value, selection, '[', '](url)', 'text');
    case 'image':
      return createNoopEdit(value, selection);
    case 'codeBlock':
      return wrapBlockSelection(value, selection, '```text\n', '\n```', 'code');
    case 'inlineMath':
      return wrapSelection(value, selection, '$$', '$$', 'x');
    case 'blockMath':
      return wrapBlockSelection(value, selection, '$$\n', '\n$$', 'x');
    case 'details':
      return insertMarkdownDetailsBlock(value, selection);
    case 'list':
      return toggleLinePrefix(value, selection, '- ');
    case 'orderedList':
      return toggleOrderedList(value, selection);
    case 'taskList':
      return toggleLinePrefix(value, selection, '- [ ] ');
    case 'table':
      return insertMarkdownText(value, selection, '\n| Column | Column |\n| --- | --- |\n| Cell | Cell |\n');
  }
};

export const applyMarkdownToolbarCommandToText = (
  value: string,
  selection: EditorTextSelection,
  command: MarkdownToolbarCommand
): MarkdownTextEdit => {
  if (command.kind === 'replace') {
    return replaceMarkdownText(
      value,
      { from: command.from, to: command.to },
      command.text,
      command.placement
    );
  }
  if (command.kind === 'insert') {
    if (command.placement === 'block') {
      return insertMarkdownBlock(value, selection, command.text);
    }
    return insertMarkdownText(value, selection, command.text);
  }
  if (command.kind === 'heading') {
    return setHeadingLevel(value, selection, command.level);
  }
  if (command.kind === 'callout') {
    return insertMarkdownText(value, selection, buildMarkdownCalloutText(command.calloutType));
  }
  return applyMarkdownToolToText(value, selection, command.toolId);
};
