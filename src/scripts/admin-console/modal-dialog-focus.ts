export type ModalDialogFocusController = {
  captureReturnFocus: (target?: Element | null) => void;
  focusInitial: () => void;
  handleKeydown: (event: KeyboardEvent) => void;
  restoreFocus: () => void;
};

export type ModalDialogFocusControllerOptions = {
  getDialog: () => HTMLElement | null;
  getInitialFocus?: () => HTMLElement | null;
  onClose: () => void;
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const isHTMLElement = (value: Element | null): value is HTMLElement =>
  value instanceof HTMLElement;

const isDisabledControl = (element: HTMLElement): boolean =>
  (element instanceof HTMLButtonElement
    || element instanceof HTMLInputElement
    || element instanceof HTMLSelectElement
    || element instanceof HTMLTextAreaElement)
  && element.disabled;

const isFocusableElement = (element: HTMLElement): boolean => {
  if (element.tabIndex < 0 || element.hidden || isDisabledControl(element)) return false;
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  return true;
};

const canReceiveProgrammaticFocus = (element: HTMLElement): boolean => {
  if (element.hidden || isDisabledControl(element)) return false;
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  return true;
};

const focusElement = (element: HTMLElement | null): void => {
  if (!element) return;
  element.focus({ preventScroll: true });
};

export const createModalDialogFocusController = ({
  getDialog,
  getInitialFocus,
  onClose
}: ModalDialogFocusControllerOptions): ModalDialogFocusController => {
  let returnFocusEl: HTMLElement | null = null;

  const getFocusableElements = (): HTMLElement[] => {
    const dialog = getDialog();
    if (!dialog) return [];

    return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      .filter(isFocusableElement);
  };

  const captureReturnFocus = (target: Element | null = null): void => {
    if (target && isHTMLElement(target)) {
      returnFocusEl = target;
      return;
    }

    returnFocusEl = isHTMLElement(document.activeElement) ? document.activeElement : null;
  };

  const focusInitial = (): void => {
    window.setTimeout(() => {
      const dialog = getDialog();
      if (!dialog) return;

      const preferredTarget = getInitialFocus?.() ?? null;
      const fallbackTarget = getFocusableElements()[0] ?? dialog;
      const target = preferredTarget && canReceiveProgrammaticFocus(preferredTarget)
        ? preferredTarget
        : fallbackTarget;

      focusElement(target);
    }, 0);
  };

  const restoreFocus = (): void => {
    const target = returnFocusEl;
    returnFocusEl = null;

    window.setTimeout(() => {
      if (!target || !document.contains(target)) return;
      focusElement(target);
    }, 0);
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;

    const dialog = getDialog();
    if (!dialog) return;

    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) {
      event.preventDefault();
      focusElement(dialog);
      return;
    }

    const firstElement = focusableElements[0] ?? null;
    const lastElement = focusableElements[focusableElements.length - 1] ?? null;
    if (!firstElement || !lastElement) return;

    const activeElement = isHTMLElement(document.activeElement) ? document.activeElement : null;

    if (!activeElement || !dialog.contains(activeElement)) {
      event.preventDefault();
      focusElement(firstElement);
      return;
    }

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault();
      focusElement(lastElement);
      return;
    }

    if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      focusElement(firstElement);
    }
  };

  return {
    captureReturnFocus,
    focusInitial,
    handleKeydown,
    restoreFocus
  };
};
