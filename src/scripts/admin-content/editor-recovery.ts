const COMMAND = 'npm run dev:clean';
const CLEANUP_KEY = '__astroWhonoAdminEditorRecoveryCleanup';

type RecoveryWindow = Window & {
  [CLEANUP_KEY]?: () => void;
};

type RecoveryRoot = {
  root: HTMLElement;
  trigger: HTMLButtonElement;
  modal: HTMLElement;
  copyButton: HTMLButtonElement | null;
  reloadButton: HTMLButtonElement | null;
  closeButtons: HTMLButtonElement[];
  status: HTMLElement | null;
};

const DYNAMIC_IMPORT_ERROR_PATTERNS = [
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'Importing a module script failed',
  'Outdated Optimize Dep'
];

const EDITOR_MODULE_PATTERNS = [
  '/src/components/admin/editor/',
  '/node_modules/.vite/deps/',
  'emoji-picker-element'
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getNonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const toMessage = (value: unknown): string => {
  if (value instanceof Error) return value.message;
  if (isRecord(value)) return getNonEmptyString(value.message) ?? '';
  return typeof value === 'string' ? value : '';
};

const toUrl = (value: unknown): string => {
  if (!isRecord(value)) return '';
  const url = getNonEmptyString(value.url)
    ?? getNonEmptyString(value.href)
    ?? getNonEmptyString(value.filename)
    ?? getNonEmptyString(value.src);
  if (url) return url;
  return '';
};

export const isAdminEditorRecoveryError = (value: unknown): boolean => {
  const message = toMessage(value);
  const url = toUrl(value);
  const text = `${message} ${url}`;

  return DYNAMIC_IMPORT_ERROR_PATTERNS.some((pattern) => text.includes(pattern))
    && EDITOR_MODULE_PATTERNS.some((pattern) => text.includes(pattern));
};

export const shouldShowAdminEditorRecovery = (documentRoot: Document = document): boolean =>
  Boolean(documentRoot.querySelector('[data-admin-editor-recovery]'))
  && !documentRoot.querySelector('.admin-editor-shell');

const getRecoveryRoot = (documentRoot: Document = document): RecoveryRoot | null => {
  const root = documentRoot.querySelector<HTMLElement>('[data-admin-editor-recovery]');
  const trigger = documentRoot.querySelector<HTMLButtonElement>('[data-admin-editor-recovery-trigger]');
  const modal = documentRoot.querySelector<HTMLElement>('[data-admin-editor-recovery-modal]');
  if (!root || !trigger || !modal) return null;

  return {
    root,
    trigger,
    modal,
    copyButton: documentRoot.querySelector<HTMLButtonElement>('[data-admin-editor-recovery-copy]'),
    reloadButton: documentRoot.querySelector<HTMLButtonElement>('[data-admin-editor-recovery-reload]'),
    closeButtons: Array.from(documentRoot.querySelectorAll<HTMLButtonElement>('[data-admin-editor-recovery-close]')),
    status: documentRoot.querySelector<HTMLElement>('[data-admin-editor-recovery-status]')
  };
};

const setStatus = (root: RecoveryRoot, text: string) => {
  if (!root.status) return;
  root.status.textContent = text;
  root.status.hidden = text.length === 0;
};

const openModal = (root: RecoveryRoot) => {
  root.modal.hidden = false;
  root.trigger.setAttribute('aria-expanded', 'true');
  root.modal.querySelector<HTMLElement>('[data-admin-editor-recovery-copy]')?.focus({ preventScroll: true });
};

const closeModal = (root: RecoveryRoot, restoreFocus = false) => {
  root.modal.hidden = true;
  root.trigger.setAttribute('aria-expanded', 'false');
  if (restoreFocus) root.trigger.focus({ preventScroll: true });
};

const revealRecovery = (root: RecoveryRoot) => {
  root.root.hidden = false;
  root.trigger.hidden = false;
  root.trigger.dataset.state = 'warning';
};

const copyCommand = async (root: RecoveryRoot) => {
  if (typeof navigator.clipboard?.writeText !== 'function') {
    setStatus(root, COMMAND);
    return;
  }

  try {
    await navigator.clipboard.writeText(COMMAND);
    setStatus(root, '已复制');
  } catch (_) {
    setStatus(root, COMMAND);
  }
};

export const initAdminEditorRecovery = (
  windowRef: Window = window,
  documentRoot: Document = document
): (() => void) | undefined => {
  const windowWithCleanup = windowRef as RecoveryWindow;
  windowWithCleanup[CLEANUP_KEY]?.();

  const root = getRecoveryRoot(documentRoot);
  if (!root) return undefined;

  const handleDetected = (value: unknown) => {
    if (!isAdminEditorRecoveryError(value)) return;
    windowRef.requestAnimationFrame?.(() => {
      if (!shouldShowAdminEditorRecovery(documentRoot)) return;
      revealRecovery(root);
      openModal(root);
    }) ?? windowRef.setTimeout(() => {
      if (!shouldShowAdminEditorRecovery(documentRoot)) return;
      revealRecovery(root);
      openModal(root);
    }, 0);
  };

  const handlePreloadError = (event: Event) => {
    const payload = isRecord(event) ? event.payload : undefined;
    handleDetected(payload);
  };
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    handleDetected(event.reason);
  };
  const handleError = (event: ErrorEvent) => {
    const target = isRecord(event.target) ? event.target : null;
    handleDetected({
      message: toMessage(event.error) || event.message,
      filename: event.filename,
      src: typeof target?.src === 'string' ? target.src : undefined,
      href: typeof target?.href === 'string' ? target.href : undefined
    });
  };
  const handleHydrationError = (event: Event) => {
    const detail = isRecord(event) ? event.detail : undefined;
    if (!isRecord(detail)) return;
    handleDetected({
      message: toMessage(detail.error),
      url: getNonEmptyString(detail.componentUrl) ?? getNonEmptyString(detail.url) ?? ''
    });
  };
  const handleTriggerClick = () => openModal(root);
  const handleCopyClick = () => {
    void copyCommand(root);
  };
  const handleReloadClick = () => windowRef.location.reload();
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || root.modal.hidden) return;
    event.preventDefault();
    closeModal(root, true);
  };
  const closeButtonHandlers = root.closeButtons.map((button) => {
    const handler = () => closeModal(root, button.dataset.adminEditorRecoveryClose === 'restore');
    return { button, handler };
  });

  windowRef.addEventListener('vite:preloadError', handlePreloadError);
  windowRef.addEventListener('unhandledrejection', handleUnhandledRejection);
  windowRef.addEventListener('error', handleError);
  windowRef.addEventListener('astro:hydration-error', handleHydrationError);
  documentRoot.addEventListener('keydown', handleKeydown);
  root.trigger.addEventListener('click', handleTriggerClick);
  root.copyButton?.addEventListener('click', handleCopyClick);
  root.reloadButton?.addEventListener('click', handleReloadClick);
  closeButtonHandlers.forEach(({ button, handler }) => {
    button.addEventListener('click', handler);
  });

  const cleanup = () => {
    windowRef.removeEventListener('vite:preloadError', handlePreloadError);
    windowRef.removeEventListener('unhandledrejection', handleUnhandledRejection);
    windowRef.removeEventListener('error', handleError);
    windowRef.removeEventListener('astro:hydration-error', handleHydrationError);
    documentRoot.removeEventListener('keydown', handleKeydown);
    root.trigger.removeEventListener('click', handleTriggerClick);
    root.copyButton?.removeEventListener('click', handleCopyClick);
    root.reloadButton?.removeEventListener('click', handleReloadClick);
    closeButtonHandlers.forEach(({ button, handler }) => {
      button.removeEventListener('click', handler);
    });
  };

  windowWithCleanup[CLEANUP_KEY] = cleanup;
  return cleanup;
};

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAdminEditorRecovery(), { once: true });
  } else {
    initAdminEditorRecovery();
  }
}
