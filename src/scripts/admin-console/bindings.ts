import { ADMIN_SOCIAL_CUSTOM_LIMIT } from '@/lib/admin-console/theme-shared';
import type { AdminThemeControls } from './controls';
import type { AdminThemeController } from './controller';
import type { createFormCodec } from './form-codec';
import type { createAdminThemeImageFields } from './image-fields';
import { shouldGuardAdminNavigation } from './navigation-guard';
import type { createSocialLinks } from './social-links';
import type { createAdminConsoleUiState } from './ui-state';

type AdminThemeFormCodec = ReturnType<typeof createFormCodec>;
type AdminThemeImageFields = ReturnType<typeof createAdminThemeImageFields>;
type AdminThemeSocialLinks = ReturnType<typeof createSocialLinks>;
type AdminThemeUiState = ReturnType<typeof createAdminConsoleUiState>;
type QueryFn = <T extends Element>(parent: ParentNode, selector: string) => T | null;

const clearTargetInvalidState = (target: EventTarget | null): void => {
  if (
    target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
  ) {
    target.removeAttribute('aria-invalid');
  }
};

export const bindAdminThemeFieldEvents = ({
  controls,
  formCodec,
  themeImageFields,
  uiState,
  refreshDirty
}: {
  controls: AdminThemeControls;
  formCodec: AdminThemeFormCodec;
  themeImageFields: AdminThemeImageFields;
  uiState: AdminThemeUiState;
  refreshDirty: () => void;
}): void => {
  const {
    form,
    adminActionsSentinel,
    inputSiteFooterStartYear,
    inputSiteFooterShowCurrentYear,
    inputSiteFooterCopyright,
    inputSiteAdminOverviewPublicVisible,
    inputArticleMetaDateLabel,
    inputArticleMetaShowDate,
    inputArticleMetaShowHeaderTags,
    inputArticleMetaShowWordCount,
    inputArticleMetaShowReadingTime,
    inputHomeIntroMore,
    inputHomeShowIntroMore,
    inputHomeIntroMoreLinkPrimary,
    inputHomeIntroMoreLinkSecondaryEnabled,
    inputHomeIntroMoreLinkSecondary,
    inputHomeShowHero,
    inputHeroImageSrc,
    inputHeroImageAlt
  } = controls;
  const {
    refreshArticleMetaPreview,
    refreshHomeIntroPreview,
    syncAdminOverviewControls,
    syncSidebarActionControls,
    syncHomeIntroLinkControls,
    syncHeroControls,
    refreshFooterPreview
  } = formCodec;

  form.addEventListener('input', (event) => {
    clearTargetInvalidState(event.target);
    refreshDirty();
  });

  form.addEventListener('change', (event) => {
    clearTargetInvalidState(event.target);
    refreshDirty();
  });

  inputSiteFooterStartYear.addEventListener('input', refreshFooterPreview);
  inputSiteFooterShowCurrentYear.addEventListener('change', refreshFooterPreview);
  inputSiteFooterCopyright.addEventListener('input', refreshFooterPreview);
  inputSiteAdminOverviewPublicVisible.addEventListener('change', () => {
    syncAdminOverviewControls();
    syncSidebarActionControls();
  });
  inputArticleMetaDateLabel.addEventListener('input', refreshArticleMetaPreview);
  inputArticleMetaShowDate.addEventListener('change', refreshArticleMetaPreview);
  inputArticleMetaShowHeaderTags.addEventListener('change', refreshArticleMetaPreview);
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
    // 关闭后这两项不再参与校验；不清除的话，含出错字段时不隐藏的规则会把它们留在页面上。
    if (!inputHomeShowHero.checked) {
      clearTargetInvalidState(inputHeroImageSrc);
      clearTargetInvalidState(inputHeroImageAlt);
    }
    syncHeroControls();
    themeImageFields?.refresh('home.heroImageSrc');
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
};

export const bindAdminThemeSocialEvents = ({
  controls,
  query,
  socialLinks,
  uiState,
  refreshDirty
}: {
  controls: AdminThemeControls;
  query: QueryFn;
  socialLinks: AdminThemeSocialLinks;
  uiState: AdminThemeUiState;
  refreshDirty: () => void;
}): void => {
  const {
    socialCustomAddBtn,
    socialCustomList
  } = controls;
  const {
    getCustomRows,
    getPresetRowHrefInput,
    getPresetRowOrderInput,
    getStoredGeneratedCustomId,
    getStoredGeneratedCustomLabel,
    getNextSocialOrder,
    syncPresetRow,
    normalizeSocialOrders,
    syncCustomRow,
    updateCustomRowsUi,
    createCustomRow,
    finalizeCustomIdInput,
    finalizeCustomLabelInput
  } = socialLinks;

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
};

export const bindAdminThemeActionEvents = ({
  controls,
  controller,
  uiState
}: {
  controls: AdminThemeControls;
  controller: AdminThemeController;
  uiState: AdminThemeUiState;
}): void => {
  const {
    errorRetryBtn,
    validateBtn,
    resetBtn,
    saveBtn
  } = controls;

  errorRetryBtn.addEventListener('click', () => {
    if (uiState.isSaving() || uiState.isValidating()) return;
    if (uiState.isConsoleLocked()) {
      void controller.loadFromApi();
      return;
    }
    void controller.runValidation();
  });

  validateBtn.addEventListener('click', () => {
    void controller.runValidation();
  });

  resetBtn.addEventListener('click', () => {
    controller.resetSettings();
  });

  saveBtn.addEventListener('click', () => {
    void controller.saveSettings();
  });
};

export const bindAdminThemeNavigationGuard = ({
  uiState
}: {
  uiState: AdminThemeUiState;
}): void => {
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
};
