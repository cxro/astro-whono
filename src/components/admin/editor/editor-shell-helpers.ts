import {
  isRecord,
  type AdminContentWriteResult
} from '../../../scripts/admin-content/entry-transport';
import type { EditorOutlineTab } from './editor-outline-helpers';

export type StatusState = 'idle' | 'loading' | 'ready' | 'ok' | 'warn' | 'error';
export type EditorScrollSource = 'body' | 'preview';
export type EditorLayoutMode = 'stacked' | 'split';
export type EditorViewMode = 'both' | 'edit' | 'preview';
export type EditorPaneMode = Exclude<EditorViewMode, 'both'>;
export type EditorSidePanelLayout =
  | 'none'
  | 'outline'
  | 'syntax'
  | 'stacked'
  | 'syntaxMaximized';
export type EditorSidePanelPreference = {
  outlineOpen: boolean;
  outlineActiveTab: EditorOutlineTab;
  syntaxOpen: boolean;
};
export type EditorSidePanelState = {
  outlineOpen: boolean;
  syntaxOpen: boolean;
  syntaxMaximized: boolean;
  available: boolean;
};
export type EditorSidePanelStackedRatioBounds = {
  min: number;
  max: number;
};

type StoredWriteFeedback = {
  statusState: StatusState;
  statusText: string;
  result: AdminContentWriteResult;
  createdAt: number;
};
type LegacyEditorOutlineState = {
  open: boolean;
  activeTab: EditorOutlineTab;
};

const STATUS_STATES: readonly StatusState[] = ['idle', 'loading', 'ready', 'ok', 'warn', 'error'];
const EDITOR_LAYOUT_MODES: readonly EditorLayoutMode[] = ['stacked', 'split'];
const EDITOR_OUTLINE_TABS: readonly EditorOutlineTab[] = ['headings', 'essays'];
export const DEFAULT_EDITOR_SIDE_PANEL_STACKED_RATIO = 45;
export const EDITOR_SIDE_PANEL_STACKED_RATIO_STEP = 5;
export const EDITOR_SIDE_PANEL_OUTLINE_MIN_BLOCK_SIZE = 120;
export const EDITOR_SIDE_PANEL_SYNTAX_MIN_BLOCK_SIZE = 150;
const EDITOR_SIDE_PANEL_STACKED_RATIO_MIN_PERCENT = 20;
const EDITOR_SIDE_PANEL_STACKED_RATIO_MAX_PERCENT = 80;
const WRITE_FIELD_LABELS: Readonly<Record<string, string>> = {
  title: '标题',
  description: '摘要',
  date: '日期',
  publishedAt: '发布时间',
  tags: '标签',
  draft: '草稿状态',
  archive: '归档状态',
  slug: '链接别名',
  cover: '封面图',
  badge: '徽标',
  body: '正文'
};

export const getPreviewDebounceMs = (source: string): number => {
  const length = source.length;
  if (length >= 12000) return 700;
  if (length >= 6000) return 480;
  if (length >= 3000) return 320;
  return 220;
};

export const normalizeEditorTextareaValue = (value: string): string =>
  value.replace(/\r\n?/g, '\n');

export const getOppositeScrollSource = (source: EditorScrollSource): EditorScrollSource =>
  source === 'body' ? 'preview' : 'body';

export const getScrollableDistance = (element: HTMLElement): number =>
  Math.max(0, element.scrollHeight - element.clientHeight);

export const getScrollRatio = (element: HTMLElement): number => {
  const scrollableDistance = getScrollableDistance(element);
  if (scrollableDistance === 0) return 0;

  return Math.min(1, Math.max(0, element.scrollTop / scrollableDistance));
};

export const clearScrollbarVisibilityTimer = (
  scrollbarVisibilityTimers: Map<HTMLElement, number>,
  element: HTMLElement
) => {
  const visibilityTimer = scrollbarVisibilityTimers.get(element);
  if (visibilityTimer !== undefined) {
    window.clearTimeout(visibilityTimer);
    scrollbarVisibilityTimers.delete(element);
  }

  delete element.dataset.scrolling;
};

export const clearAllScrollbarVisibilityTimers = (scrollbarVisibilityTimers: Map<HTMLElement, number>) => {
  scrollbarVisibilityTimers.forEach((visibilityTimer, element) => {
    window.clearTimeout(visibilityTimer);
    delete element.dataset.scrolling;
  });
  scrollbarVisibilityTimers.clear();
};

export const markScrollElementScrolling = (
  scrollbarVisibilityTimers: Map<HTMLElement, number>,
  element: HTMLElement,
  timeoutMs: number
) => {
  const previousVisibilityTimer = scrollbarVisibilityTimers.get(element);
  if (previousVisibilityTimer !== undefined) {
    window.clearTimeout(previousVisibilityTimer);
  }

  element.dataset.scrolling = 'true';
  scrollbarVisibilityTimers.set(
    element,
    window.setTimeout(() => {
      delete element.dataset.scrolling;
      scrollbarVisibilityTimers.delete(element);
    }, timeoutMs)
  );
};

export const getWriteFieldLabel = (field: string): string => WRITE_FIELD_LABELS[field] ?? field;

const roundEditorSidePanelRatio = (value: number): number => Math.round(value * 10) / 10;

export const getEditorSidePanelLayout = ({
  outlineOpen,
  syntaxOpen,
  syntaxMaximized,
  available
}: EditorSidePanelState): EditorSidePanelLayout => {
  if (!available) return 'none';
  if (outlineOpen && syntaxOpen && syntaxMaximized) return 'syntaxMaximized';
  if (outlineOpen && syntaxOpen) return 'stacked';
  if (outlineOpen) return 'outline';
  if (syntaxOpen) return 'syntax';
  return 'none';
};

export const getEditorSidePanelStackedRatioBounds = (
  containerBlockSize: number,
  outlineMinBlockSize = EDITOR_SIDE_PANEL_OUTLINE_MIN_BLOCK_SIZE,
  syntaxMinBlockSize = EDITOR_SIDE_PANEL_SYNTAX_MIN_BLOCK_SIZE
): EditorSidePanelStackedRatioBounds => {
  if (containerBlockSize > outlineMinBlockSize + syntaxMinBlockSize) {
    const min = Math.max(
      EDITOR_SIDE_PANEL_STACKED_RATIO_MIN_PERCENT,
      roundEditorSidePanelRatio((outlineMinBlockSize / containerBlockSize) * 100)
    );
    const max = Math.min(
      EDITOR_SIDE_PANEL_STACKED_RATIO_MAX_PERCENT,
      roundEditorSidePanelRatio(100 - (syntaxMinBlockSize / containerBlockSize) * 100)
    );
    if (min <= max) return { min, max };
  }

  return {
    min: EDITOR_SIDE_PANEL_STACKED_RATIO_MIN_PERCENT,
    max: EDITOR_SIDE_PANEL_STACKED_RATIO_MAX_PERCENT
  };
};

export const clampEditorSidePanelStackedRatio = (value: number, containerBlockSize: number): number => {
  const ratio = Number.isFinite(value) ? value : DEFAULT_EDITOR_SIDE_PANEL_STACKED_RATIO;
  const { min, max } = getEditorSidePanelStackedRatioBounds(containerBlockSize);
  return roundEditorSidePanelRatio(Math.min(max, Math.max(min, ratio)));
};

export const getEditorSidePanelStackedRatioFromPointer = (
  containerBlockStart: number,
  containerBlockSize: number,
  pointerBlockPosition: number
): number => {
  if (containerBlockSize <= 0) return DEFAULT_EDITOR_SIDE_PANEL_STACKED_RATIO;
  return clampEditorSidePanelStackedRatio(
    ((pointerBlockPosition - containerBlockStart) / containerBlockSize) * 100,
    containerBlockSize
  );
};

export const buildContentExportHref = (baseEndpoint: string, collectionKey: string, contentEntryId: string): string => {
  const params = new URLSearchParams({
    collection: collectionKey,
    entryId: contentEntryId
  });
  return `${baseEndpoint}?${params.toString()}`;
};

const isWriteResult = (value: unknown): value is AdminContentWriteResult => {
  if (!isRecord(value)) return false;
  return (
    typeof value.changed === 'boolean' &&
    typeof value.written === 'boolean' &&
    typeof value.relativePath === 'string' &&
    Array.isArray(value.changedFields) &&
    value.changedFields.every((field) => typeof field === 'string')
  );
};

const isStoredWriteFeedback = (value: unknown): value is StoredWriteFeedback => {
  if (!isRecord(value)) return false;
  return (
    STATUS_STATES.includes(value.statusState as StatusState) &&
    typeof value.statusText === 'string' &&
    typeof value.createdAt === 'number' &&
    isWriteResult(value.result)
  );
};

const isEditorLayoutMode = (value: unknown): value is EditorLayoutMode =>
  EDITOR_LAYOUT_MODES.includes(value as EditorLayoutMode);

const isEditorOutlineTab = (value: unknown): value is EditorOutlineTab =>
  EDITOR_OUTLINE_TABS.includes(value as EditorOutlineTab);

const isLegacyEditorOutlineState = (value: unknown): value is LegacyEditorOutlineState => {
  if (!isRecord(value)) return false;
  return typeof value.open === 'boolean' && isEditorOutlineTab(value.activeTab);
};

const isEditorSidePanelPreference = (value: unknown): value is EditorSidePanelPreference => {
  if (!isRecord(value)) return false;
  return (
    typeof value.outlineOpen === 'boolean' &&
    isEditorOutlineTab(value.outlineActiveTab) &&
    typeof value.syntaxOpen === 'boolean'
  );
};

export const readStoredEditorLayout = (storageKey: string): EditorLayoutMode | null => {
  if (typeof window === 'undefined') return null;
  try {
    const storedLayout = window.localStorage.getItem(storageKey);
    return isEditorLayoutMode(storedLayout) ? storedLayout : null;
  } catch {
    return null;
  }
};

export const storeEditorLayout = (storageKey: string, layoutMode: EditorLayoutMode) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, layoutMode);
  } catch {
    // 布局偏好只改善体验，不影响编辑主流程。
  }
};

export const readStoredEditorSidePanelPreference = (storageKey: string): EditorSidePanelPreference | null => {
  if (typeof window === 'undefined') return null;
  try {
    const rawState = window.localStorage.getItem(storageKey);
    if (!rawState) return null;

    const state: unknown = JSON.parse(rawState);
    if (isEditorSidePanelPreference(state)) return state;
    if (isLegacyEditorOutlineState(state)) {
      return {
        outlineOpen: state.open,
        outlineActiveTab: state.activeTab,
        syntaxOpen: false
      };
    }
    return null;
  } catch {
    return null;
  }
};

export const storeEditorSidePanelPreference = (storageKey: string, state: EditorSidePanelPreference) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // 右侧辅助面板偏好只改善跨文章体验，不影响编辑主流程。
  }
};

export const clearStoredWriteFeedback = (storageKey: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // 部分浏览器环境可能禁用 sessionStorage。
  }
};

export const readStoredWriteFeedback = (storageKey: string, ttlMs: number): StoredWriteFeedback | null => {
  if (typeof window === 'undefined') return null;
  try {
    const rawFeedback = window.sessionStorage.getItem(storageKey);
    if (!rawFeedback) return null;

    const feedback: unknown = JSON.parse(rawFeedback);
    if (!isStoredWriteFeedback(feedback) || Date.now() - feedback.createdAt > ttlMs) {
      clearStoredWriteFeedback(storageKey);
      return null;
    }

    return feedback;
  } catch {
    clearStoredWriteFeedback(storageKey);
    return null;
  }
};

export const storeWriteFeedback = (
  storageKey: string,
  result: AdminContentWriteResult,
  statusState: StatusState,
  statusText: string
) => {
  if (typeof window === 'undefined') return;
  try {
    const feedback: StoredWriteFeedback = {
      statusState,
      statusText,
      result,
      createdAt: Date.now()
    };
    window.sessionStorage.setItem(storageKey, JSON.stringify(feedback));
  } catch {
    // 反馈保留只改善刷新后的可见性，不应影响保存主流程。
  }
};
