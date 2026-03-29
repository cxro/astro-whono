import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { site as legacySite } from '../../site.config.mjs';
import {
  getBitsAvatarLocalFilePath,
  getHeroImageLocalFilePath,
  normalizeBitsAvatarPath,
  normalizeHeroImageSrc
} from '../utils/format';
import {
  ADMIN_ARTICLE_META_DATE_LABEL_DEFAULT,
  ADMIN_ARTICLE_META_DATE_LABEL_MAX_LENGTH,
  ADMIN_HERO_IMAGE_ALT_DEFAULT,
  ADMIN_HERO_IMAGE_ALT_MAX_LENGTH,
  ADMIN_HOME_INTRO_LINK_DEFAULT,
  ADMIN_HOME_INTRO_LINK_KEY_SET,
  ADMIN_HOME_INTRO_LINK_LIMIT,
  ADMIN_LOCALE_RE,
  ADMIN_NAV_IDS,
  ADMIN_NAV_ORDER_MAX,
  ADMIN_NAV_ORDER_MIN,
  ADMIN_NAV_ORNAMENT_DEFAULT,
  ADMIN_NAV_ORNAMENT_MAX_LENGTH,
  ADMIN_HERO_PRESET_SET,
  ADMIN_SOCIAL_ORDER_MAX,
  ADMIN_SOCIAL_ORDER_MIN,
  ADMIN_SOCIAL_PRESET_IDS,
  createAdminWritableThemeSettingsGroups,
  getAdminNavOrderIssues,
  getAdminThemeSettingsGroupFileName,
  getAdminThemeSettingsMismatchPaths,
  getAdminSocialOrderIssues,
  ADMIN_SIDEBAR_DIVIDER_DEFAULT,
  isAdminNavOrderValue,
  isAdminSocialOrderValue,
  isAdminSidebarDividerVariant,
  normalizeAdminSocialIconKey,
} from './admin-console/shared';

export type SettingSource = 'new' | 'legacy' | 'default';

export type SidebarNavId = 'essay' | 'bits' | 'memo' | 'archive' | 'about';
export type PageId = 'essay' | 'archive' | 'bits' | 'memo' | 'about';
export type HeroPresetId = 'default' | 'none';
export type SidebarDividerVariant = 'default' | 'subtle' | 'none';
export type HomeIntroLinkKey = 'archive' | 'essay' | 'bits' | 'memo' | 'about' | 'tag';
export type SiteSocialPresetId = 'github' | 'x' | 'email';
export type SiteSocialKind = 'preset' | 'custom';
export type SiteSocialIconKey =
  | 'github'
  | 'x'
  | 'email'
  | 'weibo'
  | 'facebook'
  | 'instagram'
  | 'telegram'
  | 'mastodon'
  | 'bilibili'
  | 'youtube'
  | 'linkedin'
  | 'website';

export interface SidebarNavItem {
  id: SidebarNavId;
  label: string;
  ornament: string | null;
  visible: boolean;
  order: number;
}

export interface SiteFooterSettings {
  startYear: number;
  showCurrentYear: boolean;
  copyright: string;
}

export interface SiteSocialCustomItem {
  id: string;
  label: string;
  href: string;
  iconKey: SiteSocialIconKey;
  visible: boolean;
  order: number;
}

export interface SiteSocialPresetOrder {
  github: number;
  x: number;
  email: number;
}

export interface ResolvedSocialItem {
  id: string;
  label: string;
  href: string;
  iconKey: SiteSocialIconKey;
  kind: SiteSocialKind;
  visible: boolean;
  order: number;
}

export interface SiteSocialLinks {
  github: string | null;
  x: string | null;
  email: string | null;
  presetOrder: SiteSocialPresetOrder;
  custom: SiteSocialCustomItem[];
  resolvedSocialItems: ResolvedSocialItem[];
}

export interface SiteSettings {
  title: string;
  description: string;
  defaultLocale: string;
  footer: SiteFooterSettings;
  socialLinks: SiteSocialLinks;
}

export interface ShellSettings {
  brandTitle: string;
  quote: string;
  nav: SidebarNavItem[];
}

export interface HomeSettings {
  introLead: string;
  introMore: string;
  introMoreLinks: HomeIntroLinkKey[];
  showIntroLead: boolean;
  showIntroMore: boolean;
  heroPresetId: HeroPresetId;
  heroImageSrc: string | null;
  heroImageAlt: string;
}

export interface PageHeadingSettings {
  title: string | null;
  subtitle: string | null;
}

export interface MemoPageSettings extends PageHeadingSettings {}

export interface BitsDefaultAuthorSettings {
  name: string;
  avatar: string;
}

export interface BitsPageSettings extends PageHeadingSettings {
  defaultAuthor: BitsDefaultAuthorSettings;
}

export interface PageSettings {
  essay: PageHeadingSettings;
  archive: PageHeadingSettings;
  bits: BitsPageSettings;
  memo: MemoPageSettings;
  about: PageHeadingSettings;
}

export interface ArticleMetaSettings {
  showDate: boolean;
  dateLabel: string;
  showTags: boolean;
  showWordCount: boolean;
  showReadingTime: boolean;
}

export type ArticleMetaDisplayContext = 'home' | 'list' | 'detail';

export interface UiSettings {
  codeBlock: {
    showLineNumbers: boolean;
  };
  readingMode: {
    showEntry: boolean;
  };
  articleMeta: ArticleMetaSettings;
  layout: {
    sidebarDivider: SidebarDividerVariant;
  };
}

export interface ThemeSettings {
  site: SiteSettings;
  shell: ShellSettings;
  home: HomeSettings;
  page: PageSettings;
  ui: UiSettings;
}

export interface ThemeSettingsSources {
  site: {
    title: SettingSource;
    description: SettingSource;
    defaultLocale: SettingSource;
    footerStartYear: SettingSource;
    footerShowCurrentYear: SettingSource;
    footerCopyright: SettingSource;
    socialLinksGithub: SettingSource;
    socialLinksX: SettingSource;
    socialLinksEmail: SettingSource;
    socialLinksGithubOrder: SettingSource;
    socialLinksXOrder: SettingSource;
    socialLinksEmailOrder: SettingSource;
    socialLinksCustom: SettingSource;
  };
  shell: {
    brandTitle: SettingSource;
    quote: SettingSource;
    nav: SettingSource;
  };
  home: {
    introLead: SettingSource;
    introMore: SettingSource;
    introMoreLinks: SettingSource;
    showIntroLead: SettingSource;
    showIntroMore: SettingSource;
    heroPresetId: SettingSource;
    heroImageSrc: SettingSource;
    heroImageAlt: SettingSource;
  };
  page: {
    essayTitle: SettingSource;
    essaySubtitle: SettingSource;
    archiveTitle: SettingSource;
    archiveSubtitle: SettingSource;
    bitsTitle: SettingSource;
    bitsSubtitle: SettingSource;
    bitsDefaultAuthorName: SettingSource;
    bitsDefaultAuthorAvatar: SettingSource;
    memoTitle: SettingSource;
    memoSubtitle: SettingSource;
    aboutTitle: SettingSource;
    aboutSubtitle: SettingSource;
  };
  ui: {
    codeBlockShowLineNumbers: SettingSource;
    readingModeShowEntry: SettingSource;
    articleMetaShowDate: SettingSource;
    articleMetaDateLabel: SettingSource;
    articleMetaShowTags: SettingSource;
    articleMetaShowWordCount: SettingSource;
    articleMetaShowReadingTime: SettingSource;
    layoutSidebarDivider: SettingSource;
  };
}

const ARTICLE_META_TAG_LIMITS: Record<ArticleMetaDisplayContext, number> = {
  home: 1,
  list: 3,
  detail: 3
};

export interface ThemeSettingsResolved {
  settings: ThemeSettings;
  sources: ThemeSettingsSources;
}

export interface EditableSiteSocialLinks {
  github: string | null;
  x: string | null;
  email: string | null;
  presetOrder: SiteSocialPresetOrder;
  custom: SiteSocialCustomItem[];
}

export interface EditableSiteSettings extends Omit<SiteSettings, 'socialLinks'> {
  socialLinks: EditableSiteSocialLinks;
}

export interface EditableThemeSettings extends Omit<ThemeSettings, 'site'> {
  site: EditableSiteSettings;
}

export interface ThemeSettingsEditablePayload {
  revision: string;
  settings: EditableThemeSettings;
  sources: ThemeSettingsSources;
}

type EditableThemeSettingsSnapshot = EditableThemeSettings;

export type ThemeSettingsFileGroup = 'site' | 'shell' | 'home' | 'page' | 'ui';

export interface ThemeSettingsReadDiagnostic {
  group: ThemeSettingsFileGroup;
  path: string;
  code: 'invalid-json' | 'invalid-root' | 'read-failed' | 'schema-mismatch';
  message: string;
  detail?: string;
  line?: number;
  column?: number;
}

export interface ThemeSettingsEditableErrorState {
  ok: false;
  mode: 'invalid-settings';
  message: string;
  errors: string[];
  diagnostics: ThemeSettingsReadDiagnostic[];
}

export type ThemeSettingsEditableState =
  | {
      ok: true;
      payload: ThemeSettingsEditablePayload;
    }
  | ThemeSettingsEditableErrorState;

const DEFAULT_SETTINGS_DIR = join(process.cwd(), 'src', 'data', 'settings');
const INTERNAL_TEST_SETTINGS_DIR_ENV = 'ASTRO_WHONO_INTERNAL_TEST_SETTINGS_DIR';
const INTERNAL_TEST_SETTINGS_FLAG_ENV = 'ASTRO_WHONO_INTERNAL_TEST_SETTINGS';
const SETTINGS_FILE_GROUPS: readonly ThemeSettingsFileGroup[] = ['site', 'shell', 'home', 'page', 'ui'];
const SETTINGS_RELATIVE_PATHS: Record<ThemeSettingsFileGroup, string> = {
  site: 'src/data/settings/site.json',
  shell: 'src/data/settings/shell.json',
  home: 'src/data/settings/home.json',
  page: 'src/data/settings/page.json',
  ui: 'src/data/settings/ui.json'
};

const isInternalThemeSettingsDirOverrideEnabled = (): boolean =>
  process.env[INTERNAL_TEST_SETTINGS_FLAG_ENV] === '1' || process.env.VITEST === 'true';

const resolveInternalThemeSettingsDirOverride = (): string | null => {
  if (!isInternalThemeSettingsDirOverrideEnabled()) return null;
  const rawValue = process.env[INTERNAL_TEST_SETTINGS_DIR_ENV]?.trim();
  return rawValue ? rawValue : null;
};

export const getThemeSettingsDir = (): string => resolveInternalThemeSettingsDirOverride() ?? DEFAULT_SETTINGS_DIR;

export const getThemeSettingsFilePath = (group: ThemeSettingsFileGroup): string =>
  join(getThemeSettingsDir(), getAdminThemeSettingsGroupFileName(group));

export const getThemeSettingsRelativePath = (group: ThemeSettingsFileGroup): string => SETTINGS_RELATIVE_PATHS[group];

const THEME_SETTINGS_INVALID_MESSAGE =
  'Detected corrupted settings JSON file. Theme Console has stopped reading and disabled saving. Please fix the file and try again.';

const LEGACY_INTRO_LEAD =
  'This is an open-source writing theme and example content library containing Essays/essay, Memos/memo, Archive/archive, and Bits/bits. See README for usage and configuration.';
const LEGACY_INTRO_MORE = 'More articles at';
const LEGACY_ESSAY_TITLE = 'Essays';
const LEGACY_ARCHIVE_TITLE = 'Archive';
const LEGACY_ESSAY_SUBTITLE = 'Essays and Notes';
const LEGACY_BITS_TITLE = 'Bits';
const LEGACY_BITS_SUBTITLE = 'Life is more than long stories';
const LEGACY_ABOUT_TITLE = 'About';
const LEGACY_QUOTE = 'A minimal Astro theme\nfor essays, notes, and docs.\nDesigned for reading,\nopen-source.';
const LEGACY_FOOTER_START_YEAR = 2026;
const LEGACY_FOOTER_SHOW_CURRENT_YEAR = true;
const LEGACY_FOOTER_COPYRIGHT = `Tai Nguyen's blog · by trongtai37`;
const DEFAULT_PRESET_SOCIAL_ORDER: SiteSocialPresetOrder = {
  github: 1,
  x: 2,
  email: 3
};
const LEGACY_SOCIAL_LINKS: SiteSocialLinks = {
  github: 'https://github.com/trongtai37/my-blog',
  x: 'https://twitter.com/trongtai37',
  email: 'trongtai37@gmail.com',
  presetOrder: { ...DEFAULT_PRESET_SOCIAL_ORDER },
  custom: [],
  resolvedSocialItems: []
};
const LEGACY_NAV: SidebarNavItem[] = [
  { id: 'essay', label: 'Essay', ornament: ADMIN_NAV_ORNAMENT_DEFAULT, visible: true, order: 1 },
  { id: 'bits', label: 'Bits', ornament: ADMIN_NAV_ORNAMENT_DEFAULT, visible: true, order: 2 },
  { id: 'memo', label: 'Memo', ornament: ADMIN_NAV_ORNAMENT_DEFAULT, visible: true, order: 3 },
  { id: 'archive', label: 'Archive', ornament: ADMIN_NAV_ORNAMENT_DEFAULT, visible: true, order: 4 },
  { id: 'about', label: 'About', ornament: ADMIN_NAV_ORNAMENT_DEFAULT, visible: true, order: 5 }
];
const LEGACY_NAV_ORDER = new Map<SidebarNavId, number>(LEGACY_NAV.map((item) => [item.id, item.order]));

const cloneNavItems = (items: readonly SidebarNavItem[]): SidebarNavItem[] =>
  items.map((item) => ({ ...item }));

const cloneSocialCustomItems = (items: readonly SiteSocialCustomItem[]): SiteSocialCustomItem[] =>
  items.map((item) => ({ ...item }));

const clonePresetSocialOrder = (value: Readonly<SiteSocialPresetOrder>): SiteSocialPresetOrder => ({
  ...value
});

const cloneResolvedSocialItems = (items: readonly ResolvedSocialItem[]): ResolvedSocialItem[] =>
  items.map((item) => ({ ...item }));

const cloneHomeIntroLinks = (items: readonly HomeIntroLinkKey[]): HomeIntroLinkKey[] => [...items];

const cloneThemeSettingsSources = (sources: ThemeSettingsSources): ThemeSettingsSources => ({
  site: { ...sources.site },
  shell: { ...sources.shell },
  home: { ...sources.home },
  page: { ...sources.page },
  ui: { ...sources.ui }
});

const cloneThemeSettingsReadDiagnostics = (
  diagnostics: readonly ThemeSettingsReadDiagnostic[]
): ThemeSettingsReadDiagnostic[] => diagnostics.map((diagnostic) => ({ ...diagnostic }));

const DEFAULT_SITE: SiteSettings = {
  title: 'Whono',
  description: 'A showcase site for an Astro theme: lightweight, maintainable, and reusable.',
  defaultLocale: 'en-US',
  footer: {
    startYear: LEGACY_FOOTER_START_YEAR,
    showCurrentYear: LEGACY_FOOTER_SHOW_CURRENT_YEAR,
    copyright: LEGACY_FOOTER_COPYRIGHT
  },
  socialLinks: {
    github: null,
    x: null,
    email: null,
    presetOrder: clonePresetSocialOrder(DEFAULT_PRESET_SOCIAL_ORDER),
    custom: [],
    resolvedSocialItems: []
  }
};

const DEFAULT_SHELL: ShellSettings = {
  brandTitle: 'trongtai37',
  quote: LEGACY_QUOTE,
  nav: cloneNavItems(LEGACY_NAV)
};

const DEFAULT_HOME: HomeSettings = {
  introLead: LEGACY_INTRO_LEAD,
  introMore: LEGACY_INTRO_MORE,
  introMoreLinks: cloneHomeIntroLinks(ADMIN_HOME_INTRO_LINK_DEFAULT),
  showIntroLead: true,
  showIntroMore: true,
  heroPresetId: 'default',
  heroImageSrc: null,
  heroImageAlt: ADMIN_HERO_IMAGE_ALT_DEFAULT
};

const DEFAULT_PAGE: PageSettings = {
  essay: {
    title: LEGACY_ESSAY_TITLE,
    subtitle: LEGACY_ESSAY_SUBTITLE
  },
  archive: {
    title: LEGACY_ARCHIVE_TITLE,
    subtitle: '按年份分组的归档目录'
  },
  bits: {
    title: LEGACY_BITS_TITLE,
    subtitle: LEGACY_BITS_SUBTITLE,
    defaultAuthor: {
      name: 'trongtai37',
      avatar: 'author/avatar.webp'
    }
  },
  memo: {
    title: null,
    subtitle: null
  },
  about: {
    title: LEGACY_ABOUT_TITLE,
    subtitle: null
  }
};

const DEFAULT_UI: UiSettings = {
  codeBlock: {
    showLineNumbers: true
  },
  readingMode: {
    showEntry: true
  },
  articleMeta: {
    showDate: true,
    dateLabel: ADMIN_ARTICLE_META_DATE_LABEL_DEFAULT,
    showTags: true,
    showWordCount: true,
    showReadingTime: true
  },
  layout: {
    sidebarDivider: ADMIN_SIDEBAR_DIVIDER_DEFAULT
  }
};

const NAV_IDS: ReadonlySet<SidebarNavId> = new Set(['essay', 'bits', 'memo', 'archive', 'about']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GITHUB_HOSTS = ['github.com'];
const X_HOSTS = ['x.com', 'twitter.com'];
const SOCIAL_CUSTOM_LIMIT = 8;
const PRESET_SOCIAL_ITEMS: readonly {
  id: SiteSocialPresetId;
  label: string;
  iconKey: SiteSocialIconKey;
}[] = [
  { id: 'github', label: 'GitHub', iconKey: 'github' },
  { id: 'x', label: 'X', iconKey: 'x' },
  { id: 'email', label: 'Email', iconKey: 'email' }
];

const SIDEBAR_HREFS: Record<SidebarNavId, string> = {
  essay: '/essay/',
  bits: '/bits/',
  memo: '/memo/',
  archive: '/archive/',
  about: '/about/'
};

let cachedSettings: ThemeSettingsResolved | null = null;
const shouldCacheThemeSettings = import.meta.env.PROD;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value.trim() : undefined;

const asNonEmptyString = (value: unknown): string | undefined => {
  const next = asString(value);
  return next ? next : undefined;
};

const asLocale = (value: unknown): string | undefined => {
  const next = asNonEmptyString(value);
  return next && ADMIN_LOCALE_RE.test(next) ? next : undefined;
};

const asSingleLineString = (value: unknown, maxLength?: number): string | undefined => {
  const next = asNonEmptyString(value);
  if (!next) return undefined;
  if (next.includes('\n') || next.includes('\r')) return undefined;
  if (typeof maxLength === 'number' && next.length > maxLength) return undefined;
  return next;
};

const asTrimmedSingleLineString = (value: unknown, maxLength?: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const next = value.trim();
  if (next.includes('\n') || next.includes('\r')) return undefined;
  if (typeof maxLength === 'number' && next.length > maxLength) return undefined;
  return next;
};

const asNullableSingleLineString = (value: unknown, maxLength?: number): string | null | undefined => {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes('\n') || trimmed.includes('\r')) return undefined;
  if (typeof maxLength === 'number' && trimmed.length > maxLength) return undefined;
  return trimmed;
};

const asInteger = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Number.isInteger(value) ? value : undefined;
};

const asFooterStartYear = (value: unknown): number | undefined => {
  const next = asInteger(value);
  if (next === undefined) return undefined;
  const currentYear = new Date().getFullYear();
  return next >= 1900 && next <= currentYear ? next : undefined;
};

const asPresetSocialOrderValue = (value: unknown): number | undefined => {
  const next = asInteger(value);
  return next !== undefined && isAdminSocialOrderValue(next) ? next : undefined;
};

const asNullableString = (value: unknown): string | null | undefined => {
  if (value === null) return null;

  const next = asString(value);
  if (next === undefined) return undefined;
  return next || null;
};

const asHttpsUrl = (value: unknown, allowedHosts?: readonly string[]): string | null | undefined => {
  if (value === null) return null;

  const next = asString(value);
  if (next === undefined) return undefined;
  if (!next) return null;

  try {
    const parsed = new URL(next);
    if (parsed.protocol !== 'https:') return undefined;
    if (allowedHosts?.length) {
      const hostname = parsed.hostname.toLowerCase();
      const isAllowed = allowedHosts.some(
        (host) => hostname === host || hostname === `www.${host}` || hostname.endsWith(`.${host}`)
      );
      if (!isAllowed) return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
};

const asEmailAddress = (value: unknown): string | null | undefined => {
  if (value === null) return null;

  const next = asString(value);
  if (next === undefined) return undefined;
  if (!next) return null;

  const normalized = next.replace(/^mailto:/i, '').trim();
  return EMAIL_RE.test(normalized) ? normalized : undefined;
};

const asBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const asNavId = (value: unknown): SidebarNavId | undefined => {
  if (typeof value !== 'string') return undefined;
  return NAV_IDS.has(value as SidebarNavId) ? (value as SidebarNavId) : undefined;
};

const asHeroPresetId = (value: unknown): HeroPresetId | undefined => {
  if (typeof value !== 'string') return undefined;
  return ADMIN_HERO_PRESET_SET.has(value as HeroPresetId) ? (value as HeroPresetId) : undefined;
};

const asSidebarDividerVariant = (value: unknown): SidebarDividerVariant | undefined => {
  if (typeof value !== 'string') return undefined;
  return isAdminSidebarDividerVariant(value) ? value : undefined;
};

const asHeroImageSrc = (value: unknown): string | null | undefined => {
  const normalized = normalizeHeroImageSrc(value);
  if (normalized === undefined || normalized === null) return normalized;

  const localFilePath = getHeroImageLocalFilePath(normalized);
  if (!localFilePath) return normalized;

  return existsSync(join(process.cwd(), ...localFilePath.split('/'))) ? normalized : undefined;
};

const asBitsAvatarPath = (value: unknown): string | undefined => {
  const normalized = normalizeBitsAvatarPath(value);
  if (normalized === undefined || !normalized) return normalized;

  const localFilePath = getBitsAvatarLocalFilePath(normalized);
  if (!localFilePath) return normalized;

  return existsSync(join(process.cwd(), ...localFilePath.split('/'))) ? normalized : undefined;
};

const asHomeIntroLinkKey = (value: unknown): HomeIntroLinkKey | undefined => {
  if (typeof value !== 'string') return undefined;
  return ADMIN_HOME_INTRO_LINK_KEY_SET.has(value as HomeIntroLinkKey) ? (value as HomeIntroLinkKey) : undefined;
};

const asSocialIconKey = (value: unknown): SiteSocialIconKey | undefined => {
  return normalizeAdminSocialIconKey(value);
};

export const getVisibleArticleMetaTags = (
  tags: readonly string[] | null | undefined,
  context: ArticleMetaDisplayContext
): string[] => {
  if (!Array.isArray(tags)) return [];

  return tags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter((tag): tag is string => Boolean(tag))
    .slice(0, ARTICLE_META_TAG_LIMITS[context]);
};

const resolveValue = <T>(
  nextValue: T | undefined,
  legacyValue: T | undefined,
  defaultValue: T
): { value: T; source: SettingSource } => {
  if (nextValue !== undefined) return { value: nextValue, source: 'new' };
  if (legacyValue !== undefined) return { value: legacyValue, source: 'legacy' };
  return { value: defaultValue, source: 'default' };
};

const toReadErrorDetail = (error: unknown): string =>
  error instanceof Error ? error.message.trim() : String(error).trim();

const extractDiagnosticLocation = (
  detail?: string
): { line?: number; column?: number } => {
  if (!detail) return {};

  const match = detail.match(/\(line\s+(\d+)\s+column\s+(\d+)\)\s*$/i);
  if (!match) return {};

  const line = Number.parseInt(match[1] ?? '', 10);
  const column = Number.parseInt(match[2] ?? '', 10);
  const location: { line?: number; column?: number } = {};
  if (Number.isFinite(line)) {
    location.line = line;
  }
  if (Number.isFinite(column)) {
    location.column = column;
  }
  return location;
};

const createThemeSettingsReadDiagnostic = (
  group: ThemeSettingsFileGroup,
  code: ThemeSettingsReadDiagnostic['code'],
  detail?: string
): ThemeSettingsReadDiagnostic => {
  const path = SETTINGS_RELATIVE_PATHS[group];
  const message =
    code === 'invalid-json'
      ? `${path} 不是合法 JSON`
      : code === 'invalid-root'
        ? `${path} 的根节点必须是 JSON 对象`
        : code === 'schema-mismatch'
          ? `${path} 存在无效或非规范配置值`
          : `${path} 读取失败`;
  const location = extractDiagnosticLocation(detail);

  return {
    group,
    path,
    code,
    message,
    ...(detail ? { detail } : {}),
    ...location
  };
};

const readSettingsObject = (
  name: ThemeSettingsFileGroup,
  diagnostics: ThemeSettingsReadDiagnostic[] = []
): Record<string, unknown> | undefined => {
  const filePath = getThemeSettingsFilePath(name);
  if (!existsSync(filePath)) return undefined;

  try {
    const raw = readFileSync(filePath, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      const diagnostic = createThemeSettingsReadDiagnostic(name, 'invalid-json', toReadErrorDetail(error));
      console.warn(`[astro-whono] Failed to parse ${filePath}:`, error);
      diagnostics.push(diagnostic);
      return undefined;
    }

    if (!isRecord(parsed)) {
      const diagnostic = createThemeSettingsReadDiagnostic(name, 'invalid-root');
      console.warn(`[astro-whono] Invalid settings root for ${filePath}: expected JSON object`);
      diagnostics.push(diagnostic);
      return undefined;
    }

    return parsed;
  } catch (error) {
    const diagnostic = createThemeSettingsReadDiagnostic(name, 'read-failed', toReadErrorDetail(error));
    console.warn(`[astro-whono] Failed to read ${filePath}:`, error);
    diagnostics.push(diagnostic);
    return undefined;
  }
};

const readThemeSettingsObjects = (
  diagnostics: ThemeSettingsReadDiagnostic[] = []
): Partial<Record<ThemeSettingsFileGroup, Record<string, unknown>>> => {
  const settingsObjects: Partial<Record<ThemeSettingsFileGroup, Record<string, unknown>>> = {};
  for (const group of SETTINGS_FILE_GROUPS) {
    const settingsObject = readSettingsObject(group, diagnostics);
    if (settingsObject) {
      settingsObjects[group] = settingsObject;
    }
  }
  return settingsObjects;
};

const collectThemeSettingsSchemaDiagnostics = (
  rawSettings: Partial<Record<ThemeSettingsFileGroup, Record<string, unknown>>>,
  resolved: ThemeSettingsResolved
): ThemeSettingsReadDiagnostic[] => {
  const editableSnapshot = buildEditableThemeSettingsSnapshot(resolved);
  const canonicalGroups = createAdminWritableThemeSettingsGroups(editableSnapshot);
  const diagnostics: ThemeSettingsReadDiagnostic[] = [];

  for (const group of SETTINGS_FILE_GROUPS) {
    const rawGroup = rawSettings[group];
    if (!rawGroup) continue;

    const mismatchPaths = getAdminThemeSettingsMismatchPaths(rawGroup, canonicalGroups[group], 'exact');
    if (!mismatchPaths.length) continue;

    const summarizedPaths = mismatchPaths.slice(0, 6);
    const suffix = mismatchPaths.length > summarizedPaths.length ? ' 等' : '';
    diagnostics.push(
      createThemeSettingsReadDiagnostic(
        group,
        'schema-mismatch',
        `以下字段会在读取时被静默修补：${summarizedPaths.join(', ')}${suffix}`
      )
    );
  }

  return diagnostics;
};

export const getThemeSettingsReadDiagnostics = (
  resolved: ThemeSettingsResolved = getThemeSettings()
): ThemeSettingsReadDiagnostic[] => {
  const diagnostics: ThemeSettingsReadDiagnostic[] = [];
  const rawSettings = readThemeSettingsObjects(diagnostics);
  if (diagnostics.length === 0) {
    diagnostics.push(...collectThemeSettingsSchemaDiagnostics(rawSettings, resolved));
  }

  return cloneThemeSettingsReadDiagnostics(diagnostics);
};

export const getThemeSettingsRevision = (resolved: ThemeSettingsResolved = getThemeSettings()): string =>
  hashEditableThemeSettingsSnapshot(buildEditableThemeSettingsSnapshot(resolved));

const claimAvailableOrder = (
  usedOrders: Set<number>,
  preferredOrder: number,
  fallbackOrder: number,
  isValidOrder: (value: number) => boolean,
  minOrder: number,
  maxOrder: number
): number => {
  if (isValidOrder(preferredOrder) && !usedOrders.has(preferredOrder)) {
    usedOrders.add(preferredOrder);
    return preferredOrder;
  }

  if (isValidOrder(fallbackOrder) && !usedOrders.has(fallbackOrder)) {
    usedOrders.add(fallbackOrder);
    return fallbackOrder;
  }

  for (let order = minOrder; order <= maxOrder; order += 1) {
    if (usedOrders.has(order)) continue;
    usedOrders.add(order);
    return order;
  }

  usedOrders.add(fallbackOrder);
  return fallbackOrder;
};

const sortSidebarNavItems = (items: readonly SidebarNavItem[]): SidebarNavItem[] =>
  [...items].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return ADMIN_NAV_IDS.indexOf(a.id) - ADMIN_NAV_IDS.indexOf(b.id);
  });

const normalizeSidebarNavItems = (items: readonly SidebarNavItem[]): SidebarNavItem[] => {
  const normalized = cloneNavItems(items);
  const hasOrderIssues = getAdminNavOrderIssues(
    normalized.map((item) => ({
      key: item.id,
      order: item.order
    }))
  ).length > 0;

  if (!hasOrderIssues) {
    return sortSidebarNavItems(normalized);
  }

  const usedOrders = new Set<number>();
  const nextItems = normalized.map((item) => ({
    ...item,
    order: claimAvailableOrder(
      usedOrders,
      item.order,
      LEGACY_NAV_ORDER.get(item.id) ?? ADMIN_NAV_IDS.indexOf(item.id) + 1,
      isAdminNavOrderValue,
      ADMIN_NAV_ORDER_MIN,
      ADMIN_NAV_ORDER_MAX
    )
  }));

  return sortSidebarNavItems(nextItems);
};

const normalizeSocialOrderState = (
  presetOrder: Readonly<SiteSocialPresetOrder>,
  customItems: readonly SiteSocialCustomItem[]
): { presetOrder: SiteSocialPresetOrder; customItems: SiteSocialCustomItem[] } => {
  const nextPresetOrder = clonePresetSocialOrder(presetOrder);
  const nextCustomItems = cloneSocialCustomItems(customItems);
  const hasOrderIssues = getAdminSocialOrderIssues(
    nextPresetOrder,
    nextCustomItems.map((item, index) => ({
      key: String(index),
      order: item.order
    }))
  ).length > 0;

  if (!hasOrderIssues) {
    return {
      presetOrder: nextPresetOrder,
      customItems: nextCustomItems
    };
  }

  const usedOrders = new Set<number>();

  ADMIN_SOCIAL_PRESET_IDS.forEach((id) => {
    nextPresetOrder[id] = claimAvailableOrder(
      usedOrders,
      nextPresetOrder[id],
      DEFAULT_PRESET_SOCIAL_ORDER[id],
      isAdminSocialOrderValue,
      ADMIN_SOCIAL_ORDER_MIN,
      ADMIN_SOCIAL_ORDER_MAX
    );
  });

  nextCustomItems.forEach((item, index) => {
    item.order = claimAvailableOrder(
      usedOrders,
      item.order,
      PRESET_SOCIAL_ITEMS.length + index + 1,
      isAdminSocialOrderValue,
      ADMIN_SOCIAL_ORDER_MIN,
      ADMIN_SOCIAL_ORDER_MAX
    );
  });

  return {
    presetOrder: nextPresetOrder,
    customItems: nextCustomItems
  };
};

const parseSidebarNav = (value: unknown): SidebarNavItem[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const merged = new Map<SidebarNavId, SidebarNavItem>(
    LEGACY_NAV.map((item) => [item.id, { ...item }])
  );
  let hasOverride = false;

  for (const row of value) {
    if (!isRecord(row)) continue;
    const id = asNavId(row.id);
    if (!id) continue;
    const current = merged.get(id);
    if (!current) continue;

    const label = asNonEmptyString(row.label) ?? current.label;
    const ornament = asNullableSingleLineString(row.ornament, ADMIN_NAV_ORNAMENT_MAX_LENGTH);
    const visible = asBoolean(row.visible) ?? current.visible;
    const rawOrder = asInteger(row.order);
    const order = rawOrder !== undefined && isAdminNavOrderValue(rawOrder) ? rawOrder : current.order;

    merged.set(id, {
      id,
      label,
      ornament: ornament === undefined ? current.ornament : ornament,
      visible,
      order
    });
    hasOverride = true;
  }

  if (!hasOverride) return undefined;
  return Array.from(merged.values()).sort((a, b) => a.order - b.order);
};

const parseSocialCustomItems = (value: unknown): SiteSocialCustomItem[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const normalized: SiteSocialCustomItem[] = [];
  const seenIds = new Set<string>();

  for (const [index, row] of value.entries()) {
    if (!isRecord(row)) continue;

    const label = asNonEmptyString(row.label);
    const href = asHttpsUrl(row.href);
    if (!label || !href) continue;

    const baseId = asNonEmptyString(row.id) ?? `custom-${index + 1}`;
    let id = baseId;
    let suffix = 2;
    while (seenIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    seenIds.add(id);
    const rawOrder = asInteger(row.order);

    normalized.push({
      id,
      label,
      href,
      iconKey: asSocialIconKey(row.iconKey) ?? 'website',
      visible: asBoolean(row.visible) ?? true,
      order: rawOrder !== undefined && isAdminSocialOrderValue(rawOrder) ? rawOrder : index + 1
    });

    if (normalized.length >= SOCIAL_CUSTOM_LIMIT) break;
  }

  return normalized;
};

const parseHomeIntroLinks = (value: unknown): HomeIntroLinkKey[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const normalized: HomeIntroLinkKey[] = [];
  const seen = new Set<HomeIntroLinkKey>();

  for (const item of value) {
    const linkKey = asHomeIntroLinkKey(item);
    if (!linkKey || seen.has(linkKey)) continue;
    normalized.push(linkKey);
    seen.add(linkKey);

    if (normalized.length >= ADMIN_HOME_INTRO_LINK_LIMIT) break;
  }

  return normalized.length ? normalized : undefined;
};

const buildResolvedSocialItems = (
  socialLinks: Pick<SiteSocialLinks, 'github' | 'x' | 'email' | 'presetOrder'>,
  customItems: readonly SiteSocialCustomItem[]
): ResolvedSocialItem[] => {
  const presetItems = PRESET_SOCIAL_ITEMS.flatMap((item, index) => {
    const href =
      item.id === 'email'
        ? socialLinks.email
          ? `mailto:${socialLinks.email}`
          : null
        : socialLinks[item.id];

    if (!href) return [];

    return [
      {
        id: item.id,
        label: item.label,
        href,
        iconKey: item.iconKey,
        kind: 'preset' as const,
        visible: true,
        order: socialLinks.presetOrder[item.id],
        sortIndex: index
      }
    ];
  });

  const customResolved = customItems.map((item, index) => ({
    ...item,
    kind: 'custom' as const,
    sortIndex: PRESET_SOCIAL_ITEMS.length + index
  }));

  return [...presetItems, ...customResolved]
    .sort((a, b) => a.order - b.order || a.sortIndex - b.sortIndex)
    .map(({ sortIndex: _sortIndex, ...item }) => item);
};

export const getThemeSettings = (): ThemeSettingsResolved => {
  if (shouldCacheThemeSettings && cachedSettings) return cachedSettings;

  const siteJson = readSettingsObject('site');
  const shellJson = readSettingsObject('shell');
  const homeJson = readSettingsObject('home');
  const pageJson = readSettingsObject('page');
  const uiJson = readSettingsObject('ui');

  const siteFooterJson = isRecord(siteJson?.footer) ? siteJson.footer : undefined;
  const siteSocialLinksJson = isRecord(siteJson?.socialLinks) ? siteJson.socialLinks : undefined;
  const siteSocialPresetOrderJson = isRecord(siteSocialLinksJson?.presetOrder) ? siteSocialLinksJson.presetOrder : undefined;
  const pageEssayJson = isRecord(pageJson?.essay) ? pageJson.essay : undefined;
  const pageArchiveJson = isRecord(pageJson?.archive) ? pageJson.archive : undefined;
  const pageBitsJson = isRecord(pageJson?.bits) ? pageJson.bits : undefined;
  const pageBitsDefaultAuthorJson = isRecord(pageBitsJson?.defaultAuthor) ? pageBitsJson.defaultAuthor : undefined;
  const pageMemoJson = isRecord(pageJson?.memo) ? pageJson.memo : undefined;
  const pageAboutJson = isRecord(pageJson?.about) ? pageJson.about : undefined;

  const title = resolveValue(
    asNonEmptyString(siteJson?.title),
    asNonEmptyString(legacySite.title),
    DEFAULT_SITE.title
  );
  const description = resolveValue(
    asNonEmptyString(siteJson?.description),
    asNonEmptyString(legacySite.description),
    DEFAULT_SITE.description
  );
  const defaultLocale = resolveValue(
    asLocale(siteJson?.defaultLocale),
    undefined,
    DEFAULT_SITE.defaultLocale
  );
  const footerCopyright = resolveValue(
    asNonEmptyString(siteFooterJson?.copyright),
    LEGACY_FOOTER_COPYRIGHT,
    DEFAULT_SITE.footer.copyright
  );
  const footerStartYear = resolveValue(
    asFooterStartYear(siteFooterJson?.startYear),
    LEGACY_FOOTER_START_YEAR,
    DEFAULT_SITE.footer.startYear
  );
  const footerShowCurrentYear = resolveValue(
    asBoolean(siteFooterJson?.showCurrentYear),
    LEGACY_FOOTER_SHOW_CURRENT_YEAR,
    DEFAULT_SITE.footer.showCurrentYear
  );
  const socialLinksGithub = resolveValue(
    asHttpsUrl(siteSocialLinksJson?.github, GITHUB_HOSTS),
    LEGACY_SOCIAL_LINKS.github,
    DEFAULT_SITE.socialLinks.github
  );
  const socialLinksX = resolveValue(
    asHttpsUrl(siteSocialLinksJson?.x, X_HOSTS),
    LEGACY_SOCIAL_LINKS.x,
    DEFAULT_SITE.socialLinks.x
  );
  const socialLinksEmail = resolveValue(
    asEmailAddress(siteSocialLinksJson?.email),
    LEGACY_SOCIAL_LINKS.email,
    DEFAULT_SITE.socialLinks.email
  );
  const socialLinksGithubOrder = resolveValue(
    asPresetSocialOrderValue(siteSocialPresetOrderJson?.github),
    LEGACY_SOCIAL_LINKS.presetOrder.github,
    DEFAULT_SITE.socialLinks.presetOrder.github
  );
  const socialLinksXOrder = resolveValue(
    asPresetSocialOrderValue(siteSocialPresetOrderJson?.x),
    LEGACY_SOCIAL_LINKS.presetOrder.x,
    DEFAULT_SITE.socialLinks.presetOrder.x
  );
  const socialLinksEmailOrder = resolveValue(
    asPresetSocialOrderValue(siteSocialPresetOrderJson?.email),
    LEGACY_SOCIAL_LINKS.presetOrder.email,
    DEFAULT_SITE.socialLinks.presetOrder.email
  );
  const socialLinksCustom = resolveValue(
    parseSocialCustomItems(siteSocialLinksJson?.custom),
    undefined,
    DEFAULT_SITE.socialLinks.custom
  );

  const brandTitle = resolveValue(
    asNonEmptyString(shellJson?.brandTitle),
    asNonEmptyString(legacySite.brandTitle),
    DEFAULT_SHELL.brandTitle
  );
  const quote = resolveValue(
    asNonEmptyString(shellJson?.quote),
    LEGACY_QUOTE,
    DEFAULT_SHELL.quote
  );
  const nav = resolveValue(
    parseSidebarNav(shellJson?.nav),
    cloneNavItems(LEGACY_NAV),
    cloneNavItems(DEFAULT_SHELL.nav)
  );

  const introLead = resolveValue(
    asNonEmptyString(homeJson?.introLead),
    LEGACY_INTRO_LEAD,
    DEFAULT_HOME.introLead
  );
  const introMore = resolveValue(
    asNonEmptyString(homeJson?.introMore),
    LEGACY_INTRO_MORE,
    DEFAULT_HOME.introMore
  );
  const introMoreLinks = resolveValue(
    parseHomeIntroLinks(homeJson?.introMoreLinks),
    undefined,
    cloneHomeIntroLinks(DEFAULT_HOME.introMoreLinks)
  );
  const showIntroLead = resolveValue(
    asBoolean(homeJson?.showIntroLead),
    undefined,
    DEFAULT_HOME.showIntroLead
  );
  const showIntroMore = resolveValue(
    asBoolean(homeJson?.showIntroMore),
    undefined,
    DEFAULT_HOME.showIntroMore
  );
  const heroPresetId = resolveValue(
    asHeroPresetId(homeJson?.heroPresetId),
    DEFAULT_HOME.heroPresetId,
    DEFAULT_HOME.heroPresetId
  );
  const heroImageSrc = resolveValue<string | null>(
    asHeroImageSrc(homeJson?.heroImageSrc),
    undefined,
    DEFAULT_HOME.heroImageSrc
  );
  const heroImageAlt = resolveValue(
    asSingleLineString(homeJson?.heroImageAlt, ADMIN_HERO_IMAGE_ALT_MAX_LENGTH),
    undefined,
    DEFAULT_HOME.heroImageAlt
  );

  const essayTitle = resolveValue(
    asNullableString(pageEssayJson?.title),
    undefined,
    DEFAULT_PAGE.essay.title
  );
  const essaySubtitle = resolveValue(
    asNullableString(pageEssayJson?.subtitle),
    LEGACY_ESSAY_SUBTITLE,
    DEFAULT_PAGE.essay.subtitle
  );
  const archiveTitle = resolveValue(
    asNullableString(pageArchiveJson?.title),
    undefined,
    DEFAULT_PAGE.archive.title
  );
  const archiveSubtitle = resolveValue(
    asNullableString(pageArchiveJson?.subtitle),
    undefined,
    DEFAULT_PAGE.archive.subtitle
  );
  const bitsTitle = resolveValue(
    asNullableString(pageBitsJson?.title),
    undefined,
    DEFAULT_PAGE.bits.title
  );
  const bitsSubtitle = resolveValue(
    asNullableString(pageBitsJson?.subtitle),
    LEGACY_BITS_SUBTITLE,
    DEFAULT_PAGE.bits.subtitle
  );
  const bitsDefaultAuthorName = resolveValue(
    asNonEmptyString(pageBitsDefaultAuthorJson?.name),
    asNonEmptyString(legacySite.author),
    DEFAULT_PAGE.bits.defaultAuthor.name
  );
  const bitsDefaultAuthorAvatar = resolveValue(
    asBitsAvatarPath(pageBitsDefaultAuthorJson?.avatar),
    asBitsAvatarPath(legacySite.authorAvatar),
    DEFAULT_PAGE.bits.defaultAuthor.avatar
  );
  const memoSubtitle = resolveValue<string | null>(
    asNullableString(pageMemoJson?.subtitle),
    undefined,
    DEFAULT_PAGE.memo.subtitle
  );
  const memoTitle = resolveValue<string | null>(
    asNullableString(pageMemoJson?.title),
    undefined,
    DEFAULT_PAGE.memo.title
  );
  const aboutTitle = resolveValue(
    asNullableString(pageAboutJson?.title),
    undefined,
    DEFAULT_PAGE.about.title
  );
  const aboutSubtitle = resolveValue<string | null>(
    asNullableString(pageAboutJson?.subtitle),
    undefined,
    DEFAULT_PAGE.about.subtitle
  );

  const uiCodeBlock = isRecord(uiJson?.codeBlock) ? uiJson.codeBlock : undefined;
  const uiReadingMode = isRecord(uiJson?.readingMode) ? uiJson.readingMode : undefined;
  const uiArticleMeta = isRecord(uiJson?.articleMeta) ? uiJson.articleMeta : undefined;
  const uiLayout = isRecord(uiJson?.layout) ? uiJson.layout : undefined;

  const showLineNumbers = resolveValue(
    asBoolean(uiCodeBlock?.showLineNumbers),
    DEFAULT_UI.codeBlock.showLineNumbers,
    DEFAULT_UI.codeBlock.showLineNumbers
  );
  const showReadingEntry = resolveValue(
    asBoolean(uiReadingMode?.showEntry),
    DEFAULT_UI.readingMode.showEntry,
    DEFAULT_UI.readingMode.showEntry
  );
  const showArticleDate = resolveValue(
    asBoolean(uiArticleMeta?.showDate),
    undefined,
    DEFAULT_UI.articleMeta.showDate
  );
  const articleDateLabel = resolveValue(
    asTrimmedSingleLineString(uiArticleMeta?.dateLabel, ADMIN_ARTICLE_META_DATE_LABEL_MAX_LENGTH),
    undefined,
    DEFAULT_UI.articleMeta.dateLabel
  );
  const showArticleTags = resolveValue(
    asBoolean(uiArticleMeta?.showTags),
    undefined,
    DEFAULT_UI.articleMeta.showTags
  );
  const showArticleWordCount = resolveValue(
    asBoolean(uiArticleMeta?.showWordCount),
    undefined,
    DEFAULT_UI.articleMeta.showWordCount
  );
  const showArticleReadingTime = resolveValue(
    asBoolean(uiArticleMeta?.showReadingTime),
    undefined,
    DEFAULT_UI.articleMeta.showReadingTime
  );
  const sidebarDivider = resolveValue(
    asSidebarDividerVariant(uiLayout?.sidebarDivider),
    undefined,
    DEFAULT_UI.layout.sidebarDivider
  );

  const normalizedNav = normalizeSidebarNavItems(nav.value);
  const normalizedSocialOrderState = normalizeSocialOrderState(
    {
      github: socialLinksGithubOrder.value,
      x: socialLinksXOrder.value,
      email: socialLinksEmailOrder.value
    },
    socialLinksCustom.value
  );
  const customSocialItems = cloneSocialCustomItems(normalizedSocialOrderState.customItems);
  const presetSocialOrder = clonePresetSocialOrder(normalizedSocialOrderState.presetOrder);
  const resolvedSocialItems = buildResolvedSocialItems(
    {
      github: socialLinksGithub.value,
      x: socialLinksX.value,
      email: socialLinksEmail.value,
      presetOrder: presetSocialOrder
    },
    customSocialItems
  );

  const resolved: ThemeSettingsResolved = {
    settings: {
      site: {
        title: title.value,
        description: description.value,
        defaultLocale: defaultLocale.value,
        footer: {
          startYear: footerStartYear.value,
          showCurrentYear: footerShowCurrentYear.value,
          copyright: footerCopyright.value
        },
        socialLinks: {
          github: socialLinksGithub.value,
          x: socialLinksX.value,
          email: socialLinksEmail.value,
          presetOrder: clonePresetSocialOrder(presetSocialOrder),
          custom: cloneSocialCustomItems(customSocialItems),
          resolvedSocialItems: cloneResolvedSocialItems(resolvedSocialItems)
        }
      },
      shell: {
        brandTitle: brandTitle.value,
        quote: quote.value,
        nav: cloneNavItems(normalizedNav)
      },
      home: {
        introLead: introLead.value,
        introMore: introMore.value,
        introMoreLinks: cloneHomeIntroLinks(introMoreLinks.value),
        showIntroLead: showIntroLead.value,
        showIntroMore: showIntroMore.value,
        heroPresetId: heroPresetId.value,
        heroImageSrc: heroImageSrc.value,
        heroImageAlt: heroImageAlt.value
      },
      page: {
        essay: {
          title: essayTitle.value,
          subtitle: essaySubtitle.value
        },
        archive: {
          title: archiveTitle.value,
          subtitle: archiveSubtitle.value
        },
        bits: {
          title: bitsTitle.value,
          subtitle: bitsSubtitle.value,
          defaultAuthor: {
            name: bitsDefaultAuthorName.value,
            avatar: bitsDefaultAuthorAvatar.value
          }
        },
        memo: {
          title: memoTitle.value,
          subtitle: memoSubtitle.value
        },
        about: {
          title: aboutTitle.value,
          subtitle: aboutSubtitle.value
        }
      },
      ui: {
        codeBlock: {
          showLineNumbers: showLineNumbers.value
        },
        readingMode: {
          showEntry: showReadingEntry.value
        },
        articleMeta: {
          showDate: showArticleDate.value,
          dateLabel: articleDateLabel.value,
          showTags: showArticleTags.value,
          showWordCount: showArticleWordCount.value,
          showReadingTime: showArticleReadingTime.value
        },
        layout: {
          sidebarDivider: sidebarDivider.value
        }
      }
    },
    sources: {
      site: {
        title: title.source,
        description: description.source,
        defaultLocale: defaultLocale.source,
        footerStartYear: footerStartYear.source,
        footerShowCurrentYear: footerShowCurrentYear.source,
        footerCopyright: footerCopyright.source,
        socialLinksGithub: socialLinksGithub.source,
        socialLinksX: socialLinksX.source,
        socialLinksEmail: socialLinksEmail.source,
        socialLinksGithubOrder: socialLinksGithubOrder.source,
        socialLinksXOrder: socialLinksXOrder.source,
        socialLinksEmailOrder: socialLinksEmailOrder.source,
        socialLinksCustom: socialLinksCustom.source
      },
      shell: {
        brandTitle: brandTitle.source,
        quote: quote.source,
        nav: nav.source
      },
      home: {
        introLead: introLead.source,
        introMore: introMore.source,
        introMoreLinks: introMoreLinks.source,
        showIntroLead: showIntroLead.source,
        showIntroMore: showIntroMore.source,
        heroPresetId: heroPresetId.source,
        heroImageSrc: heroImageSrc.source,
        heroImageAlt: heroImageAlt.source
      },
      page: {
        essayTitle: essayTitle.source,
        essaySubtitle: essaySubtitle.source,
        archiveTitle: archiveTitle.source,
        archiveSubtitle: archiveSubtitle.source,
        bitsTitle: bitsTitle.source,
        bitsSubtitle: bitsSubtitle.source,
        bitsDefaultAuthorName: bitsDefaultAuthorName.source,
        bitsDefaultAuthorAvatar: bitsDefaultAuthorAvatar.source,
        memoTitle: memoTitle.source,
        memoSubtitle: memoSubtitle.source,
        aboutTitle: aboutTitle.source,
        aboutSubtitle: aboutSubtitle.source
      },
      ui: {
        codeBlockShowLineNumbers: showLineNumbers.source,
        readingModeShowEntry: showReadingEntry.source,
        articleMetaShowDate: showArticleDate.source,
        articleMetaDateLabel: articleDateLabel.source,
        articleMetaShowTags: showArticleTags.source,
        articleMetaShowWordCount: showArticleWordCount.source,
        articleMetaShowReadingTime: showArticleReadingTime.source,
        layoutSidebarDivider: sidebarDivider.source
      }
    }
  };

  // DEV 下关闭模块级缓存，避免手改 settings JSON 或切分支后继续读到旧值。
  if (shouldCacheThemeSettings) {
    cachedSettings = resolved;
  }
  return resolved;
};

export const toEditableThemeSettingsPayload = (
  resolved: ThemeSettingsResolved
): ThemeSettingsEditablePayload => {
  const snapshot = buildEditableThemeSettingsSnapshot(resolved);

  return {
    revision: hashEditableThemeSettingsSnapshot(snapshot),
    settings: snapshot,
    sources: cloneThemeSettingsSources(resolved.sources)
  };
};

const buildEditableThemeSettingsSnapshot = (
  resolved: ThemeSettingsResolved
): EditableThemeSettingsSnapshot => ({
  site: {
    title: resolved.settings.site.title,
    description: resolved.settings.site.description,
    defaultLocale: resolved.settings.site.defaultLocale,
    footer: {
      ...resolved.settings.site.footer
    },
    socialLinks: {
      github: resolved.settings.site.socialLinks.github,
      x: resolved.settings.site.socialLinks.x,
      email: resolved.settings.site.socialLinks.email,
      presetOrder: clonePresetSocialOrder(resolved.settings.site.socialLinks.presetOrder),
      custom: cloneSocialCustomItems(resolved.settings.site.socialLinks.custom)
    }
  },
  shell: {
    brandTitle: resolved.settings.shell.brandTitle,
    quote: resolved.settings.shell.quote,
    nav: cloneNavItems(resolved.settings.shell.nav)
  },
  home: {
    ...resolved.settings.home,
    introMoreLinks: cloneHomeIntroLinks(resolved.settings.home.introMoreLinks)
  },
  page: {
    essay: { ...resolved.settings.page.essay },
    archive: { ...resolved.settings.page.archive },
    bits: {
      title: resolved.settings.page.bits.title,
      subtitle: resolved.settings.page.bits.subtitle,
      defaultAuthor: {
        ...resolved.settings.page.bits.defaultAuthor
      }
    },
    memo: { ...resolved.settings.page.memo },
    about: { ...resolved.settings.page.about }
  },
  ui: {
    codeBlock: { ...resolved.settings.ui.codeBlock },
    readingMode: { ...resolved.settings.ui.readingMode },
    articleMeta: { ...resolved.settings.ui.articleMeta },
    layout: { ...resolved.settings.ui.layout }
  }
});

const hashEditableThemeSettingsSnapshot = (snapshot: EditableThemeSettingsSnapshot): string => {
  const hash = createHash('sha1');
  hash.update(JSON.stringify(snapshot));
  return hash.digest('hex');
};

export const getEditableThemeSettingsPayload = (
  resolved: ThemeSettingsResolved = getThemeSettings()
): ThemeSettingsEditablePayload => toEditableThemeSettingsPayload(resolved);

export const getEditableThemeSettingsState = (
  resolved?: ThemeSettingsResolved
): ThemeSettingsEditableState => {
  const currentResolved = resolved ?? getThemeSettings();
  const diagnostics = getThemeSettingsReadDiagnostics(currentResolved);
  if (diagnostics.length > 0) {
    return {
      ok: false,
      mode: 'invalid-settings',
      message: THEME_SETTINGS_INVALID_MESSAGE,
      errors: diagnostics.map((diagnostic) => diagnostic.message),
      diagnostics
    };
  }

  return {
    ok: true,
    payload: getEditableThemeSettingsPayload(currentResolved)
  };
};

export const resetThemeSettingsCache = (): void => {
  cachedSettings = null;
};

export const getSidebarHref = (id: SidebarNavId): string => SIDEBAR_HREFS[id];
