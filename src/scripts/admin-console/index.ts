import type {
  SidebarNavId,
  ThemeSettingsEditableErrorState,
  ThemeSettingsEditablePayload,
  ThemeSettingsReadDiagnostic,
} from '@/lib/theme-settings';
import {
  ADMIN_NAV_IDS,
  ADMIN_SOCIAL_CUSTOM_LIMIT,
  getAdminFooterStartYearMax,
} from '@/lib/admin-console/shared';
import { createFormCodec, type EditableSettings } from './form-codec';
import { createSocialLinks } from './social-links';
import { createValidation, type ValidationIssue } from './validation';

type RequiredElements<T extends Record<string, Element | null>> = {
  [K in keyof T]: NonNullable<T[K]>;
};
type LoadSource = 'bootstrap' | 'remote';
type LooseRecord = Record<string, unknown>;
type AdminControl =
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement
  | HTMLButtonElement;
type ErrorBannerState = {
  title: string;
  message?: string;
  items?: Array<string | HTMLElement>;
  retryable?: boolean;
};
type ErrorBannerOptions = {
  title?: string;
  message?: string;
  retryable?: boolean;
};

const root = document.querySelector<HTMLElement>('[data-admin-root]');

if (!root) {
  // Current page does not use admin console.
} else {
  const byId = <T extends Element>(id: string): T | null =>
    document.getElementById(id) as T | null;
  const query = <T extends Element>(
    parent: ParentNode,
    selector: string
  ): T | null => parent.querySelector(selector) as T | null;
  const queryAll = <T extends Element>(
    parent: ParentNode,
    selector: string
  ): T[] => Array.from(parent.querySelectorAll(selector)) as T[];
  const ensureElements = <T extends Record<string, Element | null>>(
    elements: T
  ): RequiredElements<T> | null => {
    if (Object.values(elements).some((element) => element === null))
      return null;
    return elements as RequiredElements<T>;
  };
  const isRecord = (value: unknown): value is LooseRecord =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

  const endpoint =
    root.getAttribute('data-settings-endpoint') || '/api/admin/settings/';
  const footerStartYearMax = getAdminFooterStartYearMax();

  const controls = ensureElements({
    form: byId<HTMLFormElement>('admin-form'),
    adminActions: byId<HTMLElement>('admin-actions'),
    adminActionsSentinel: byId<HTMLElement>('admin-actions-sentinel'),
    statusLiveEl: byId<HTMLElement>('admin-status-live'),
    statusEl: byId<HTMLElement>('admin-status'),
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
    socialCustomTemplate: byId<HTMLTemplateElement>(
      'site-social-custom-row-template'
    ),
    inputSiteTitle: byId<HTMLInputElement>('site-title'),
    inputSiteDescription: byId<HTMLTextAreaElement>('site-description'),
    inputSiteDefaultLocale: byId<HTMLInputElement>('site-default-locale'),
    inputSiteFooterStartYear: byId<HTMLInputElement>('site-footer-start-year'),
    inputSiteFooterShowCurrentYear: byId<HTMLInputElement>(
      'site-footer-show-current-year'
    ),
    inputSiteFooterCopyright: byId<HTMLInputElement>('site-footer-copyright'),
    inputSiteSocialGithubOrder: byId<HTMLInputElement>(
      'site-social-github-order'
    ),
    inputSiteSocialGithub: byId<HTMLInputElement>('site-social-github'),
    inputSiteSocialXOrder: byId<HTMLInputElement>('site-social-x-order'),
    inputSiteSocialX: byId<HTMLInputElement>('site-social-x'),
    inputSiteSocialEmailOrder: byId<HTMLInputElement>(
      'site-social-email-order'
    ),
    inputSiteSocialEmail: byId<HTMLInputElement>('site-social-email'),
    inputShellBrandTitle: byId<HTMLInputElement>('shell-brand-title'),
    inputShellQuote: byId<HTMLTextAreaElement>('shell-quote'),
    inputHomeShowIntroLead: byId<HTMLInputElement>('home-show-intro-lead'),
    inputHomeShowIntroMore: byId<HTMLInputElement>('home-show-intro-more'),
    inputHomeIntroLead: byId<HTMLTextAreaElement>('home-intro-lead'),
    inputHomeIntroMore: byId<HTMLTextAreaElement>('home-intro-more'),
    homeIntroMorePreviewEl: byId<HTMLElement>('home-intro-more-preview'),
    inputHomeIntroMoreLinkPrimary: byId<HTMLSelectElement>(
      'home-intro-more-link-primary'
    ),
    inputHomeIntroMoreLinkSecondaryEnabled: byId<HTMLInputElement>(
      'home-intro-more-link-secondary-enabled'
    ),
    homeIntroMoreLinkSecondaryGroupEl: byId<HTMLElement>(
      'home-intro-more-link-secondary-group'
    ),
    inputHomeIntroMoreLinkSecondary: byId<HTMLSelectElement>(
      'home-intro-more-link-secondary'
    ),
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
    inputArticleMetaShowDate: byId<HTMLInputElement>(
      'ui-article-meta-show-date'
    ),
    inputArticleMetaDateLabel: byId<HTMLInputElement>(
      'ui-article-meta-date-label'
    ),
    inputArticleMetaShowTags: byId<HTMLInputElement>(
      'ui-article-meta-show-tags'
    ),
    inputArticleMetaShowWordCount: byId<HTMLInputElement>(
      'ui-article-meta-show-word-count'
    ),
    inputArticleMetaShowReadingTime: byId<HTMLInputElement>(
      'ui-article-meta-show-reading-time'
    ),
    inputPageBitsAuthorName: byId<HTMLInputElement>('page-bits-author-name'),
    inputPageBitsAuthorAvatar: byId<HTMLInputElement>(
      'page-bits-author-avatar'
    ),
    inputHomeShowHero: byId<HTMLInputElement>('home-show-hero'),
    inputHeroImageSrc: byId<HTMLInputElement>('home-hero-image-src'),
    inputHeroImageAlt: byId<HTMLInputElement>('home-hero-image-alt'),
    inputCodeLineNumbers: byId<HTMLInputElement>('ui-code-line-numbers'),
    inputReadingEntry: byId<HTMLInputElement>('ui-reading-entry'),
    inputSidebarDividerDefault: byId<HTMLInputElement>(
      'ui-layout-sidebar-divider-default'
    ),
    inputSidebarDividerSubtle: byId<HTMLInputElement>(
      'ui-layout-sidebar-divider-subtle'
    ),
    inputSidebarDividerNone: byId<HTMLInputElement>(
      'ui-layout-sidebar-divider-none'
    ),
  });

  if (!controls) {
    // Required controls are missing.
  } else {
    const {
      form,
      adminActions,
      adminActionsSentinel,
      statusLiveEl,
      statusEl,
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
      inputSidebarDividerNone,
    } = controls;

    const getNavRows = (): HTMLElement[] =>
      queryAll<HTMLElement>(root, '[data-nav-id]');
    const deepClone = <T>(value: T): T =>
      JSON.parse(JSON.stringify(value)) as T;

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
      replaceCustomRows,
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
      inputSiteSocialEmailOrder,
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
      syncFooterYearControls,
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
      inputSidebarDividerNone,
    });

    const finalizeAppliedSettings = (): void => {
      getPresetRows().forEach((row) => {
        delete row.dataset.stashedHref;
        delete row.dataset.stashedOrder;
        syncPresetRow(row);
      });
    };

    const getNavFieldTarget =
      (
        id: SidebarNavId,
        field: 'label' | 'ornament' | 'order' | 'visible'
      ): (() => HTMLElement | null) =>
      () => {
        const row = query<HTMLElement>(root, `[data-nav-id="${id}"]`);
        return row
          ? query<HTMLElement>(row, `[data-nav-field="${field}"]`)
          : null;
      };

    const getFirstNavLabelTarget = (): HTMLElement | null => {
      const firstNavId = ADMIN_NAV_IDS[0];
      return firstNavId ? getNavFieldTarget(firstNavId, 'label')() : null;
    };

    const {
      validateSettings,
      clearInvalidFields,
      markInvalidFields,
      resolveIssueField,
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
      getFirstNavLabelTarget,
    });

    let baseline: EditableSettings | null = null;
    let currentRevision: string | null = null;
    let isDirty = false;
    let isSaving = false;
    let isValidating = false;
    let isConsoleLocked = false;
    let isAdminActionsNearViewport = false;
    const statusTargets = [statusEl, statusInlineEl];

    const scrollIntoViewWithOffset = (element: HTMLElement): void => {
      const top = element.getBoundingClientRect().top + window.scrollY - 24;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    };

    const revealErrorState = (
      issues: readonly ValidationIssue[] = []
    ): void => {
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

    const STATUS_WAITING_SAVE = 'Waiting to save';
    const STATUS_CLEAN = 'No unsaved changes';
    const STATUS_INVALID_SETTINGS = 'Settings Invalid';

    const setStatus = (
      state: string,
      message: string,
      options: { announce?: boolean } = {}
    ): void => {
      const currentState = statusEl.dataset.state ?? '';
      const currentMessage = statusEl.textContent?.trim() || '';
      if (currentState !== state || currentMessage !== message) {
        statusTargets.forEach((target) => {
          target.dataset.state = state;
          target.textContent = message;
        });
      }

      if (options.announce === false) return;

      const liveState = statusLiveEl.dataset.state ?? '';
      const liveMessage = statusLiveEl.textContent?.trim() || '';
      if (liveState === state && liveMessage === message) return;
      statusLiveEl.dataset.state = state;
      statusLiveEl.textContent = message;
    };

    const syncDirtyStatus = (next: boolean): void => {
      const currentState = statusEl.dataset.state;
      const currentMessage = statusEl.textContent?.trim() || '';

      if (next) {
        if (
          (currentState === 'ready' || currentState === 'ok') &&
          currentMessage !== STATUS_WAITING_SAVE
        ) {
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
      retryable = false,
    }: ErrorBannerState): void => {
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

    const setErrors = (
      errors: string[],
      options: ErrorBannerOptions = {}
    ): void => {
      if (!errors.length) {
        clearErrorBanner();
        return;
      }

      setErrorBanner({
        title: options.title ?? 'Please address the following issues',
        ...(options.message ? { message: options.message } : {}),
        items: errors,
        retryable: options.retryable ?? false,
      });
    };

    const setDirty = (next: boolean): void => {
      isDirty = next;
      dirtyBanner.hidden = !next;
      adminActions.dataset.dirty = String(next);
      adminActions.dataset.sticky = String(next && !isAdminActionsNearViewport);
      syncDirtyStatus(next);
    };

    const syncInteractiveAvailability = (): void => {
      const isInteractionLocked = isConsoleLocked || isSaving || isValidating;
      queryAll<AdminControl>(root, 'input, textarea, select, button').forEach(
        (element) => {
          if (element === errorRetryBtn) {
            element.disabled = isSaving || isValidating;
            return;
          }

          element.disabled = isInteractionLocked;
        }
      );
    };

    const setConsoleLocked = (next: boolean): void => {
      isConsoleLocked = next;
      root.dataset.consoleLocked = String(next);
      syncInteractiveAvailability();
    };

    const setSaving = (next: boolean): void => {
      isSaving = next;
      saveBtn.textContent = next ? 'Saving...' : 'Save';
      syncInteractiveAvailability();
    };

    const setValidating = (next: boolean): void => {
      isValidating = next;
      validateBtn.textContent = next ? 'Validating...' : 'Check Config';
      syncInteractiveAvailability();
    };

    const setValidationIssues = (issues: readonly ValidationIssue[]): void => {
      markInvalidFields(issues);
      setErrors(issues.map((issue) => issue.message));
    };

    const refreshDirty = (): void => {
      if (!baseline) return;
      const current = canonicalize(collectSettings());
      setDirty(JSON.stringify(current) !== JSON.stringify(baseline));
    };

    const validateCurrentSettings = (): {
      draft: EditableSettings;
      issues: ValidationIssue[];
    } => {
      const draft = collectSettings();
      const issues = validateSettings(draft);
      setValidationIssues(issues);
      return { draft, issues };
    };

    const extractSettingsPayload = (
      payload: unknown
    ): ThemeSettingsEditablePayload | null => {
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

    const extractInvalidSettingsState = (
      payload: unknown
    ): ThemeSettingsEditableErrorState | null => {
      if (!isRecord(payload)) return null;
      if (payload.ok !== false || payload.mode !== 'invalid-settings')
        return null;
      if (typeof payload.message !== 'string' || !Array.isArray(payload.errors))
        return null;
      return payload as unknown as ThemeSettingsEditableErrorState;
    };

    const getPayloadMessage = (payload: unknown): string | null =>
      isRecord(payload) && typeof payload.message === 'string'
        ? payload.message
        : null;

    const getPayloadErrors = (payload: unknown): string[] => {
      if (!isRecord(payload) || !Array.isArray(payload.errors)) return [];
      return payload.errors.filter(
        (error): error is string =>
          typeof error === 'string' && error.length > 0
      );
    };

    const getDiagnosticHeadline = (
      diagnostic: ThemeSettingsReadDiagnostic
    ): string => {
      const fileName = diagnostic.path.split('/').pop() || diagnostic.path;
      if (diagnostic.code === 'invalid-json') return `${fileName} Format Error`;
      if (diagnostic.code === 'invalid-root')
        return `${fileName} Structure Error`;
      if (diagnostic.code === 'schema-mismatch')
        return `${fileName} Schema Mismatch`;
      return `${fileName} Read Failed`;
    };

    const createDiagnosticMeta = (
      label: string,
      value: string,
      options: { mono?: boolean } = {}
    ): HTMLElement => {
      const row = document.createElement('div');
      row.className = 'admin-banner__meta';

      const labelEl = document.createElement('span');
      labelEl.className = 'admin-banner__meta-label';
      labelEl.textContent = label;

      const valueEl = document.createElement(options.mono ? 'code' : 'span');
      valueEl.className = options.mono
        ? 'admin-banner__meta-value admin-banner__meta-value--mono'
        : 'admin-banner__meta-value';
      valueEl.textContent = value;

      row.append(labelEl, valueEl);
      return row;
    };

    const createDiagnosticListItem = (
      diagnostic: ThemeSettingsReadDiagnostic
    ): HTMLElement => {
      const item = document.createElement('li');
      item.className =
        'admin-banner__list-item admin-banner__list-item--diagnostic';

      const title = document.createElement('p');
      title.className = 'admin-banner__item-title';
      title.textContent = getDiagnosticHeadline(diagnostic);
      item.appendChild(title);

      item.appendChild(
        createDiagnosticMeta('File', diagnostic.path, { mono: true })
      );

      if (
        typeof diagnostic.line === 'number' &&
        typeof diagnostic.column === 'number'
      ) {
        item.appendChild(
          createDiagnosticMeta(
            'Position',
            `Line ${diagnostic.line}, Column ${diagnostic.column}`
          )
        );
      }

      if (diagnostic.detail) {
        item.appendChild(
          createDiagnosticMeta('Technical Detail', diagnostic.detail, {
            mono: true,
          })
        );
      }

      return item;
    };

    const setInvalidSettingsErrorBanner = (
      invalidState: ThemeSettingsEditableErrorState
    ): void => {
      setErrorBanner({
        title: 'Switched to Read-Only Mode',
        message:
          'Settings configuration files are corrupted. Please fix the files, then click "Retry" or refresh the page.',
        items: invalidState.diagnostics.map((diagnostic) =>
          createDiagnosticListItem(diagnostic)
        ),
        retryable: true,
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
      setDirty(false);
      setConsoleLocked(true);
      setInvalidSettingsErrorBanner(invalidState);
      setStatus(
        'error',
        STATUS_INVALID_SETTINGS,
        options.announceStatus === undefined
          ? {}
          : { announce: options.announceStatus }
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
          options.announceStatus === undefined
            ? {}
            : { announceStatus: options.announceStatus }
        )
      ) {
        return;
      }

      const resolvedPayload = extractSettingsPayload(payload);
      if (!resolvedPayload) {
        clearInvalidFields();
        setStatus('error', 'Invalid response format');
        setErrors(
          [getPayloadMessage(payload) || 'Config API returned invalid payload'],
          { title: 'Failed to load config' }
        );
        revealErrorState();
        return;
      }

      setConsoleLocked(false);
      currentRevision = resolvedPayload.revision;
      const normalized = canonicalize(resolvedPayload.settings);
      applySettings(normalized);
      finalizeAppliedSettings();
      baseline = canonicalize(collectSettings());
      clearInvalidFields();
      clearErrorBanner();
      setDirty(false);
      setStatus(
        'ready',
        source === 'remote' ? 'Synced latest config' : 'Loaded initial config',
        { announce: options.announceStatus ?? source === 'remote' }
      );
    };

    const loadBootstrap = (): void => {
      try {
        const payload = JSON.parse(bootstrapEl.textContent || '{}') as unknown;
        if (applyInvalidSettingsState(payload, { announceStatus: false })) {
          return;
        }
        loadPayload(payload, 'bootstrap', { announceStatus: false });
      } catch (error) {
        setStatus('error', 'Failed to parse initialization data');
        console.error(error);
      }
    };

    const loadFromApi = async (): Promise<void> => {
      setStatus('loading', 'Reading /api/admin/settings', { announce: false });
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        const payload = (await response.json().catch(() => null)) as unknown;
        if (applyInvalidSettingsState(payload, { announceStatus: false })) {
          return;
        }
        if (!response.ok) {
          throw new Error(
            getPayloadMessage(payload) || `HTTP ${response.status}`
          );
        }
        if (!extractSettingsPayload(payload)) {
          throw new Error(
            getPayloadMessage(payload) || 'Invalid response format'
          );
        }
        loadPayload(payload, 'remote');
      } catch (error) {
        if (!isConsoleLocked) {
          setStatus('warn', 'API read failed, continuing with initial config');
        }
        console.warn(error);
      }
    };

    const buildSettingsRequestUrl = (
      options: { dryRun?: boolean } = {}
    ): string => {
      const requestUrl = new URL(endpoint, window.location.href);
      if (options.dryRun) {
        requestUrl.searchParams.set('dryRun', '1');
      } else {
        requestUrl.searchParams.delete('dryRun');
      }
      return requestUrl.toString();
    };

    const createSettingsRequestBody = (
      settings: EditableSettings
    ): string | null => {
      if (!currentRevision) return null;
      return JSON.stringify({
        revision: currentRevision,
        settings,
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
          'Content-Type': 'application/json; charset=utf-8',
        },
        cache: 'no-store',
        body: requestBody,
      });

      const payload = (await response.json().catch(() => null)) as unknown;
      return { response, payload };
    };

    errorRetryBtn.addEventListener('click', () => {
      if (!isConsoleLocked) return;
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
    inputArticleMetaDateLabel.addEventListener(
      'input',
      refreshArticleMetaPreview
    );
    inputArticleMetaShowDate.addEventListener(
      'change',
      refreshArticleMetaPreview
    );
    inputArticleMetaShowTags.addEventListener(
      'change',
      refreshArticleMetaPreview
    );
    inputArticleMetaShowWordCount.addEventListener(
      'change',
      refreshArticleMetaPreview
    );
    inputArticleMetaShowReadingTime.addEventListener(
      'change',
      refreshArticleMetaPreview
    );
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
          isAdminActionsNearViewport = entries.some(
            (entry) => entry.isIntersecting
          );
          adminActions.dataset.sticky = String(
            isDirty && !isAdminActionsNearViewport
          );
        },
        {
          root: null,
          threshold: 0,
          rootMargin: '0px 0px -96px 0px',
        }
      );
      adminActionsObserver.observe(adminActionsSentinel);
    }

    socialCustomAddBtn.addEventListener('click', () => {
      if (getCustomRows().length >= ADMIN_SOCIAL_CUSTOM_LIMIT) {
        setStatus('warn', 'Custom links limit reached');
        return;
      }
      const row = createCustomRow(
        {
          href: '',
          order: getNextSocialOrder(),
          visible: true,
        },
        getCustomRows().length,
        { manualId: false }
      );
      if (!row) return;
      socialCustomList.appendChild(row);
      updateCustomRowsUi();
      refreshDirty();
      query<HTMLSelectElement>(
        row,
        '[data-social-custom-field="iconKey"]'
      )?.focus();
    });

    socialCustomList.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const presetRow = target.closest('[data-social-preset-row]');
      if (presetRow) {
        if (
          target.matches(
            '[data-social-preset-field="order"], [data-social-preset-field="href"]'
          )
        ) {
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
        row.dataset.idManual =
          trimmed && trimmed !== generatedId ? 'true' : 'false';
        return;
      }
      if (target.matches('[data-social-custom-field="label"]')) {
        const trimmed = target.value.trim();
        const generatedLabel = getStoredGeneratedCustomLabel(row);
        row.dataset.labelManual =
          trimmed && trimmed !== generatedLabel ? 'true' : 'false';
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
        const action = presetActionBtn.getAttribute(
          'data-social-preset-action'
        );

        if (action === 'toggle-visible') {
          const hrefInput = getPresetRowHrefInput(presetRow);
          const orderInput = getPresetRowOrderInput(presetRow);
          if (
            !(hrefInput instanceof HTMLInputElement) ||
            !(orderInput instanceof HTMLInputElement)
          )
            return;

          const visible = hrefInput.value.trim().length > 0;
          if (visible) {
            presetRow.dataset.stashedHref = hrefInput.value.trim();
            presetRow.dataset.stashedOrder = orderInput.value.trim();
            hrefInput.value = '';
          } else {
            hrefInput.value = presetRow.dataset.stashedHref || '';
            orderInput.value =
              presetRow.dataset.stashedOrder || String(getNextSocialOrder());
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
        const visibleInput = query<HTMLInputElement>(
          row,
          '[data-social-custom-field="visible"]'
        );
        if (!(visibleInput instanceof HTMLInputElement)) return;
        visibleInput.checked = !visibleInput.checked;
        syncCustomRow(row);
        normalizeSocialOrders();
        refreshDirty();
      }
    });

    validateBtn.addEventListener('click', async () => {
      if (isSaving || isValidating) return;

      const { draft, issues } = validateCurrentSettings();
      if (issues.length) {
        setStatus('error', 'Validation failed', { announce: false });
        revealErrorState(issues);
        return;
      }

      const current = canonicalize(draft);
      setValidating(true);
      setStatus('loading', 'Running server-side validation');

      try {
        if (!currentRevision) {
          clearInvalidFields();
          setErrors(
            [
              'Current config is missing revision, please sync latest config first',
            ],
            {
              title: 'Re-sync required before check',
            }
          );
          setStatus('error', 'Config check failed', { announce: false });
          revealErrorState();
          return;
        }

        const { response, payload } = await requestSettingsWrite(current, {
          dryRun: true,
        });
        if (
          applyInvalidSettingsState(payload, {
            announceStatus: false,
            revealError: true,
          })
        ) {
          return;
        }

        if (!response.ok || !isRecord(payload) || payload.ok !== true) {
          clearInvalidFields();
          const serverErrors = getPayloadErrors(payload);

          if (response.status === 409) {
            setErrors(
              serverErrors.length
                ? serverErrors
                : [
                    'Config has been updated externally; draft is preserved, please sync before merging',
                  ],
              { title: 'External update detected during check' }
            );
            setStatus('warn', 'External update detected during check', {
              announce: false,
            });
            revealErrorState();
            return;
          }

          setErrors(
            serverErrors.length
              ? serverErrors
              : ['Config check failed, please try again'],
            {
              title: 'Config check failed',
            }
          );
          setStatus('error', 'Config check failed', { announce: false });
          revealErrorState();
          return;
        }

        clearInvalidFields();
        clearErrorBanner();
        setStatus('ok', 'Server-side validation passed, ready to save');
      } catch (error) {
        console.error(error);
        clearInvalidFields();
        setErrors(
          ['Config check request failed, please check local service logs'],
          { title: 'Config check failed' }
        );
        setStatus('error', 'Config check failed', { announce: false });
        revealErrorState();
      } finally {
        setValidating(false);
      }
    });

    resetBtn.addEventListener('click', () => {
      if (!baseline) return;
      applySettings(deepClone(baseline));
      finalizeAppliedSettings();
      clearInvalidFields();
      clearErrorBanner();
      setDirty(false);
      setStatus('ready', 'Reset to last loaded values');
    });

    saveBtn.addEventListener('click', async () => {
      if (isSaving || isValidating) return;
      const { draft, issues } = validateCurrentSettings();
      if (issues.length) {
        setStatus('error', 'Pre-save validation failed', { announce: false });
        revealErrorState(issues);
        return;
      }

      const current = canonicalize(draft);

      setSaving(true);
      setStatus('loading', 'Saving to src/data/settings/*.json');

      try {
        if (!currentRevision) {
          clearInvalidFields();
          setErrors(
            [
              'Current config is missing revision, please sync latest config before saving',
            ],
            {
              title: 'Re-sync required before save',
            }
          );
          setStatus('error', 'Save failed', { announce: false });
          revealErrorState();
          return;
        }

        const { response, payload } = await requestSettingsWrite(current);
        if (!response.ok || !isRecord(payload) || payload.ok !== true) {
          clearInvalidFields();
          if (
            applyInvalidSettingsState(payload, {
              announceStatus: false,
              revealError: true,
            })
          ) {
            return;
          }

          const serverErrors = getPayloadErrors(payload);
          if (response.status === 409 && extractSettingsPayload(payload)) {
            loadPayload(payload, 'remote', { announceStatus: false });
            setErrors(
              serverErrors.length
                ? serverErrors
                : [
                    'Config updated, synced latest, please review before saving',
                  ],
              {
                title: 'External update detected',
              }
            );
            setStatus(
              'warn',
              'External update detected, synced latest config',
              { announce: false }
            );
            revealErrorState();
            return;
          }

          setErrors(
            serverErrors.length
              ? serverErrors
              : ['Save failed, please try again'],
            { title: 'Save failed' }
          );
          if (response.status === 404) {
            setStatus(
              'error',
              'Write not allowed in current environment (DEV only)',
              { announce: false }
            );
          } else {
            setStatus('error', 'Save failed', { announce: false });
          }
          revealErrorState();
          return;
        }

        if (extractSettingsPayload(payload)) {
          loadPayload(payload, 'remote', { announceStatus: false });
          setStatus(
            'ok',
            'Save successful, refresh target page to see changes'
          );
        } else {
          baseline = current;
          setDirty(false);
          setStatus('ok', 'Save successful');
        }
        clearInvalidFields();
        clearErrorBanner();
      } catch (error) {
        console.error(error);
        clearInvalidFields();
        setErrors(['Save request failed, please check local service logs'], {
          title: 'Save request failed',
        });
        setStatus('error', 'Save failed', { announce: false });
        revealErrorState();
      } finally {
        setSaving(false);
      }
    });

    window.addEventListener('beforeunload', (event) => {
      if (!isDirty) return;
      event.preventDefault();
      Reflect.set(event, 'returnValue', '');
    });

    loadBootstrap();
    void loadFromApi();
  }
}
