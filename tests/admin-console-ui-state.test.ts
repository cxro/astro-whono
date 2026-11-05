import { describe, expect, it } from 'vitest';
import { createAdminConsoleUiState } from '../src/scripts/admin-console/ui-state';

type UiStateContext = Parameters<typeof createAdminConsoleUiState>[0];

const createControl = (attributes: Record<string, string> = {}) => ({
  disabled: false,
  getAttribute: (name: string): string | null => attributes[name] ?? null,
  hasAttribute: (name: string): boolean => name in attributes
});

const createUiState = () => {
  const field = createControl();
  const tab = createControl({ role: 'tab' });
  const alwaysDisabled = createControl({ 'data-always-disabled': '' });
  const retry = createControl();
  const element = () => ({ dataset: {}, hidden: false, textContent: '' });

  const uiState = createAdminConsoleUiState({
    root: element(),
    adminActions: element(),
    dirtyBanner: element(),
    errorBanner: element(),
    errorTitleEl: element(),
    errorMessageEl: element(),
    errorListEl: element(),
    errorRetryBtn: retry,
    validateBtn: element(),
    saveBtn: element(),
    statusTargets: [],
    statusLiveEl: null,
    queryAll: () => [field, tab, alwaysDisabled, retry]
  } as unknown as UiStateContext);

  return { uiState, field, tab, alwaysDisabled, retry };
};

describe('admin-console/ui-state interactive availability', () => {
  it('disables form controls while locked and restores them afterwards', () => {
    const { uiState, field } = createUiState();

    uiState.setConsoleLocked(true);
    expect(field.disabled).toBe(true);

    uiState.setConsoleLocked(false);
    expect(field.disabled).toBe(false);
  });

  it('keeps section tabs usable while saving, validating or locked', () => {
    const { uiState, tab } = createUiState();

    uiState.setSaving(true);
    uiState.setValidating(true);
    uiState.setConsoleLocked(true);

    expect(tab.disabled).toBe(false);
  });

  it('keeps data-always-disabled controls disabled after unlocking', () => {
    const { uiState, alwaysDisabled } = createUiState();

    uiState.setSaving(true);
    uiState.setSaving(false);

    expect(alwaysDisabled.disabled).toBe(true);
  });

  it('keeps the retry button usable while locked but not while a request runs', () => {
    const { uiState, retry } = createUiState();

    uiState.setConsoleLocked(true);
    expect(retry.disabled).toBe(false);

    uiState.setSaving(true);
    expect(retry.disabled).toBe(true);
  });
});
