import { createWithBase, normalizeBitsAvatarPath, toSafeHttpUrl } from '../utils/format';

type Tone = 'info' | 'error' | 'success';
type ToolbarSnapshot = { value: string; start: number; end: number };
type ImageRowState = { lastValue: string; requestId: number };
type ImageDraft = { src: string; width: number; height: number };
type ImageRowRefs = {
  srcEl: HTMLInputElement;
  widthEl: HTMLInputElement;
  heightEl: HTMLInputElement;
  removeBtn: HTMLButtonElement;
};

export type BitsDraftOpenOptions = {
  opener?: HTMLElement | null;
};

export type BitsDraftController = {
  dialog: HTMLDialogElement;
  open: (options?: BitsDraftOpenOptions) => void;
  close: () => void;
};

let cachedController: BitsDraftController | null = null;

const base = import.meta.env.BASE_URL ?? '/';
const withBase = createWithBase(base);

const query = <T extends Element>(root: ParentNode | null, selector: string) => root?.querySelector<T>(selector) ?? null;
const queryAll = <T extends Element>(root: ParentNode | null, selector: string) =>
  Array.from(root?.querySelectorAll<T>(selector) ?? []);

const pad2 = (value: number) => String(value).padStart(2, '0');

const formatDateLocal = () => {
  const now = new Date();
  const tzMinutes = -now.getTimezoneOffset();
  const sign = tzMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(tzMinutes);
  const tzHours = pad2(Math.floor(abs / 60));
  const tzRemainder = pad2(abs % 60);
  const datePart = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const timePart = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  return `${datePart}T${timePart}${sign}${tzHours}:${tzRemainder}`;
};

const formatFileStamp = () => {
  const now = new Date();
  const datePart = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const timePart = `${pad2(now.getHours())}${pad2(now.getMinutes())}`;
  return `${datePart}-${timePart}`;
};

const splitTags = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[,\s，]+/)
        .map((part) => part.trim())
        .filter(Boolean)
    )
  );

const squashTagSpaces = (value: string) => value.replace(/，/g, ',').replace(/\s{2,}/g, ' ');

const escapeYamlDoubleQuoted = (value: string) =>
  value.replace(/[\n\r\t"\\]/g, (char) => {
    switch (char) {
      case '\\':
        return '\\\\';
      case '"':
        return '\\"';
      case '\n':
        return '\\n';
      case '\r':
        return '\\r';
      case '\t':
        return '\\t';
      default:
        return char;
    }
  });

const quoteYaml = (value: string) =>
  /[:#\n\r\t\\]|^\s|\s$|^-/.test(value) ? `"${escapeYamlDoubleQuoted(value)}"` : value;

const toSafeDocumentHttpUrl = (value: string) => toSafeHttpUrl(value, window.location.href);

const normalizeImageSrc = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  let normalized = trimmed.replace(/\\/g, '/');
  normalized = normalized.replace(/^\/+/, '');
  normalized = normalized.replace(/^public\//i, '');
  normalized = normalized.replace(/\.webp\.webp$/i, '.webp');
  return normalized;
};

const resolvePreviewSrc = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return toSafeDocumentHttpUrl(trimmed);
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  if (trimmed.startsWith(normalizedBase)) return toSafeDocumentHttpUrl(trimmed);
  return toSafeDocumentHttpUrl(withBase(trimmed.replace(/^\/+/, '')));
};

const normalizeAuthorName = (value: string) => value.trim();
const normalizeAuthorAvatar = (value: string) => normalizeBitsAvatarPath(value) ?? '';
const resolveAuthorAvatarPreviewSrc = (value: string) => {
  const normalized = normalizeAuthorAvatar(value);
  return normalized ? toSafeDocumentHttpUrl(withBase(normalized)) : '';
};

export const initBitsDraft = (): BitsDraftController | null => {
  const dialog = document.getElementById('bits-draft-dialog') as HTMLDialogElement | null;
  if (!dialog) return null;
  if (cachedController?.dialog === dialog) return cachedController;

  const defaultAuthorName = (dialog.dataset.defaultAuthorName ?? '').trim();
  const defaultAuthorAvatar = (dialog.dataset.defaultAuthorAvatar ?? '').trim();

  const form = query<HTMLFormElement>(dialog, '[data-bits-draft-form]');
  const closeBtns = queryAll<HTMLElement>(dialog, '[data-bits-draft-close]');
  const generateBtn = query<HTMLButtonElement>(dialog, '[data-bits-draft-generate]');
  const downloadBtn = query<HTMLButtonElement>(dialog, '[data-bits-draft-download]');
  const statusEl = query<HTMLElement>(dialog, '[data-bits-draft-status]');
  const manualOpenBtn = query<HTMLButtonElement>(dialog, '[data-bits-manual-open]');
  const manualBox = query<HTMLElement>(dialog, '[data-bits-manual]');
  const manualTextarea = query<HTMLTextAreaElement>(dialog, '[data-bits-manual-textarea]');
  const manualNote = query<HTMLElement>(dialog, '[data-bits-manual-note]');
  const manualCopyBtn = query<HTMLButtonElement>(dialog, '[data-bits-manual-copy]');
  const toolbar = query<HTMLElement>(dialog, '[data-bits-draft-toolbar]');
  const quoteBtn = query<HTMLButtonElement>(toolbar, '[data-action="quote"]');
  const listBtn = query<HTMLButtonElement>(toolbar, '[data-action="list"]');
  const boldBtn = query<HTMLButtonElement>(toolbar, '[data-action="bold"]');
  const italicBtn = query<HTMLButtonElement>(toolbar, '[data-action="italic"]');
  const codeBtn = query<HTMLButtonElement>(toolbar, '[data-action="code"]');
  const linkBtn = query<HTMLButtonElement>(toolbar, '[data-action="link"]');
  const contentEl = query<HTMLTextAreaElement>(dialog, '#bits-draft-content');
  const tagsEl = query<HTMLInputElement>(dialog, '#bits-draft-tags');
  const placeEl = query<HTMLInputElement>(dialog, '#bits-draft-place');
  const authorNameEl = query<HTMLInputElement>(dialog, '[data-author-name]');
  const authorAvatarEl = query<HTMLInputElement>(dialog, '[data-author-avatar]');
  const identityPanel = query<HTMLElement>(dialog, '[data-identity-panel]');
  const identityBar = query<HTMLElement>(dialog, '[data-identity-bar]');
  const identityPill = query<HTMLButtonElement>(dialog, '[data-identity-pill]');
  const identityNew = query<HTMLButtonElement>(dialog, '[data-identity-new]');
  const identityNameEl = query<HTMLElement>(dialog, '[data-identity-name]');
  const identityAvatarEl = query<HTMLElement>(dialog, '[data-identity-avatar]');
  const authorResetBtn = query<HTMLButtonElement>(dialog, '[data-author-reset]');
  const imagesWrap = query<HTMLElement>(dialog, '[data-bits-images]');
  const imageAddBtn = query<HTMLButtonElement>(dialog, '[data-bits-image-add]');
  const imageTemplate = query<HTMLTemplateElement>(dialog, '[data-bits-image-template]');
  const draftEl = query<HTMLInputElement>(dialog, '#bits-draft-draft');

  let lastOpenTrigger: HTMLElement | null = null;
  let lastIdentityTrigger: HTMLButtonElement | null = identityPill ?? identityNew ?? null;
  let lastMarkdown = '';
  let hasGenerated = false;
  let lastEditSource: 'typing' | 'toolbar' = 'typing';
  let isApplyingToolbar = false;
  let isComposingTags = false;
  const toolbarUndoStack: ToolbarSnapshot[] = [];
  const imageStateMap = new WeakMap<HTMLElement, ImageRowState>();
  const initializedRows = new WeakSet<HTMLElement>();

  const setStatus = (text: string, tone: Tone = 'info') => {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.setAttribute('data-tone', tone);
  };

  const clearStatus = () => {
    if (!statusEl) return;
    statusEl.textContent = '';
    statusEl.removeAttribute('data-tone');
  };

  const updateManualLink = () => {
    if (!manualOpenBtn) return;
    const hasContent = !!contentEl?.value.trim();
    manualOpenBtn.hidden = !(hasGenerated || hasContent);
  };

  const focusTextarea = () => {
    contentEl?.focus();
  };

  const pushToolbarUndo = () => {
    if (!contentEl) return;
    const start = contentEl.selectionStart ?? 0;
    const end = contentEl.selectionEnd ?? 0;
    toolbarUndoStack.push({ value: contentEl.value, start, end });
    if (toolbarUndoStack.length > 50) toolbarUndoStack.shift();
  };

  const applyToolbarAction = (fn: () => void) => {
    if (!contentEl) return;
    pushToolbarUndo();
    isApplyingToolbar = true;
    fn();
    isApplyingToolbar = false;
    lastEditSource = 'toolbar';
    updateToolbarActive();
    updateManualLink();
  };

  const getLineAtCursor = () => {
    if (!contentEl) return { line: '', lineStart: 0, lineEnd: 0 };
    const value = contentEl.value;
    const cursor = contentEl.selectionStart ?? 0;
    const lineStart = value.lastIndexOf('\n', cursor - 1) + 1;
    const lineEndIndex = value.indexOf('\n', cursor);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    return {
      line: value.slice(lineStart, lineEnd),
      lineStart,
      lineEnd
    };
  };

  const isWrappedBy = (before: string, after: string, start: number, end: number) => {
    if (!contentEl) return false;
    const value = contentEl.value;
    const left = value.lastIndexOf(before, start);
    if (left === -1) return false;
    const right = value.indexOf(after, end);
    if (right === -1 || right <= left) return false;
    return left + before.length <= start && end <= right;
  };

  const findSingleStarBefore = (value: string, index: number) => {
    for (let i = index - 1; i >= 0; i -= 1) {
      if (value[i] !== '*') continue;
      if (value[i - 1] === '*' || value[i + 1] === '*') continue;
      return i;
    }
    return -1;
  };

  const findSingleStarAfter = (value: string, index: number) => {
    for (let i = index; i < value.length; i += 1) {
      if (value[i] !== '*') continue;
      if (value[i - 1] === '*' || value[i + 1] === '*') continue;
      return i;
    }
    return -1;
  };

  const isInsideSingleStar = (start: number, end: number) => {
    if (!contentEl) return false;
    const value = contentEl.value;
    const left = findSingleStarBefore(value, start);
    if (left === -1) return false;
    const right = findSingleStarAfter(value, end);
    if (right === -1 || right <= left) return false;
    return left + 1 <= start && end <= right;
  };

  const isInsideLink = (start: number, end: number) => {
    if (!contentEl) return false;
    const value = contentEl.value;
    const left = value.lastIndexOf('[', start);
    if (left === -1) return false;
    const middle = value.indexOf('](', left);
    if (middle === -1) return false;
    const right = value.indexOf(')', middle);
    if (right === -1) return false;
    return start >= left + 1 && end <= right;
  };

  const updateToolbarActive = () => {
    if (!contentEl) return;
    const { line } = getLineAtCursor();
    const start = contentEl.selectionStart ?? 0;
    const end = contentEl.selectionEnd ?? 0;
    const boldActive = isWrappedBy('**', '**', start, end);
    const italicActive = !boldActive && isInsideSingleStar(start, end);
    const codeActive = isWrappedBy('`', '`', start, end);
    const linkActive = isInsideLink(start, end);
    const quoteActive = /^\s*>\s?/.test(line);
    const listActive = /^\s*[-*+]\s+/.test(line);

    boldBtn?.classList.toggle('is-active', boldActive);
    italicBtn?.classList.toggle('is-active', italicActive);
    codeBtn?.classList.toggle('is-active', codeActive);
    linkBtn?.classList.toggle('is-active', linkActive);
    quoteBtn?.classList.toggle('is-active', quoteActive);
    listBtn?.classList.toggle('is-active', listActive);
  };

  const wrapSelection = (before: string, after: string, placeholder: string) => {
    if (!contentEl) return;
    focusTextarea();
    const start = contentEl.selectionStart ?? 0;
    const end = contentEl.selectionEnd ?? 0;
    const hasSelection = start !== end;
    const selected = hasSelection ? contentEl.value.slice(start, end) : placeholder;
    const next = `${before}${selected}${after}`;
    contentEl.setRangeText(next, start, end, 'select');
    const innerStart = start + before.length;
    const innerEnd = innerStart + selected.length;
    contentEl.setSelectionRange(innerStart, innerEnd);
    focusTextarea();
  };

  const insertText = (text: string) => {
    if (!contentEl) return;
    focusTextarea();
    const start = contentEl.selectionStart ?? 0;
    const end = contentEl.selectionEnd ?? 0;
    contentEl.setRangeText(text, start, end, 'end');
    focusTextarea();
  };

  const prefixLines = (prefix: string) => {
    if (!contentEl) return;
    focusTextarea();
    const value = contentEl.value;
    const start = contentEl.selectionStart ?? 0;
    const end = contentEl.selectionEnd ?? 0;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEndIndex = value.indexOf('\n', end);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const segment = value.slice(lineStart, lineEnd);
    const prefixed = segment
      .split('\n')
      .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`))
      .join('\n');
    contentEl.setRangeText(prefixed, lineStart, lineEnd, 'select');
    contentEl.setSelectionRange(lineStart, lineStart + prefixed.length);
    focusTextarea();
  };

  const rememberMarkdown = (markdown: string) => {
    hasGenerated = true;
    lastMarkdown = markdown;
    updateManualLink();
  };

  const hideManualCopy = () => {
    if (manualBox) manualBox.hidden = true;
    if (manualTextarea) manualTextarea.value = '';
    if (manualNote) manualNote.textContent = '';
    manualOpenBtn?.setAttribute('aria-expanded', 'false');
    manualOpenBtn?.classList.remove('is-open');
  };

  const showManualCopy = (text: string, message: string) => {
    if (!manualBox || !manualTextarea) return;
    manualTextarea.value = text;
    manualBox.hidden = false;
    if (manualNote) manualNote.textContent = message;
    manualOpenBtn?.setAttribute('aria-expanded', 'true');
    manualOpenBtn?.classList.add('is-open');
    window.setTimeout(() => {
      manualTextarea.focus();
      manualTextarea.select();
    }, 0);
  };

  const normalizeTagsField = () => {
    if (!tagsEl) return;
    const current = tagsEl.value;
    const normalized = squashTagSpaces(current);
    if (normalized === current) return;
    const start = tagsEl.selectionStart ?? normalized.length;
    const end = tagsEl.selectionEnd ?? normalized.length;
    const normalizedStart = squashTagSpaces(current.slice(0, start));
    const normalizedEnd = squashTagSpaces(current.slice(0, end));
    tagsEl.value = normalized;
    tagsEl.setSelectionRange(normalizedStart.length, normalizedEnd.length);
  };

  const setAuthorPlaceholders = () => {
    if (authorNameEl) authorNameEl.placeholder = defaultAuthorName ? `Default: ${defaultAuthorName}` : 'Default: Anonymous';
    if (authorAvatarEl) {
      authorAvatarEl.placeholder = defaultAuthorAvatar
        ? `Default: ${defaultAuthorAvatar}`
        : 'Relative image path (e.g. author/avatar.webp, leave empty for default)';
    }
  };

  const renderIdentityAvatar = (src: string, fallback: string) => {
    if (!identityAvatarEl) return;
    identityAvatarEl.replaceChildren();
    if (!src) {
      const span = document.createElement('span');
      span.textContent = fallback;
      identityAvatarEl.appendChild(span);
      return;
    }
    const previewSrc = resolveAuthorAvatarPreviewSrc(src);
    if (!previewSrc) {
      const span = document.createElement('span');
      span.textContent = fallback;
      identityAvatarEl.appendChild(span);
      return;
    }
    const image = document.createElement('img');
    image.src = previewSrc;
    image.alt = '';
    image.decoding = 'async';
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      renderIdentityAvatar('', fallback);
    });
    identityAvatarEl.appendChild(image);
  };

  const updateIdentityPill = () => {
    const authorName = normalizeAuthorName(authorNameEl?.value ?? '');
    const authorAvatar = normalizeAuthorAvatar(authorAvatarEl?.value ?? '');
    const displayName = authorName || defaultAuthorName || 'Anonymous';
    const label = !authorName && !authorAvatar ? `${displayName} (current)` : displayName;
    if (identityNameEl) identityNameEl.textContent = label;
    const avatarSrc = authorAvatar || defaultAuthorAvatar;
    const fallback = Array.from(displayName)[0] ?? 'A';
    renderIdentityAvatar(avatarSrc, fallback);
  };

  const syncIdentityToggleState = () => {
    const isOpen = !!identityPanel && !identityPanel.hidden;
    identityBar?.classList.toggle('is-open', isOpen);
    identityPill?.setAttribute('aria-expanded', String(isOpen));
    identityNew?.setAttribute('aria-expanded', String(isOpen));
  };

  const setIdentityPanelOpen = (open: boolean, trigger: HTMLButtonElement | null = null) => {
    if (!identityPanel) return;
    if (trigger) lastIdentityTrigger = trigger;
    identityPanel.hidden = !open;
    syncIdentityToggleState();
    if (open) {
      authorNameEl?.focus();
      return;
    }
    (trigger ?? lastIdentityTrigger)?.focus();
  };

  const toggleIdentityPanel = (trigger: HTMLButtonElement | null) => {
    if (!identityPanel) return;
    setIdentityPanelOpen(identityPanel.hidden, trigger);
  };

  const closeIdentityPanel = (trigger: HTMLButtonElement | null = null) => {
    if (!identityPanel || identityPanel.hidden) return;
    setIdentityPanelOpen(false, trigger);
  };

  const openIdentityPanel = (trigger: HTMLButtonElement | null = null) => {
    if (!identityPanel || !identityPanel.hidden) return;
    setIdentityPanelOpen(true, trigger);
  };

  const handleIdentityToggleKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !identityPanel || identityPanel.hidden) return;
    event.preventDefault();
    closeIdentityPanel();
  };

  const getImageRows = () => queryAll<HTMLElement>(imagesWrap, '[data-bits-image-row]');

  const getImageRowRefs = (row: HTMLElement): ImageRowRefs | null => {
    const srcEl = query<HTMLInputElement>(row, '[data-bits-image-src]');
    const widthEl = query<HTMLInputElement>(row, '[data-bits-image-width]');
    const heightEl = query<HTMLInputElement>(row, '[data-bits-image-height]');
    const removeBtn = query<HTMLButtonElement>(row, '[data-bits-image-remove]');
    if (!srcEl || !widthEl || !heightEl || !removeBtn) return null;
    return { srcEl, widthEl, heightEl, removeBtn };
  };

  const getImageState = (row: HTMLElement) => {
    const existing = imageStateMap.get(row);
    if (existing) return existing;
    const next: ImageRowState = { lastValue: '', requestId: 0 };
    imageStateMap.set(row, next);
    return next;
  };

  const syncImageRow = (row: HTMLElement) => {
    const refs = getImageRowRefs(row);
    if (!refs) return;
    const hasImage = !!refs.srcEl.value.trim();
    row.classList.toggle('has-image', hasImage);
    refs.widthEl.disabled = !hasImage;
    refs.heightEl.disabled = !hasImage;
    if (!hasImage) {
      refs.widthEl.value = '';
      refs.heightEl.value = '';
    }
  };

  const syncImageRows = () => {
    const rows = getImageRows();
    rows.forEach((row) => {
      syncImageRow(row);
    });
    imagesWrap?.classList.toggle('has-multiple', rows.length > 1);
  };

  const readImageSize = (row: HTMLElement) => {
    const refs = getImageRowRefs(row);
    if (!refs) return;
    const value = refs.srcEl.value.trim();
    const state = getImageState(row);
    if (!value) {
      state.lastValue = '';
      return;
    }
    if (value === state.lastValue) return;
    state.lastValue = value;

    const previewSrc = resolvePreviewSrc(value);
    if (!previewSrc) return;

    const requestId = ++state.requestId;
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      if (requestId !== state.requestId) return;
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (!width || !height) {
        setStatus('Unable to auto-detect, please enter manually.');
        return;
      }
      refs.widthEl.value = String(width);
      refs.heightEl.value = String(height);
      setStatus(`Auto-detected: ${width}×${height}`);
    };
    image.onerror = () => {
      if (requestId !== state.requestId) return;
      setStatus('Unable to auto-detect, please enter manually.');
    };
    image.src = previewSrc;
  };

  const removeImageRow = (row: HTMLElement) => {
    const refs = getImageRowRefs(row);
    if (!refs) return;
    const rows = getImageRows();
    if (rows.length <= 1) {
      refs.srcEl.value = '';
      refs.widthEl.value = '';
      refs.heightEl.value = '';
      syncImageRow(row);
      refs.srcEl.focus();
      syncImageRows();
      return;
    }
    row.remove();
    syncImageRows();
  };

  const bindImageRow = (row: HTMLElement) => {
    if (initializedRows.has(row)) return;
    const refs = getImageRowRefs(row);
    if (!refs) return;
    initializedRows.add(row);
    refs.srcEl.addEventListener('input', () => {
      syncImageRow(row);
    });
    refs.srcEl.addEventListener('change', () => {
      syncImageRow(row);
      readImageSize(row);
    });
    refs.removeBtn.addEventListener('click', () => {
      removeImageRow(row);
    });
    syncImageRow(row);
  };

  const initImageRows = () => {
    getImageRows().forEach((row) => {
      bindImageRow(row);
    });
  };

  const addImageRow = () => {
    if (!imagesWrap || !imageTemplate) return;
    const templateRow = imageTemplate.content.firstElementChild;
    if (!templateRow) return;
    const row = templateRow.cloneNode(true) as HTMLElement;
    imagesWrap.appendChild(row);
    bindImageRow(row);
    syncImageRows();
    query<HTMLInputElement>(row, '[data-bits-image-src]')?.focus();
  };

  const tryClipboardCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  };

  const collectImages = (): ImageDraft[] | null => {
    const images: ImageDraft[] = [];
    for (const row of getImageRows()) {
      const refs = getImageRowRefs(row);
      if (!refs) continue;
      const src = normalizeImageSrc(refs.srcEl.value ?? '');
      if (!src) continue;
      const widthValue = refs.widthEl.value.trim();
      const heightValue = refs.heightEl.value.trim();
      if (!widthValue || !heightValue) {
        setStatus('Image added, please complete width and height.', 'error');
        if (widthValue) refs.heightEl.focus();
        else refs.widthEl.focus();
        return null;
      }
      const width = Number(widthValue);
      const height = Number(heightValue);
      if (!Number.isFinite(width) || width <= 0) {
        setStatus('Image width must be positive.', 'error');
        refs.widthEl.focus();
        return null;
      }
      if (!Number.isFinite(height) || height <= 0) {
        setStatus('Image height must be positive.', 'error');
        refs.heightEl.focus();
        return null;
      }
      images.push({ src, width, height });
    }
    return images;
  };

  const buildMarkdown = () => {
    if (!contentEl) return null;
    const content = contentEl.value.trim();
    if (!content) {
      setStatus('Please enter content first.', 'error');
      contentEl.focus();
      return null;
    }
    const images = collectImages();
    if (!images) return null;

    let tags = splitTags(tagsEl?.value ?? '');
    const place = (placeEl?.value ?? '').trim().replace(/^loc:/i, '').trim();
    if (place) {
      tags = tags.filter((tag) => !tag.trim().toLowerCase().startsWith('loc:'));
      tags.unshift(`loc:${place}`);
    }

    const authorName = normalizeAuthorName(authorNameEl?.value ?? '');
    const authorAvatar = normalizeBitsAvatarPath(authorAvatarEl?.value ?? '');
    if (authorAvatar === undefined) {
      setStatus('Author avatar only accepts relative image paths (e.g. author/avatar.webp), without public/, without leading /, and no URLs, .., ?, #.', 'error');
      authorAvatarEl?.focus();
      return null;
    }
    const customAuthorName = authorName && authorName !== defaultAuthorName ? authorName : '';
    const customAuthorAvatar = authorAvatar && authorAvatar !== defaultAuthorAvatar ? authorAvatar : '';
    const hasCustomAuthor = !!customAuthorName || !!customAuthorAvatar;

    const lines = ['---', `date: ${formatDateLocal()}`];

    if (tags.length) {
      lines.push('tags:');
      tags.forEach((tag) => {
        lines.push(`  - ${quoteYaml(tag)}`);
      });
    }

    if (hasCustomAuthor) {
      lines.push('author:');
      if (customAuthorName) lines.push(`  name: ${quoteYaml(customAuthorName)}`);
      if (customAuthorAvatar) lines.push(`  avatar: ${quoteYaml(customAuthorAvatar)}`);
    }

    if (draftEl?.checked) {
      lines.push('draft: true');
    }

    if (images.length) {
      lines.push('images:');
      images.forEach((image) => {
        lines.push(`  - src: ${quoteYaml(image.src)}`);
        lines.push(`    width: ${image.width}`);
        lines.push(`    height: ${image.height}`);
      });
    }

    lines.push('---', '', content);
    return lines.join('\n');
  };

  const restoreFocus = () => {
    const target = lastOpenTrigger;
    lastOpenTrigger = null;
    if (!target?.isConnected) return;
    window.requestAnimationFrame(() => {
      target.focus({ preventScroll: true });
    });
  };

  const openDialog = (options: BitsDraftOpenOptions = {}) => {
    lastOpenTrigger =
      options.opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : lastOpenTrigger);
    if (dialog.open) return;
    clearStatus();
    hideManualCopy();
    updateManualLink();
    syncImageRows();
    updateToolbarActive();
    setAuthorPlaceholders();
    updateIdentityPill();
    syncIdentityToggleState();
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    window.setTimeout(() => {
      contentEl?.focus();
    }, 0);
  };

  const closeDialog = () => {
    hideManualCopy();
    hasGenerated = false;
    lastMarkdown = '';
    updateManualLink();
    if (authorNameEl) authorNameEl.value = '';
    if (authorAvatarEl) authorAvatarEl.value = '';
    if (identityPanel) identityPanel.hidden = true;
    updateIdentityPill();
    syncIdentityToggleState();
    if (dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
    restoreFocus();
  };

  initImageRows();

  closeBtns.forEach((button) => {
    button.addEventListener('click', () => {
      closeDialog();
    });
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      closeDialog();
    }
  });

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeDialog();
  });

  imageAddBtn?.addEventListener('click', () => {
    addImageRow();
  });

  identityPill?.addEventListener('click', () => {
    toggleIdentityPanel(identityPill);
  });

  identityNew?.addEventListener('click', () => {
    toggleIdentityPanel(identityNew);
  });

  identityPill?.addEventListener('keydown', handleIdentityToggleKey);
  identityNew?.addEventListener('keydown', handleIdentityToggleKey);
  identityPanel?.addEventListener('keydown', handleIdentityToggleKey);

  authorNameEl?.addEventListener('input', () => {
    updateIdentityPill();
  });

  authorAvatarEl?.addEventListener('input', () => {
    updateIdentityPill();
  });

  authorResetBtn?.addEventListener('click', () => {
    if (authorNameEl) authorNameEl.value = '';
    if (authorAvatarEl) authorAvatarEl.value = '';
    updateIdentityPill();
  });

  authorNameEl?.addEventListener('focus', () => {
    openIdentityPanel(identityPill);
  });

  authorAvatarEl?.addEventListener('focus', () => {
    openIdentityPanel(identityPill);
  });

  form?.addEventListener('input', () => {
    if (statusEl?.textContent) clearStatus();
    if (manualBox && !manualBox.hidden) hideManualCopy();
    updateManualLink();
  });

  contentEl?.addEventListener('input', () => {
    updateToolbarActive();
    updateManualLink();
    if (!isApplyingToolbar) {
      lastEditSource = 'typing';
    }
  });

  contentEl?.addEventListener('mouseup', () => {
    updateToolbarActive();
  });

  contentEl?.addEventListener('keyup', () => {
    updateToolbarActive();
  });

  contentEl?.addEventListener('keydown', (event) => {
    const isUndo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z';
    if (!isUndo) return;
    if (lastEditSource !== 'toolbar' || toolbarUndoStack.length === 0) return;
    event.preventDefault();
    const snapshot = toolbarUndoStack.pop();
    if (!snapshot || !contentEl) return;
    isApplyingToolbar = true;
    contentEl.value = snapshot.value;
    contentEl.setSelectionRange(snapshot.start, snapshot.end);
    isApplyingToolbar = false;
    updateToolbarActive();
    updateManualLink();
    if (toolbarUndoStack.length === 0) {
      lastEditSource = 'typing';
    }
  });

  tagsEl?.addEventListener('compositionstart', () => {
    isComposingTags = true;
  });

  tagsEl?.addEventListener('compositionend', () => {
    isComposingTags = false;
    normalizeTagsField();
  });

  tagsEl?.addEventListener('input', () => {
    if (isComposingTags) return;
    normalizeTagsField();
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
  });

  manualCopyBtn?.addEventListener('click', async () => {
    if (!manualTextarea) return;
    manualTextarea.focus();
    manualTextarea.select();
    const copied = await tryClipboardCopy(manualTextarea.value);
    if (manualNote) {
      manualNote.textContent = copied ? 'Draft copied.' : 'Text selected, press ⌘C / Ctrl+C to copy.';
    }
  });

  manualOpenBtn?.addEventListener('click', () => {
    clearStatus();
    if (manualBox && !manualBox.hidden) {
      hideManualCopy();
      return;
    }
    const contentValue = contentEl?.value.trim() ?? '';
    let markdown = '';
    if (contentValue) {
      const built = buildMarkdown();
      if (!built) return;
      markdown = built;
      rememberMarkdown(markdown);
    } else if (hasGenerated && lastMarkdown) {
      markdown = lastMarkdown;
    } else {
      setStatus('Please enter content first.', 'error');
      contentEl?.focus();
      return;
    }
    showManualCopy(markdown, 'Draft generated.');
  });

  toolbar?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLButtonElement>('button[data-action]');
    if (!button) return;
    const action = button.getAttribute('data-action');
    if (!action) return;
    applyToolbarAction(() => {
      switch (action) {
        case 'bold':
          wrapSelection('**', '**', 'text');
          break;
        case 'italic':
          wrapSelection('*', '*', 'text');
          break;
        case 'code':
          wrapSelection('`', '`', 'code');
          break;
        case 'quote':
          prefixLines('> ');
          break;
        case 'list':
          prefixLines('- ');
          break;
        case 'link':
          wrapSelection('[', '](url)', 'text');
          break;
        case 'paragraph':
          insertText('\n');
          break;
        default:
          break;
      }
    });
  });

  generateBtn?.addEventListener('click', async () => {
    clearStatus();
    hideManualCopy();
    const markdown = buildMarkdown();
    if (!markdown) return;
    rememberMarkdown(markdown);
    if (!window.isSecureContext || !navigator.clipboard?.writeText) {
      showManualCopy(markdown, 'Draft generated.');
      return;
    }
    const copied = await tryClipboardCopy(markdown);
    if (copied) setStatus('Draft copied.', 'success');
    else showManualCopy(markdown, 'Draft generated.');
  });

  downloadBtn?.addEventListener('click', () => {
    clearStatus();
    hideManualCopy();
    const markdown = buildMarkdown();
    if (!markdown) return;
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bits-${formatFileStamp()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatus('Draft downloaded.', 'success');
  });

  cachedController = {
    dialog,
    open: openDialog,
    close: closeDialog
  };

  return cachedController;
};
