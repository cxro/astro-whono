import {
  getMarkdownOutlineSelectionRange,
  type MarkdownOutlineItem
} from './editor-outline-helpers';

export type OutlineScrollOptions = {
  targetOffsetRatio?: number;
};

const DEFAULT_TARGET_OFFSET_RATIO = 0.18;

const TEXTAREA_MIRROR_STYLE_PROPERTIES = [
  'box-sizing',
  'width',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'font-family',
  'font-size',
  'font-style',
  'font-variant',
  'font-weight',
  'font-stretch',
  'letter-spacing',
  'line-height',
  'text-indent',
  'text-transform',
  'word-spacing',
  'tab-size'
] as const;

const getTargetOffsetRatio = (options: OutlineScrollOptions = {}): number =>
  options.targetOffsetRatio ?? DEFAULT_TARGET_OFFSET_RATIO;

const getOutlineTargetScrollTop = (
  targetTop: number,
  viewportHeight: number,
  options: OutlineScrollOptions = {}
): number => Math.max(0, targetTop - viewportHeight * getTargetOffsetRatio(options));

const getRelativeTargetTop = (scroller: HTMLElement, target: HTMLElement): number => {
  const scrollerRect = scroller.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  return targetRect.top - scrollerRect.top + scroller.scrollTop;
};

export const findPreviewOutlineTarget = (
  previewElement: HTMLElement,
  outlineKey: string,
  outlineKeyAttribute: string
): HTMLElement | null => {
  const targets = previewElement.querySelectorAll<HTMLElement>(`[${outlineKeyAttribute}]`);
  for (const target of targets) {
    if (target.getAttribute(outlineKeyAttribute) === outlineKey) {
      return target;
    }
  }

  return null;
};

export const scrollPreviewToOutlineKey = (
  previewElement: HTMLElement | null,
  outlineKey: string,
  outlineKeyAttribute: string,
  options: OutlineScrollOptions = {}
): boolean => {
  if (!previewElement) return false;

  const target = findPreviewOutlineTarget(previewElement, outlineKey, outlineKeyAttribute);
  if (!target) return false;

  previewElement.scrollTop = getOutlineTargetScrollTop(
    getRelativeTargetTop(previewElement, target),
    previewElement.clientHeight,
    options
  );
  return true;
};

const copyTextareaMirrorStyles = (textarea: HTMLTextAreaElement, mirror: HTMLElement) => {
  const computedStyle = window.getComputedStyle(textarea);
  for (const property of TEXTAREA_MIRROR_STYLE_PROPERTIES) {
    mirror.style.setProperty(property, computedStyle.getPropertyValue(property));
  }

  mirror.style.position = 'absolute';
  mirror.style.insetBlockStart = '0';
  mirror.style.insetInlineStart = '-9999px';
  mirror.style.visibility = 'hidden';
  mirror.style.pointerEvents = 'none';
  mirror.style.overflow = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.wordBreak = computedStyle.wordBreak;
  mirror.style.inlineSize = `${textarea.clientWidth}px`;
  mirror.style.minBlockSize = '0';
};

const measureTextareaTextOffsetTop = (
  textarea: HTMLTextAreaElement,
  source: string,
  offset: number
): number => {
  const ownerDocument = textarea.ownerDocument;
  const ownerBody = ownerDocument.body;
  const mirror = ownerDocument.createElement('div');
  const marker = ownerDocument.createElement('span');
  const boundedOffset = Math.min(Math.max(0, offset), source.length);

  copyTextareaMirrorStyles(textarea, mirror);
  mirror.textContent = source.slice(0, boundedOffset);
  marker.textContent = '\u200b';
  mirror.append(marker);
  ownerBody.append(mirror);

  const top = marker.offsetTop;
  mirror.remove();
  return top;
};

export const scrollTextareaToOutlineItem = (
  textarea: HTMLTextAreaElement | null,
  source: string,
  item: MarkdownOutlineItem,
  options: OutlineScrollOptions = {}
): boolean => {
  if (!textarea) return false;

  const { selectionStart, selectionEnd } = getMarkdownOutlineSelectionRange(source, item);
  const targetTop = measureTextareaTextOffsetTop(textarea, source, selectionStart);
  const nextScrollTop = getOutlineTargetScrollTop(targetTop, textarea.clientHeight, options);

  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(selectionStart, selectionEnd);
  textarea.scrollTop = nextScrollTop;
  return true;
};
