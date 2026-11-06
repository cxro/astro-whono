export type MarkdownHeadingLevel = 2 | 3 | 4 | 5;
export type MarkdownCalloutType = 'note' | 'tip' | 'info' | 'warning';
export type MarkdownInsertPlacement = 'inline' | 'block';

export type MarkdownToolId =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'highlight'
  | 'spoiler'
  | 'quote'
  | 'link'
  | 'image'
  | 'code'
  | 'codeBlock'
  | 'inlineMath'
  | 'blockMath'
  | 'details'
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
      placement?: MarkdownInsertPlacement;
    }
  | {
      id: number;
      kind: 'replace';
      from: number;
      to: number;
      text: string;
      placement?: MarkdownInsertPlacement;
    };

export const buildMarkdownCalloutText = (calloutType: MarkdownCalloutType): string =>
  `\n:::${calloutType}[标题]\n内容\n:::\n`;
