export const ADMIN_SIDEBAR_NAV_MODE_STORAGE_KEY = 'astro-whono:admin-sidebar:nav-mode';
export const ADMIN_SHOW_TOP_NAV_STORAGE_KEY = 'astro-whono:admin:show-top-nav';
export const ADMIN_DEFAULT_SIDEBAR_NAV_MODE_STORAGE_KEY = 'astro-whono:admin-sidebar:default-nav-mode';
export const ADMIN_EDITOR_DEFAULTS_STORAGE_KEY = 'astro-whono:admin-editor:defaults';
export const ADMIN_EDITOR_LAYOUT_STORAGE_KEY = 'astro-whono:admin-editor:layout';
export const ADMIN_EDITOR_SIDE_PANEL_PREFERENCE_STORAGE_KEY = 'astro-whono:admin-editor:outline-state';

export type AdminSidebarNavMode = 'public' | 'admin';
export type AdminEditorDefaultLayout = 'stacked' | 'split';
export type AdminEditorDefaults = {
  layout: AdminEditorDefaultLayout;
  outlineOpen: boolean;
  syntaxOpen: boolean;
};

export const ADMIN_SIDEBAR_NAV_PUBLIC: AdminSidebarNavMode = 'public';
export const ADMIN_SIDEBAR_NAV_ADMIN: AdminSidebarNavMode = 'admin';
export const ADMIN_EDITOR_DEFAULT_LAYOUT_SPLIT: AdminEditorDefaultLayout = 'split';
export const ADMIN_EDITOR_DEFAULT_LAYOUT_STACKED: AdminEditorDefaultLayout = 'stacked';
export const DEFAULT_ADMIN_EDITOR_DEFAULTS: AdminEditorDefaults = {
  layout: ADMIN_EDITOR_DEFAULT_LAYOUT_SPLIT,
  outlineOpen: false,
  syntaxOpen: false
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isAdminSidebarNavMode = (value: string | undefined): value is AdminSidebarNavMode =>
  value === ADMIN_SIDEBAR_NAV_PUBLIC || value === ADMIN_SIDEBAR_NAV_ADMIN;

export const isAdminTopNavVisible = (value: string | undefined | null): boolean =>
  value === 'true';

export const isAdminEditorDefaultLayout = (value: unknown): value is AdminEditorDefaultLayout =>
  value === ADMIN_EDITOR_DEFAULT_LAYOUT_SPLIT || value === ADMIN_EDITOR_DEFAULT_LAYOUT_STACKED;

export const isAdminEditorDefaults = (value: unknown): value is AdminEditorDefaults => {
  if (!isRecord(value)) return false;
  return (
    isAdminEditorDefaultLayout(value.layout) &&
    typeof value.outlineOpen === 'boolean' &&
    typeof value.syntaxOpen === 'boolean'
  );
};

export const parseAdminEditorDefaults = (value: string | null | undefined): AdminEditorDefaults | null => {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isAdminEditorDefaults(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const serializeAdminEditorDefaults = (defaults: AdminEditorDefaults): string =>
  JSON.stringify(defaults);

export const readStoredAdminEditorDefaults = (
  storageKey = ADMIN_EDITOR_DEFAULTS_STORAGE_KEY
): AdminEditorDefaults | null => {
  if (typeof window === 'undefined') return null;
  try {
    return parseAdminEditorDefaults(window.localStorage.getItem(storageKey));
  } catch {
    return null;
  }
};
