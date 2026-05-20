import {
  ADMIN_DEFAULT_SIDEBAR_NAV_MODE_STORAGE_KEY,
  ADMIN_EDITOR_DEFAULTS_STORAGE_KEY,
  ADMIN_EDITOR_LAYOUT_STORAGE_KEY,
  ADMIN_EDITOR_SIDE_PANEL_PREFERENCE_STORAGE_KEY,
  ADMIN_SIDEBAR_NAV_PUBLIC,
  ADMIN_SHOW_TOP_NAV_STORAGE_KEY,
  DEFAULT_ADMIN_EDITOR_DEFAULTS,
  isAdminEditorDefaultLayout,
  isAdminSidebarNavMode,
  isAdminTopNavVisible,
  parseAdminEditorDefaults,
  serializeAdminEditorDefaults,
  type AdminEditorDefaults,
  type AdminSidebarNavMode
} from '../lib/admin-console/ui-prefs-keys';

const PREFS_POPOVER_CLOSE_DELAY_MS = 160;

const readLocalStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
};

const writeLocalStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (_) {}
};

const removeLocalStorage = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch (_) {}
};

const readStoredShowTopNav = (): boolean => {
  return isAdminTopNavVisible(readLocalStorage(ADMIN_SHOW_TOP_NAV_STORAGE_KEY));
};

const writeStoredShowTopNav = (showTopNav: boolean) => {
  writeLocalStorage(ADMIN_SHOW_TOP_NAV_STORAGE_KEY, showTopNav ? 'true' : 'false');
};

const readStoredDefaultSidebarNavMode = (): AdminSidebarNavMode => {
  const stored = readLocalStorage(ADMIN_DEFAULT_SIDEBAR_NAV_MODE_STORAGE_KEY) ?? undefined;
  return isAdminSidebarNavMode(stored) ? stored : ADMIN_SIDEBAR_NAV_PUBLIC;
};

const writeStoredDefaultSidebarNavMode = (mode: AdminSidebarNavMode) => {
  writeLocalStorage(ADMIN_DEFAULT_SIDEBAR_NAV_MODE_STORAGE_KEY, mode);
};

const readStoredEditorDefaults = (): AdminEditorDefaults =>
  parseAdminEditorDefaults(readLocalStorage(ADMIN_EDITOR_DEFAULTS_STORAGE_KEY)) ?? DEFAULT_ADMIN_EDITOR_DEFAULTS;

const writeStoredEditorDefaults = (defaults: AdminEditorDefaults) => {
  writeLocalStorage(ADMIN_EDITOR_DEFAULTS_STORAGE_KEY, serializeAdminEditorDefaults(defaults));
};

const clearStoredExplicitEditorPreferences = () => {
  removeLocalStorage(ADMIN_EDITOR_LAYOUT_STORAGE_KEY);
  removeLocalStorage(ADMIN_EDITOR_SIDE_PANEL_PREFERENCE_STORAGE_KEY);
};

const persistEditorDefaults = (defaults: AdminEditorDefaults) => {
  writeStoredEditorDefaults(defaults);
  clearStoredExplicitEditorPreferences();
};

const bindShowTopNavPreference = (prefsRoot: HTMLElement, root: HTMLElement) => {
  const checkbox = prefsRoot.querySelector<HTMLInputElement>('[data-admin-ui-pref="show-top-nav"]');
  if (!checkbox) return;

  const initialShowTopNav = root.dataset.adminShowTopNav === 'true' || readStoredShowTopNav();
  const applyShowTopNav = (showTopNav: boolean, persist: boolean) => {
    checkbox.checked = showTopNav;
    if (showTopNav) {
      root.dataset.adminShowTopNav = 'true';
    } else {
      delete root.dataset.adminShowTopNav;
    }

    if (persist) writeStoredShowTopNav(showTopNav);
  };

  applyShowTopNav(initialShowTopNav, false);

  checkbox.addEventListener('change', () => {
    applyShowTopNav(checkbox.checked, true);
  });
};

const bindDefaultSidebarNavPreference = (prefsRoot: HTMLElement) => {
  const controls = Array.from(
    prefsRoot.querySelectorAll<HTMLInputElement>('[data-admin-ui-pref="default-sidebar-nav"]')
  );
  if (controls.length === 0) return;

  const applyMode = (mode: AdminSidebarNavMode) => {
    controls.forEach((control) => {
      control.checked = control.value === mode;
    });
  };

  applyMode(readStoredDefaultSidebarNavMode());

  controls.forEach((control) => {
    control.addEventListener('change', () => {
      if (!control.checked) return;
      const mode = control.value;
      if (!isAdminSidebarNavMode(mode)) return;
      applyMode(mode);
      writeStoredDefaultSidebarNavMode(mode);
    });
  });
};

const bindEditorDefaultPreferences = (prefsRoot: HTMLElement) => {
  const layoutControls = Array.from(
    prefsRoot.querySelectorAll<HTMLInputElement>('[data-admin-ui-pref="editor-default-layout"]')
  );
  const outlineControl = prefsRoot.querySelector<HTMLInputElement>('[data-admin-ui-pref="editor-default-outline"]');
  const syntaxControl = prefsRoot.querySelector<HTMLInputElement>('[data-admin-ui-pref="editor-default-syntax"]');

  if (layoutControls.length === 0 && !outlineControl && !syntaxControl) return;

  const readControls = (): AdminEditorDefaults => {
    const selectedLayout = layoutControls.find((control) => control.checked)?.value;
    const storedDefaults = readStoredEditorDefaults();
    return {
      layout: isAdminEditorDefaultLayout(selectedLayout) ? selectedLayout : storedDefaults.layout,
      outlineOpen: outlineControl?.checked ?? storedDefaults.outlineOpen,
      syntaxOpen: syntaxControl?.checked ?? storedDefaults.syntaxOpen
    };
  };

  const applyDefaults = (defaults: AdminEditorDefaults) => {
    layoutControls.forEach((control) => {
      control.checked = control.value === defaults.layout;
    });
    if (outlineControl) outlineControl.checked = defaults.outlineOpen;
    if (syntaxControl) syntaxControl.checked = defaults.syntaxOpen;
  };

  applyDefaults(readStoredEditorDefaults());

  layoutControls.forEach((control) => {
    control.addEventListener('change', () => {
      if (!control.checked || !isAdminEditorDefaultLayout(control.value)) return;
      const nextDefaults = readControls();
      applyDefaults(nextDefaults);
      persistEditorDefaults(nextDefaults);
    });
  });

  outlineControl?.addEventListener('change', () => {
    persistEditorDefaults(readControls());
  });

  syntaxControl?.addEventListener('change', () => {
    persistEditorDefaults(readControls());
  });
};

const bindDetailsPopoverClose = (details: HTMLDetailsElement) => {
  const summary = details.querySelector<HTMLElement>('summary');
  let closeTimer: number | undefined;

  const shouldSkipAnimation = () => {
    return typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  const clearClosingState = () => {
    if (closeTimer !== undefined) {
      window.clearTimeout(closeTimer);
      closeTimer = undefined;
    }

    delete details.dataset.closing;
  };

  const closePopover = (restoreFocus: boolean) => {
    if (!details.open) return;

    if (shouldSkipAnimation()) {
      clearClosingState();
      details.open = false;
      if (restoreFocus) summary?.focus();
      return;
    }

    if (details.dataset.closing === 'true') return;
    details.dataset.closing = 'true';

    closeTimer = window.setTimeout(() => {
      details.open = false;
      clearClosingState();
      if (restoreFocus) summary?.focus();
    }, PREFS_POPOVER_CLOSE_DELAY_MS);
  };

  summary?.addEventListener('click', (event) => {
    if (!details.open) return;
    event.preventDefault();
    closePopover(false);
  });

  details.addEventListener('toggle', () => {
    if (!details.open) return;
    clearClosingState();
  });

  document.addEventListener('click', (event) => {
    if (!details.open) return;
    if (event.target instanceof Node && details.contains(event.target)) return;
    closePopover(false);
  });

  details.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    closePopover(true);
  });
};

export function initAdminUiPrefs() {
  if (!document.body.classList.contains('admin-page')) return;

  const root = document.documentElement;
  const prefsRoot = document.querySelector<HTMLElement>('[data-admin-ui-prefs-root]');
  if (!prefsRoot) return;

  bindShowTopNavPreference(prefsRoot, root);
  bindDefaultSidebarNavPreference(prefsRoot);
  bindEditorDefaultPreferences(prefsRoot);

  if (prefsRoot instanceof HTMLDetailsElement) {
    bindDetailsPopoverClose(prefsRoot);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminUiPrefs, { once: true });
} else {
  initAdminUiPrefs();
}
