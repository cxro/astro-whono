export type EditorOutlineTab = 'headings' | 'essays';

export type MarkdownOutlineItem = {
  key: string;
  level: 2 | 3;
  label: string;
  line: number;
  offset: number;
  labelStart: number;
  labelEnd: number;
};

export type MarkdownOutlineSelectionRange = {
  selectionStart: number;
  selectionEnd: number;
};

export type EditorOutlineListSourceItem = {
  entryId: string;
  title: string;
  editHref: string;
  dateLabel?: string;
  sourceError?: string | null;
};

export type EditorOutlineListItem = EditorOutlineListSourceItem & {
  active: boolean;
};

export type EditorOutlineEssaySourceItem = EditorOutlineListSourceItem;
export type EditorOutlineEssayListItem = EditorOutlineListItem;

type FenceState = {
  marker: '`' | '~';
  length: number;
};

type HeadingLabelResult = {
  label: string;
  startInRawLabel: number;
  endInRawLabel: number;
};

const FENCE_OPEN_RE = /^( {0,3})(`{3,}|~{3,})/;
const HEADING_RE = /^( {0,3})(#{2,3})(?!#)([ \t]*)(.*)$/;

const getLineEndLength = (source: string, lineEndIndex: number): number => {
  if (lineEndIndex < 0) return 0;
  return source[lineEndIndex] === '\r' && source[lineEndIndex + 1] === '\n' ? 2 : 1;
};

const getFenceOpen = (line: string): FenceState | null => {
  const match = FENCE_OPEN_RE.exec(line);
  if (!match) return null;

  const sequence = match[2] ?? '';
  const marker = sequence[0];
  if (marker !== '`' && marker !== '~') return null;

  return {
    marker,
    length: sequence.length
  };
};

const isFenceClose = (line: string, fence: FenceState): boolean => {
  const markerPattern = fence.marker === '`' ? '`' : '~';
  const closeRe = new RegExp(`^( {0,3})\\${markerPattern}{${fence.length},}[ \\t]*$`);
  return closeRe.test(line);
};

const parseHeadingLabel = (rawLabel: string): HeadingLabelResult | null => {
  const leadingWhitespace = rawLabel.match(/^[ \t]*/)?.[0].length ?? 0;
  const trailingWhitespace = rawLabel.match(/[ \t]*$/)?.[0].length ?? 0;
  let startInRawLabel = leadingWhitespace;
  let endInRawLabel = rawLabel.length - trailingWhitespace;
  let label = rawLabel.slice(startInRawLabel, endInRawLabel);

  if (!label || /^#+$/.test(label)) return null;

  const closingHashMatch = /[ \t]+#+$/.exec(label);
  if (closingHashMatch) {
    endInRawLabel = startInRawLabel + closingHashMatch.index;
    const nextTrailingWhitespace = rawLabel.slice(startInRawLabel, endInRawLabel).match(/[ \t]*$/)?.[0].length ?? 0;
    endInRawLabel -= nextTrailingWhitespace;
    label = rawLabel.slice(startInRawLabel, endInRawLabel);
  }

  if (!label || /^#+$/.test(label)) return null;

  return {
    label,
    startInRawLabel,
    endInRawLabel
  };
};

export const extractMarkdownOutline = (source: string): MarkdownOutlineItem[] => {
  const items: MarkdownOutlineItem[] = [];
  let offset = 0;
  let line = 1;
  let fence: FenceState | null = null;

  while (offset <= source.length) {
    const nextLineFeed = source.indexOf('\n', offset);
    const lineEndIndex = nextLineFeed === -1 ? source.length : nextLineFeed;
    const rawLine = source.slice(offset, lineEndIndex);
    const currentLine = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

    if (fence) {
      if (isFenceClose(currentLine, fence)) {
        fence = null;
      }
    } else {
      const nextFence = getFenceOpen(currentLine);
      if (nextFence) {
        fence = nextFence;
      } else {
        const headingMatch = HEADING_RE.exec(currentLine);
        if (headingMatch) {
          const indent = headingMatch[1] ?? '';
          const marker = headingMatch[2] ?? '';
          const separator = headingMatch[3] ?? '';
          const rawLabel = headingMatch[4] ?? '';
          const labelResult = separator.length === 0 && rawLabel.length > 0
            ? null
            : parseHeadingLabel(rawLabel);

          if (labelResult) {
            const rawLabelStart = offset + indent.length + marker.length + separator.length;
            const labelStart = rawLabelStart + labelResult.startInRawLabel;
            items.push({
              key: `${line}:${offset}`,
              level: marker.length as 2 | 3,
              label: labelResult.label,
              line,
              offset,
              labelStart,
              labelEnd: rawLabelStart + labelResult.endInRawLabel
            });
          }
        }
      }
    }

    if (nextLineFeed === -1) break;
    offset = lineEndIndex + getLineEndLength(source, lineEndIndex);
    line += 1;
  }

  return items;
};

export const getMarkdownOutlineSelectionRange = (
  source: string,
  item: Pick<MarkdownOutlineItem, 'offset' | 'labelStart' | 'labelEnd'>
): MarkdownOutlineSelectionRange => {
  const sourceLength = source.length;
  const selectionStart = Math.min(Math.max(0, item.labelStart), sourceLength);
  const selectionEnd = Math.min(Math.max(selectionStart, item.labelEnd), sourceLength);

  if (selectionStart !== selectionEnd) {
    return { selectionStart, selectionEnd };
  }

  const fallback = Math.min(Math.max(0, item.offset), sourceLength);
  return {
    selectionStart: fallback,
    selectionEnd: fallback
  };
};

const normalizeListText = (value: string): string => value.trim();

export const buildEditorOutlineListItems = (
  items: readonly EditorOutlineListSourceItem[],
  currentEntryId: string
): EditorOutlineListItem[] =>
  items.map((item) => {
    const entryId = normalizeListText(item.entryId);
    return {
      ...item,
      entryId,
      title: normalizeListText(item.title) || entryId,
      active: entryId === currentEntryId
    };
  });

export const buildEssayOutlineListItems = buildEditorOutlineListItems;
