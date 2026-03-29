import type {
  EditableThemeSettings,
  HeroPresetId,
  HomeIntroLinkKey,
  PageId,
  SidebarDividerVariant,
  SidebarNavId,
  SiteSocialIconKey,
  SiteSocialPresetId,
  SiteSocialPresetOrder,
  ThemeSettingsFileGroup
} from '../theme-settings';
import {
  getBitsAvatarLocalFilePath as getAdminBitsAvatarLocalFilePath,
  getHeroImageLocalFilePath as getAdminHeroImageLocalFilePath,
  normalizeBitsAvatarPath as normalizeAdminBitsAvatarPath,
  normalizeHeroImageSrc as normalizeAdminHeroImageSrc
} from '../../utils/format';

export {
  getAdminBitsAvatarLocalFilePath,
  getAdminHeroImageLocalFilePath,
  normalizeAdminBitsAvatarPath,
  normalizeAdminHeroImageSrc
};

export const ADMIN_NAV_IDS = ['essay', 'bits', 'memo', 'archive', 'about'] as const satisfies readonly SidebarNavId[];
export const ADMIN_PAGE_IDS = ['essay', 'archive', 'bits', 'memo', 'about'] as const satisfies readonly PageId[];
export const ADMIN_SOCIAL_CUSTOM_LIMIT = 8;

export const ADMIN_HERO_PRESETS = ['default', 'none'] as const satisfies readonly HeroPresetId[];
export const ADMIN_HERO_PRESET_SET: ReadonlySet<HeroPresetId> = new Set(ADMIN_HERO_PRESETS);
export const ADMIN_HERO_IMAGE_ALT_DEFAULT = 'Whono theme preview';
export const ADMIN_HERO_IMAGE_ALT_MAX_LENGTH = 120;

export const ADMIN_ARTICLE_META_DATE_LABEL_DEFAULT = 'Published on:';
export const ADMIN_ARTICLE_META_DATE_LABEL_MAX_LENGTH = 20;

export const ADMIN_SIDEBAR_DIVIDER_VARIANTS = [
  'default',
  'subtle',
  'none'
] as const satisfies readonly SidebarDividerVariant[];
export const ADMIN_SIDEBAR_DIVIDER_DEFAULT: SidebarDividerVariant = 'default';
export const ADMIN_SIDEBAR_DIVIDER_SET: ReadonlySet<SidebarDividerVariant> = new Set(ADMIN_SIDEBAR_DIVIDER_VARIANTS);
export const ADMIN_SIDEBAR_DIVIDER_OPTIONS = [
  { id: 'default', label: 'Default' },
  { id: 'subtle', label: 'Subtle' },
  { id: 'none', label: 'Hidden' }
] as const satisfies readonly {
  id: SidebarDividerVariant;
  label: string;
}[];

export const ADMIN_HOME_INTRO_LINK_KEYS = [
  'archive',
  'essay',
  'bits',
  'memo',
  'about',
  'tag'
] as const satisfies readonly HomeIntroLinkKey[];
export const ADMIN_HOME_INTRO_LINK_DEFAULT = ['archive', 'essay'] as const satisfies readonly HomeIntroLinkKey[];
export const ADMIN_HOME_INTRO_LINK_LIMIT = 2;
export const ADMIN_HOME_INTRO_LINK_KEY_SET: ReadonlySet<HomeIntroLinkKey> = new Set(ADMIN_HOME_INTRO_LINK_KEYS);
export const ADMIN_HOME_INTRO_LINK_OPTIONS = [
  { id: 'archive', label: 'Archive', href: '/archive/' },
  { id: 'essay', label: 'Essays', href: '/essay/' },
  { id: 'bits', label: 'Bits', href: '/bits/' },
  { id: 'memo', label: 'Memo', href: '/memo/' },
  { id: 'about', label: 'About', href: '/about/' },
  { id: 'tag', label: '#Tags', href: '/archive/?picker=tag' }
] as const satisfies readonly {
  id: HomeIntroLinkKey;
  label: string;
  href: string;
}[];

export const ADMIN_SOCIAL_PRESET_IDS = ['github', 'x', 'email'] as const satisfies readonly SiteSocialPresetId[];
export const ADMIN_SOCIAL_PRESET_ORDER_DEFAULT: Record<SiteSocialPresetId, number> = {
  github: 1,
  x: 2,
  email: 3
};
export const ADMIN_SOCIAL_ORDER_MIN = 1;
export const ADMIN_SOCIAL_ORDER_MAX = ADMIN_SOCIAL_PRESET_IDS.length + ADMIN_SOCIAL_CUSTOM_LIMIT;
export const ADMIN_NAV_ORDER_MIN = 1;
export const ADMIN_NAV_ORDER_MAX = 999;

type AdminSocialOrderScope = 'preset' | 'custom';
type AdminSocialOrderInput = {
  key: string;
  order: number;
};
type AdminNavOrderInput = {
  key: SidebarNavId;
  order: number;
};

export type AdminSocialOrderIssue = {
  type: 'range' | 'duplicate';
  scope: AdminSocialOrderScope;
  key: string;
  order: number;
};
export type AdminNavOrderIssue = {
  type: 'range' | 'duplicate';
  key: SidebarNavId;
  order: number;
};

export const ADMIN_SOCIAL_ICON_KEYS = [
  'github',
  'x',
  'email',
  'weibo',
  'facebook',
  'instagram',
  'telegram',
  'mastodon',
  'bilibili',
  'youtube',
  'linkedin',
  'website'
] as const satisfies readonly SiteSocialIconKey[];
export const ADMIN_SOCIAL_ICON_KEY_SET: ReadonlySet<SiteSocialIconKey> = new Set(ADMIN_SOCIAL_ICON_KEYS);

export const ADMIN_GITHUB_HOSTS = ['github.com'] as const;
export const ADMIN_X_HOSTS = ['x.com', 'twitter.com'] as const;

export const ADMIN_HOME_INTRO_MAX_LENGTH = 240;
export const ADMIN_PAGE_TITLE_MAX_LENGTH = 60;
export const ADMIN_PAGE_SUBTITLE_MAX_LENGTH = 120;
export const ADMIN_NAV_ORNAMENT_DEFAULT = '·';
export const ADMIN_NAV_ORNAMENT_MAX_LENGTH = 4;
export const ADMIN_FOOTER_START_YEAR_MIN = 1900;
export const ADMIN_FOOTER_COPYRIGHT_MAX_LENGTH = 120;

export const ADMIN_LOCALE_RE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
export const ADMIN_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const getAdminFooterStartYearMax = (): number => new Date().getFullYear();

export const isAdminNavId = (value: string): value is SidebarNavId =>
  (ADMIN_NAV_IDS as readonly string[]).includes(value);

export const isAdminHeroPresetId = (value: string): value is HeroPresetId =>
  ADMIN_HERO_PRESET_SET.has(value as HeroPresetId);

export const isAdminSidebarDividerVariant = (value: string): value is SidebarDividerVariant =>
  ADMIN_SIDEBAR_DIVIDER_SET.has(value as SidebarDividerVariant);

export const isAdminHomeIntroLinkKey = (value: string): value is HomeIntroLinkKey =>
  ADMIN_HOME_INTRO_LINK_KEY_SET.has(value as HomeIntroLinkKey);

export const isAdminSocialPresetId = (value: string): value is SiteSocialPresetId =>
  (ADMIN_SOCIAL_PRESET_IDS as readonly string[]).includes(value);

export const normalizeAdminSocialIconKey = (value: unknown): SiteSocialIconKey | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized === 'link' || normalized === 'globe') return 'website';
  return ADMIN_SOCIAL_ICON_KEY_SET.has(normalized as SiteSocialIconKey) ? (normalized as SiteSocialIconKey) : undefined;
};

export const isAdminSocialIconKey = (value: string): value is SiteSocialIconKey =>
  ADMIN_SOCIAL_ICON_KEY_SET.has(value as SiteSocialIconKey);

export const isAdminSocialOrderValue = (value: number): boolean =>
  Number.isInteger(value) && value >= ADMIN_SOCIAL_ORDER_MIN && value <= ADMIN_SOCIAL_ORDER_MAX;

export const isAdminNavOrderValue = (value: number): boolean =>
  Number.isInteger(value) && value >= ADMIN_NAV_ORDER_MIN && value <= ADMIN_NAV_ORDER_MAX;

export const getAdminSocialOrderIssues = (
  presetOrder: Readonly<SiteSocialPresetOrder>,
  customItems: readonly AdminSocialOrderInput[]
): AdminSocialOrderIssue[] => {
  const entries = [
    ...ADMIN_SOCIAL_PRESET_IDS.map((id) => ({
      scope: 'preset' as const,
      key: id,
      order: presetOrder[id]
    })),
    ...customItems.map((item) => ({
      scope: 'custom' as const,
      key: item.key,
      order: item.order
    }))
  ];
  const orderCounts = new Map<number, number>();

  entries.forEach((entry) => {
    if (!isAdminSocialOrderValue(entry.order)) return;
    orderCounts.set(entry.order, (orderCounts.get(entry.order) ?? 0) + 1);
  });

  const issues: AdminSocialOrderIssue[] = [];

  entries.forEach((entry) => {
    if (!isAdminSocialOrderValue(entry.order)) {
      issues.push({ type: 'range', ...entry });
      return;
    }

    if ((orderCounts.get(entry.order) ?? 0) > 1) {
      issues.push({ type: 'duplicate', ...entry });
    }
  });

  return issues;
};

export const getAdminNavOrderIssues = (items: readonly AdminNavOrderInput[]): AdminNavOrderIssue[] => {
  const orderCounts = new Map<number, number>();

  items.forEach((item) => {
    if (!isAdminNavOrderValue(item.order)) return;
    orderCounts.set(item.order, (orderCounts.get(item.order) ?? 0) + 1);
  });

  const issues: AdminNavOrderIssue[] = [];

  items.forEach((item) => {
    if (!isAdminNavOrderValue(item.order)) {
      issues.push({ type: 'range', ...item });
      return;
    }

    if ((orderCounts.get(item.order) ?? 0) > 1) {
      issues.push({ type: 'duplicate', ...item });
    }
  });

  return issues;
};

export const getAdminHomeIntroLinkOption = (
  id: HomeIntroLinkKey
): (typeof ADMIN_HOME_INTRO_LINK_OPTIONS)[number] =>
  ADMIN_HOME_INTRO_LINK_OPTIONS.find((option) => option.id === id) ?? ADMIN_HOME_INTRO_LINK_OPTIONS[0];

export const isAdminAllowedHttpsUrl = (value: string, allowedHosts?: readonly string[]): boolean => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return false;
    if (!Array.isArray(allowedHosts) || !allowedHosts.length) return true;

    const hostname = parsed.hostname.toLowerCase();
    return allowedHosts.some((host) => hostname === host || hostname === `www.${host}` || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
};

export type AdminThemeSettingsValidationIssue = {
  path: string;
  message: string;
};

export type AdminThemeSettingsMismatchMode = 'exact' | 'subset';

export type AdminWritableThemeSettingsGroups = {
  site: EditableThemeSettings['site'];
  shell: EditableThemeSettings['shell'];
  home: EditableThemeSettings['home'];
  page: EditableThemeSettings['page'];
  ui: EditableThemeSettings['ui'];
};

type LooseRecord = Record<string, unknown>;

type AdminThemeSettingsCanonicalizeOptions = {
  footerStartYearMax?: number;
  defaultCustomSocialIconKey?: SiteSocialIconKey;
  normalizeCustomSocialLabel?: (value: unknown, iconKey: SiteSocialIconKey) => string;
};

type AdminThemeSettingsValidateOptions = {
  footerStartYearMax?: number;
  localFileExists?: (relativePath: string) => boolean;
};

const isRecord = (value: unknown): value is LooseRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeMultiline = (value: string): string => value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const normalizeTrimmed = (value: unknown): string => String(value ?? '').trim();

const normalizeOptionalSingleLine = (value: string): string | null => {
  const normalized = normalizeMultiline(value).trim();
  return normalized ? normalized : null;
};

const normalizeSingleLine = (value: unknown, fallback = ''): string => {
  const normalized = normalizeMultiline(String(value ?? '')).trim();
  return normalized || fallback;
};

const normalizeNavOrnament = (value: unknown): string | null => {
  if (value === null) return null;
  if (typeof value !== 'string') return ADMIN_NAV_ORNAMENT_DEFAULT;
  const normalized = normalizeMultiline(value).trim();
  return normalized || null;
};

const normalizeEmail = (value: string): string => value.replace(/^mailto:/i, '').trim();

const parseOrder = (value: string | number | null | undefined, fallback: number): number => {
  const next = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(next) ? next : fallback;
};

const parseInteger = (value: string | number | null | undefined): number | null => {
  const next = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(next) ? next : null;
};

const defaultNormalizeCustomSocialLabel = (value: unknown): string => normalizeTrimmed(value);

const cloneCustomItems = (
  items: ReadonlyArray<EditableThemeSettings['site']['socialLinks']['custom'][number]>
): EditableThemeSettings['site']['socialLinks']['custom'] =>
  items.map((item) => ({ ...item }));

const cloneNavItems = (
  items: ReadonlyArray<EditableThemeSettings['shell']['nav'][number]>
): EditableThemeSettings['shell']['nav'] =>
  items.map((item) => ({ ...item }));

const normalizeHomeIntroLinks = (value: unknown): HomeIntroLinkKey[] => {
  const defaultHomeIntroLinks = [...ADMIN_HOME_INTRO_LINK_DEFAULT] as HomeIntroLinkKey[];
  if (!Array.isArray(value)) return defaultHomeIntroLinks;

  const normalized: HomeIntroLinkKey[] = [];
  const seen = new Set<HomeIntroLinkKey>();

  value.forEach((item) => {
    const rawValue = normalizeTrimmed(item);
    if (!rawValue || !isAdminHomeIntroLinkKey(rawValue)) return;
    const linkKey = rawValue as HomeIntroLinkKey;
    if (seen.has(linkKey) || normalized.length >= ADMIN_HOME_INTRO_LINK_LIMIT) return;
    normalized.push(linkKey);
    seen.add(linkKey);
  });

  return normalized.length ? normalized : defaultHomeIntroLinks;
};

export const canonicalizeAdminThemeSettings = (
  settings: unknown,
  options: AdminThemeSettingsCanonicalizeOptions = {}
): EditableThemeSettings => {
  type SortableCustomItem = EditableThemeSettings['site']['socialLinks']['custom'][number] & { __index: number };

  const {
    footerStartYearMax = getAdminFooterStartYearMax(),
    defaultCustomSocialIconKey = 'website',
    normalizeCustomSocialLabel = defaultNormalizeCustomSocialLabel
  } = options;

  const next = isRecord(settings) ? settings : {};
  const site = isRecord(next.site) ? next.site : {};
  const shell = isRecord(next.shell) ? next.shell : {};
  const home = isRecord(next.home) ? next.home : {};
  const page = isRecord(next.page) ? next.page : {};
  const ui = isRecord(next.ui) ? next.ui : {};
  const siteFooter = isRecord(site.footer) ? site.footer : {};
  const socialLinks = isRecord(site.socialLinks) ? site.socialLinks : {};
  const customItems = Array.isArray(socialLinks.custom) ? socialLinks.custom : [];
  const bitsPage = isRecord(page.bits) ? page.bits : {};
  const bitsDefaultAuthor = isRecord(bitsPage.defaultAuthor) ? bitsPage.defaultAuthor : {};
  const rawPresetOrder = isRecord(socialLinks.presetOrder) ? socialLinks.presetOrder : {};
  const rawUiArticleMeta: LooseRecord = isRecord(ui.articleMeta) ? ui.articleMeta : {};
  const rawUiLayout: LooseRecord = isRecord(ui.layout) ? ui.layout : {};
  const rawHeroPresetId = normalizeTrimmed(home.heroPresetId);
  const rawSidebarDivider = normalizeTrimmed(rawUiLayout.sidebarDivider);

  const normalizedCustom: EditableThemeSettings['site']['socialLinks']['custom'] = customItems
    .map((item, index) => {
      const record = isRecord(item) ? item : {};
      const iconKey = normalizeAdminSocialIconKey(record.iconKey) ?? defaultCustomSocialIconKey;
      const sortableItem: SortableCustomItem = {
        id: normalizeTrimmed(record.id),
        label: normalizeCustomSocialLabel(record.label, iconKey),
        href: normalizeTrimmed(record.href),
        iconKey,
        visible: Boolean(record.visible),
        order: parseOrder(record.order as string | number | null | undefined, index + 1),
        __index: index
      };
      return sortableItem;
    })
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      const idCompare = a.id.localeCompare(b.id);
      if (idCompare !== 0) return idCompare;
      return a.__index - b.__index;
    })
    .map(({ __index: _ignored, ...item }) => item);

  const normalizedNav = (Array.isArray(shell.nav) ? shell.nav : [])
    .map((item) => {
      const record = isRecord(item) ? item : null;
      if (!record) return null;
      const id = normalizeTrimmed(record.id);
      if (!isAdminNavId(id)) return null;
      return {
        id,
        label: normalizeTrimmed(record.label),
        ornament: normalizeNavOrnament(record.ornament),
        order: parseOrder(record.order as string | number | null | undefined, ADMIN_NAV_IDS.indexOf(id) + 1),
        visible: Boolean(record.visible)
      };
    })
    .filter((item): item is EditableThemeSettings['shell']['nav'][number] => item !== null)
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return ADMIN_NAV_IDS.indexOf(a.id) - ADMIN_NAV_IDS.indexOf(b.id);
    });

  const heroImageSrc = (() => {
    const normalized = normalizeAdminHeroImageSrc(home.heroImageSrc);
    if (normalized === undefined) {
      const rawValue = normalizeTrimmed(home.heroImageSrc);
      return rawValue ? rawValue : null;
    }
    return normalized;
  })();

  const heroImageAlt = (() => {
    const normalized = normalizeTrimmed(home.heroImageAlt);
    return normalized || ADMIN_HERO_IMAGE_ALT_DEFAULT;
  })();

  return {
    site: {
      title: normalizeTrimmed(site.title),
      description: normalizeMultiline(String(site.description ?? '')).trim(),
      defaultLocale: normalizeTrimmed(site.defaultLocale),
      footer: {
        startYear: parseInteger(siteFooter.startYear as string | number | null | undefined) ?? footerStartYearMax,
        showCurrentYear: Boolean(siteFooter.showCurrentYear),
        copyright: normalizeTrimmed(siteFooter.copyright)
      },
      socialLinks: {
        github: normalizeTrimmed(socialLinks.github) || null,
        x: normalizeTrimmed(socialLinks.x) || null,
        email: normalizeEmail(normalizeTrimmed(socialLinks.email)) || null,
        presetOrder: {
          github: parseOrder(
            rawPresetOrder.github as string | number | null | undefined,
            ADMIN_SOCIAL_PRESET_ORDER_DEFAULT.github
          ),
          x: parseOrder(rawPresetOrder.x as string | number | null | undefined, ADMIN_SOCIAL_PRESET_ORDER_DEFAULT.x),
          email: parseOrder(
            rawPresetOrder.email as string | number | null | undefined,
            ADMIN_SOCIAL_PRESET_ORDER_DEFAULT.email
          )
        },
        custom: normalizedCustom
      }
    },
    shell: {
      brandTitle: normalizeTrimmed(shell.brandTitle),
      quote: normalizeMultiline(String(shell.quote ?? '')).trim(),
      nav: normalizedNav
    },
    home: {
      introLead: normalizeMultiline(String(home.introLead ?? '')).trim(),
      introMore: normalizeMultiline(String(home.introMore ?? '')).trim(),
      introMoreLinks: normalizeHomeIntroLinks(home.introMoreLinks),
      showIntroLead: typeof home.showIntroLead === 'boolean' ? home.showIntroLead : true,
      showIntroMore: typeof home.showIntroMore === 'boolean' ? home.showIntroMore : true,
      heroPresetId: isAdminHeroPresetId(rawHeroPresetId) ? rawHeroPresetId : 'default',
      heroImageSrc,
      heroImageAlt
    },
    page: {
      essay: {
        title: normalizeOptionalSingleLine(String(isRecord(page.essay) ? page.essay.title ?? '' : '')),
        subtitle: normalizeOptionalSingleLine(String(isRecord(page.essay) ? page.essay.subtitle ?? '' : ''))
      },
      archive: {
        title: normalizeOptionalSingleLine(String(isRecord(page.archive) ? page.archive.title ?? '' : '')),
        subtitle: normalizeOptionalSingleLine(String(isRecord(page.archive) ? page.archive.subtitle ?? '' : ''))
      },
      bits: {
        title: normalizeOptionalSingleLine(String(bitsPage.title ?? '')),
        subtitle: normalizeOptionalSingleLine(String(bitsPage.subtitle ?? '')),
        defaultAuthor: {
          name: normalizeTrimmed(bitsDefaultAuthor.name),
          avatar: normalizeTrimmed(bitsDefaultAuthor.avatar)
        }
      },
      memo: {
        title: normalizeOptionalSingleLine(String(isRecord(page.memo) ? page.memo.title ?? '' : '')),
        subtitle: normalizeOptionalSingleLine(String(isRecord(page.memo) ? page.memo.subtitle ?? '' : ''))
      },
      about: {
        title: normalizeOptionalSingleLine(String(isRecord(page.about) ? page.about.title ?? '' : '')),
        subtitle: normalizeOptionalSingleLine(String(isRecord(page.about) ? page.about.subtitle ?? '' : ''))
      }
    },
    ui: {
      codeBlock: {
        showLineNumbers: Boolean(isRecord(ui.codeBlock) ? ui.codeBlock.showLineNumbers : false)
      },
      readingMode: {
        showEntry: Boolean(isRecord(ui.readingMode) ? ui.readingMode.showEntry : false)
      },
      articleMeta: {
        showDate: typeof rawUiArticleMeta.showDate === 'boolean' ? rawUiArticleMeta.showDate : true,
        dateLabel: normalizeSingleLine(rawUiArticleMeta.dateLabel, ADMIN_ARTICLE_META_DATE_LABEL_DEFAULT),
        showTags: typeof rawUiArticleMeta.showTags === 'boolean' ? rawUiArticleMeta.showTags : true,
        showWordCount: typeof rawUiArticleMeta.showWordCount === 'boolean' ? rawUiArticleMeta.showWordCount : true,
        showReadingTime: typeof rawUiArticleMeta.showReadingTime === 'boolean'
          ? rawUiArticleMeta.showReadingTime
          : true
      },
      layout: {
        sidebarDivider: isAdminSidebarDividerVariant(rawSidebarDivider)
          ? rawSidebarDivider
          : ADMIN_SIDEBAR_DIVIDER_DEFAULT
      }
    }
  };
};

export const createAdminWritableThemeSettingsGroups = (
  settings: EditableThemeSettings
): AdminWritableThemeSettingsGroups => ({
  site: {
    title: settings.site.title,
    description: settings.site.description,
    defaultLocale: settings.site.defaultLocale,
    footer: {
      ...settings.site.footer
    },
    socialLinks: {
      github: settings.site.socialLinks.github,
      x: settings.site.socialLinks.x,
      email: settings.site.socialLinks.email,
      presetOrder: {
        ...settings.site.socialLinks.presetOrder
      },
      custom: cloneCustomItems(settings.site.socialLinks.custom)
    }
  },
  shell: {
    brandTitle: settings.shell.brandTitle,
    quote: settings.shell.quote,
    nav: cloneNavItems(settings.shell.nav)
  },
  home: {
    ...settings.home,
    introMoreLinks: [...settings.home.introMoreLinks]
  },
  page: {
    essay: { ...settings.page.essay },
    archive: { ...settings.page.archive },
    bits: {
      title: settings.page.bits.title,
      subtitle: settings.page.bits.subtitle,
      defaultAuthor: {
        ...settings.page.bits.defaultAuthor
      }
    },
    memo: { ...settings.page.memo },
    about: { ...settings.page.about }
  },
  ui: {
    codeBlock: { ...settings.ui.codeBlock },
    readingMode: { ...settings.ui.readingMode },
    articleMeta: { ...settings.ui.articleMeta },
    layout: { ...settings.ui.layout }
  }
});

const createValidationIssue = (path: string, message: string): AdminThemeSettingsValidationIssue => ({
  path,
  message
});

export const validateAdminThemeSettings = (
  settings: EditableThemeSettings,
  options: AdminThemeSettingsValidateOptions = {}
): AdminThemeSettingsValidationIssue[] => {
  const footerStartYearMax = options.footerStartYearMax ?? getAdminFooterStartYearMax();
  const issues: AdminThemeSettingsValidationIssue[] = [];
  const pushIssue = (path: string, message: string): void => {
    issues.push(createValidationIssue(path, message));
  };

  if (!settings.site.title) pushIssue('site.title', 'Site title cannot be empty');
  if (!settings.site.description) pushIssue('site.description', 'Site description cannot be empty');
  if (!settings.site.defaultLocale) {
    pushIssue('site.defaultLocale', 'Default language cannot be empty');
  } else if (!ADMIN_LOCALE_RE.test(settings.site.defaultLocale)) {
    pushIssue('site.defaultLocale', 'Default language format is invalid (example: zh-CN)');
  }

  if (!Number.isInteger(settings.site.footer?.startYear)) {
    pushIssue('site.footer.startYear', 'Footer start year must be an integer');
  } else if (
    settings.site.footer.startYear < ADMIN_FOOTER_START_YEAR_MIN ||
    settings.site.footer.startYear > footerStartYearMax
  ) {
    pushIssue('site.footer.startYear', 'Footer start year is out of allowed range');
  }

  if (typeof settings.site.footer?.showCurrentYear !== 'boolean') {
    pushIssue('site.footer.showCurrentYear', 'Whether to display the current year must be a boolean');
  }

  if (!settings.site.footer?.copyright) {
    pushIssue('site.footer.copyright', 'Footer copyright cannot be empty');
  } else if (
    settings.site.footer.copyright.includes('\n') ||
    settings.site.footer.copyright.includes('\r')
  ) {
    pushIssue('site.footer.copyright', 'Footer copyright only allows single-line text');
  } else if (settings.site.footer.copyright.length > ADMIN_FOOTER_COPYRIGHT_MAX_LENGTH) {
    pushIssue('site.footer.copyright', `Footer copyright cannot exceed ${ADMIN_FOOTER_COPYRIGHT_MAX_LENGTH} characters`);
  }

  if (
    settings.site.socialLinks?.github &&
    !isAdminAllowedHttpsUrl(settings.site.socialLinks.github, ADMIN_GITHUB_HOSTS)
  ) {
    pushIssue('site.socialLinks.github', 'GitHub link only allows https://github.com/... ');
  }
  if (
    settings.site.socialLinks?.x &&
    !isAdminAllowedHttpsUrl(settings.site.socialLinks.x, ADMIN_X_HOSTS)
  ) {
    pushIssue('site.socialLinks.x', 'X / Twitter link only allows https://x.com/... or https://twitter.com/... ');
  }
  if (
    settings.site.socialLinks?.email &&
    !ADMIN_EMAIL_RE.test(normalizeEmail(settings.site.socialLinks.email))
  ) {
    pushIssue('site.socialLinks.email', 'Email must be a valid email address');
  }

  const presetOrder = settings.site.socialLinks.presetOrder;
  const customLinks = Array.isArray(settings.site.socialLinks?.custom) ? settings.site.socialLinks.custom : [];
  const socialOrderIssues = getAdminSocialOrderIssues(
    presetOrder,
    customLinks.map((item, index) => ({
      key: String(index),
      order: item.order
    }))
  );
  const presetOrderIssues = new Map<SiteSocialPresetId, 'range' | 'duplicate'>();
  const customOrderIssues = new Map<number, 'range' | 'duplicate'>();

  socialOrderIssues.forEach((issue) => {
    if (issue.scope === 'preset') {
      if (isAdminSocialPresetId(issue.key)) {
        presetOrderIssues.set(issue.key, issue.type);
      }
      return;
    }

    const index = Number.parseInt(issue.key, 10);
    if (Number.isInteger(index)) {
      customOrderIssues.set(index, issue.type);
    }
  });

  ADMIN_SOCIAL_PRESET_IDS.forEach((id) => {
    const rowLabel = id === 'github' ? 'GitHub' : id === 'x' ? 'X / Twitter' : 'Email';
    const orderIssue = presetOrderIssues.get(id);
    if (orderIssue === 'range') {
      pushIssue(
        `site.socialLinks.presetOrder.${id}`,
        `${rowLabel} position order must be an integer from ${ADMIN_SOCIAL_ORDER_MIN} to ${ADMIN_SOCIAL_ORDER_MAX}`
      );
      return;
    }
    if (orderIssue === 'duplicate') {
      pushIssue(`site.socialLinks.presetOrder.${id}`, `Social link position order cannot be repeated: ${presetOrder[id]}`);
    }
  });

  if (customLinks.length > ADMIN_SOCIAL_CUSTOM_LIMIT) {
    pushIssue('site.socialLinks.custom', `Custom links can add up to ${ADMIN_SOCIAL_CUSTOM_LIMIT} items`);
  }

  const seenCustomIds = new Set<string>();
  customLinks.forEach((item, index) => {
    const basePath = `site.socialLinks.custom[${index}]`;
    if (!item.id) {
      pushIssue(`${basePath}.id`, `Custom link #${index + 1} ID cannot be empty`);
    } else {
      if (item.id.includes('\n') || item.id.includes('\r')) {
        pushIssue(`${basePath}.id`, `Custom link #${index + 1} ID only allows single-line text`);
      }
      if (seenCustomIds.has(item.id)) {
        pushIssue(`${basePath}.id`, `Custom link ID repeated: ${item.id}`);
      }
      seenCustomIds.add(item.id);
    }

    if (!item.label) {
      pushIssue(`${basePath}.label`, `Custom link #${index + 1} display name cannot be empty`);
    } else if (item.label.includes('\n') || item.label.includes('\r')) {
      pushIssue(`${basePath}.label`, `Custom link #${index + 1} display name only allows single-line text`);
    }

    if (!item.href || !isAdminAllowedHttpsUrl(item.href)) {
      pushIssue(`${basePath}.href`, `Custom link #${index + 1} URL must be a valid https:// address`);
    }
    if (!isAdminSocialIconKey(item.iconKey)) {
      pushIssue(`${basePath}.iconKey`, `Custom link #${index + 1} icon must be selected from the whitelist`);
    }
    const orderIssue = customOrderIssues.get(index);
    if (orderIssue === 'range') {
      pushIssue(
        `${basePath}.order`,
        `Custom link #${index + 1} position order must be an integer from ${ADMIN_SOCIAL_ORDER_MIN} to ${ADMIN_SOCIAL_ORDER_MAX}`
      );
    } else if (orderIssue === 'duplicate') {
      pushIssue(`${basePath}.order`, `Social link position order cannot be repeated: ${item.order}`);
    }
    if (typeof item.visible !== 'boolean') {
      pushIssue(`${basePath}.visible`, `Custom link #${index + 1} visible must be a boolean`);
    }
  });

  if (!settings.shell.brandTitle) pushIssue('shell.brandTitle', 'Sidebar site name cannot be empty');
  if (!settings.shell.quote) pushIssue('shell.quote', 'Sidebar quote cannot be empty');

  if (!settings.home.introLead) {
    pushIssue('home.introLead', 'Home intro lead text cannot be empty');
  } else if (settings.home.introLead.length > ADMIN_HOME_INTRO_MAX_LENGTH) {
    pushIssue('home.introLead', `Home intro lead text cannot exceed ${ADMIN_HOME_INTRO_MAX_LENGTH} characters`);
  }

  if (typeof settings.home.showIntroLead !== 'boolean') {
    pushIssue('home.showIntroLead', 'Home intro lead text display toggle must be a boolean');
  }

  if (!settings.home.introMore) {
    pushIssue('home.introMore', 'Home intro supplementary text cannot be empty');
  } else if (settings.home.introMore.length > ADMIN_HOME_INTRO_MAX_LENGTH) {
    pushIssue('home.introMore', `Home intro supplementary text cannot exceed ${ADMIN_HOME_INTRO_MAX_LENGTH} characters`);
  }

  if (typeof settings.home.showIntroMore !== 'boolean') {
    pushIssue('home.showIntroMore', 'Home intro supplementary text display toggle must be a boolean');
  }

  if (!Array.isArray(settings.home.introMoreLinks)) {
    pushIssue('home.introMoreLinks', 'Home intro links must be an array');
  } else if (
    settings.home.introMoreLinks.length < 1 ||
    settings.home.introMoreLinks.length > ADMIN_HOME_INTRO_LINK_LIMIT
  ) {
    pushIssue('home.introMoreLinks', `Home intro links must select 1-${ADMIN_HOME_INTRO_LINK_LIMIT} entries`);
  } else {
    const seenHomeIntroLinks = new Set<HomeIntroLinkKey>();
    settings.home.introMoreLinks.forEach((linkKey, index) => {
      if (!isAdminHomeIntroLinkKey(linkKey)) {
        pushIssue(`home.introMoreLinks[${index}]`, `Home intro link #${index + 1} is invalid: ${String(linkKey)}`);
        return;
      }
      if (seenHomeIntroLinks.has(linkKey)) {
        pushIssue(`home.introMoreLinks[${index}]`, `Home intro link cannot be repeated: ${linkKey}`);
        return;
      }
      seenHomeIntroLinks.add(linkKey);
    });
  }

  if (!ADMIN_HERO_PRESET_SET.has(settings.home.heroPresetId)) {
    pushIssue('home.heroPresetId', 'Hero display mode only allows default/none');
  }

  if (
    settings.home.heroImageSrc !== null &&
    normalizeAdminHeroImageSrc(settings.home.heroImageSrc) === undefined
  ) {
    pushIssue(
      'home.heroImageSrc',
      'Hero image URL only allows src/assets/**, public/** (or paths starting with /), and https:// image URLs'
    );
  } else if (settings.home.heroImageSrc) {
    const localFilePath = getAdminHeroImageLocalFilePath(settings.home.heroImageSrc);
    if (localFilePath && options.localFileExists && !options.localFileExists(localFilePath)) {
      pushIssue('home.heroImageSrc', `Hero image local file does not exist: ${localFilePath}`);
    }
  }

  if (!settings.home.heroImageAlt) {
    pushIssue('home.heroImageAlt', 'Hero image alt cannot be empty');
  } else if (
    settings.home.heroImageAlt.includes('\n') ||
    settings.home.heroImageAlt.includes('\r')
  ) {
    pushIssue('home.heroImageAlt', 'Hero image alt only allows single-line text');
  } else if (settings.home.heroImageAlt.length > ADMIN_HERO_IMAGE_ALT_MAX_LENGTH) {
    pushIssue('home.heroImageAlt', `Hero image alt cannot exceed ${ADMIN_HERO_IMAGE_ALT_MAX_LENGTH} characters`);
  }

  const pageTitleMap: Array<[string | null, string, string]> = [
    [settings.page.essay?.title, '/essay/ page main title', 'page.essay.title'],
    [settings.page.archive?.title, '/archive/ page main title', 'page.archive.title'],
    [settings.page.bits?.title, '/bits/ page main title', 'page.bits.title'],
    [settings.page.memo?.title, '/memo/ page main title', 'page.memo.title'],
    [settings.page.about?.title, '/about/ page main title', 'page.about.title']
  ];

  pageTitleMap.forEach(([title, label, path]) => {
    if (title == null) return;
    if (typeof title !== 'string') {
      pushIssue(path, `${label} must be a string or be empty`);
      return;
    }
    if (title.includes('\n') || title.includes('\r')) {
      pushIssue(path, `${label} only allows single-line text`);
    }
    if (title.length > ADMIN_PAGE_TITLE_MAX_LENGTH) {
      pushIssue(path, `${label} cannot exceed ${ADMIN_PAGE_TITLE_MAX_LENGTH} characters`);
    }
  });

  const pageSubtitleMap: Array<[string | null, string, string]> = [
    [settings.page.essay?.subtitle, '/essay/ page subtitle', 'page.essay.subtitle'],
    [settings.page.archive?.subtitle, '/archive/ page subtitle', 'page.archive.subtitle'],
    [settings.page.bits?.subtitle, '/bits/ page subtitle', 'page.bits.subtitle'],
    [settings.page.memo?.subtitle, '/memo/ page subtitle', 'page.memo.subtitle'],
    [settings.page.about?.subtitle, '/about/ page subtitle', 'page.about.subtitle']
  ];

  pageSubtitleMap.forEach(([subtitle, label, path]) => {
    if (subtitle == null) return;
    if (typeof subtitle !== 'string') {
      pushIssue(path, `${label} must be a string or be empty`);
      return;
    }
    if (subtitle.includes('\n') || subtitle.includes('\r')) {
      pushIssue(path, `${label} only allows single-line text`);
    }
    if (subtitle.length > ADMIN_PAGE_SUBTITLE_MAX_LENGTH) {
      pushIssue(path, `${label} cannot exceed ${ADMIN_PAGE_SUBTITLE_MAX_LENGTH} characters`);
    }
  });

  if (!settings.page.bits?.defaultAuthor?.name) {
    pushIssue('page.bits.defaultAuthor.name', 'Bits default author name cannot be empty');
  }
  if (settings.page.bits?.defaultAuthor?.avatar) {
    if (normalizeAdminBitsAvatarPath(settings.page.bits.defaultAuthor.avatar) === undefined) {
      pushIssue(
        'page.bits.defaultAuthor.avatar',
        'Bits default avatar only allows relative image paths (e.g., author/avatar.webp), no public/, no leading /, no URL, .., ?, or #'
      );
    } else {
      const localFilePath = getAdminBitsAvatarLocalFilePath(settings.page.bits.defaultAuthor.avatar);
      if (localFilePath && options.localFileExists && !options.localFileExists(localFilePath)) {
        pushIssue('page.bits.defaultAuthor.avatar', `Bits default avatar local file does not exist: ${localFilePath}`);
      }
    }
  }

  if (typeof settings.ui?.articleMeta?.showDate !== 'boolean') {
    pushIssue('ui.articleMeta.showDate', '文章元信息里的“显示发布日期”必须是布尔值');
  }

  if (typeof settings.ui?.articleMeta?.dateLabel !== 'string') {
    pushIssue('ui.articleMeta.dateLabel', '文章元信息里的“日期前缀”必须是字符串');
  } else if (
    settings.ui.articleMeta.dateLabel.includes('\n') ||
    settings.ui.articleMeta.dateLabel.includes('\r')
  ) {
    pushIssue('ui.articleMeta.dateLabel', '文章元信息里的“日期前缀”must be single-line text');
  } else if (settings.ui.articleMeta.dateLabel.length > ADMIN_ARTICLE_META_DATE_LABEL_MAX_LENGTH) {
    pushIssue(
      'ui.articleMeta.dateLabel',
      `文章元信息里的“日期前缀”cannot exceed ${ADMIN_ARTICLE_META_DATE_LABEL_MAX_LENGTH} characters`
    );
  }

  if (typeof settings.ui?.articleMeta?.showTags !== 'boolean') {
    pushIssue('ui.articleMeta.showTags', '文章元信息里的“显示标签”必须是布尔值');
  }

  if (typeof settings.ui?.articleMeta?.showWordCount !== 'boolean') {
    pushIssue('ui.articleMeta.showWordCount', '文章元信息里的“显示字数”必须是布尔值');
  }

  if (typeof settings.ui?.articleMeta?.showReadingTime !== 'boolean') {
    pushIssue('ui.articleMeta.showReadingTime', '文章元信息里的“显示阅读时长”必须是布尔值');
  }

  if (!isAdminSidebarDividerVariant(settings.ui?.layout?.sidebarDivider ?? '')) {
    pushIssue('ui.layout.sidebarDivider', 'Sidebar divider only allows Default / Subtle / Hidden');
  }

  const nav = Array.isArray(settings.shell.nav) ? settings.shell.nav : [];
  if (nav.length !== ADMIN_NAV_IDS.length) {
    pushIssue('shell.nav', 'Sidebar navigation item count must be consistent with existing navigation');
  }

  const seenIds = new Set<SidebarNavId>();
  const navOrderIssues = new Map<SidebarNavId, 'range' | 'duplicate'>();
  getAdminNavOrderIssues(
    nav.flatMap((item) =>
      ADMIN_NAV_IDS.includes(item.id)
        ? [
            {
              key: item.id as SidebarNavId,
              order: item.order
            }
          ]
        : []
    )
  ).forEach((issue) => {
    navOrderIssues.set(issue.key, issue.type);
  });

  nav.forEach((item, index) => {
    const navId = ADMIN_NAV_IDS.includes(item.id) ? item.id : null;
    const basePath = navId ? `shell.nav.${navId}` : `shell.nav[${index}]`;
    if (!navId) {
      pushIssue(`${basePath}.id`, `Invalid navigation item ID: ${item.id}`);
    } else if (seenIds.has(navId)) {
      pushIssue(`${basePath}.id`, `Navigation item ID is duplicated: ${navId}`);
    }
    if (navId) seenIds.add(navId);

    if (!item.label) {
      pushIssue(`${basePath}.label`, `Navigation item ${item.id} display name cannot be empty`);
    }
    if (item.ornament !== null) {
      if (typeof item.ornament !== 'string') {
        pushIssue(`${basePath}.ornament`, `Navigation item ${item.id} ornament must be a string or empty`);
      } else if (item.ornament.includes('\n') || item.ornament.includes('\r')) {
        pushIssue(`${basePath}.ornament`, `Navigation item ${item.id} ornament only allows single-line text`);
      } else if (item.ornament.length > ADMIN_NAV_ORNAMENT_MAX_LENGTH) {
        pushIssue(`${basePath}.ornament`, `Navigation item ${item.id} ornament cannot exceed ${ADMIN_NAV_ORNAMENT_MAX_LENGTH} characters`);
      }
    }
    if (
      !Number.isInteger(item.order) ||
      item.order < ADMIN_NAV_ORDER_MIN ||
      item.order > ADMIN_NAV_ORDER_MAX
    ) {
      pushIssue(`${basePath}.order`, `Navigation item ${item.id} order must be an integer between ${ADMIN_NAV_ORDER_MIN}-${ADMIN_NAV_ORDER_MAX}`);
    } else if (navId && navOrderIssues.get(navId) === 'duplicate') {
      pushIssue(`${basePath}.order`, `Order cannot be duplicated: ${item.order}`);
    }
    if (typeof item.visible !== 'boolean') {
      pushIssue(`${basePath}.visible`, `Navigation item ${item.id} visible must be a boolean`);
    }
  });

  return issues;
};

const appendPathSegment = (basePath: string, segment: string): string => {
  if (!basePath) return segment;
  if (segment.startsWith('[')) return `${basePath}${segment}`;
  return `${basePath}.${segment}`;
};

const collectMismatchPaths = (
  actual: unknown,
  expected: unknown,
  mode: AdminThemeSettingsMismatchMode,
  basePath = '',
  mismatches: string[] = []
): string[] => {
  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) {
      mismatches.push(basePath || 'root');
      return mismatches;
    }

    actual.forEach((item, index) => {
      collectMismatchPaths(item, expected[index], mode, appendPathSegment(basePath, `[${index}]`), mismatches);
    });
    return mismatches;
  }

  if (isRecord(actual) || isRecord(expected)) {
    if (!isRecord(actual) || !isRecord(expected)) {
      mismatches.push(basePath || 'root');
      return mismatches;
    }

    const actualKeys = Object.keys(actual);
    const expectedKeys = Object.keys(expected);
    const keys = mode === 'exact' ? Array.from(new Set([...actualKeys, ...expectedKeys])) : actualKeys;

    keys.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(actual, key) || !Object.prototype.hasOwnProperty.call(expected, key)) {
        mismatches.push(appendPathSegment(basePath, key));
        return;
      }

      collectMismatchPaths(actual[key], expected[key], mode, appendPathSegment(basePath, key), mismatches);
    });
    return mismatches;
  }

  if (!Object.is(actual, expected)) {
    mismatches.push(basePath || 'root');
  }
  return mismatches;
};

export const getAdminThemeSettingsMismatchPaths = (
  actual: unknown,
  expected: unknown,
  mode: AdminThemeSettingsMismatchMode = 'exact'
): string[] => Array.from(new Set(collectMismatchPaths(actual, expected, mode)));

export const createAdminThemeSettingsCanonicalMismatchIssues = (
  actual: unknown,
  expected: unknown,
  options: { mode?: AdminThemeSettingsMismatchMode; pathPrefix?: string; messagePrefix?: string } = {}
): AdminThemeSettingsValidationIssue[] => {
  const {
    mode = 'exact',
    pathPrefix = '',
    messagePrefix = 'Configuration values will change after normalization, please fix the original input first'
  } = options;
  const mismatchPaths = getAdminThemeSettingsMismatchPaths(actual, expected, mode);
  return mismatchPaths.map((path) => {
    const normalizedPath = path === 'root'
      ? (pathPrefix || 'root')
      : pathPrefix
        ? appendPathSegment(pathPrefix, path)
        : path;
    return createValidationIssue(normalizedPath, `${messagePrefix}：${normalizedPath}`);
  });
};

export const getAdminThemeSettingsGroupFileName = (group: ThemeSettingsFileGroup): string => `${group}.json`;
