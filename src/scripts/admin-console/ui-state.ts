type AdminControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement;

export type AdminConsoleErrorBannerState = {
  title: string;
  message?: string;
  items?: Array<string | HTMLElement>;
  retryable?: boolean;
};

export type AdminConsoleErrorBannerOptions = {
  title?: string;
  message?: string;
  retryable?: boolean;
};

type AdminConsoleUiStateContext = {
  root: HTMLElement;
  adminActions: HTMLElement;
  dirtyBanner: HTMLElement;
  errorBanner: HTMLElement;
  errorTitleEl: HTMLElement;
  errorMessageEl: HTMLElement;
  errorListEl: HTMLElement;
  errorRetryBtn: HTMLButtonElement;
  validateBtn: HTMLButtonElement;
  saveBtn: HTMLButtonElement;
  statusTargets: readonly HTMLElement[];
  statusLiveEl: HTMLElement | null;
  queryAll: <T extends Element>(parent: ParentNode, selector: string) => T[];
};

const STATUS_WAITING_SAVE = '等待保存';
const STATUS_CLEAN = '当前配置无未保存更改';

export const createAdminConsoleUiState = ({
  root,
  adminActions,
  dirtyBanner,
  errorBanner,
  errorTitleEl,
  errorMessageEl,
  errorListEl,
  errorRetryBtn,
  validateBtn,
  saveBtn,
  statusTargets,
  statusLiveEl,
  queryAll
}: AdminConsoleUiStateContext) => {
  let isDirty = false;
  let isSaving = false;
  let isValidating = false;
  let isConsoleLocked = false;
  let isAdminActionsNearViewport = false;

  const syncStickyState = (): void => {
    adminActions.dataset.dirty = String(isDirty);
    adminActions.dataset.sticky = String(isDirty && !isAdminActionsNearViewport);
  };

  const setStatus = (state: string, message: string, options: { announce?: boolean } = {}): void => {
    const primaryStatusTarget = statusTargets[0] ?? null;
    const currentState = primaryStatusTarget?.dataset.state ?? '';
    const currentMessage = primaryStatusTarget?.textContent?.trim() || '';
    if (statusTargets.length > 0 && (currentState !== state || currentMessage !== message)) {
      statusTargets.forEach((target) => {
        target.dataset.state = state;
        target.textContent = message;
      });
    }

    if (options.announce === false || !statusLiveEl) return;

    const liveState = statusLiveEl.dataset.state ?? '';
    const liveMessage = statusLiveEl.textContent?.trim() || '';
    if (liveState === state && liveMessage === message) return;
    statusLiveEl.dataset.state = state;
    statusLiveEl.textContent = message;
  };

  const syncDirtyStatus = (next: boolean): void => {
    const primaryStatusTarget = statusTargets[0] ?? null;
    const currentState = primaryStatusTarget?.dataset.state;
    const currentMessage = primaryStatusTarget?.textContent?.trim() || '';

    if (next) {
      if ((currentState === 'ready' || currentState === 'ok') && currentMessage !== STATUS_WAITING_SAVE) {
        setStatus('ready', STATUS_WAITING_SAVE);
      }
      return;
    }

    if (currentState === 'ready' && currentMessage === STATUS_WAITING_SAVE) {
      setStatus('ready', STATUS_CLEAN);
    }
  };

  const clearErrorBanner = (): void => {
    errorBanner.hidden = true;
    errorTitleEl.textContent = '';
    errorMessageEl.hidden = true;
    errorMessageEl.textContent = '';
    errorListEl.hidden = true;
    errorListEl.replaceChildren();
    errorRetryBtn.hidden = true;
  };

  const setErrorBanner = ({
    title,
    message,
    items = [],
    retryable = false
  }: AdminConsoleErrorBannerState): void => {
    errorBanner.hidden = false;
    errorTitleEl.textContent = title;

    if (message) {
      errorMessageEl.hidden = false;
      errorMessageEl.textContent = message;
    } else {
      errorMessageEl.hidden = true;
      errorMessageEl.textContent = '';
    }

    errorListEl.replaceChildren();
    if (items.length) {
      const fragment = document.createDocumentFragment();
      items.forEach((item) => {
        if (typeof item === 'string') {
          const entry = document.createElement('li');
          entry.className = 'admin-banner__list-item';
          entry.textContent = item;
          fragment.appendChild(entry);
          return;
        }
        fragment.appendChild(item);
      });
      errorListEl.appendChild(fragment);
      errorListEl.hidden = false;
    } else {
      errorListEl.hidden = true;
    }

    errorRetryBtn.hidden = !retryable;
  };

  const setErrors = (errors: string[], options: AdminConsoleErrorBannerOptions = {}): void => {
    if (!errors.length) {
      clearErrorBanner();
      return;
    }

    setErrorBanner({
      title: options.title ?? '请先处理以下问题',
      ...(options.message ? { message: options.message } : {}),
      items: errors,
      retryable: options.retryable ?? false
    });
  };

  const syncInteractiveAvailability = (): void => {
    const isInteractionLocked = isConsoleLocked || isSaving || isValidating;
    queryAll<AdminControl>(root, 'input, textarea, select, button').forEach((element) => {
      if (element === errorRetryBtn) {
        element.disabled = isSaving || isValidating;
        return;
      }

      element.disabled = isInteractionLocked;
    });
  };

  return {
    isDirty: (): boolean => isDirty,
    isSaving: (): boolean => isSaving,
    isValidating: (): boolean => isValidating,
    isConsoleLocked: (): boolean => isConsoleLocked,
    setStatus,
    clearErrorBanner,
    setErrorBanner,
    setErrors,
    setDirty: (next: boolean): void => {
      isDirty = next;
      dirtyBanner.hidden = !next;
      syncStickyState();
      syncDirtyStatus(next);
    },
    setActionsNearViewport: (next: boolean): void => {
      isAdminActionsNearViewport = next;
      syncStickyState();
    },
    setConsoleLocked: (next: boolean): void => {
      isConsoleLocked = next;
      root.dataset.consoleLocked = String(next);
      syncInteractiveAvailability();
    },
    setSaving: (next: boolean): void => {
      isSaving = next;
      saveBtn.textContent = next ? '保存中...' : '保存';
      syncInteractiveAvailability();
    },
    setValidating: (next: boolean): void => {
      isValidating = next;
      validateBtn.textContent = next ? '校验中...' : '检查配置';
      syncInteractiveAvailability();
    }
  };
};
