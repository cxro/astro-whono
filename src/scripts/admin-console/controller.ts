import type {
  ThemeSettingsEditableErrorState,
  ThemeSettingsEditablePayload
} from '@/lib/theme-settings';
import { ADMIN_SETTINGS_API_PATH } from '@/lib/admin-console/admin-api-paths';
import type { AdminThemeControls } from './controls';
import type { createFormCodec, EditableSettings } from './form-codec';
import { createInvalidSettingsBannerItems } from './invalid-settings-banner';
import type { createAdminConsoleUiState } from './ui-state';
import type { createValidation, ValidationIssue } from './validation';
import {
  extractInvalidSettingsState,
  extractSettingsPayload,
  getPayloadErrors,
  getPayloadIssues,
  getPayloadMessage,
  isRecord,
  requestSettingsWrite
} from './settings-transport';

type LoadSource = 'bootstrap' | 'remote';
type AdminThemeFormCodec = ReturnType<typeof createFormCodec>;
type AdminThemeUiState = ReturnType<typeof createAdminConsoleUiState>;
type AdminThemeValidation = ReturnType<typeof createValidation>;

type AdminThemeControllerContext = {
  controls: AdminThemeControls;
  endpoint: string;
  formCodec: AdminThemeFormCodec;
  uiState: AdminThemeUiState;
  validation: AdminThemeValidation;
  finalizeAppliedSettings: () => void;
  syncEditableDerivedControls: () => void;
  /** 让字段所在的分组标签显示出来（字段可能在未选中的分组里）。 */
  revealField: (field: HTMLElement) => void;
};

const STATUS_INVALID_SETTINGS = '配置损坏';

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const createAdminThemeController = ({
  controls,
  endpoint,
  formCodec,
  uiState,
  validation,
  finalizeAppliedSettings,
  syncEditableDerivedControls,
  revealField
}: AdminThemeControllerContext) => {
  const {
    bootstrapEl,
    errorBanner
  } = controls;
  const {
    canonicalize,
    collectSettings,
    applySettings
  } = formCodec;
  const {
    validateSettings,
    createPathIssues,
    clearInvalidFields,
    markInvalidFields,
    resolveIssueField
  } = validation;

  let baseline: EditableSettings | null = null;
  let currentRevision: string | null = null;
  let pendingExternalUpdate: { revision: string; settings: EditableSettings } | null = null;

  const scrollIntoViewWithOffset = (element: HTMLElement): void => {
    const top = element.getBoundingClientRect().top + window.scrollY - 24;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  };

  const revealErrorState = (issues: readonly ValidationIssue[] = []): void => {
    const firstField = issues
      .map((issue) => resolveIssueField(issue))
      .find((field): field is HTMLElement => field !== null);

    if (firstField) revealField(firstField);
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

  const setValidationIssues = (issues: readonly ValidationIssue[]): void => {
    markInvalidFields(issues);
    uiState.setErrors(issues.map((issue) => issue.message));
  };

  /* 服务器才能发现的问题（如本地文件不存在）：标出字段，交给 revealErrorState 切到所在分组。 */
  const markServerIssues = (payload: unknown): ValidationIssue[] => {
    const issues = createPathIssues(getPayloadIssues(payload));
    markInvalidFields(issues);
    return issues;
  };

  const clearExternalUpdate = (): void => {
    pendingExternalUpdate = null;
  };

  const refreshDirty = (): void => {
    if (!baseline) return;
    const current = canonicalize(collectSettings());
    uiState.setDirty(pendingExternalUpdate !== null || JSON.stringify(current) !== JSON.stringify(baseline));
  };

  const validateCurrentSettings = (): { draft: EditableSettings; issues: ValidationIssue[] } => {
    const draft = collectSettings();
    const issues = validateSettings(draft);
    setValidationIssues(issues);
    return { draft, issues };
  };

  const stageExternalUpdate = (payload: ThemeSettingsEditablePayload): void => {
    pendingExternalUpdate = {
      revision: payload.revision,
      settings: canonicalize(payload.settings)
    };
  };

  const showExternalUpdateConflict = (payload: unknown, title: string, status: string): boolean => {
    const latestPayload = extractSettingsPayload(payload);
    if (!latestPayload) return false;

    stageExternalUpdate(latestPayload);
    uiState.setErrorBanner({
      title,
      items: ['你的修改仍保留在页面中；如需同步最新配置，请点击「重置更改」。']
    });
    uiState.setDirty(true);
    uiState.setStatus('warn', status, { announce: false });
    revealErrorState();
    return true;
  };

  const setInvalidSettingsErrorBanner = (invalidState: ThemeSettingsEditableErrorState): void => {
    uiState.setErrorBanner({
      title: '已切换为只读保护',
      message: '检测到 settings 配置文件损坏。请先修复文件，再点击“重新检测”或刷新当前页面。',
      items: createInvalidSettingsBannerItems(invalidState),
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
    clearExternalUpdate();
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
    clearExternalUpdate();
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
    clearExternalUpdate();
    clearInvalidFields();
    uiState.setDirty(false);
    uiState.setConsoleLocked(true);
    uiState.setStatus('error', '初始化失败');
    uiState.setErrors([message], {
      title: '读取配置失败',
      message: '未能读取 Theme Console 当前配置。请点击“重新检测”重试。',
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
        console.warn(`Theme Console bootstrap payload is invalid; falling back to ${ADMIN_SETTINGS_API_PATH}.`);
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
    uiState.setStatus('loading', '加载中', { announce: false });
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
        uiState.setStatus('warn', '接口读取失败');
      } else if (!uiState.isConsoleLocked()) {
        setInitialLoadError(error instanceof Error ? error.message : '初始化请求失败，请稍后重试');
      }
      console.warn(error);
    }
  };

  const runValidation = async (): Promise<void> => {
    if (uiState.isSaving() || uiState.isValidating()) return;

    const { draft, issues } = validateCurrentSettings();
    if (issues.length) {
      uiState.setStatus('error', '校验未通过', { announce: false });
      revealErrorState(issues);
      return;
    }

    const current = canonicalize(draft);
    uiState.setValidating(true);
    uiState.setStatus('loading', '正在预检');

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

      const { response, payload } = await requestSettingsWrite({
        endpoint,
        currentUrl: window.location.href,
        revision: currentRevision,
        settings: current,
        dryRun: true
      });
      if (applyInvalidSettingsState(payload, { announceStatus: false, revealError: true })) {
        return;
      }

      if (!response.ok || !isRecord(payload) || payload.ok !== true) {
        clearInvalidFields();
        const serverErrors = getPayloadErrors(payload);

        if (
          response.status === 409
          && showExternalUpdateConflict(payload, '检查时发现外部更新', '检查时发现外部更新，当前草稿已保留')
        ) {
          return;
        }

        uiState.setErrors(serverErrors.length ? serverErrors : ['检查配置失败，请稍后重试'], {
          title: '检查配置失败'
        });
        uiState.setStatus('error', '检查配置失败', { announce: false });
        revealErrorState(markServerIssues(payload));
        return;
      }

      clearInvalidFields();
      clearExternalUpdate();
      uiState.clearErrorBanner();
      uiState.setStatus('ok', '检查通过');
    } catch (error) {
      console.error(error);
      clearInvalidFields();
      uiState.setErrors(['检查配置请求失败，请检查本地服务日志'], { title: '检查配置失败' });
      uiState.setStatus('error', '检查配置失败', { announce: false });
      revealErrorState();
    } finally {
      uiState.setValidating(false);
      syncEditableDerivedControls();
    }
  };

  const resetSettings = (): void => {
    const externalUpdate = pendingExternalUpdate;
    if (externalUpdate) {
      const latestSettings = deepClone(externalUpdate.settings);
      currentRevision = externalUpdate.revision;
      baseline = latestSettings;
      clearExternalUpdate();
      applySettings(deepClone(latestSettings));
      finalizeAppliedSettings();
      clearInvalidFields();
      uiState.clearErrorBanner();
      uiState.setDirty(false);
      uiState.setStatus('ready', '已同步外部最新配置');
      return;
    }

    if (!baseline) return;
    applySettings(deepClone(baseline));
    finalizeAppliedSettings();
    clearInvalidFields();
    uiState.clearErrorBanner();
    uiState.setDirty(false);
    uiState.setStatus('ready', '已重置');
  };

  const saveSettings = async (): Promise<void> => {
    if (uiState.isSaving() || uiState.isValidating()) return;
    const { draft, issues } = validateCurrentSettings();
    if (issues.length) {
      uiState.setStatus('error', '保存前校验失败', { announce: false });
      revealErrorState(issues);
      return;
    }

    const current = canonicalize(draft);

    uiState.setSaving(true);
    uiState.setStatus('loading', '正在保存');

    try {
      if (!currentRevision) {
        clearInvalidFields();
        uiState.setErrors(['当前配置缺少 revision，请先同步最新配置后再保存'], { title: '保存前需要重新同步配置' });
        uiState.setStatus('error', '保存失败', { announce: false });
        revealErrorState();
        return;
      }

      const { response, payload } = await requestSettingsWrite({
        endpoint,
        currentUrl: window.location.href,
        revision: currentRevision,
        settings: current
      });
      if (!response.ok || !isRecord(payload) || payload.ok !== true) {
        clearInvalidFields();
        if (applyInvalidSettingsState(payload, { announceStatus: false, revealError: true })) {
          return;
        }

        const serverErrors = getPayloadErrors(payload);
        if (
          response.status === 409
          && showExternalUpdateConflict(payload, '检测到外部更新，保存已暂停', '检测到外部更新，当前草稿已保留')
        ) {
          return;
        }

        uiState.setErrors(serverErrors.length ? serverErrors : ['保存失败，请稍后重试'], { title: '保存失败' });
        if (response.status === 404) {
          uiState.setStatus('error', '无法写入', { announce: false });
        } else {
          uiState.setStatus('error', '保存失败', { announce: false });
        }
        revealErrorState(markServerIssues(payload));
        return;
      }

      if (extractSettingsPayload(payload)) {
        loadPayload(payload, 'remote', { announceStatus: false });
        uiState.setStatus('ok', '保存成功');
      } else {
        baseline = current;
        clearExternalUpdate();
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
      syncEditableDerivedControls();
    }
  };

  const start = (): void => {
    if (loadBootstrap() === 'fallback') {
      void loadFromApi();
    }
  };

  return {
    loadFromApi,
    refreshDirty,
    resetSettings,
    runValidation,
    saveSettings,
    start
  };
};

export type AdminThemeController = ReturnType<typeof createAdminThemeController>;
