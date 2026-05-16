export type MarkdownHeadingLevel = 2 | 3 | 4 | 5;
export type MarkdownCalloutType = 'note' | 'tip' | 'info' | 'warning';

export type MarkdownToolId =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'quote'
  | 'link'
  | 'image'
  | 'code'
  | 'codeBlock'
  | 'list'
  | 'orderedList'
  | 'taskList'
  | 'table';

export type MarkdownToolbarCommand =
  | {
      id: number;
      kind: 'tool';
      toolId: MarkdownToolId;
    }
  | {
      id: number;
      kind: 'heading';
      level: MarkdownHeadingLevel;
    }
  | {
      id: number;
      kind: 'callout';
      calloutType: MarkdownCalloutType;
    }
  | {
      id: number;
      kind: 'insert';
      text: string;
    };

export type MarkdownShortcutKeyState = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
};

export const getMarkdownShortcutTool = (event: MarkdownShortcutKeyState): MarkdownToolId | null => {
  if ((!event.ctrlKey && !event.metaKey) || event.altKey) return null;

  const key = event.key.toLowerCase();
  if (event.shiftKey) return null;
  if (key === 'b') return 'bold';
  if (key === 'i') return 'italic';
  if (key === 'k') return 'link';
  return null;
};

export const buildMarkdownCalloutText = (calloutType: MarkdownCalloutType): string =>
  `\n:::${calloutType}[标题]\n内容\n:::\n`;
