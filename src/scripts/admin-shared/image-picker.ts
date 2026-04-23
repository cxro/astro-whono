import type { AdminImageOrigin } from '../../lib/admin-console/image-contract';
import { getAdminImageFieldAllowedOrigins } from '../../lib/admin-console/image-params';
import {
  fetchAdminImageJson,
  formatAdminImageBytes,
  formatAdminImageMetaSummary,
  getAdminImageOriginLabel,
  parseAdminImageListResponse,
  parseAdminImageMetaResponse,
  type AdminImageClientItem,
  type AdminImageClientMeta
} from './image-client';

export type AdminImagePickerField =
  | 'bits.images'
  | 'home.heroImageSrc'
  | 'page.bits.defaultAuthor.avatar';

type AdminImagePickerOpenOptions = {
  field: AdminImagePickerField;
  title: string;
  description?: string;
  query?: string;
  currentValue?: string;
  fallbackCurrentValue?: string;
  fallbackCurrentLabel?: string;
  resetLabel?: string;
  onReset?: () => void;
  onSelect: (item: AdminImageClientItem) => void;
};

type AdminImagePickerViewMode = 'list' | 'grid';
type AdminImagePickerOriginFilter = 'all' | AdminImageOrigin;
type AdminImagePickerOriginOption = {
  value: AdminImagePickerOriginFilter;
  label: string;
};

const ADMIN_IMAGE_PICKER_PAGE_LIMITS = {
  list: 6,
  grid: 12
} as const satisfies Record<AdminImagePickerViewMode, number>;

const formatAdminImageGridMetaSummary = (
  item: Pick<AdminImageClientItem, 'width' | 'height' | 'size'>
): string => {
  const dimensions = item.width && item.height ? `${item.width}×${item.height}` : '尺寸未知';
  return `${dimensions} · ${formatAdminImageBytes(item.size)}`;
};

export type AdminImagePickerController = {
  open: (options: AdminImagePickerOpenOptions) => void;
  close: () => void;
  readMeta: (options: {
    field: AdminImagePickerField;
    value?: string;
    path?: string;
  }) => Promise<AdminImageClientMeta>;
};

export const createAdminImagePicker = (root: ParentNode = document): AdminImagePickerController | null => {
  const dialog = root.querySelector<HTMLDialogElement>('[data-admin-images-picker]');
  if (!(dialog instanceof HTMLDialogElement)) return null;

  const getOriginOptions = (field: AdminImagePickerField): AdminImagePickerOriginOption[] => {
    const allowedOrigins = getAdminImageFieldAllowedOrigins(field).filter((origin) => origin !== 'src/content');
    if (allowedOrigins.length <= 1) return [];
    return [
      { value: 'all', label: '全部' },
      ...allowedOrigins.map((origin) => ({ value: origin, label: getAdminImageOriginLabel(origin) }))
    ];
  };

  const listEndpoint = dialog.dataset.listEndpoint?.trim() ?? '';
  const metaEndpoint = dialog.dataset.metaEndpoint?.trim() ?? '';
  if (!listEndpoint || !metaEndpoint) return null;

  const titleEl = dialog.querySelector<HTMLElement>('[data-admin-images-picker-title]');
  const descriptionEl = dialog.querySelector<HTMLElement>('[data-admin-images-picker-description]');
  const queryInput = dialog.querySelector<HTMLInputElement>('[data-admin-images-picker-query]');
  const filtersEl = dialog.querySelector<HTMLElement>('[data-admin-images-picker-filters]');
  const filterTabsEl = dialog.querySelector<HTMLElement>('[data-admin-images-picker-filter-tabs]');
  const filterToggleBtn = dialog.querySelector<HTMLButtonElement>('[data-admin-images-picker-filter-toggle]');
  const statusEl = dialog.querySelector<HTMLElement>('[data-admin-images-picker-status]');
  const resultsEl = dialog.querySelector<HTMLElement>('[data-admin-images-picker-results]');
  const pageEl = dialog.querySelector<HTMLElement>('[data-admin-images-picker-page]');
  const prevBtn = dialog.querySelector<HTMLButtonElement>('[data-admin-images-picker-prev]');
  const nextBtn = dialog.querySelector<HTMLButtonElement>('[data-admin-images-picker-next]');
  const closeBtn = dialog.querySelector<HTMLButtonElement>('[data-admin-images-picker-close]');
  const resetBtn = dialog.querySelector<HTMLButtonElement>('[data-admin-images-picker-reset]');
  const confirmBtn = dialog.querySelector<HTMLButtonElement>('[data-admin-images-picker-confirm]');
  const listViewBtn = dialog.querySelector<HTMLButtonElement>('[data-admin-images-picker-view="list"]');
  const gridViewBtn = dialog.querySelector<HTMLButtonElement>('[data-admin-images-picker-view="grid"]');
  if (
    !(titleEl instanceof HTMLElement)
    || !(descriptionEl instanceof HTMLElement)
    || !(queryInput instanceof HTMLInputElement)
    || !(filtersEl instanceof HTMLElement)
    || !(filterTabsEl instanceof HTMLElement)
    || !(filterToggleBtn instanceof HTMLButtonElement)
    || !(statusEl instanceof HTMLElement)
    || !(resultsEl instanceof HTMLElement)
    || !(pageEl instanceof HTMLElement)
    || !(prevBtn instanceof HTMLButtonElement)
    || !(nextBtn instanceof HTMLButtonElement)
    || !(closeBtn instanceof HTMLButtonElement)
    || !(resetBtn instanceof HTMLButtonElement)
    || !(confirmBtn instanceof HTMLButtonElement)
    || !(listViewBtn instanceof HTMLButtonElement)
    || !(gridViewBtn instanceof HTMLButtonElement)
  ) {
    return null;
  }

  let currentOptions: AdminImagePickerOpenOptions | null = null;
  let currentViewMode: AdminImagePickerViewMode = 'list';
  let currentOriginFilter: AdminImagePickerOriginFilter = 'all';
  let currentOriginOptions: readonly AdminImagePickerOriginOption[] = [];
  let currentValue = '';
  let fallbackCurrentValue = '';
  let fallbackCurrentLabel = '';
  let selectedValue = '';
  let selectedItem: AdminImageClientItem | null = null;
  let currentItems: readonly AdminImageClientItem[] = [];
  let currentTotalCount = 0;
  let filterPanelOpen = false;
  let currentPage = 1;
  let totalPages = 1;
  let requestToken = 0;
  let searchTimer = 0;
  let focusTimer = 0;
  let scrollLocked = false;
  let bodyOverflow = '';
  let docOverflow = '';

  const lockPageScroll = () => {
    if (scrollLocked) return;
    bodyOverflow = document.body.style.overflow;
    docOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    scrollLocked = true;
  };

  const unlockPageScroll = () => {
    if (!scrollLocked) return;
    document.body.style.overflow = bodyOverflow;
    document.documentElement.style.overflow = docOverflow;
    scrollLocked = false;
  };

  const cancelPendingWork = () => {
    window.clearTimeout(searchTimer);
    window.clearTimeout(focusTimer);
    searchTimer = 0;
    focusTimer = 0;
    requestToken += 1;
  };

  const syncPager = () => {
    pageEl.textContent = `${currentPage} / ${totalPages}`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
  };

  const setStatus = (text: string) => {
    statusEl.textContent = text;
  };

  const resetResultsScroll = () => {
    resultsEl.scrollTop = 0;
  };

  const syncConfirmAction = () => {
    confirmBtn.disabled = !selectedItem;
  };

  const syncSelectedItemFromCurrentItems = () => {
    if (!selectedValue) {
      selectedItem = null;
      syncConfirmAction();
      return;
    }

    selectedItem =
      currentItems.find((item) => item.value === selectedValue)
      ?? (selectedItem?.value === selectedValue ? selectedItem : null);
    syncConfirmAction();
  };

  const getCurrentMarker = () => {
    if (currentValue.length > 0) {
      return {
        value: currentValue,
        label: '当前使用'
      };
    }

    if (fallbackCurrentValue.length > 0) {
      return {
        value: fallbackCurrentValue,
        label: fallbackCurrentLabel || '当前使用'
      };
    }

    return null;
  };

  const syncViewMode = () => {
    resultsEl.dataset.view = currentViewMode;
    listViewBtn.dataset.active = String(currentViewMode === 'list');
    gridViewBtn.dataset.active = String(currentViewMode === 'grid');
    listViewBtn.setAttribute('aria-pressed', String(currentViewMode === 'list'));
    gridViewBtn.setAttribute('aria-pressed', String(currentViewMode === 'grid'));
  };

  const setViewMode = (viewMode: AdminImagePickerViewMode) => {
    if (currentViewMode === viewMode) return;
    currentViewMode = viewMode;
    currentPage = 1;
    syncViewMode();
    void loadList();
  };

  const renderOriginTabs = () => {
    filterTabsEl.replaceChildren();
    if (currentOriginOptions.length === 0) return;

    const fragment = document.createDocumentFragment();
    currentOriginOptions.forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-btn admin-btn--tool admin-btn--compact admin-images-picker__filter-tab';
      button.dataset.origin = option.value;
      button.setAttribute('aria-pressed', String(currentOriginFilter === option.value));
      button.textContent = option.label;
      button.addEventListener('click', () => {
        if (currentOriginFilter === option.value) return;
        currentOriginFilter = option.value;
        currentPage = 1;
        syncFilterControls();
        void loadList();
      });
      fragment.appendChild(button);
    });

    filterTabsEl.appendChild(fragment);
  };

  const syncFilterControls = () => {
    const hasFilters = currentOriginOptions.length > 0;
    if (!hasFilters) {
      currentOriginFilter = 'all';
      filterPanelOpen = false;
      filterToggleBtn.hidden = true;
      filterToggleBtn.dataset.active = 'false';
      filterToggleBtn.setAttribute('aria-expanded', 'false');
      filtersEl.hidden = true;
      filterTabsEl.replaceChildren();
      return;
    }

    filterToggleBtn.hidden = false;
    filterToggleBtn.dataset.active = String(filterPanelOpen || currentOriginFilter !== 'all');
    filterToggleBtn.setAttribute('aria-expanded', String(filterPanelOpen));
    filtersEl.hidden = !filterPanelOpen;
    renderOriginTabs();
  };

  const renderItems = (items: readonly AdminImageClientItem[], totalCount: number) => {
    currentItems = items;
    currentTotalCount = totalCount;
    syncSelectedItemFromCurrentItems();
    resultsEl.replaceChildren();
    setStatus(`${totalCount} 个文件`);
    if (!items.length) {
      const empty = document.createElement('li');
      empty.className = 'admin-images-picker__empty';
      empty.textContent = '没有匹配到可选图片。';
      resultsEl.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    const currentMarker = getCurrentMarker();
    items.forEach((item) => {
      const row = document.createElement('li');
      row.className = 'admin-images-picker__item';
      const isCurrent = currentMarker?.value === item.value;
      const isSelected = selectedValue.length > 0 && item.value === selectedValue;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-images-picker__item-button';
      button.dataset.current = String(isCurrent);
      button.dataset.selected = String(isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
      button.addEventListener('click', () => {
        selectedValue = item.value;
        selectedItem = item;
        renderItems(currentItems, currentTotalCount);
      });

      const thumb = document.createElement('span');
      thumb.className = 'admin-images-picker__thumb';
      if (item.previewSrc) {
        const image = document.createElement('img');
        image.src = item.previewSrc;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        thumb.appendChild(image);
      } else {
        const fallback = document.createElement('span');
        fallback.textContent = item.origin;
        thumb.appendChild(fallback);
      }

      const copy = document.createElement('span');
      copy.className = 'admin-images-picker__item-copy';

      const pathRow = document.createElement('span');
      pathRow.className = 'admin-images-picker__item-head';

      const pathEl = document.createElement('span');
      pathEl.className = 'admin-images-picker__item-path';
      pathEl.title = item.value;

      const pathListEl = document.createElement('span');
      pathListEl.className = 'admin-images-picker__item-path-label admin-images-picker__item-path-label--list';
      pathListEl.textContent = item.value;

      const pathGridEl = document.createElement('span');
      pathGridEl.className = 'admin-images-picker__item-path-label admin-images-picker__item-path-label--grid';
      pathGridEl.textContent = item.fileName || item.value;

      pathEl.append(pathListEl, pathGridEl);

      const badgesEl = document.createElement('span');
      badgesEl.className = 'admin-images-picker__item-badges';

      if (isCurrent) {
        const currentBadge = document.createElement('span');
        currentBadge.className = 'admin-images-picker__badge';
        currentBadge.textContent = currentMarker?.label ?? '当前使用';
        badgesEl.appendChild(currentBadge);
      }

      if (isSelected && !isCurrent) {
        const selectedBadge = document.createElement('span');
        selectedBadge.className = 'admin-images-picker__badge admin-images-picker__badge--selected';
        selectedBadge.textContent = '已选中';
        badgesEl.appendChild(selectedBadge);
      }

      const metaEl = document.createElement('span');
      metaEl.className = 'admin-images-picker__item-meta';
      const listMetaText = formatAdminImageMetaSummary({
        kind: 'local',
        origin: item.origin,
        width: item.width,
        height: item.height,
        size: item.size
      });

      const metaListEl = document.createElement('span');
      metaListEl.className = 'admin-images-picker__item-meta-label admin-images-picker__item-meta-label--list';
      metaListEl.textContent = listMetaText;

      const metaGridEl = document.createElement('span');
      metaGridEl.className = 'admin-images-picker__item-meta-label admin-images-picker__item-meta-label--grid';
      metaGridEl.textContent = formatAdminImageGridMetaSummary(item);

      metaEl.append(metaListEl, metaGridEl);

      pathRow.append(pathEl, badgesEl);
      copy.append(pathRow, metaEl);
      button.append(thumb, copy);
      row.appendChild(button);
      fragment.appendChild(row);
    });

    resultsEl.appendChild(fragment);
  };

  const loadList = async () => {
    if (!currentOptions) return;

    const token = ++requestToken;
    resetResultsScroll();
    setStatus('加载中…');
    currentItems = [];
    currentTotalCount = 0;
    syncSelectedItemFromCurrentItems();
    resultsEl.replaceChildren();

    const params = new URLSearchParams({
      field: currentOptions.field,
      page: String(currentPage),
      limit: String(ADMIN_IMAGE_PICKER_PAGE_LIMITS[currentViewMode])
    });
    const query = queryInput.value.trim();
    if (query) params.set('q', query);
    if (currentOriginFilter !== 'all') {
      params.set('origin', currentOriginFilter);
    }

    try {
      const payload = await fetchAdminImageJson(`${listEndpoint}?${params.toString()}`, '图片列表请求失败');
      if (token !== requestToken) return;

      const result = parseAdminImageListResponse(payload);
      currentPage = result.page;
      totalPages = result.totalPages;
      syncPager();
      renderItems(result.items, result.totalCount);
    } catch (error) {
      if (token !== requestToken) return;
      console.warn('[admin-images-picker] 图片列表加载失败', error);
      currentItems = [];
      currentTotalCount = 0;
      syncSelectedItemFromCurrentItems();
      totalPages = 1;
      syncPager();
      resultsEl.replaceChildren();
      setStatus('加载失败');
    }
  };

  const close = () => {
    if (dialog.open) {
      dialog.close();
      return;
    }
    cancelPendingWork();
    unlockPageScroll();
  };

  const open = (options: AdminImagePickerOpenOptions) => {
    cancelPendingWork();
    currentOptions = options;
    currentViewMode = 'list';
    currentOriginFilter = 'all';
    currentOriginOptions = getOriginOptions(options.field);
    currentValue = options.currentValue?.trim() ?? '';
    fallbackCurrentValue = currentValue ? '' : options.fallbackCurrentValue?.trim() ?? '';
    fallbackCurrentLabel = fallbackCurrentValue ? options.fallbackCurrentLabel?.trim() ?? '' : '';
    selectedValue = currentValue;
    selectedItem = null;
    currentItems = [];
    currentTotalCount = 0;
    filterPanelOpen = false;
    currentPage = 1;
    totalPages = 1;
    titleEl.textContent = options.title;

    const description = options.description?.trim() ?? '';
    descriptionEl.textContent = description;
    descriptionEl.hidden = !description;
    if (description) {
      dialog.setAttribute('aria-describedby', 'admin-images-picker-description');
    } else {
      dialog.removeAttribute('aria-describedby');
    }

    queryInput.value = options.query?.trim() ?? '';
    resetBtn.textContent = options.resetLabel?.trim() || '恢复默认';
    resetBtn.hidden = typeof options.onReset !== 'function';
    syncViewMode();
    syncFilterControls();
    syncPager();
    syncConfirmAction();
    if (!dialog.open) {
      lockPageScroll();
      dialog.showModal();
    }
    void loadList();
    focusTimer = window.setTimeout(() => {
      focusTimer = 0;
      if (!dialog.open) return;
      listViewBtn.focus({ preventScroll: true });
    }, 0);
  };

  const readMeta = async ({
    field,
    value,
    path
  }: {
    field: AdminImagePickerField;
    value?: string;
    path?: string;
  }): Promise<AdminImageClientMeta> => {
    const params = new URLSearchParams();
    if (path?.trim()) {
      params.set('path', path.trim());
    } else {
      params.set('field', field);
      params.set('value', value?.trim() ?? '');
    }
    const payload = await fetchAdminImageJson(`${metaEndpoint}?${params.toString()}`, '图片元数据请求失败');
    return parseAdminImageMetaResponse(payload);
  };

  closeBtn.addEventListener('click', close);
  resetBtn.addEventListener('click', () => {
    if (typeof currentOptions?.onReset !== 'function') return;
    currentOptions.onReset();
    close();
  });
  confirmBtn.addEventListener('click', () => {
    if (!selectedItem) return;
    currentOptions?.onSelect(selectedItem);
    close();
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('close', () => {
    cancelPendingWork();
    unlockPageScroll();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  queryInput.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      searchTimer = 0;
      if (!dialog.open) return;
      currentPage = 1;
      void loadList();
    }, 180);
  });

  listViewBtn.addEventListener('click', () => {
    setViewMode('list');
  });

  gridViewBtn.addEventListener('click', () => {
    setViewMode('grid');
  });

  filterToggleBtn.addEventListener('click', () => {
    if (currentOriginOptions.length === 0) return;
    filterPanelOpen = !filterPanelOpen;
    syncFilterControls();
  });

  prevBtn.addEventListener('click', () => {
    if (currentPage <= 1) return;
    currentPage -= 1;
    void loadList();
  });

  nextBtn.addEventListener('click', () => {
    if (currentPage >= totalPages) return;
    currentPage += 1;
    void loadList();
  });

  syncViewMode();
  syncFilterControls();
  syncPager();

  return {
    open,
    close,
    readMeta
  };
};
