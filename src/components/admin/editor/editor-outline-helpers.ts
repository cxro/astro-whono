import type { MarkdownOutlineItem } from '../../../lib/admin-console/editor-outline';

export {
  buildEditorOutlineListItems,
  buildEssayOutlineListItems,
  extractMarkdownOutline,
  getMarkdownOutlineSelectionRange
} from '../../../lib/admin-console/editor-outline';

export type {
  EditorOutlineListItem,
  EditorOutlineListSourceItem,
  EditorOutlineEssayListItem,
  EditorOutlineEssaySourceItem,
  EditorOutlineTab,
  MarkdownOutlineItem,
  MarkdownOutlineSelectionRange
} from '../../../lib/admin-console/editor-outline';

export type MarkdownOutlineJumpCommand = {
  id: number;
  item: MarkdownOutlineItem;
  targetOffsetRatio?: number;
};
