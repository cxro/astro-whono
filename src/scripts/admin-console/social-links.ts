import type { SiteSocialIconKey, SiteSocialPresetId } from '@/lib/theme-settings';
import {
  ADMIN_SOCIAL_CUSTOM_LIMIT,
  ADMIN_SOCIAL_PRESET_ORDER_DEFAULT,
  normalizeAdminSocialIconKey,
  isAdminSocialPresetId
} from '@/lib/admin-console/shared';
import type { EditableCustomSocialItem, SocialPresetOrder } from './form-codec';

type Query = <T extends Element>(parent: ParentNode, selector: string) => T | null;
type QueryAll = <T extends Element>(parent: ParentNode, selector: string) => T[];

type SocialLinksContext = {
  query: Query;
  queryAll: QueryAll;
  socialCustomList: HTMLElement;
  socialCustomHead: HTMLElement;
  socialCustomCountEl: HTMLElement;
  socialCustomAddBtn: HTMLButtonElement;
  socialCustomTemplate: HTMLTemplateElement;
  inputSiteSocialGithubOrder: HTMLInputElement;
  inputSiteSocialXOrder: HTMLInputElement;
  inputSiteSocialEmailOrder: HTMLInputElement;
};

const parseOrder = (value: string | number | null | undefined, fallback: number): number => {
  const next = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(next) ? next : fallback;
};

const parseInteger = (value: string | number | null | undefined): number | null => {
  const next = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(next) ? next : null;
};

const normalizeTrimmed = (value: unknown): string => String(value ?? '').trim();

export const createSocialLinks = ({
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
}: SocialLinksContext) => {
  const getPresetRows = (): HTMLElement[] => queryAll<HTMLElement>(socialCustomList, '[data-social-preset-row]');
  const getCustomRows = (): HTMLElement[] => queryAll<HTMLElement>(socialCustomList, '[data-social-custom-row]');

  const fallbackCustomSocialIconKey: SiteSocialIconKey = 'website';
  const customSocialOptionElements = queryAll<HTMLOptionElement>(
    socialCustomTemplate.content,
    '[data-social-custom-field="iconKey"] option'
  );
  const customSocialIconOrder = Array.from(
    new Set(
      customSocialOptionElements.map(
        (option) => normalizeAdminSocialIconKey(option.value) ?? fallbackCustomSocialIconKey
      )
    )
  ) as SiteSocialIconKey[];
  const defaultCustomSocialIconKey: SiteSocialIconKey =
    customSocialIconOrder[0] ?? fallbackCustomSocialIconKey;
  const customSocialIconKeys = new Set<SiteSocialIconKey>(
    customSocialOptionElements.map((option) => {
      return normalizeAdminSocialIconKey(option.value) ?? defaultCustomSocialIconKey;
    })
  );
  const customSocialIconLabels = new Map<SiteSocialIconKey, string>(
    customSocialOptionElements.map((option) => {
      const value = normalizeAdminSocialIconKey(option.value) ?? defaultCustomSocialIconKey;
      const label =
        option.getAttribute('data-social-default-label')?.trim() || option.textContent?.trim() || 'Link';
      return [value, label];
    })
  );
  const getDefaultCustomSocialLabel = (iconKey: SiteSocialIconKey): string =>
    customSocialIconLabels.get(iconKey)
    || customSocialIconLabels.get(fallbackCustomSocialIconKey)
    || customSocialIconLabels.get(defaultCustomSocialIconKey)
    || 'Link';
  const isEditableCustomLabelIconKey = (iconKey: SiteSocialIconKey): boolean =>
    iconKey === fallbackCustomSocialIconKey;

  const getPresetRowId = (row: Element | null): SiteSocialPresetId => {
    const value = row?.getAttribute('data-social-preset-id')?.trim() ?? 'github';
    return isAdminSocialPresetId(value) ? value : 'github';
  };

  const getPresetOrderInputs = (): Record<SiteSocialPresetId, HTMLInputElement> => ({
    github: inputSiteSocialGithubOrder,
    x: inputSiteSocialXOrder,
    email: inputSiteSocialEmailOrder
  });

  const getPresetSocialOrder = (): SocialPresetOrder => {
    const inputs = getPresetOrderInputs();
    return {
      github: parseOrder(inputs.github.value, ADMIN_SOCIAL_PRESET_ORDER_DEFAULT.github),
      x: parseOrder(inputs.x.value, ADMIN_SOCIAL_PRESET_ORDER_DEFAULT.x),
      email: parseOrder(inputs.email.value, ADMIN_SOCIAL_PRESET_ORDER_DEFAULT.email)
    };
  };

  const getPresetFieldTarget = (id: SiteSocialPresetId, field: 'order' | 'href') => (): HTMLElement | null => {
    const row = getPresetRows().find((currentRow) => getPresetRowId(currentRow) === id) ?? null;
    return row ? query<HTMLElement>(row, `[data-social-preset-field="${field}"]`) : null;
  };

  const getCustomFieldTarget = (
    index: number,
    field: 'order' | 'iconKey' | 'id' | 'label' | 'href'
  ) => (): HTMLElement | null => {
    const row = getCustomRows()[index] ?? null;
    return row ? query<HTMLElement>(row, `[data-social-custom-field="${field}"]`) : null;
  };

  const getCustomVisibilityTarget = (index: number): (() => HTMLElement | null) => () => {
    const row = getCustomRows()[index] ?? null;
    return row ? query<HTMLElement>(row, '[data-social-custom-action="toggle-visible"]') : null;
  };

  const getCustomRowIconKey = (row: Element | null): SiteSocialIconKey => {
    const select = row ? query<HTMLSelectElement>(row, '[data-social-custom-field="iconKey"]') : null;
    const value = normalizeAdminSocialIconKey(select?.value);
    return value && customSocialIconKeys.has(value) ? value : defaultCustomSocialIconKey;
  };

  const getNextDefaultCustomSocialIconKey = (): SiteSocialIconKey => {
    const usedIconKeys = new Set(getCustomRows().map((row) => getCustomRowIconKey(row)));
    return customSocialIconOrder.find((iconKey) => !usedIconKeys.has(iconKey)) || defaultCustomSocialIconKey;
  };

  const getCustomRowLabelInput = (row: Element | null): HTMLInputElement | null =>
    row ? query<HTMLInputElement>(row, '[data-social-custom-field="label"]') : null;

  const getCustomRowLabelField = (row: Element | null): HTMLElement | null =>
    row ? query<HTMLElement>(row, '.admin-social-link-label') : null;

  const getPresetRowHrefInput = (row: Element | null): HTMLInputElement | null =>
    row ? query<HTMLInputElement>(row, '[data-social-preset-field="href"]') : null;

  const getPresetRowOrderInput = (row: Element | null): HTMLInputElement | null =>
    row ? query<HTMLInputElement>(row, '[data-social-preset-field="order"]') : null;

  const isPresetRowVisible = (row: Element | null): boolean => {
    const hrefInput = getPresetRowHrefInput(row);
    return hrefInput instanceof HTMLInputElement && hrefInput.value.trim().length > 0;
  };

  const syncPresetRow = (row: Element | null): void => {
    if (!row) return;
    const toggleBtn = query<HTMLButtonElement>(row, '[data-social-preset-action="toggle-visible"]');
    if (!(toggleBtn instanceof HTMLButtonElement)) return;

    const presetId = getPresetRowId(row);
    const label = presetId === 'x' ? 'X' : presetId === 'email' ? 'Email' : 'GitHub';
    const visible = isPresetRowVisible(row);
    toggleBtn.dataset.state = visible ? 'visible' : 'hidden';
    toggleBtn.setAttribute('aria-pressed', visible ? 'true' : 'false');
    toggleBtn.setAttribute('aria-label', visible ? `Hide ${label}` : `Restore ${label}`);
    toggleBtn.setAttribute('title', visible ? `Hide ${label}` : `Restore ${label}`);
  };

  const normalizeSocialOrders = (): void => {
    type SocialOrderItem = {
      row: HTMLElement;
      type: 'preset' | 'custom';
      visible: boolean;
      order: number;
      tie: number;
    };

    const presetRows = getPresetRows();
    const customRows = getCustomRows();
    const items: SocialOrderItem[] = [
      ...presetRows.map((row, index) => ({
        row,
        type: 'preset' as const,
        visible: isPresetRowVisible(row),
        order: parseOrder(
          getPresetRowOrderInput(row)?.value || '',
          ADMIN_SOCIAL_PRESET_ORDER_DEFAULT[getPresetRowId(row)]
        ),
        tie: index
      })),
      ...customRows.map((row, index) => ({
        row,
        type: 'custom' as const,
        visible: Boolean(query<HTMLInputElement>(row, '[data-social-custom-field="visible"]')?.checked),
        order: parseOrder(query<HTMLInputElement>(row, '[data-social-custom-field="order"]')?.value || '', index + 1),
        tie: presetRows.length + index
      }))
    ];

    const orderedItems = [
      ...items.filter((item) => item.visible).sort((a, b) => a.order - b.order || a.tie - b.tie),
      ...items.filter((item) => !item.visible).sort((a, b) => a.order - b.order || a.tie - b.tie)
    ];

    orderedItems.forEach((item, index) => {
      const nextValue = String(index + 1);
      if (item.type === 'preset') {
        const orderInput = getPresetRowOrderInput(item.row);
        if (orderInput instanceof HTMLInputElement) orderInput.value = nextValue;
      } else {
        const orderInput = query<HTMLInputElement>(item.row, '[data-social-custom-field="order"]');
        if (orderInput instanceof HTMLInputElement) orderInput.value = nextValue;
      }
    });
  };

  const normalizeCustomSocialLabel = (value: unknown, iconKey: SiteSocialIconKey): string => {
    if (!isEditableCustomLabelIconKey(iconKey)) {
      return getDefaultCustomSocialLabel(iconKey);
    }
    const normalized = normalizeTrimmed(value);
    return normalized || getDefaultCustomSocialLabel(iconKey);
  };

  const getDisplayCustomSocialLabel = (value: unknown, iconKey: SiteSocialIconKey): string => {
    const normalized = normalizeTrimmed(value);
    if (!isEditableCustomLabelIconKey(iconKey)) {
      return normalized || getDefaultCustomSocialLabel(iconKey);
    }
    const defaultLabel = getDefaultCustomSocialLabel(iconKey);
    return normalized && normalized !== defaultLabel ? normalized : '';
  };

  const slugifyIdPart = (value: unknown): string => {
    const slug = String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || 'link';
  };

  const getCustomIdValues = (exceptRow?: Element | null): Set<string> =>
    new Set(
      getCustomRows()
        .filter((row) => row !== exceptRow)
        .map((row) => query<HTMLInputElement>(row, '[data-social-custom-field="id"]')?.value.trim() || '')
        .filter(Boolean)
    );

  const generateCustomId = (
    row: Element | null,
    iconKey: SiteSocialIconKey = getCustomRowIconKey(row)
  ): string => {
    const existingIds = getCustomIdValues(row);
    const base = `custom-${slugifyIdPart(iconKey)}`;
    let candidate = base;
    let suffix = 2;

    while (existingIds.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  };

  const getStoredGeneratedCustomId = (row: HTMLElement | null): string => row?.dataset.generatedId?.trim() || '';

  const getStoredGeneratedCustomLabel = (row: HTMLElement | null): string =>
    row?.dataset.generatedLabel?.trim() || '';

  const applyGeneratedCustomId = (row: HTMLElement | null, nextId: string): void => {
    const idInput = row ? query<HTMLInputElement>(row, '[data-social-custom-field="id"]') : null;
    if (!(idInput instanceof HTMLInputElement) || !row) return;

    idInput.value = nextId;
    row.dataset.generatedId = nextId;
    row.dataset.idManual = 'false';
  };

  const applyGeneratedCustomLabel = (row: HTMLElement | null, nextLabel: string): void => {
    const labelInput = getCustomRowLabelInput(row);
    if (!(labelInput instanceof HTMLInputElement) || !row) return;

    labelInput.value = getDisplayCustomSocialLabel(nextLabel, getCustomRowIconKey(row));
    row.dataset.generatedLabel = nextLabel;
    row.dataset.labelManual = 'false';
  };

  const shouldAutoSyncCustomId = (row: HTMLElement | null): boolean => {
    const idInput = row ? query<HTMLInputElement>(row, '[data-social-custom-field="id"]') : null;
    if (!(idInput instanceof HTMLInputElement) || !row) return false;

    const trimmed = idInput.value.trim();
    const generatedId = getStoredGeneratedCustomId(row);
    return row.dataset.idManual !== 'true' || !trimmed || Boolean(generatedId && trimmed === generatedId);
  };

  const shouldAutoSyncCustomLabel = (row: HTMLElement | null): boolean => {
    const labelInput = getCustomRowLabelInput(row);
    if (!(labelInput instanceof HTMLInputElement) || !row) return false;

    const trimmed = labelInput.value.trim();
    const generatedLabel = getStoredGeneratedCustomLabel(row);
    return row.dataset.labelManual !== 'true' || !trimmed || Boolean(generatedLabel && trimmed === generatedLabel);
  };

  const getNextSocialOrder = (): number => {
    const presetOrders = Object.values(getPresetSocialOrder());
    const customOrders = getCustomRows()
      .map((row) => parseInteger(query<HTMLInputElement>(row, '[data-social-custom-field="order"]')?.value))
      .filter((value): value is number => value != null);
    const orders = [...presetOrders, ...customOrders];
    return orders.length ? Math.max(...orders) + 1 : 1;
  };

  const syncCustomIconPreview = (row: HTMLElement): void => {
    const iconKey = getCustomRowIconKey(row);
    queryAll<HTMLElement>(row, '[data-social-custom-icon-option]').forEach((node) => {
      const active = node.getAttribute('data-social-custom-icon-option') === iconKey;
      node.hidden = !active;
    });
  };

  const syncCustomVisibilityButton = (row: HTMLElement): void => {
    const visibleInput = query<HTMLInputElement>(row, '[data-social-custom-field="visible"]');
    const toggleBtn = query<HTMLButtonElement>(row, '[data-social-custom-action="toggle-visible"]');
    const toggleLabel = query<HTMLElement>(row, '[data-social-custom-visible-label]');
    if (
      !(visibleInput instanceof HTMLInputElement) ||
      !(toggleBtn instanceof HTMLButtonElement) ||
      !(toggleLabel instanceof HTMLElement)
    ) {
      return;
    }

    const visible = Boolean(visibleInput.checked);
    toggleBtn.dataset.state = visible ? 'visible' : 'hidden';
    toggleBtn.setAttribute('aria-pressed', visible ? 'true' : 'false');
    toggleBtn.setAttribute('aria-label', visible ? 'Hide Link' : 'Show Link');
    toggleBtn.setAttribute('title', visible ? 'Hide Link' : 'Show Link');
    toggleLabel.textContent = visible ? 'Hide Link' : 'Show Link';
  };

  const finalizeCustomIdInput = (
    row: HTMLElement,
    options: { regenerateIfEmpty?: boolean } = {}
  ): void => {
    const { regenerateIfEmpty = true } = options;
    const idInput = query<HTMLInputElement>(row, '[data-social-custom-field="id"]');
    if (!(idInput instanceof HTMLInputElement)) return;

    const trimmed = idInput.value.trim();
    const generatedId = getStoredGeneratedCustomId(row);
    if (!trimmed && regenerateIfEmpty) {
      applyGeneratedCustomId(row, generateCustomId(row));
    } else {
      idInput.value = trimmed;
      row.dataset.idManual = trimmed && trimmed !== generatedId ? 'true' : 'false';
    }
  };

  const finalizeCustomLabelInput = (
    row: HTMLElement,
    options: { regenerateIfEmpty?: boolean } = {}
  ): void => {
    const { regenerateIfEmpty = true } = options;
    const labelInput = getCustomRowLabelInput(row);
    if (!(labelInput instanceof HTMLInputElement)) return;

    const trimmed = labelInput.value.trim();
    const nextGeneratedLabel = getDefaultCustomSocialLabel(getCustomRowIconKey(row));
    const generatedLabel = getStoredGeneratedCustomLabel(row) || nextGeneratedLabel;
    row.dataset.generatedLabel = nextGeneratedLabel;
    if (!trimmed && regenerateIfEmpty) {
      applyGeneratedCustomLabel(row, nextGeneratedLabel);
    } else {
      labelInput.value = getDisplayCustomSocialLabel(trimmed, getCustomRowIconKey(row));
      row.dataset.labelManual = trimmed && trimmed !== generatedLabel ? 'true' : 'false';
    }
  };

  const syncCustomLabelField = (
    row: HTMLElement,
    options: { syncValue?: boolean } = {}
  ): void => {
    const { syncValue = false } = options;
    const labelField = getCustomRowLabelField(row);
    const iconKey = getCustomRowIconKey(row);
    const editable = isEditableCustomLabelIconKey(iconKey);
    row.dataset.customLabelVisible = String(editable);
    if (labelField instanceof HTMLElement) {
      labelField.hidden = !editable;
    }

    if (!editable) {
      applyGeneratedCustomLabel(row, getDefaultCustomSocialLabel(iconKey));
      return;
    }

    if (syncValue) {
      const nextGeneratedLabel = getDefaultCustomSocialLabel(iconKey);
      if (shouldAutoSyncCustomLabel(row)) {
        applyGeneratedCustomLabel(row, nextGeneratedLabel);
      } else {
        row.dataset.generatedLabel = nextGeneratedLabel;
      }
    }
  };

  const syncCustomRow = (row: HTMLElement, options: { syncId?: boolean; syncLabel?: boolean } = {}): void => {
    const { syncId = false, syncLabel = false } = options;
    const idInput = query<HTMLInputElement>(row, '[data-social-custom-field="id"]');
    if (!(idInput instanceof HTMLInputElement)) return;
    const iconKey = getCustomRowIconKey(row);

    if (syncId && shouldAutoSyncCustomId(row)) {
      applyGeneratedCustomId(row, generateCustomId(row, iconKey));
    }

    syncCustomLabelField(row, { syncValue: syncLabel });
    syncCustomIconPreview(row);
    syncCustomVisibilityButton(row);
  };

  const updateCustomRowsUi = (): void => {
    const rows = getCustomRows();
    socialCustomHead.hidden = false;
    socialCustomCountEl.textContent = `(Add ${rows.length} / ${ADMIN_SOCIAL_CUSTOM_LIMIT})`;
    socialCustomAddBtn.disabled = rows.length >= ADMIN_SOCIAL_CUSTOM_LIMIT;
  };

  const createCustomRow = (
    item: Partial<EditableCustomSocialItem> | null | undefined,
    index: number,
    options: { manualId?: boolean } = {}
  ): HTMLElement | null => {
    const { manualId = false } = options;
    const fragment = socialCustomTemplate.content.cloneNode(true) as DocumentFragment;
    const row = query<HTMLElement>(fragment, '[data-social-custom-row]');
    if (!(row instanceof HTMLElement)) return null;

    const idInput = query<HTMLInputElement>(row, '[data-social-custom-field="id"]');
    const labelInput = getCustomRowLabelInput(row);
    const hrefInput = query<HTMLInputElement>(row, '[data-social-custom-field="href"]');
    const iconInput = query<HTMLSelectElement>(row, '[data-social-custom-field="iconKey"]');
    const orderInput = query<HTMLInputElement>(row, '[data-social-custom-field="order"]');
    const visibleInput = query<HTMLInputElement>(row, '[data-social-custom-field="visible"]');

    if (
      !(idInput instanceof HTMLInputElement) ||
      !(labelInput instanceof HTMLInputElement) ||
      !(hrefInput instanceof HTMLInputElement) ||
      !(iconInput instanceof HTMLSelectElement) ||
      !(orderInput instanceof HTMLInputElement) ||
      !(visibleInput instanceof HTMLInputElement)
    ) {
      return null;
    }

    row.dataset.idManual = manualId ? 'true' : 'false';
    const initialIconKey =
      typeof item?.iconKey === 'string'
        ? normalizeAdminSocialIconKey(item.iconKey) ?? fallbackCustomSocialIconKey
        : getNextDefaultCustomSocialIconKey();
    const initialLabel = normalizeCustomSocialLabel(item?.label, initialIconKey);
    const initialDisplayLabel = getDisplayCustomSocialLabel(initialLabel, initialIconKey);
    idInput.value = item?.id ? String(item.id).trim() : '';
    labelInput.value = initialDisplayLabel;
    hrefInput.value = item?.href ? String(item.href).trim() : '';
    iconInput.value = initialIconKey;
    orderInput.value = String(parseOrder(item?.order, index + 1));
    visibleInput.checked = item?.visible !== false;
    row.dataset.generatedLabel = getDefaultCustomSocialLabel(initialIconKey);
    row.dataset.labelManual =
      isEditableCustomLabelIconKey(initialIconKey)
      && initialDisplayLabel
      && initialLabel !== row.dataset.generatedLabel
        ? 'true'
        : 'false';
    syncCustomRow(row, {
      syncId: !item?.id,
      syncLabel: isEditableCustomLabelIconKey(initialIconKey) && !item?.label
    });
    row.dataset.generatedId = idInput.value.trim();

    return row;
  };

  const replaceCustomRows = (items: EditableCustomSocialItem[]): void => {
    getCustomRows().forEach((row) => row.remove());
    items.forEach((item, index) => {
      const row = createCustomRow(item, index, { manualId: false });
      if (row) socialCustomList.appendChild(row);
    });
    updateCustomRowsUi();
  };

  return {
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
    getCustomRowIconKey,
    normalizeCustomSocialLabel,
    syncPresetRow,
    normalizeSocialOrders,
    syncCustomRow,
    updateCustomRowsUi,
    createCustomRow,
    finalizeCustomIdInput,
    finalizeCustomLabelInput,
    replaceCustomRows
  };
};
