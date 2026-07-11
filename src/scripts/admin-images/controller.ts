import {
  ADMIN_IMAGE_DEFAULT_LIST_LIMIT,
  ADMIN_IMAGE_SCOPE_LABELS
} from '../../lib/admin-console/image-contract';
import {
  resolveAdminImageBrowsePage
} from '../../lib/admin-console/image-browse';
import {
  queryAdminDomControls,
  reportAdminDomSetupError
} from '../admin-shared/dom-diagnostics';
import { type AdminImageClientMeta } from '../admin-shared/image-client';
import {
  copyText,
  deleteCloudImage,
  fetchList,
  fetchMetaByPath,
  navigateToRefresh,
  parseBootstrap,
  toBrowseItem,
  toCachedMeta,
  updateUrl
} from './data';
import {
  renderDetail,
  renderGroupButtons,
  renderItems,
  renderSubgroupButtons,
  syncRenderedCardMeta,
  syncRenderedSelection
} from './view';
import {
  DEFAULT_GROUP,
  DEFAULT_SCOPE,
  type AdminImageBrowseItem,
  type AdminImageFilterOption,
  type AdminImageListItem,
  type AdminImageListResponse,
  type AdminImageState,
  type AdminImageViewMode
} from './types';

const root = document.querySelector<HTMLElement>('[data-admin-images-root]');
const LARGE_FILE_THRESHOLD = 500 * 1024;
const GRID_VIEW_PAGE_SIZE = ADMIN_IMAGE_DEFAULT_LIST_LIMIT;
const MOBILE_GRID_VIEW_PAGE_SIZE = 9;
const LIST_VIEW_PAGE_SIZE = 5;

const byId = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;
const iconLibraryEl = byId<HTMLDivElement>('admin-images-icon-library');
const iconMarkupCache = new Map<string, string>();

const getIconMarkup = (name: string): string => {
  const cached = iconMarkupCache.get(name);
  if (cached !== undefined) return cached;

  const markup = iconLibraryEl?.querySelector<HTMLElement>(`[data-icon="${name}"]`)?.innerHTML.trim() ?? '';
  iconMarkupCache.set(name, markup);
  return markup;
};

export const initAdminImagesConsole = () => {
  if (!root) {
    return;
  }

  const controls = {
    bootstrapEl: byId<HTMLDivElement>('admin-images-bootstrap'),
    formEl: byId<HTMLFormElement>('admin-images-form'),
    filtersPanelEl: byId<HTMLDivElement>('admin-images-filters'),
    filterToggleBtn: byId<HTMLButtonElement>('admin-images-filter-toggle'),
    groupsWrapEl: byId<HTMLDivElement>('admin-images-groups-wrap'),
    groupsEl: byId<HTMLDivElement>('admin-images-groups'),
    subgroupsWrapEl: byId<HTMLDivElement>('admin-images-subgroups-wrap'),
    subgroupsEl: byId<HTMLDivElement>('admin-images-subgroups'),
    searchPanelEl: byId<HTMLDivElement>('admin-images-search-panel'),
    searchToggleBtn: byId<HTMLButtonElement>('admin-images-search-toggle'),
    queryInput: byId<HTMLInputElement>('admin-images-query'),
    recentBtn: byId<HTMLButtonElement>('admin-images-recent'),
    refreshBtn: byId<HTMLButtonElement>('admin-images-refresh'),
    listViewBtn: byId<HTMLButtonElement>('admin-images-view-list'),
    gridViewBtn: byId<HTMLButtonElement>('admin-images-view-grid'),
    statusLiveEl: byId<HTMLElement>('admin-images-status-live'),
    statusEl: byId<HTMLElement>('admin-images-status'),
    pageMetaEl: byId<HTMLElement>('admin-images-page-meta'),
    resultListEl: byId<HTMLUListElement>('admin-images-result-list'),
    emptyEl: byId<HTMLElement>('admin-images-empty'),
    prevBtn: byId<HTMLButtonElement>('admin-images-prev'),
    nextBtn: byId<HTMLButtonElement>('admin-images-next'),
    detailEl: byId<HTMLElement>('admin-images-detail')
  };
  const controlState = queryAdminDomControls(controls, {
    bootstrapEl: '#admin-images-bootstrap',
    formEl: '#admin-images-form',
    filtersPanelEl: '#admin-images-filters',
    filterToggleBtn: '#admin-images-filter-toggle',
    groupsWrapEl: '#admin-images-groups-wrap',
    groupsEl: '#admin-images-groups',
    subgroupsWrapEl: '#admin-images-subgroups-wrap',
    subgroupsEl: '#admin-images-subgroups',
    searchPanelEl: '#admin-images-search-panel',
    searchToggleBtn: '#admin-images-search-toggle',
    queryInput: '#admin-images-query',
    recentBtn: '#admin-images-recent',
    refreshBtn: '#admin-images-refresh',
    listViewBtn: '#admin-images-view-list',
    gridViewBtn: '#admin-images-view-grid',
    statusLiveEl: '#admin-images-status-live',
    statusEl: '#admin-images-status',
    pageMetaEl: '#admin-images-page-meta',
    resultListEl: '#admin-images-result-list',
    emptyEl: '#admin-images-empty',
    prevBtn: '#admin-images-prev',
    nextBtn: '#admin-images-next',
    detailEl: '#admin-images-detail'
  });

  if (!controlState.ok) {
    reportAdminDomSetupError({
      prefix: '[admin-images]',
      missing: controlState.missing,
      statusEl: controlState.controls.statusEl,
      statusLiveEl: controlState.controls.statusLiveEl
    });
    return;
  }
  const {
    bootstrapEl,
    formEl,
    filtersPanelEl,
    filterToggleBtn,
    groupsWrapEl,
    groupsEl,
    subgroupsWrapEl,
    subgroupsEl,
    searchPanelEl,
    searchToggleBtn,
    queryInput,
    recentBtn,
    refreshBtn,
    listViewBtn,
    gridViewBtn,
    statusLiveEl,
    statusEl,
    pageMetaEl,
    resultListEl,
    emptyEl,
    prevBtn,
    nextBtn,
    detailEl
  } = controlState.controls;

  const bootstrap = parseBootstrap(bootstrapEl.textContent ?? '');
  if (!bootstrap) {
    statusEl.dataset.state = 'error';
    statusEl.textContent = '图库初始化失败';
    statusLiveEl.textContent = '图库初始化失败';
    return;
  }

  const hasLocalBrowse = Array.isArray(bootstrap.browseIndex);
  let busy = false;
  let requestToken = 0;
  let currentTotalPages = 1;
  let currentTotalCount = 0;
  let currentItems: AdminImageBrowseItem[] = [];
  let currentGroupOptions: AdminImageFilterOption[] = [];
  let currentSubgroupOptions: AdminImageFilterOption[] = [];
  let selectedPath: string | null = null;
  const detailMetaCache = new Map<string, AdminImageClientMeta>();
  const detailMetaErrors = new Map<string, string>();
  const detailMetaPending = new Set<string>();
  let currentState: AdminImageState = {
    scope: bootstrap.initialState.scope === 'recent' ? 'recent' : DEFAULT_SCOPE,
    group: bootstrap.initialState.group,
    subgroup: bootstrap.initialState.group === DEFAULT_GROUP ? '' : bootstrap.initialState.subgroup,
    query: bootstrap.initialState.query,
    page: bootstrap.initialState.page
  };
  let filtersOpen = currentState.scope === DEFAULT_SCOPE
    && (currentState.group !== DEFAULT_GROUP || currentState.subgroup.trim().length > 0);
  let currentViewMode: AdminImageViewMode = 'grid';
  let searchOpen = currentState.query.trim().length > 0;
  let draftQuery = currentState.query;
  const mobileGridViewQuery = window.matchMedia('(max-width: 560px)');
  const icons = {
    copy: getIconMarkup('copy'),
    link: getIconMarkup('link'),
    eye: getIconMarkup('eye'),
    trash: getIconMarkup('trash')
  };

  const getCurrentPageSize = (): number =>
    currentViewMode === 'list'
      ? LIST_VIEW_PAGE_SIZE
      : mobileGridViewQuery.matches
        ? MOBILE_GRID_VIEW_PAGE_SIZE
        : GRID_VIEW_PAGE_SIZE;

  let currentPageSize = getCurrentPageSize();

  const resolvePageForPageSizeChange = ({
    page,
    previousPageSize,
    nextPageSize
  }: {
    page: number;
    previousPageSize: number;
    nextPageSize: number;
  }): number => {
    const safePreviousPageSize = Math.max(1, previousPageSize);
    const safeNextPageSize = Math.max(1, nextPageSize);
    const firstVisibleItemIndex = Math.max(0, (Math.max(1, page) - 1) * safePreviousPageSize);
    return Math.floor(firstVisibleItemIndex / safeNextPageSize) + 1;
  };

  const setStatus = (
    state: 'idle' | 'loading' | 'ok' | 'warn' | 'error',
    message: string,
    announce = true
  ) => {
    statusEl.dataset.state = state;
    statusEl.textContent = message;
    if (announce) {
      statusLiveEl.textContent = message;
    }
  };

  const focusSearchInput = (select = false) => {
    window.requestAnimationFrame(() => {
      queryInput.focus();
      if (select) {
        queryInput.select();
      }
    });
  };

  const hasBrowseFilters = () =>
    currentState.scope === DEFAULT_SCOPE
    && (currentState.group !== DEFAULT_GROUP || currentState.subgroup.trim().length > 0);

  const withoutCloudGroupOption = (options: readonly AdminImageFilterOption[]): AdminImageFilterOption[] =>
    options.filter((option) => option.value !== 'cloud');

  const renderCurrentItems = () => {
    renderItems({
      resultListEl,
      emptyEl,
      items: currentItems,
      selectedPath,
      detailMetaCache
    });
  };

  const renderCurrentDetail = () => {
    const item = currentItems.find((entry) => entry.path === selectedPath) ?? null;
    renderDetail({
      detailEl,
      item,
      detailMeta: item ? detailMetaCache.get(item.path) ?? null : null,
      detailError: item ? detailMetaErrors.get(item.path) ?? null : null,
      detailLoading: item ? detailMetaPending.has(item.path) : false,
      copyIcon: icons.copy,
      linkIcon: icons.link,
      eyeIcon: icons.eye,
      trashIcon: icons.trash,
      largeFileThreshold: LARGE_FILE_THRESHOLD
    });
  };

  const syncViewMode = () => {
    resultListEl.dataset.view = currentViewMode;
    listViewBtn.dataset.active = currentViewMode === 'list' ? 'true' : 'false';
    gridViewBtn.dataset.active = currentViewMode === 'grid' ? 'true' : 'false';
    listViewBtn.setAttribute('aria-pressed', currentViewMode === 'list' ? 'true' : 'false');
    gridViewBtn.setAttribute('aria-pressed', currentViewMode === 'grid' ? 'true' : 'false');
  };

  const renderCurrentGroupButtons = () => {
    renderGroupButtons({
      groupsWrapEl,
      groupsEl,
      visible: currentState.scope === DEFAULT_SCOPE,
      currentGroup: currentState.group,
      busy,
      groupOptions: currentGroupOptions,
      onSelect: (group) => {
        if (busy) return;
        if (currentState.group === group && currentState.page === 1 && !currentState.subgroup) {
          return;
        }
        currentState = {
          scope: DEFAULT_SCOPE,
          group,
          subgroup: '',
          query: currentState.query,
          page: 1
        };
        applyCurrentState({ updateLocation: true });
      }
    });
  };

  const renderCurrentSubgroupButtons = () => {
    renderSubgroupButtons({
      subgroupsWrapEl,
      subgroupsEl,
      visible: currentState.scope === DEFAULT_SCOPE
        && currentState.group !== DEFAULT_GROUP
        && currentSubgroupOptions.length > 0,
      currentSubgroup: currentState.subgroup,
      busy,
      subgroupOptions: currentSubgroupOptions,
      onSelectAll: () => {
        if (busy || currentState.subgroup.length === 0) return;
        currentState = {
          ...currentState,
          subgroup: '',
          page: 1
        };
        applyCurrentState({ updateLocation: true });
      },
      onSelect: (subgroup) => {
        if (busy || currentState.subgroup === subgroup) return;
        currentState = {
          ...currentState,
          subgroup,
          page: 1
        };
        applyCurrentState({ updateLocation: true });
      }
    });
  };

  const syncControls = () => {
    const searchVisible = searchOpen;
    const filterVisible = filtersOpen && currentState.scope === DEFAULT_SCOPE;
    const filtered = hasBrowseFilters();

    queryInput.value = draftQuery;
    queryInput.disabled = busy;
    queryInput.tabIndex = searchVisible ? 0 : -1;
    filterToggleBtn.disabled = busy || currentState.scope !== DEFAULT_SCOPE;
    filterToggleBtn.dataset.active = filterVisible ? 'true' : 'false';
    filterToggleBtn.dataset.filtered = filtered ? 'true' : 'false';
    filterToggleBtn.setAttribute('aria-expanded', filterVisible ? 'true' : 'false');
    filterToggleBtn.setAttribute('aria-label', filterVisible ? '收起图片筛选' : '展开图片筛选');
    filtersPanelEl.hidden = !filterVisible;
    filtersPanelEl.dataset.open = filterVisible ? 'true' : 'false';
    filtersPanelEl.setAttribute('aria-hidden', filterVisible ? 'false' : 'true');
    searchToggleBtn.disabled = busy;
    searchPanelEl.dataset.open = searchVisible ? 'true' : 'false';
    searchPanelEl.setAttribute('aria-hidden', searchVisible ? 'false' : 'true');
    searchToggleBtn.dataset.active = searchVisible ? 'true' : 'false';
    searchToggleBtn.setAttribute('aria-expanded', searchVisible ? 'true' : 'false');
    recentBtn.disabled = busy;
    recentBtn.textContent = currentState.scope === 'recent' ? '返回分类' : ADMIN_IMAGE_SCOPE_LABELS.recent;
    recentBtn.setAttribute('aria-pressed', currentState.scope === 'recent' ? 'true' : 'false');
    refreshBtn.disabled = busy;
    listViewBtn.disabled = busy;
    gridViewBtn.disabled = busy;
    prevBtn.disabled = busy || currentState.page <= 1;
    nextBtn.disabled = busy || currentState.page >= currentTotalPages;
    formEl.dataset.busy = busy ? 'true' : 'false';
    resultListEl.dataset.busy = busy ? 'true' : 'false';
    syncViewMode();
    renderCurrentGroupButtons();
    renderCurrentSubgroupButtons();
  };

  const syncSummary = () => {
    pageMetaEl.textContent = `${currentState.page} / ${currentTotalPages}`;
  };

  const resolveSelectedPath = (
    items: readonly AdminImageBrowseItem[],
    candidate: string | null
  ): string | null => {
    if (candidate && items.some((item) => item.path === candidate)) {
      return candidate;
    }
    return items[0]?.path ?? null;
  };

  const commitResolvedState = ({
    nextState,
    items,
    groupOptions,
    subgroupOptions,
    totalCount,
    totalPages,
    updateLocation,
    listMetaItems,
    selectedPathOverride,
    ensureSelectedMeta = true
  }: {
    nextState: AdminImageState;
    items: AdminImageBrowseItem[];
    groupOptions: AdminImageFilterOption[];
    subgroupOptions: AdminImageFilterOption[];
    totalCount: number;
    totalPages: number;
    updateLocation: boolean;
    listMetaItems?: readonly AdminImageListItem[];
    selectedPathOverride?: string | null;
    ensureSelectedMeta?: boolean;
  }) => {
    currentTotalPages = totalPages;
    currentTotalCount = totalCount;
    currentGroupOptions = groupOptions;
    currentSubgroupOptions = subgroupOptions;
    if (listMetaItems) {
      listMetaItems.forEach((item) => {
        detailMetaCache.set(item.path, toCachedMeta(item));
        detailMetaErrors.delete(item.path);
      });
    }
    currentItems = items;
    currentState = nextState;
    draftQuery = currentState.query;
    selectedPath = selectedPathOverride ?? resolveSelectedPath(items, selectedPath);
    if (updateLocation) {
      updateUrl(currentState);
    }
    syncControls();
    renderCurrentItems();
    renderCurrentDetail();
    syncSummary();
    if (ensureSelectedMeta) {
      ensureDetailMeta(selectedPath);
    }
  };

  const applyListResult = (
    result: AdminImageListResponse,
    { updateLocation }: { updateLocation: boolean }
  ) => {
    const nextScope = result.scope;
    commitResolvedState({
      nextState: {
        scope: nextScope,
        group: nextScope ? currentState.group : result.group || DEFAULT_GROUP,
        subgroup: nextScope
          ? currentState.subgroup
          : result.group === DEFAULT_GROUP ? '' : result.subgroup,
        query: currentState.query.trim(),
        page: result.page
      },
      items: result.items.map(toBrowseItem),
      groupOptions: result.groupOptions,
      subgroupOptions: result.subgroupOptions,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      updateLocation,
      listMetaItems: result.items
    });
  };

  const loadDetailMeta = async (
    assetPath: string,
    { syncUi = true }: { syncUi?: boolean } = {}
  ): Promise<void> => {
    if (!assetPath || detailMetaCache.has(assetPath) || detailMetaPending.has(assetPath)) {
      return;
    }

    detailMetaErrors.delete(assetPath);
    detailMetaPending.add(assetPath);
    if (syncUi && selectedPath === assetPath) {
      renderCurrentDetail();
    }

    try {
      const meta = await fetchMetaByPath(bootstrap.metaEndpoint, assetPath);
      detailMetaCache.set(assetPath, meta);
      detailMetaErrors.delete(assetPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片信息读取失败';
      detailMetaErrors.set(assetPath, message);
      if (syncUi && selectedPath === assetPath) {
        setStatus('warn', message);
      }
    } finally {
      detailMetaPending.delete(assetPath);
      if (syncUi) {
        if (currentItems.some((item) => item.path === assetPath)) {
          syncRenderedCardMeta({
            resultListEl,
            items: currentItems,
            assetPath,
            detailMetaCache
          });
        }
        if (selectedPath === assetPath) {
          renderCurrentDetail();
        }
      }
    }
  };

  const ensureDetailMeta = (assetPath: string | null) => {
    if (!assetPath) return;
    void loadDetailMeta(assetPath);
  };

  const getListViewMetaPrefetchPaths = ({
    items,
    nextSelectedPath
  }: {
    items: readonly AdminImageBrowseItem[];
    nextSelectedPath: string | null;
  }): string[] => {
    if (currentViewMode !== 'list') {
      return [];
    }

    const orderedPaths = nextSelectedPath
      ? [nextSelectedPath, ...items.map((item) => item.path)]
      : items.map((item) => item.path);

    return orderedPaths.filter((assetPath, index, paths) =>
      assetPath.length > 0
      && !detailMetaCache.has(assetPath)
      && !detailMetaPending.has(assetPath)
      && paths.indexOf(assetPath) === index
    );
  };

  const applyResolvedLocalState = async ({
    nextState,
    items,
    groupOptions,
    subgroupOptions,
    totalCount,
    totalPages,
    updateLocation,
    successMessage
  }: {
    nextState: AdminImageState;
    items: AdminImageBrowseItem[];
    groupOptions: AdminImageFilterOption[];
    subgroupOptions: AdminImageFilterOption[];
    totalCount: number;
    totalPages: number;
    updateLocation: boolean;
    successMessage: string;
  }) => {
    const nextSelectedPath = resolveSelectedPath(items, selectedPath);
    const prefetchPaths = getListViewMetaPrefetchPaths({
      items,
      nextSelectedPath
    });
    const shouldPrefetch = prefetchPaths.length > 0;

    if (shouldPrefetch) {
      busy = true;
      syncControls();
      setStatus('loading', '正在读取当前页图片信息...', false);
      await Promise.all(prefetchPaths.map((assetPath) => loadDetailMeta(assetPath, { syncUi: false })));
    }

    commitResolvedState({
      nextState,
      items,
      groupOptions,
      subgroupOptions,
      totalCount,
      totalPages,
      updateLocation,
      selectedPathOverride: nextSelectedPath,
      ensureSelectedMeta: currentViewMode !== 'list'
    });
    setStatus('ok', successMessage, false);

    if (shouldPrefetch) {
      busy = false;
      syncControls();
    }
  };

  const applyBrowseState = async ({ updateLocation }: { updateLocation: boolean }) => {
    if (!bootstrap.browseIndex) return;

    const browsePage = resolveAdminImageBrowsePage({
      items: bootstrap.browseIndex,
      group: currentState.group,
      subgroup: currentState.subgroup,
      query: currentState.query,
      page: currentState.page,
      limit: getCurrentPageSize()
    });

    await applyResolvedLocalState({
      nextState: {
        scope: DEFAULT_SCOPE,
        group: browsePage.activeGroup,
        subgroup: browsePage.activeGroup === DEFAULT_GROUP ? '' : browsePage.activeSubgroup,
        query: browsePage.query,
        page: browsePage.page
      },
      items: browsePage.items,
      groupOptions: withoutCloudGroupOption(browsePage.groupOptions),
      subgroupOptions: browsePage.subgroupOptions,
      totalCount: browsePage.totalCount,
      totalPages: browsePage.totalPages,
      updateLocation,
      successMessage: browsePage.totalCount > 0 ? `已匹配 ${browsePage.totalCount} 张图片` : '没有找到符合条件的图片'
    });
  };

  const clearLoadFailure = (message: string) => {
    currentItems = [];
    selectedPath = null;
    currentTotalPages = 1;
    currentGroupOptions = [];
    currentSubgroupOptions = [];
    renderCurrentGroupButtons();
    renderCurrentSubgroupButtons();
    renderCurrentItems();
    renderCurrentDetail();
    syncSummary();
    setStatus('error', message);
  };

  const loadList = async ({ updateLocation }: { updateLocation: boolean }) => {
    const token = ++requestToken;
    busy = true;
    syncControls();
    setStatus('loading', '正在加载图片...', false);

    try {
      const result = await fetchList(bootstrap.listEndpoint, currentState, getCurrentPageSize());
      if (token !== requestToken) return;

      applyListResult(result, { updateLocation });
      setStatus('ok', result.totalCount > 0 ? `已加载 ${result.totalCount} 张图片` : '没有找到符合条件的图片', false);
    } catch (error) {
      if (token !== requestToken) return;
      clearLoadFailure(error instanceof Error ? error.message : '图片列表读取失败');
    } finally {
      if (token === requestToken) {
        busy = false;
        syncControls();
      }
    }
  };

  const applyCurrentState = ({ updateLocation }: { updateLocation: boolean }) => {
    if (currentState.scope) {
      void loadList({ updateLocation });
      return;
    }
    if (hasLocalBrowse) {
      void applyBrowseState({ updateLocation });
      return;
    }
    void loadList({ updateLocation });
  };

  const setViewMode = (viewMode: AdminImageViewMode) => {
    if (currentViewMode === viewMode) return;
    currentViewMode = viewMode;
    currentPageSize = getCurrentPageSize();
    currentState = {
      ...currentState,
      page: 1
    };
    applyCurrentState({ updateLocation: true });
  };

  const submitCurrentState = () => {
    const nextQuery = draftQuery.trim();
    currentState = {
      ...currentState,
      query: nextQuery,
      page: 1
    };
    draftQuery = nextQuery;
    searchOpen = nextQuery.length > 0;
    applyCurrentState({ updateLocation: true });
  };

  const clearCurrentSearch = () => {
    draftQuery = '';
    currentState = {
      ...currentState,
      query: '',
      page: 1
    };
    searchOpen = false;
    applyCurrentState({ updateLocation: true });
  };

  const reloadAfterPageSizeChange = () => {
    const previousPageSize = currentPageSize;
    const nextPageSize = getCurrentPageSize();
    if (nextPageSize === previousPageSize) return;

    currentPageSize = nextPageSize;
    currentState = {
      ...currentState,
      page: resolvePageForPageSizeChange({
        page: currentState.page,
        previousPageSize,
        nextPageSize
      })
    };
    applyCurrentState({ updateLocation: true });
  };

  const triggerInlineCopyFeedback = (button: HTMLButtonElement, copyLabel: string) => {
    const existingTimer = Number(button.dataset.feedbackTimer ?? '');
    if (Number.isFinite(existingTimer) && existingTimer > 0) {
      window.clearTimeout(existingTimer);
    }

    button.dataset.state = 'copied';
    button.setAttribute('aria-label', `已复制${copyLabel}`);
    button.setAttribute('title', `已复制${copyLabel}`);

    const timer = window.setTimeout(() => {
      if (!button.isConnected) return;
      delete button.dataset.state;
      delete button.dataset.feedbackTimer;
      button.setAttribute('aria-label', `复制${copyLabel}`);
      button.setAttribute('title', '点击复制');
    }, 1100);

    button.dataset.feedbackTimer = String(timer);
  };

  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    if (busy) return;
    submitCurrentState();
  });

  queryInput.addEventListener('input', () => {
    draftQuery = queryInput.value;
  });

  filterToggleBtn.addEventListener('click', () => {
    if (busy || currentState.scope !== DEFAULT_SCOPE) return;
    filtersOpen = !filtersOpen;
    syncControls();
  });

  searchToggleBtn.addEventListener('click', () => {
    if (busy) return;
    const draft = draftQuery.trim();
    const committed = currentState.query.trim();

    if (!searchOpen) {
      searchOpen = true;
      syncControls();
      focusSearchInput(true);
      return;
    }

    if (!draft && committed) {
      clearCurrentSearch();
      return;
    }

    if (draft !== committed) {
      submitCurrentState();
      return;
    }

    if (committed) {
      focusSearchInput(true);
      return;
    }

    searchOpen = false;
    syncControls();
    searchToggleBtn.focus();
  });

  queryInput.addEventListener('search', () => {
    if (busy) return;
    formEl.requestSubmit();
  });

  queryInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || busy) return;
    if (draftQuery.trim() || currentState.query.trim()) {
      event.preventDefault();
      clearCurrentSearch();
      return;
    }
    event.preventDefault();
    searchOpen = false;
    syncControls();
    searchToggleBtn.focus();
  });

  refreshBtn.addEventListener('click', () => {
    if (busy) return;
    navigateToRefresh({ resetState: true });
  });

  listViewBtn.addEventListener('click', () => {
    if (busy) return;
    setViewMode('list');
  });

  gridViewBtn.addEventListener('click', () => {
    if (busy) return;
    setViewMode('grid');
  });

  recentBtn.addEventListener('click', () => {
    if (busy) return;
    currentState = {
      ...currentState,
      scope: currentState.scope === 'recent' ? DEFAULT_SCOPE : 'recent',
      page: 1
    };
    applyCurrentState({ updateLocation: true });
  });

  resultListEl.addEventListener('click', (event) => {
    if (busy) return;
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>('[data-path]') : null;
    const nextPath = target?.dataset.path?.trim() ?? '';
    if (!nextPath || nextPath === selectedPath) return;
    const previousPath = selectedPath;
    selectedPath = nextPath;
    syncRenderedSelection({
      resultListEl,
      previousPath,
      nextPath: selectedPath
    });
    renderCurrentDetail();
    ensureDetailMeta(selectedPath);
  });

  detailEl.addEventListener('click', async (event) => {
    const deleteTarget = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('[data-cloud-delete-key]')
      : null;
    if (deleteTarget instanceof HTMLButtonElement) {
      if (busy) return;
      const key = deleteTarget.dataset.cloudDeleteKey?.trim() ?? '';
      const label = deleteTarget.dataset.cloudDeleteLabel?.trim() || '该云端图片';
      if (!key) {
        setStatus('error', '云端图片 key 为空，无法删除');
        return;
      }
      if (!window.confirm(`确定删除云端图片「${label}」吗？如果文章或页面仍引用这个 URL，已发布内容中的图片会失效。`)) {
        return;
      }

      busy = true;
      syncControls();
      setStatus('loading', '正在删除云端图片...');
      try {
        await deleteCloudImage(bootstrap.cloudDeleteEndpoint, key);
        selectedPath = null;
        detailMetaCache.clear();
        detailMetaErrors.clear();
        detailMetaPending.clear();
        setStatus('ok', '云端图片已删除，正在刷新图库');
        await loadList({ updateLocation: true });
      } catch (error) {
        setStatus('error', error instanceof Error ? error.message : '云端图片删除失败');
      } finally {
        busy = false;
        syncControls();
      }
      return;
    }

    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-copy-value]') : null;
    if (!(target instanceof HTMLButtonElement)) return;

    const copyValue = target.dataset.copyValue ?? '';
    const copyLabel = target.dataset.copyLabel?.trim() ?? '内容';
    if (!copyValue) {
      setStatus('error', `${copyLabel}为空，无法复制`);
      return;
    }

    try {
      await copyText(copyValue);
      setStatus('ok', `已复制${copyLabel}`);
      if (target.dataset.inlineFeedback === 'true') {
        triggerInlineCopyFeedback(target, copyLabel);
      }
    } catch (error) {
      setStatus('error', error instanceof Error ? error.message : `复制${copyLabel}失败`);
    }
  });

  prevBtn.addEventListener('click', () => {
    if (busy || currentState.page <= 1) return;
    currentState = {
      ...currentState,
      page: currentState.page - 1
    };
    applyCurrentState({ updateLocation: true });
  });

  nextBtn.addEventListener('click', () => {
    if (busy || currentState.page >= currentTotalPages) return;
    currentState = {
      ...currentState,
      page: currentState.page + 1
    };
    applyCurrentState({ updateLocation: true });
  });

  mobileGridViewQuery.addEventListener('change', reloadAfterPageSizeChange);

  if (hasLocalBrowse) {
    syncControls();
    applyCurrentState({ updateLocation: false });
    if (bootstrap.didRefresh) {
      const resetToDefaultView = currentState.scope === DEFAULT_SCOPE
        && currentState.group === DEFAULT_GROUP
        && currentState.subgroup.length === 0
        && currentState.query.trim().length === 0
        && currentState.page === 1;
      updateUrl(currentState);
      setStatus(
        'ok',
        resetToDefaultView
          ? (currentTotalCount > 0 ? `图库已刷新，已返回全部资源（共 ${currentTotalCount} 张图片）` : '图库已刷新，已返回全部资源')
          : (currentTotalCount > 0 ? `图库已刷新，当前共 ${currentTotalCount} 张图片` : '图库已刷新')
      );
    }
  } else {
    syncControls();
    syncSummary();
    void loadList({ updateLocation: true });
  }
};
