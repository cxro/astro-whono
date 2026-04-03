import type {
  SidebarNavId,
  ThemeSettingsEditableErrorState,
  ThemeSettingsEditablePayload,
  ThemeSettingsReadDiagnostic
} from '@/lib/theme-settings';
import {
  ADMIN_NAV_IDS,
  ADMIN_SOCIAL_CUSTOM_LIMIT,
  getAdminFooterStartYearMax
} from '@/lib/admin-console/theme-shared';
import { createFormCodec, type EditableSettings } from './form-codec';
import { createAdminMediaPicker } from '../admin-shared/media-picker';
import { createAdminThemeMediaFields } from './media-fields';
import { shouldGuardAdminNavigation } from './navigation-guard';
import { createSocialLinks } from './social-links';
import { createAdminConsoleUiState } from './ui-state';
import { createValidation, type ValidationIssue } from './validation';

type RequiredElements<T extends Record<string, Element | null>> = { [K in keyof T]: NonNullable<T[K]> };
type LoadSource = 'bootstrap' | 'remote';
type LooseRecord = Record<string, unknown>;

const root = document.querySelector<HTMLElement>('[data-admin-root]');

if (!root) {
  // Current page does not use admin console.
} else {
  const byId = <T extends Element>(id: string): T | null => document.getElementById(id) as T | null;
  const query = <T extends Element>(parent: ParentNode, selector: string): T | null =>
    parent.querySelector(selector) as T | null;
  const queryAll = <T extends Element>(parent: ParentNode, selector: string): T[] =>
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
  const isRecord = (value: unknown): value is LooseRecord =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

  const endpoint = root.getAttribute('data-settings-endpoint') || '/api/admin/settings/';
  const footerStartYearMax = getAdminFooterStartYearMax();

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
    inputSidebarDividerDefault: byId<HTMLInputElement>('ui-layout-sidebar-divider-default'),
    inputSidebarDividerSubtle: byId<HTMLInputElement>('ui-layout-sidebar-divider-subtle'),
    inputSidebarDividerNone: byId<HTMLInputElement>('ui-layout-sidebar-divider-none')
  });

  if (!controls) {
    // Required controls are missing.
  } else {
    const {
      form,
      adminActions,
      adminActionsSentinel,
      statusInlineEl,
      dirtyBanner,
      errorBanner,
      errorTitleEl,
      errorMessageEl,
      errorListEl,
      errorRetryBtn,
      validateBtn,
      resetBtn,
      saveBtn,
      bootstrapEl,
      articleMetaPreviewValueEl,
      footerPreviewValueEl,
      socialCustomList,
      socialCustomHead,
      socialCustomCountEl,
      socialCustomAddBtn,
      socialCustomTemplate,
      inputSiteTitle,
      inputSiteDescription,
      inputSiteDefaultLocale,
      inputSiteFooterStartYear,
      inputSiteFooterShowCurrentYear,
      inputSiteFooterCopyright,
      inputSiteSocialGithubOrder,
      inputSiteSocialGithub,
      inputSiteSocialXOrder,
      inputSiteSocialX,
      inputSiteSocialEmailOrder,
      inputSiteSocialEmail,
      inputShellBrandTitle,
      inputShellQuote,
      inputHomeShowIntroLead,
      inputHomeShowIntroMore,
      inputHomeIntroLead,
      inputHomeIntroMore,
      homeIntroMorePreviewEl,
      inputHomeIntroMoreLinkPrimary,
      inputHomeIntroMoreLinkSecondaryEnabled,
      homeIntroMoreLinkSecondaryGroupEl,
      inputHomeIntroMoreLinkSecondary,
      inputPageEssayTitle,
      inputPageEssaySubtitle,
      inputPageArchiveTitle,
      inputPageArchiveSubtitle,
      inputPageBitsTitle,
      inputPageBitsSubtitle,
      inputPageMemoTitle,
      inputPageMemoSubtitle,
      inputPageAboutTitle,
      inputPageAboutSubtitle,
      inputArticleMetaShowDate,
      inputArticleMetaDateLabel,
      inputArticleMetaShowTags,
      inputArticleMetaShowWordCount,
      inputArticleMetaShowReadingTime,
      inputPageBitsAuthorName,
      inputPageBitsAuthorAvatar,
      inputHomeShowHero,
      inputHeroImageSrc,
      inputHeroImageAlt,
      inputCodeLineNumbers,
      inputReadingEntry,
      inputSidebarDividerDefault,
      inputSidebarDividerSubtle,
      inputSidebarDividerNone
    } = controls;
    const statusLiveEl = byId<HTMLElement>('admin-status-live');
    const statusEl = byId<HTMLElement>('admin-status');

    const getNavRows = (): HTMLElement[] => queryAll<HTMLElement>(root, '[data-nav-id]');
    const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

    const {
      defaultCustomSocialIconKey,
      getPresetRows,
      getCustomRows,
      getPresetFieldTarget,
      getCustomFieldTarget,
      getCustomVisibilityTarget,
      getCustomRowLabelInput,
      getPresetRowHrefInput,
      getPresetRowOrderInput,
      getStoredGeneratedCustomId,
      getStoredGeneratedCustomLabel,
      getNextSocialOrder,
      getPresetSocialOrder,
      normalizeCustomSocialLabel,
      syncPresetRow,
      normalizeSocialOrders,
      syncCustomRow,
      updateCustomRowsUi,
      createCustomRow,
      finalizeCustomIdInput,
      finalizeCustomLabelInput,
      replaceCustomRows
    } = createSocialLinks({
      query,
      queryAll,
      socialCustomList,
      socialCustomHead,
      socialCustomCountEl,
      socialCustomAddBtn,
      socialCustomTemplate,
      inputSiteSocialGithubOrder,
      inputSiteSocialXOrder,
      inputSiteSocialEmailOrder
    });

    const {
      canonicalize,
      collectSettings,
      applySettings,
      refreshArticleMetaPreview,
      refreshHomeIntroPreview,
      syncHomeIntroLinkControls,
      syncHeroControls,
      refreshFooterPreview,
      syncFooterYearControls
    } = createFormCodec({
      footerStartYearMax,
      query,
      getNavRows,
      getCustomRows,
      getCustomRowLabelInput,
      defaultCustomSocialIconKey,
      normalizeCustomSocialLabel,
      replaceCustomRows,
      normalizeSocialOrders,
      getPresetSocialOrder,
      articleMetaPreviewValueEl,
      footerPreviewValueEl,
      homeIntroMorePreviewEl,
      homeIntroMoreLinkSecondaryGroupEl,
      inputSiteTitle,
      inputSiteDescription,
      inputSiteDefaultLocale,
      inputSiteFooterStartYear,
      inputSiteFooterShowCurrentYear,
      inputSiteFooterCopyright,
      inputSiteSocialGithubOrder,
      inputSiteSocialGithub,
      inputSiteSocialXOrder,
      inputSiteSocialX,
      inputSiteSocialEmailOrder,
      inputSiteSocialEmail,
      inputShellBrandTitle,
      inputShellQuote,
      inputHomeShowIntroLead,
      inputHomeShowIntroMore,
      inputHomeIntroLead,
      inputHomeIntroMore,
      inputHomeIntroMoreLinkPrimary,
      inputHomeIntroMoreLinkSecondaryEnabled,
      inputHomeIntroMoreLinkSecondary,
      inputPageEssayTitle,
      inputPageEssaySubtitle,
      inputPageArchiveTitle,
      inputPageArchiveSubtitle,
      inputPageBitsTitle,
      inputPageBitsSubtitle,
      inputPageMemoTitle,
      inputPageMemoSubtitle,
      inputPageAboutTitle,
      inputPageAboutSubtitle,
      inputArticleMetaShowDate,
      inputArticleMetaDateLabel,
      inputArticleMetaShowTags,
      inputArticleMetaShowWordCount,
      inputArticleMetaShowReadingTime,
      inputPageBitsAuthorName,
      inputPageBitsAuthorAvatar,
      inputHomeShowHero,
      inputHeroImageSrc,
      inputHeroImageAlt,
      inputCodeLineNumbers,
      inputReadingEntry,
      inputSidebarDividerDefault,
      inputSidebarDividerSubtle,
      inputSidebarDividerNone
    });
    let themeMediaFields: ReturnType<typeof createAdminThemeMediaFields> | null = null;

    const finalizeAppliedSettings = (): void => {
      getPresetRows().forEach((row) => {
        delete row.dataset.stashedHref;
        delete row.dataset.stashedOrder;
        syncPresetRow(row);
      });
      themeMediaFields?.refreshAll();
    };

    const getNavFieldTarget = (
      id: SidebarNavId,
      field: 'label' | 'ornament' | 'order' | 'visible'
    ): (() => HTMLElement | null) => () => {
      const row = query<HTMLElement>(root, `[data-nav-id="${id}"]`);
      return row ? query<HTMLElement>(row, `[data-nav-field="${field}"]`) : null;
    };

    const getFirstNavLabelTarget = (): HTMLElement | null => {
      const firstNavId = ADMIN_NAV_IDS[0];
      return firstNavId ? getNavFieldTarget(firstNavId, 'label')() : null;
    };

    const {
      validateSettings,
      clearInvalidFields,
      markInvalidFields,
      resolveIssueField
    } = createValidation({
      form,
      queryAll,
      footerStartYearMax,
      socialCustomAddBtn,
      inputSiteTitle,
      inputSiteDescription,
      inputSiteDefaultLocale,
      inputSiteFooterStartYear,
      inputSiteFooterShowCurrentYear,
      inputSiteFooterCopyright,
      inputSiteSocialGithub,
      inputSiteSocialX,
      inputSiteSocialEmail,
      inputShellBrandTitle,
      inputShellQuote,
      inputHomeIntroLead,
      inputHomeShowIntroLead,
      inputHomeIntroMore,
      inputHomeShowIntroMore,
      inputHomeIntroMoreLinkPrimary,
      inputHomeShowHero,
      inputHeroImageSrc,
      inputHeroImageAlt,
      inputPageEssayTitle,
      inputPageArchiveTitle,
      inputPageBitsTitle,
      inputPageMemoTitle,
      inputPageAboutTitle,
      inputPageEssaySubtitle,
      inputPageArchiveSubtitle,
      inputPageBitsSubtitle,
      inputPageMemoSubtitle,
      inputPageAboutSubtitle,
      inputArticleMetaShowDate,
      inputArticleMetaDateLabel,
      inputArticleMetaShowTags,
      inputArticleMetaShowWordCount,
      inputArticleMetaShowReadingTime,
      inputPageBitsAuthorName,
      inputPageBitsAuthorAvatar,
      inputSidebarDividerDefault,
      getPresetFieldTarget,
      getCustomFieldTarget,
      getCustomVisibilityTarget,
      getNavFieldTarget,
      getFirstNavLabelTarget
    });

    let baseline: EditableSettings | null = null;
    let currentRevision: string | null = null;
    const statusTargets = [statusEl, statusInlineEl].filter((target): target is HTMLElement => target !== null);
    const uiState = createAdminConsoleUiState({
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
    });

    const scrollIntoViewWithOffset = (element: HTMLElement): void => {
      const top = element.getBoundingClientRect().top + window.scrollY - 24;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    };

    const revealErrorState = (issues: readonly ValidationIssue[] = []): void => {
      const firstField = issues
        .map((issue) => resolveIssueField(issue))
        .find((field): field is HTMLElement => field !== null);

      scrollIntoViewWithOffset(errorBanner);
      window.requestAnimationFrame(() => {
        if (!firstField) {
          errorBanner.focus({ preventScroll: true });
          return;
        }
        firstField.focus({ preventScroll: true });
        const { top, bottom } = firstField.getBoundingClientRect();
        if (top < 96 || bottom > window.innerHeight - 24) {
          scrollIntoViewWithOffset(firstField);
        }
      });
    };

    const STATUS_INVALID_SETTINGS = '配置损坏';

    const mediaPicker = createAdminMediaPicker();
    themeMediaFields = createAdminThemeMediaFields({
      root,
      picker: mediaPicker,
      setStatus: uiState.setStatus
    });

    const setValidationIssues = (issues: readonly ValidationIssue[]): void => {
      markInvalidFields(issues);
      uiState.setErrors(issues.map((issue) => issue.message));
    };

    const refreshDirty = (): void => {
      if (!baseline) return;
      const current = canonicalize(collectSettings());
      uiState.setDirty(JSON.stringify(current) !== JSON.stringify(baseline));
    };

    const validateCurrentSettings = (): { draft: EditableSettings; issues: ValidationIssue[] } => {
      const draft = collectSettings();
      const issues = validateSettings(draft);
      setValidationIssues(issues);
      return { draft, issues };
    };

    const extractSettingsPayload = (payload: unknown): ThemeSettingsEditablePayload | null => {
      if (!isRecord(payload)) return null;
      if (typeof payload.revision === 'string' && isRecord(payload.settings)) {
        return payload as unknown as ThemeSettingsEditablePayload;
      }

      const nestedPayload = payload.payload;
      if (
        isRecord(nestedPayload) &&
        typeof nestedPayload.revision === 'string' &&
        isRecord(nestedPayload.settings)
      ) {
        return nestedPayload as unknown as ThemeSettingsEditablePayload;
      }
      return null;
    };

    const extractInvalidSettingsState = (payload: unknown): ThemeSettingsEditableErrorState | null => {
      if (!isRecord(payload)) return null;
      if (payload.ok !== false || payload.mode !== 'invalid-settings') return null;
      if (typeof payload.message !== 'string' || !Array.isArray(payload.errors)) return null;
      return payload as unknown as ThemeSettingsEditableErrorState;
    };

    const getPayloadMessage = (payload: unknown): string | null =>
      isRecord(payload) && typeof payload.message === 'string' ? payload.message : null;

    const getPayloadErrors = (payload: unknown): string[] => {
      if (!isRecord(payload) || !Array.isArray(payload.errors)) return [];
      return payload.errors.filter((error): error is string => typeof error === 'string' && error.length > 0);
    };

    const getDiagnosticHeadline = (diagnostic: ThemeSettingsReadDiagnostic): string => {
      const fileName = diagnostic.path.split('/').pop() || diagnostic.path;
      if (diagnostic.code === 'invalid-json') return `${fileName} 格式错误`;
      if (diagnostic.code === 'invalid-root') return `${fileName} 结构错误`;
      if (diagnostic.code === 'schema-mismatch') return `${fileName} 配置不一致`;
      return `${fileName} 读取失败`;
    };

    const createDiagnosticMeta = (label: string, value: string, options: { mono?: boolean } = {}): HTMLElement => {
      const row = document.createElement('div');
      row.className = 'admin-banner__meta';

      const labelEl = document.createElement('span');
      labelEl.className = 'admin-banner__meta-label';
      labelEl.textContent = label;

      const valueEl = document.createElement(options.mono ? 'code' : 'span');
      valueEl.className = options.mono ? 'admin-banner__meta-value admin-banner__meta-value--mono' : 'admin-banner__meta-value';
      valueEl.textContent = value;

      row.append(labelEl, valueEl);
      return row;
    };

    const createDiagnosticListItem = (diagnostic: ThemeSettingsReadDiagnostic): HTMLElement => {
      const item = document.createElement('li');
      item.className = 'admin-banner__list-item admin-banner__list-item--diagnostic';

      const title = document.createElement('p');
      title.className = 'admin-banner__item-title';
      title.textContent = getDiagnosticHeadline(diagnostic);
      item.appendChild(title);

      item.appendChild(createDiagnosticMeta('文件', diagnostic.path, { mono: true }));

      if (typeof diagnostic.line === 'number' && typeof diagnostic.column === 'number') {
        item.appendChild(createDiagnosticMeta('位置', `第 ${diagnostic.line} 行，第 ${diagnostic.column} 列`));
      }

      if (diagnostic.detail) {
        item.appendChild(createDiagnosticMeta('技术细节', diagnostic.detail, { mono: true }));
      }

      return item;
    };

    const setInvalidSettingsErrorBanner = (invalidState: ThemeSettingsEditableErrorState): void => {
      uiState.setErrorBanner({
        title: '已切换为只读保护',
        message: '检测到 settings 配置文件损坏。请先修复文件，再点击“重新检查”或刷新当前页面。',
        items: invalidState.diagnostics.map((diagnostic) => createDiagnosticListItem(diagnostic)),
        retryable: true
      });
    };

    const applyInvalidSettingsState = (
      payload: unknown,
      options: { announceStatus?: boolean; revealError?: boolean } = {}
    ): boolean => {
      const invalidState = extractInvalidSettingsState(payload);
      if (!invalidState) return false;

      currentRevision = null;
      baseline = null;
      clearInvalidFields();
      uiState.setDirty(false);
      uiState.setConsoleLocked(true);
      setInvalidSettingsErrorBanner(invalidState);
      uiState.setStatus(
        'error',
        STATUS_INVALID_SETTINGS,
        options.announceStatus === undefined ? {} : { announce: options.announceStatus }
      );
      if (options.revealError) {
        revealErrorState();
      }

      return true;
    };

    const loadPayload = (
      payload: unknown,
      source: LoadSource,
      options: { announceStatus?: boolean } = {}
    ): void => {
      if (
        applyInvalidSettingsState(
          payload,
          options.announceStatus === undefined ? {} : { announceStatus: options.announceStatus }
        )
      ) {
        return;
      }

      const resolvedPayload = extractSettingsPayload(payload);
      if (!resolvedPayload) {
        clearInvalidFields();
        uiState.setStatus('error', '返回数据格式无效');
        uiState.setErrors([getPayloadMessage(payload) || '配置接口返回了无效的 payload'], { title: '读取配置失败' });
        revealErrorState();
        return;
      }

      uiState.setConsoleLocked(false);
      currentRevision = resolvedPayload.revision;
      const normalized = canonicalize(resolvedPayload.settings);
      applySettings(normalized);
      finalizeAppliedSettings();
      baseline = canonicalize(collectSettings());
      clearInvalidFields();
      uiState.clearErrorBanner();
      uiState.setDirty(false);
      uiState.setStatus(
        'ready',
        source === 'remote' ? '已同步最新配置' : '已载入初始配置',
        { announce: options.announceStatus ?? source === 'remote' }
      );
    };

    const setInitialLoadError = (message: string): void => {
      currentRevision = null;
      baseline = null;
      clearInvalidFields();
      uiState.setDirty(false);
      uiState.setConsoleLocked(true);
      uiState.setStatus('error', '初始化失败');
      uiState.setErrors([message], {
        title: '读取配置失败',
        message: '未能读取 Theme Console 当前配置。请点击“重新检查”重试。',
        retryable: true
      });
      revealErrorState();
    };

    const hasInitialSettings = (): boolean => baseline !== null && currentRevision !== null;

    const loadBootstrap = (): 'ready' | 'locked' | 'fallback' => {
      try {
        const payload = JSON.parse(bootstrapEl.textContent || '{}') as unknown;
        if (applyInvalidSettingsState(payload, { announceStatus: false })) {
          return 'locked';
        }
        if (!extractSettingsPayload(payload)) {
          console.warn('Theme Console bootstrap payload is invalid; falling back to /api/admin/settings/.');
          return 'fallback';
        }
        loadPayload(payload, 'bootstrap', { announceStatus: false });
        return 'ready';
      } catch (error) {
        console.warn(error);
        return 'fallback';
      }
    };

    const loadFromApi = async (): Promise<void> => {
      uiState.setStatus('loading', '正在读取 /api/admin/settings', { announce: false });
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store'
        });
        const payload = (await response.json().catch(() => null)) as unknown;
        if (applyInvalidSettingsState(payload, { announceStatus: false })) {
          return;
        }
        if (!response.ok) {
          throw new Error(getPayloadMessage(payload) || `HTTP ${response.status}`);
        }
        if (!extractSettingsPayload(payload)) {
          throw new Error(getPayloadMessage(payload) || '返回数据格式无效');
        }
        loadPayload(payload, 'remote');
      } catch (error) {
        if (hasInitialSettings()) {
          uiState.setStatus('warn', '接口读取失败，继续使用初始配置');
        } else if (!uiState.isConsoleLocked()) {
          setInitialLoadError(error instanceof Error ? error.message : '初始化请求失败，请稍后重试');
        }
        console.warn(error);
      }
    };

    const buildSettingsRequestUrl = (options: { dryRun?: boolean } = {}): string => {
      const requestUrl = new URL(endpoint, window.location.href);
      if (options.dryRun) {
        requestUrl.searchParams.set('dryRun', '1');
      } else {
        requestUrl.searchParams.delete('dryRun');
      }
      return requestUrl.toString();
    };

    const createSettingsRequestBody = (settings: EditableSettings): string | null => {
      if (!currentRevision) return null;
      return JSON.stringify({
        revision: currentRevision,
        settings
      });
    };

    const requestSettingsWrite = async (
      settings: EditableSettings,
      options: { dryRun?: boolean } = {}
    ): Promise<{ response: Response; payload: unknown }> => {
      const requestBody = createSettingsRequestBody(settings);
      if (!requestBody) {
        throw new Error('missing-revision');
      }

      const response = await fetch(buildSettingsRequestUrl(options), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json; charset=utf-8'
        },
        cache: 'no-store',
        body: requestBody
      });

      const payload = (await response.json().catch(() => null)) as unknown;
      return { response, payload };
    };

    errorRetryBtn.addEventListener('click', () => {
      if (!uiState.isConsoleLocked()) return;
      void loadFromApi();
    });

    form.addEventListener('input', (event) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        target.removeAttribute('aria-invalid');
      }
      refreshDirty();
    });

    form.addEventListener('change', (event) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        target.removeAttribute('aria-invalid');
      }
      refreshDirty();
    });

    inputSiteFooterStartYear.addEventListener('input', refreshFooterPreview);
    inputSiteFooterShowCurrentYear.addEventListener('change', () => {
      syncFooterYearControls();
      refreshFooterPreview();
    });
    inputSiteFooterCopyright.addEventListener('input', refreshFooterPreview);
    inputArticleMetaDateLabel.addEventListener('input', refreshArticleMetaPreview);
    inputArticleMetaShowDate.addEventListener('change', refreshArticleMetaPreview);
    inputArticleMetaShowTags.addEventListener('change', refreshArticleMetaPreview);
    inputArticleMetaShowWordCount.addEventListener('change', refreshArticleMetaPreview);
    inputArticleMetaShowReadingTime.addEventListener('change', refreshArticleMetaPreview);
    inputHomeIntroMore.addEventListener('input', refreshHomeIntroPreview);
    inputHomeShowIntroMore.addEventListener('change', refreshHomeIntroPreview);
    inputHomeIntroMoreLinkPrimary.addEventListener('change', () => {
      syncHomeIntroLinkControls();
      refreshDirty();
    });
    inputHomeIntroMoreLinkSecondaryEnabled.addEventListener('change', () => {
      syncHomeIntroLinkControls();
      refreshDirty();
    });
    inputHomeIntroMoreLinkSecondary.addEventListener('change', () => {
      syncHomeIntroLinkControls();
      refreshDirty();
    });
    inputHomeShowHero.addEventListener('change', () => {
      syncHeroControls();
      refreshDirty();
    });

    if ('IntersectionObserver' in window) {
      const adminActionsObserver = new IntersectionObserver(
        (entries) => {
          uiState.setActionsNearViewport(entries.some((entry) => entry.isIntersecting));
        },
        {
          root: null,
          threshold: 0,
          rootMargin: '0px 0px -96px 0px'
        }
      );
      adminActionsObserver.observe(adminActionsSentinel);
    }

    socialCustomAddBtn.addEventListener('click', () => {
      if (getCustomRows().length >= ADMIN_SOCIAL_CUSTOM_LIMIT) {
        uiState.setStatus('warn', '自定义链接已达到上限');
        return;
      }
      const row = createCustomRow(
        {
          href: '',
          order: getNextSocialOrder(),
          visible: true
        },
        getCustomRows().length,
        { manualId: false }
      );
      if (!row) return;
      socialCustomList.appendChild(row);
      updateCustomRowsUi();
      refreshDirty();
      query<HTMLSelectElement>(row, '[data-social-custom-field="iconKey"]')?.focus();
    });

    socialCustomList.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const presetRow = target.closest('[data-social-preset-row]');
      if (presetRow) {
        if (target.matches('[data-social-preset-field="order"], [data-social-preset-field="href"]')) {
          normalizeSocialOrders();
        }
        syncPresetRow(presetRow);
        return;
      }

      const row = target.closest('[data-social-custom-row]');
      if (!(row instanceof HTMLElement)) return;

      if (target.matches('[data-social-custom-field="iconKey"]')) {
        syncCustomRow(row, { syncId: true, syncLabel: true });
        return;
      }

      if (target.matches('[data-social-custom-field="order"]')) {
        normalizeSocialOrders();
      }
    });

    socialCustomList.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const presetRow = target.closest('[data-social-preset-row]');
      if (presetRow) {
        syncPresetRow(presetRow);
        return;
      }

      if (!(target instanceof HTMLInputElement)) return;
      const row = target.closest('[data-social-custom-row]');
      if (!(row instanceof HTMLElement)) return;
      if (target.matches('[data-social-custom-field="id"]')) {
        const trimmed = target.value.trim();
        const generatedId = getStoredGeneratedCustomId(row);
        row.dataset.idManual = trimmed && trimmed !== generatedId ? 'true' : 'false';
        return;
      }
      if (target.matches('[data-social-custom-field="label"]')) {
        const trimmed = target.value.trim();
        const generatedLabel = getStoredGeneratedCustomLabel(row);
        row.dataset.labelManual = trimmed && trimmed !== generatedLabel ? 'true' : 'false';
      }
    });

    socialCustomList.addEventListener('focusout', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      const row = target.closest('[data-social-custom-row]');
      if (!(row instanceof HTMLElement)) return;
      if (target.matches('[data-social-custom-field="id"]')) {
        finalizeCustomIdInput(row);
      } else if (target.matches('[data-social-custom-field="label"]')) {
        finalizeCustomLabelInput(row);
      } else {
        return;
      }
      refreshDirty();
    });

    socialCustomList.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const presetActionBtn = target.closest('[data-social-preset-action]');
      if (presetActionBtn instanceof HTMLButtonElement) {
        const presetRow = presetActionBtn.closest('[data-social-preset-row]');
        if (!(presetRow instanceof HTMLElement)) return;
        const action = presetActionBtn.getAttribute('data-social-preset-action');

        if (action === 'toggle-visible') {
          const hrefInput = getPresetRowHrefInput(presetRow);
          const orderInput = getPresetRowOrderInput(presetRow);
          if (!(hrefInput instanceof HTMLInputElement) || !(orderInput instanceof HTMLInputElement)) return;

          const visible = hrefInput.value.trim().length > 0;
          if (visible) {
            presetRow.dataset.stashedHref = hrefInput.value.trim();
            presetRow.dataset.stashedOrder = orderInput.value.trim();
            hrefInput.value = '';
          } else {
            hrefInput.value = presetRow.dataset.stashedHref || '';
            orderInput.value = presetRow.dataset.stashedOrder || String(getNextSocialOrder());
          }

          normalizeSocialOrders();
          syncPresetRow(presetRow);
          refreshDirty();
        }
        return;
      }

      const actionBtn = target.closest('[data-social-custom-action]');
      if (!(actionBtn instanceof HTMLButtonElement)) return;
      const row = actionBtn.closest('[data-social-custom-row]');
      if (!(row instanceof HTMLElement)) return;
      const action = actionBtn.getAttribute('data-social-custom-action');

      if (action === 'remove') {
        row.remove();
        getCustomRows().forEach((item) => syncCustomRow(item));
        normalizeSocialOrders();
        updateCustomRowsUi();
        refreshDirty();
        return;
      }

      if (action === 'toggle-visible') {
        const visibleInput = query<HTMLInputElement>(row, '[data-social-custom-field="visible"]');
        if (!(visibleInput instanceof HTMLInputElement)) return;
        visibleInput.checked = !visibleInput.checked;
        syncCustomRow(row);
        normalizeSocialOrders();
        refreshDirty();
      }
    });

    validateBtn.addEventListener('click', async () => {
      if (uiState.isSaving() || uiState.isValidating()) return;

      const { draft, issues } = validateCurrentSettings();
      if (issues.length) {
        uiState.setStatus('error', '校验未通过', { announce: false });
        revealErrorState(issues);
        return;
      }

      const current = canonicalize(draft);
      uiState.setValidating(true);
      uiState.setStatus('loading', '正在进行服务端预检');

      try {
        if (!currentRevision) {
          clearInvalidFields();
          uiState.setErrors(['当前配置缺少 revision，请先同步最新配置后再检查'], {
            title: '检查前需要重新同步配置'
          });
          uiState.setStatus('error', '检查配置失败', { announce: false });
          revealErrorState();
          return;
        }

        const { response, payload } = await requestSettingsWrite(current, { dryRun: true });
        if (applyInvalidSettingsState(payload, { announceStatus: false, revealError: true })) {
          return;
        }

        if (!response.ok || !isRecord(payload) || payload.ok !== true) {
          clearInvalidFields();
          const serverErrors = getPayloadErrors(payload);

          if (response.status === 409) {
            uiState.setErrors(
              serverErrors.length
                ? serverErrors
                : ['检测到配置已在外部更新；当前草稿仍保留在页面中，请先同步后再决定是否手工合并'],
              { title: '检查时发现外部更新' }
            );
            uiState.setStatus('warn', '检查时发现外部更新', { announce: false });
            revealErrorState();
            return;
          }

          uiState.setErrors(serverErrors.length ? serverErrors : ['检查配置失败，请稍后重试'], {
            title: '检查配置失败'
          });
          uiState.setStatus('error', '检查配置失败', { announce: false });
          revealErrorState();
          return;
        }

        clearInvalidFields();
        uiState.clearErrorBanner();
        uiState.setStatus('ok', '服务端预检通过，可直接保存');
      } catch (error) {
        console.error(error);
        clearInvalidFields();
        uiState.setErrors(['检查配置请求失败，请检查本地服务日志'], { title: '检查配置失败' });
        uiState.setStatus('error', '检查配置失败', { announce: false });
        revealErrorState();
      } finally {
        uiState.setValidating(false);
      }
    });

    resetBtn.addEventListener('click', () => {
      if (!baseline) return;
      applySettings(deepClone(baseline));
      finalizeAppliedSettings();
      clearInvalidFields();
      uiState.clearErrorBanner();
      uiState.setDirty(false);
      uiState.setStatus('ready', '已重置为最近一次加载值');
    });

    saveBtn.addEventListener('click', async () => {
      if (uiState.isSaving() || uiState.isValidating()) return;
      const { draft, issues } = validateCurrentSettings();
      if (issues.length) {
        uiState.setStatus('error', '保存前校验失败', { announce: false });
        revealErrorState(issues);
        return;
      }

      const current = canonicalize(draft);

      uiState.setSaving(true);
      uiState.setStatus('loading', '正在保存到 src/data/settings/*.json');

      try {
        if (!currentRevision) {
          clearInvalidFields();
          uiState.setErrors(['当前配置缺少 revision，请先同步最新配置后再保存'], { title: '保存前需要重新同步配置' });
          uiState.setStatus('error', '保存失败', { announce: false });
          revealErrorState();
          return;
        }

        const { response, payload } = await requestSettingsWrite(current);
        if (!response.ok || !isRecord(payload) || payload.ok !== true) {
          clearInvalidFields();
          if (applyInvalidSettingsState(payload, { announceStatus: false, revealError: true })) {
            return;
          }

          const serverErrors = getPayloadErrors(payload);
          if (response.status === 409 && extractSettingsPayload(payload)) {
            loadPayload(payload, 'remote', { announceStatus: false });
            uiState.setErrors(serverErrors.length ? serverErrors : ['配置已更新，已同步最新配置，请重新确认后再保存'], {
              title: '检测到外部更新'
            });
            uiState.setStatus('warn', '检测到外部更新，已同步最新配置', { announce: false });
            revealErrorState();
            return;
          }

          uiState.setErrors(serverErrors.length ? serverErrors : ['保存失败，请稍后重试'], { title: '保存失败' });
          if (response.status === 404) {
            uiState.setStatus('error', '当前环境不允许写入（仅 DEV 可写）', { announce: false });
          } else {
            uiState.setStatus('error', '保存失败', { announce: false });
          }
          revealErrorState();
          return;
        }

        if (extractSettingsPayload(payload)) {
          loadPayload(payload, 'remote', { announceStatus: false });
          uiState.setStatus('ok', '保存成功，请刷新目标页面查看效果');
        } else {
          baseline = current;
          uiState.setDirty(false);
          uiState.setStatus('ok', '保存成功');
        }
        clearInvalidFields();
        uiState.clearErrorBanner();
      } catch (error) {
        console.error(error);
        clearInvalidFields();
        uiState.setErrors(['保存请求失败，请检查本地服务日志'], { title: '保存请求失败' });
        uiState.setStatus('error', '保存失败', { announce: false });
        revealErrorState();
      } finally {
        uiState.setSaving(false);
      }
    });

    document.addEventListener(
      'click',
      (event) => {
        if (!uiState.isDirty()) return;
        if (!(event.target instanceof Element)) return;

        const anchor = event.target.closest('a[href]');
        if (!(anchor instanceof HTMLAnchorElement)) return;

        if (
          !shouldGuardAdminNavigation({
            isDirty: uiState.isDirty(),
            currentUrl: window.location.href,
            nextUrl: anchor.href,
            button: event.button,
            metaKey: event.metaKey,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            target: anchor.target,
            download: anchor.hasAttribute('download')
          })
        ) {
          return;
        }

        const confirmed = window.confirm('当前有未保存更改，确定要离开此页吗？');
        if (confirmed) return;

        event.preventDefault();
        event.stopPropagation();
        uiState.setStatus('warn', '已取消页面切换，请先保存或重置当前更改', { announce: false });
      },
      true
    );

    window.addEventListener('beforeunload', (event) => {
      if (!uiState.isDirty()) return;
      event.preventDefault();
      Reflect.set(event, 'returnValue', '');
    });

    if (loadBootstrap() === 'fallback') {
      void loadFromApi();
    }
  }
}
