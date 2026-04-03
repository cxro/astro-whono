export type AdminMediaPickerField =
  | 'bits.images'
  | 'home.heroImageSrc'
  | 'page.bits.defaultAuthor.avatar';

export type AdminMediaPickerItem = {
  path: string;
  value: string;
  origin: 'public' | 'src/assets' | 'src/content';
  fileName: string;
  width: number | null;
  height: number | null;
  size: number | null;
  mimeType: string | null;
  previewSrc: string | null;
};

export type AdminMediaPickerMeta = {
  kind: 'local' | 'remote';
  path: string | null;
  value: string;
  origin: 'public' | 'src/assets' | 'src/content' | null;
  width: number | null;
  height: number | null;
  size: number | null;
  mimeType: string | null;
  previewSrc: string | null;
};

type AdminMediaPickerOpenOptions = {
  field: AdminMediaPickerField;
  title: string;
  description?: string;
  query?: string;
  onSelect: (item: AdminMediaPickerItem) => void;
};

export type AdminMediaPickerController = {
  open: (options: AdminMediaPickerOpenOptions) => void;
  close: () => void;
  readMeta: (options: {
    field: AdminMediaPickerField;
    value?: string;
    path?: string;
  }) => Promise<AdminMediaPickerMeta>;
};

type AdminMediaListResponse = {
  items: AdminMediaPickerItem[];
  page: number;
  totalPages: number;
  totalCount: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const formatBytes = (size: number | null): string => {
  if (!size || size <= 0) return '大小未知';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const getOriginLabel = (origin: AdminMediaPickerMeta['origin']): string => {
  if (origin === 'public') return '公开资源';
  if (origin === 'src/assets') return '站点素材';
  if (origin === 'src/content') return '文章附件';
  return '本地资源';
};

export const formatAdminMediaMetaSummary = (meta: Pick<AdminMediaPickerMeta, 'kind' | 'origin' | 'width' | 'height' | 'size'>): string => {
  if (meta.kind === 'remote') {
    return '远程图片；不自动读取本地尺寸';
  }

  const originLabel = getOriginLabel(meta.origin);
  const sizeLabel = formatBytes(meta.size);
  if (meta.width && meta.height) {
    return `${originLabel} · ${meta.width}×${meta.height} · ${sizeLabel}`;
  }
  return `${originLabel} · 尺寸未知 · ${sizeLabel}`;
};

const getResponseErrors = (payload: unknown): string[] =>
  isRecord(payload) && Array.isArray(payload.errors)
    ? payload.errors.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

const parseListResponse = (payload: unknown): AdminMediaListResponse => {
  if (!isRecord(payload) || !isRecord(payload.result) || !Array.isArray(payload.result.items)) {
    throw new Error('媒体列表响应缺少 result.items');
  }

  return {
    items: payload.result.items.filter((item): item is AdminMediaPickerItem => isRecord(item) && typeof item.value === 'string'),
    page: typeof payload.result.page === 'number' ? payload.result.page : 1,
    totalPages: typeof payload.result.totalPages === 'number' ? payload.result.totalPages : 1,
    totalCount: typeof payload.result.totalCount === 'number' ? payload.result.totalCount : 0
  };
};

const parseMetaResponse = (payload: unknown): AdminMediaPickerMeta => {
  if (!isRecord(payload) || !isRecord(payload.result) || typeof payload.result.kind !== 'string') {
    throw new Error('媒体元数据响应缺少 result');
  }

  return payload.result as AdminMediaPickerMeta;
};

const fetchJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok || !isRecord(payload) || payload.ok !== true) {
    const errors = getResponseErrors(payload);
    throw new Error(errors[0] ?? '媒体接口请求失败');
  }
  return payload;
};

export const createAdminMediaPicker = (root: ParentNode = document): AdminMediaPickerController | null => {
  const dialog = root.querySelector<HTMLDialogElement>('[data-admin-media-picker]');
  if (!(dialog instanceof HTMLDialogElement)) return null;

  const listEndpoint = dialog.dataset.listEndpoint?.trim() ?? '';
  const metaEndpoint = dialog.dataset.metaEndpoint?.trim() ?? '';
  if (!listEndpoint || !metaEndpoint) return null;

  const titleEl = dialog.querySelector<HTMLElement>('[data-admin-media-picker-title]');
  const descriptionEl = dialog.querySelector<HTMLElement>('[data-admin-media-picker-description]');
  const queryInput = dialog.querySelector<HTMLInputElement>('[data-admin-media-picker-query]');
  const statusEl = dialog.querySelector<HTMLElement>('[data-admin-media-picker-status]');
  const resultsEl = dialog.querySelector<HTMLElement>('[data-admin-media-picker-results]');
  const pageEl = dialog.querySelector<HTMLElement>('[data-admin-media-picker-page]');
  const prevBtn = dialog.querySelector<HTMLButtonElement>('[data-admin-media-picker-prev]');
  const nextBtn = dialog.querySelector<HTMLButtonElement>('[data-admin-media-picker-next]');
  const closeBtn = dialog.querySelector<HTMLButtonElement>('[data-admin-media-picker-close]');
  if (
    !(titleEl instanceof HTMLElement)
    || !(descriptionEl instanceof HTMLElement)
    || !(queryInput instanceof HTMLInputElement)
    || !(statusEl instanceof HTMLElement)
    || !(resultsEl instanceof HTMLElement)
    || !(pageEl instanceof HTMLElement)
    || !(prevBtn instanceof HTMLButtonElement)
    || !(nextBtn instanceof HTMLButtonElement)
    || !(closeBtn instanceof HTMLButtonElement)
  ) {
    return null;
  }

  let currentOptions: AdminMediaPickerOpenOptions | null = null;
  let currentPage = 1;
  let totalPages = 1;
  let requestToken = 0;
  let searchTimer = 0;

  const syncPager = () => {
    pageEl.textContent = `第 ${currentPage} / ${totalPages} 页`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
  };

  const setStatus = (text: string) => {
    statusEl.textContent = text;
  };

  const renderItems = (items: readonly AdminMediaPickerItem[], totalCount: number) => {
    resultsEl.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('li');
      empty.className = 'admin-media-picker__empty';
      empty.textContent = '没有匹配到可选图片。';
      resultsEl.appendChild(empty);
      setStatus(totalCount > 0 ? '当前页没有结果' : '没有匹配结果');
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const row = document.createElement('li');
      row.className = 'admin-media-picker__item';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-media-picker__item-button';
      button.addEventListener('click', () => {
        currentOptions?.onSelect(item);
        dialog.close();
      });

      const media = document.createElement('span');
      media.className = 'admin-media-picker__thumb';
      if (item.previewSrc) {
        const image = document.createElement('img');
        image.src = item.previewSrc;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        media.appendChild(image);
      } else {
        const fallback = document.createElement('span');
        fallback.textContent = item.origin;
        media.appendChild(fallback);
      }

      const copy = document.createElement('span');
      copy.className = 'admin-media-picker__item-copy';

      const pathEl = document.createElement('span');
      pathEl.className = 'admin-media-picker__item-path';
      pathEl.textContent = item.value;

      const metaEl = document.createElement('span');
      metaEl.className = 'admin-media-picker__item-meta';
      metaEl.textContent = formatAdminMediaMetaSummary({
        kind: 'local',
        origin: item.origin,
        width: item.width,
        height: item.height,
        size: item.size
      });

      copy.append(pathEl, metaEl);
      button.append(media, copy);
      row.appendChild(button);
      fragment.appendChild(row);
    });

    resultsEl.appendChild(fragment);
    setStatus(`共 ${totalCount} 个可选文件`);
  };

  const loadList = async () => {
    if (!currentOptions) return;

    const token = ++requestToken;
    setStatus('正在加载媒体列表...');
    resultsEl.replaceChildren();

    const params = new URLSearchParams({
      field: currentOptions.field,
      page: String(currentPage),
      limit: '24'
    });
    const query = queryInput.value.trim();
    if (query) params.set('q', query);

    try {
      const payload = await fetchJson(`${listEndpoint}?${params.toString()}`);
      if (token !== requestToken) return;

      const result = parseListResponse(payload);
      currentPage = result.page;
      totalPages = result.totalPages;
      syncPager();
      renderItems(result.items, result.totalCount);
    } catch (error) {
      if (token !== requestToken) return;
      totalPages = 1;
      syncPager();
      resultsEl.replaceChildren();
      setStatus(error instanceof Error ? error.message : '媒体列表加载失败');
    }
  };

  const close = () => {
    if (dialog.open) dialog.close();
  };

  const open = (options: AdminMediaPickerOpenOptions) => {
    currentOptions = options;
    currentPage = 1;
    totalPages = 1;
    titleEl.textContent = options.title;

    const description = options.description?.trim() ?? '';
    descriptionEl.textContent = description;
    descriptionEl.hidden = !description;

    queryInput.value = options.query?.trim() ?? '';
    syncPager();
    if (!dialog.open) dialog.showModal();
    void loadList();
    window.setTimeout(() => {
      queryInput.focus();
      queryInput.select();
    }, 0);
  };

  const readMeta = async ({
    field,
    value,
    path
  }: {
    field: AdminMediaPickerField;
    value?: string;
    path?: string;
  }): Promise<AdminMediaPickerMeta> => {
    const params = new URLSearchParams();
    if (path?.trim()) {
      params.set('path', path.trim());
    } else {
      params.set('field', field);
      params.set('value', value?.trim() ?? '');
    }
    const payload = await fetchJson(`${metaEndpoint}?${params.toString()}`);
    return parseMetaResponse(payload);
  };

  closeBtn.addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  queryInput.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      currentPage = 1;
      void loadList();
    }, 180);
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

  syncPager();

  return {
    open,
    close,
    readMeta
  };
};
