type RequiredElements<T extends Record<string, Element | null>> = { [K in keyof T]: NonNullable<T[K]> };

export const byId = <T extends Element>(id: string): T | null => document.getElementById(id) as T | null;

export const query = <T extends Element>(parent: ParentNode, selector: string): T | null =>
  parent.querySelector(selector) as T | null;

export const queryAll = <T extends Element>(parent: ParentNode, selector: string): T[] =>
  Array.from(parent.querySelectorAll(selector)) as T[];

const ensureElements = <T extends Record<string, Element | null>>(elements: T): RequiredElements<T> | null => {
  const missingKeys = Object.entries(elements)
    .filter(([, element]) => element === null)
    .map(([key]) => key);
  if (missingKeys.length > 0) {
    console.error(`[admin-console] Missing required controls: ${missingKeys.join(', ')}`);
    return null;
  }
  return elements as RequiredElements<T>;
};

export type AdminThemeControls = RequiredElements<{
  form: HTMLFormElement | null;
  adminActions: HTMLElement | null;
  adminActionsSentinel: HTMLElement | null;
  statusInlineEl: HTMLElement | null;
  dirtyBanner: HTMLElement | null;
  errorBanner: HTMLElement | null;
  errorTitleEl: HTMLElement | null;
  errorMessageEl: HTMLElement | null;
  errorListEl: HTMLElement | null;
  errorRetryBtn: HTMLButtonElement | null;
  validateBtn: HTMLButtonElement | null;
  resetBtn: HTMLButtonElement | null;
  saveBtn: HTMLButtonElement | null;
  bootstrapEl: HTMLElement | null;
  articleMetaPreviewValueEl: HTMLElement | null;
  footerPreviewValueEl: HTMLElement | null;
  socialCustomList: HTMLElement | null;
  socialCustomHead: HTMLElement | null;
  socialCustomCountEl: HTMLElement | null;
  socialCustomAddBtn: HTMLButtonElement | null;
  socialCustomTemplate: HTMLTemplateElement | null;
  inputSiteTitle: HTMLInputElement | null;
  inputSiteDescription: HTMLTextAreaElement | null;
  inputSiteDefaultLocale: HTMLInputElement | null;
  inputSiteFooterStartYear: HTMLInputElement | null;
  inputSiteFooterShowCurrentYear: HTMLInputElement | null;
  inputSiteFooterCopyright: HTMLInputElement | null;
  inputSiteAdminOverviewPublicVisible: HTMLInputElement | null;
  inputSiteAdminOverviewHiddenMessage: HTMLInputElement | null;
  /* svg 槽位暂无上传 UI，隐藏 input 只负责把手工配置的值随表单快照往返。 */
  inputSiteFaviconSvg: HTMLInputElement | null;
  inputSiteFaviconPng: HTMLInputElement | null;
  inputSiteFaviconAppleTouchIcon: HTMLInputElement | null;
  inputSiteSocialGithubOrder: HTMLInputElement | null;
  inputSiteSocialGithub: HTMLInputElement | null;
  inputSiteSocialXOrder: HTMLInputElement | null;
  inputSiteSocialX: HTMLInputElement | null;
  inputSiteSocialEmailOrder: HTMLInputElement | null;
  inputSiteSocialEmail: HTMLInputElement | null;
  inputShellBrandTitle: HTMLInputElement | null;
  inputShellQuote: HTMLTextAreaElement | null;
  inputHomeShowIntroLead: HTMLInputElement | null;
  inputHomeShowIntroMore: HTMLInputElement | null;
  inputHomeIntroLead: HTMLTextAreaElement | null;
  inputHomeIntroMore: HTMLTextAreaElement | null;
  homeIntroMorePreviewEl: HTMLElement | null;
  inputHomeIntroMoreLinkPrimary: HTMLSelectElement | null;
  inputHomeIntroMoreLinkSecondaryEnabled: HTMLInputElement | null;
  homeIntroMoreLinkSecondaryGroupEl: HTMLElement | null;
  inputHomeIntroMoreLinkSecondary: HTMLSelectElement | null;
  inputPageEssayTitle: HTMLInputElement | null;
  inputPageEssaySubtitle: HTMLInputElement | null;
  inputPageArchiveTitle: HTMLInputElement | null;
  inputPageArchiveSubtitle: HTMLInputElement | null;
  inputPageBitsTitle: HTMLInputElement | null;
  inputPageBitsSubtitle: HTMLInputElement | null;
  inputPageMemoTitle: HTMLInputElement | null;
  inputPageMemoSubtitle: HTMLInputElement | null;
  inputPageAboutTitle: HTMLInputElement | null;
  inputPageAboutSubtitle: HTMLInputElement | null;
  inputArticleMetaShowDate: HTMLInputElement | null;
  inputArticleMetaDateLabel: HTMLInputElement | null;
  inputArticleMetaShowTags: HTMLInputElement | null;
  inputArticleMetaShowWordCount: HTMLInputElement | null;
  inputArticleMetaShowReadingTime: HTMLInputElement | null;
  inputPageBitsAuthorName: HTMLInputElement | null;
  inputPageBitsAuthorAvatar: HTMLInputElement | null;
  inputHomeShowHero: HTMLInputElement | null;
  inputHeroImageSrc: HTMLInputElement | null;
  inputHeroImageAlt: HTMLInputElement | null;
  inputCodeLineNumbers: HTMLInputElement | null;
  inputReadingEntry: HTMLInputElement | null;
  inputSidebarActionsShowRssLink: HTMLInputElement | null;
  inputSidebarActionsShowThemeToggle: HTMLInputElement | null;
  inputSidebarActionsShowAdminEntry: HTMLInputElement | null;
  sidebarAdminEntryRowEl: HTMLElement | null;
  inputSidebarDividerDefault: HTMLInputElement | null;
  inputSidebarDividerSubtle: HTMLInputElement | null;
  inputSidebarDividerNone: HTMLInputElement | null;
  /* 排版字体是 radio 卡片组：控件引用的是 radiogroup 容器（id 与旧 select 一致），值经 :checked 读写。 */
  inputTypographyReadable: HTMLElement | null;
  inputTypographyCopy: HTMLElement | null;
  inputTypographyMono: HTMLElement | null;
  inputTypographyBrand: HTMLElement | null;
}> & {
  statusEl: HTMLElement | null;
  statusLiveEl: HTMLElement | null;
};

export const queryAdminThemeControls = (): AdminThemeControls | null => {
  const controls = ensureElements({
    form: byId<HTMLFormElement>('admin-form'),
    adminActions: byId<HTMLElement>('admin-actions'),
    adminActionsSentinel: byId<HTMLElement>('admin-actions-sentinel'),
    statusInlineEl: byId<HTMLElement>('admin-status-inline'),
    dirtyBanner: byId<HTMLElement>('admin-dirty-banner'),
    errorBanner: byId<HTMLElement>('admin-error-banner'),
    errorTitleEl: byId<HTMLElement>('admin-error-title'),
    errorMessageEl: byId<HTMLElement>('admin-error-message'),
    errorListEl: byId<HTMLElement>('admin-error-list'),
    errorRetryBtn: byId<HTMLButtonElement>('admin-error-retry'),
    validateBtn: byId<HTMLButtonElement>('admin-validate'),
    resetBtn: byId<HTMLButtonElement>('admin-reset'),
    saveBtn: byId<HTMLButtonElement>('admin-save'),
    bootstrapEl: byId<HTMLElement>('admin-bootstrap'),
    articleMetaPreviewValueEl: byId<HTMLElement>('article-meta-preview-value'),
    footerPreviewValueEl: byId<HTMLElement>('site-footer-preview-value'),
    socialCustomList: byId<HTMLElement>('site-social-custom-list'),
    socialCustomHead: byId<HTMLElement>('site-social-custom-head'),
    socialCustomCountEl: byId<HTMLElement>('site-social-custom-count'),
    socialCustomAddBtn: byId<HTMLButtonElement>('site-social-custom-add'),
    socialCustomTemplate: byId<HTMLTemplateElement>('site-social-custom-row-template'),
    inputSiteTitle: byId<HTMLInputElement>('site-title'),
    inputSiteDescription: byId<HTMLTextAreaElement>('site-description'),
    inputSiteDefaultLocale: byId<HTMLInputElement>('site-default-locale'),
    inputSiteFooterStartYear: byId<HTMLInputElement>('site-footer-start-year'),
    inputSiteFooterShowCurrentYear: byId<HTMLInputElement>('site-footer-show-current-year'),
    inputSiteFooterCopyright: byId<HTMLInputElement>('site-footer-copyright'),
    inputSiteAdminOverviewPublicVisible: byId<HTMLInputElement>('site-admin-overview-public-visible'),
    inputSiteAdminOverviewHiddenMessage: byId<HTMLInputElement>('site-admin-overview-hidden-message'),
    inputSiteFaviconSvg: byId<HTMLInputElement>('site-favicon-svg'),
    inputSiteFaviconPng: byId<HTMLInputElement>('site-favicon-png'),
    inputSiteFaviconAppleTouchIcon: byId<HTMLInputElement>('site-favicon-apple-touch-icon'),
    inputSiteSocialGithubOrder: byId<HTMLInputElement>('site-social-github-order'),
    inputSiteSocialGithub: byId<HTMLInputElement>('site-social-github'),
    inputSiteSocialXOrder: byId<HTMLInputElement>('site-social-x-order'),
    inputSiteSocialX: byId<HTMLInputElement>('site-social-x'),
    inputSiteSocialEmailOrder: byId<HTMLInputElement>('site-social-email-order'),
    inputSiteSocialEmail: byId<HTMLInputElement>('site-social-email'),
    inputShellBrandTitle: byId<HTMLInputElement>('shell-brand-title'),
    inputShellQuote: byId<HTMLTextAreaElement>('shell-quote'),
    inputHomeShowIntroLead: byId<HTMLInputElement>('home-show-intro-lead'),
    inputHomeShowIntroMore: byId<HTMLInputElement>('home-show-intro-more'),
    inputHomeIntroLead: byId<HTMLTextAreaElement>('home-intro-lead'),
    inputHomeIntroMore: byId<HTMLTextAreaElement>('home-intro-more'),
    homeIntroMorePreviewEl: byId<HTMLElement>('home-intro-more-preview'),
    inputHomeIntroMoreLinkPrimary: byId<HTMLSelectElement>('home-intro-more-link-primary'),
    inputHomeIntroMoreLinkSecondaryEnabled: byId<HTMLInputElement>('home-intro-more-link-secondary-enabled'),
    homeIntroMoreLinkSecondaryGroupEl: byId<HTMLElement>('home-intro-more-link-secondary-group'),
    inputHomeIntroMoreLinkSecondary: byId<HTMLSelectElement>('home-intro-more-link-secondary'),
    inputPageEssayTitle: byId<HTMLInputElement>('page-essay-title'),
    inputPageEssaySubtitle: byId<HTMLInputElement>('page-essay-subtitle'),
    inputPageArchiveTitle: byId<HTMLInputElement>('page-archive-title'),
    inputPageArchiveSubtitle: byId<HTMLInputElement>('page-archive-subtitle'),
    inputPageBitsTitle: byId<HTMLInputElement>('page-bits-title'),
    inputPageBitsSubtitle: byId<HTMLInputElement>('page-bits-subtitle'),
    inputPageMemoTitle: byId<HTMLInputElement>('page-memo-title'),
    inputPageMemoSubtitle: byId<HTMLInputElement>('page-memo-subtitle'),
    inputPageAboutTitle: byId<HTMLInputElement>('page-about-title'),
    inputPageAboutSubtitle: byId<HTMLInputElement>('page-about-subtitle'),
    inputArticleMetaShowDate: byId<HTMLInputElement>('ui-article-meta-show-date'),
    inputArticleMetaDateLabel: byId<HTMLInputElement>('ui-article-meta-date-label'),
    inputArticleMetaShowTags: byId<HTMLInputElement>('ui-article-meta-show-tags'),
    inputArticleMetaShowWordCount: byId<HTMLInputElement>('ui-article-meta-show-word-count'),
    inputArticleMetaShowReadingTime: byId<HTMLInputElement>('ui-article-meta-show-reading-time'),
    inputPageBitsAuthorName: byId<HTMLInputElement>('page-bits-author-name'),
    inputPageBitsAuthorAvatar: byId<HTMLInputElement>('page-bits-author-avatar'),
    inputHomeShowHero: byId<HTMLInputElement>('home-show-hero'),
    inputHeroImageSrc: byId<HTMLInputElement>('home-hero-image-src'),
    inputHeroImageAlt: byId<HTMLInputElement>('home-hero-image-alt'),
    inputCodeLineNumbers: byId<HTMLInputElement>('ui-code-line-numbers'),
    inputReadingEntry: byId<HTMLInputElement>('ui-reading-entry'),
    inputSidebarActionsShowRssLink: byId<HTMLInputElement>('ui-sidebar-actions-show-rss-link'),
    inputSidebarActionsShowThemeToggle: byId<HTMLInputElement>('ui-sidebar-actions-show-theme-toggle'),
    inputSidebarActionsShowAdminEntry: byId<HTMLInputElement>('ui-sidebar-actions-show-admin-entry'),
    sidebarAdminEntryRowEl: byId<HTMLElement>('ui-sidebar-actions-show-admin-entry-row'),
    inputSidebarDividerDefault: byId<HTMLInputElement>('ui-layout-sidebar-divider-default'),
    inputSidebarDividerSubtle: byId<HTMLInputElement>('ui-layout-sidebar-divider-subtle'),
    inputSidebarDividerNone: byId<HTMLInputElement>('ui-layout-sidebar-divider-none'),
    inputTypographyReadable: byId<HTMLElement>('ui-typography-readable'),
    inputTypographyCopy: byId<HTMLElement>('ui-typography-copy'),
    inputTypographyMono: byId<HTMLElement>('ui-typography-mono'),
    inputTypographyBrand: byId<HTMLElement>('ui-typography-brand')
  });

  if (!controls) return null;

  return {
    ...controls,
    statusEl: byId<HTMLElement>('admin-status'),
    statusLiveEl: byId<HTMLElement>('admin-status-live')
  };
};
