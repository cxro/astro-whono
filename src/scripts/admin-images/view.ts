import { formatAdminImageBytes, type AdminImageClientMeta } from '../admin-shared/image-client';
import { type AdminImageBrowseItem, type AdminImageFilterOption } from './types';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const getOriginBadgeLabel = (origin: AdminImageBrowseItem['origin']): string => {
  if (origin === 'public') return '公开资源';
  if (origin === 'src/assets') return '站点素材';
  return '内容附件';
};

const getCardOverlayMetaText = (
  item: AdminImageBrowseItem,
  detailMetaCache: ReadonlyMap<string, AdminImageClientMeta>
): string => {
  const detailMeta = detailMetaCache.get(item.path);
  if (!detailMeta?.width || !detailMeta.height) {
    return '';
  }

  const dimensions = `${detailMeta.width} × ${detailMeta.height}`;
  if (!detailMeta.size || detailMeta.size <= 0) {
    return dimensions;
  }

  return `${dimensions} · ${formatAdminImageBytes(detailMeta.size)}`;
};

const getItemMetaText = (
  item: AdminImageBrowseItem,
  detailMetaCache: ReadonlyMap<string, AdminImageClientMeta>,
  { includeOwner = true }: { includeOwner?: boolean } = {}
): string => {
  const metaParts = [
    item.browseGroupLabel,
    item.browseSubgroupLabel && item.browseSubgroupLabel !== item.ownerLabel
      ? item.browseSubgroupLabel
      : '',
    includeOwner && item.ownerLabel ? `Owner: ${item.ownerLabel}` : '',
    getCardOverlayMetaText(item, detailMetaCache)
  ];
  return metaParts.filter((part) => part.trim().length > 0).join(' · ');
};

const getCardDescriptionText = (
  item: AdminImageBrowseItem,
  detailMetaCache: ReadonlyMap<string, AdminImageClientMeta>
): string => {
  const descriptionParts = [
    getOriginBadgeLabel(item.origin),
    getItemMetaText(item, detailMetaCache)
  ];
  return descriptionParts.filter((part) => part.trim().length > 0).join(' · ');
};

const getFilterOptionCount = (options: readonly AdminImageFilterOption[]): number =>
  options.reduce((total, option) => total + option.count, 0);

const createChipButton = (
  option: Pick<AdminImageFilterOption, 'label' | 'count'>,
  active: boolean,
  disabled: boolean,
  onClick: () => void
): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `admin-images-browser__chip${active ? ' admin-images-browser__chip--active' : ''}`;
  button.disabled = disabled;
  button.setAttribute('aria-pressed', active ? 'true' : 'false');

  const label = document.createElement('span');
  label.textContent = option.label;
  button.append(label);

  const count = document.createElement('span');
  count.className = 'admin-images-browser__chip-count';
  count.textContent = String(option.count);
  button.append(count);

  button.addEventListener('click', onClick);
  return button;
};

export const renderGroupButtons = ({
  groupsWrapEl,
  groupsEl,
  visible,
  currentGroup,
  busy,
  groupOptions,
  onSelect
}: {
  groupsWrapEl: HTMLDivElement;
  groupsEl: HTMLDivElement;
  visible: boolean;
  currentGroup: string;
  busy: boolean;
  groupOptions: readonly AdminImageFilterOption[];
  onSelect: (group: string) => void;
}) => {
  groupsWrapEl.hidden = !visible;
  groupsEl.replaceChildren();
  if (!visible) {
    return;
  }

  groupOptions.forEach((option) => {
    groupsEl.append(
      createChipButton(option, currentGroup === option.value, busy, () => onSelect(option.value))
    );
  });
};

export const renderSubgroupButtons = ({
  subgroupsWrapEl,
  subgroupsEl,
  visible,
  currentSubgroup,
  busy,
  subgroupOptions,
  onSelectAll,
  onSelect
}: {
  subgroupsWrapEl: HTMLDivElement;
  subgroupsEl: HTMLDivElement;
  visible: boolean;
  currentSubgroup: string;
  busy: boolean;
  subgroupOptions: readonly AdminImageFilterOption[];
  onSelectAll: () => void;
  onSelect: (subgroup: string) => void;
}) => {
  subgroupsEl.replaceChildren();

  if (!visible) {
    subgroupsWrapEl.hidden = true;
    return;
  }

  subgroupsWrapEl.hidden = false;
  subgroupsEl.append(
    createChipButton(
      {
        label: '全部',
        count: getFilterOptionCount(subgroupOptions)
      },
      currentSubgroup.length === 0,
      busy,
      onSelectAll
    )
  );

  subgroupOptions.forEach((option) => {
    subgroupsEl.append(
      createChipButton(option, currentSubgroup === option.value, busy, () => onSelect(option.value))
    );
  });
};

export const renderItems = ({
  resultListEl,
  emptyEl,
  items,
  selectedPath,
  detailMetaCache
}: {
  resultListEl: HTMLUListElement;
  emptyEl: HTMLElement;
  items: readonly AdminImageBrowseItem[];
  selectedPath: string | null;
  detailMetaCache: ReadonlyMap<string, AdminImageClientMeta>;
}) => {
  if (items.length === 0) {
    resultListEl.innerHTML = '';
    emptyEl.hidden = false;
    return;
  }

  const isGridView = resultListEl.dataset.view === 'grid';
  const includeOwnerInItemMeta = isGridView;
  emptyEl.hidden = true;
  resultListEl.innerHTML = items
    .map((item, index) => {
      const overlayMeta = isGridView ? getCardOverlayMetaText(item, detailMetaCache) : '';
      const itemMeta = getItemMetaText(item, detailMetaCache, {
        includeOwner: includeOwnerInItemMeta
      });
      const titleId = `admin-images-card-title-${index}`;
      const pathId = `admin-images-card-path-${index}`;
      const descriptionId = `admin-images-card-description-${index}`;
      const descriptionText = getCardDescriptionText(item, detailMetaCache);

      return `
        <li class="admin-images-browser__item-shell">
          <button
            class="admin-images-browser__card${selectedPath === item.path ? ' admin-images-browser__card--active' : ''}"
            type="button"
            data-path="${escapeHtml(item.path)}"
            aria-labelledby="${titleId} ${pathId}"
            aria-describedby="${descriptionId}"
            aria-pressed="${selectedPath === item.path ? 'true' : 'false'}"
            style="--item-index:${index};"
          >
            <span id="${titleId}" class="admin-sr-only">${escapeHtml(item.fileName)}</span>
            <span id="${pathId}" class="admin-sr-only">${escapeHtml(item.path)}</span>
            <span id="${descriptionId}" class="admin-sr-only admin-images-browser__card-description">${escapeHtml(descriptionText)}</span>
            <span class="admin-images-browser__thumb">
              ${item.previewSrc
            ? `<img src="${escapeHtml(item.previewSrc)}" alt="" loading="lazy" decoding="async" />`
            : '<span class="admin-images-browser__thumb-fallback">暂无预览</span>'}
              ${overlayMeta
            ? `
                  <span class="admin-images-browser__thumb-overlay" aria-hidden="true">
                    <span class="admin-images-browser__thumb-meta">${escapeHtml(overlayMeta)}</span>
                  </span>
                `
            : ''}
            </span>
            <span class="admin-images-browser__item-copy">
              <span class="admin-images-browser__item-head">
                <span class="admin-images-browser__item-title">${escapeHtml(item.fileName)}</span>
                <span class="admin-images-browser__item-badges">
                  <span class="admin-images-browser__badge admin-images-browser__origin-badge" data-origin="${escapeHtml(item.origin)}">${escapeHtml(getOriginBadgeLabel(item.origin))}</span>
                </span>
              </span>
              <span class="admin-images-browser__item-path">${escapeHtml(item.path)}</span>
              <span class="admin-images-browser__item-meta">${escapeHtml(itemMeta)}</span>
            </span>
          </button>
        </li>
      `;
    })
    .join('');
};

const getRenderedCard = (resultListEl: HTMLUListElement, assetPath: string): HTMLButtonElement | null =>
  Array.from(resultListEl.querySelectorAll<HTMLButtonElement>('[data-path]')).find(
    (button) => button.dataset.path === assetPath
  ) ?? null;

export const syncRenderedSelection = ({
  resultListEl,
  previousPath,
  nextPath
}: {
  resultListEl: HTMLUListElement;
  previousPath: string | null;
  nextPath: string | null;
}) => {
  if (previousPath) {
    const previousCard = getRenderedCard(resultListEl, previousPath);
    previousCard?.classList.remove('admin-images-browser__card--active');
    previousCard?.setAttribute('aria-pressed', 'false');
  }
  if (nextPath) {
    const nextCard = getRenderedCard(resultListEl, nextPath);
    nextCard?.classList.add('admin-images-browser__card--active');
    nextCard?.setAttribute('aria-pressed', 'true');
  }
};

export const syncRenderedCardMeta = ({
  resultListEl,
  items,
  assetPath,
  detailMetaCache
}: {
  resultListEl: HTMLUListElement;
  items: readonly AdminImageBrowseItem[];
  assetPath: string;
  detailMetaCache: ReadonlyMap<string, AdminImageClientMeta>;
}) => {
  const item = items.find((entry) => entry.path === assetPath);
  if (!item) return;

  const card = getRenderedCard(resultListEl, assetPath);
  if (!(card instanceof HTMLButtonElement)) return;

  const isGridView = resultListEl.dataset.view === 'grid';
  const includeOwnerInItemMeta = isGridView;
  const itemMeta = card.querySelector<HTMLElement>('.admin-images-browser__item-meta');
  if (itemMeta instanceof HTMLElement) {
    itemMeta.textContent = getItemMetaText(item, detailMetaCache, {
      includeOwner: includeOwnerInItemMeta
    });
  }

  const cardDescription = card.querySelector<HTMLElement>('.admin-images-browser__card-description');
  if (cardDescription instanceof HTMLElement) {
    cardDescription.textContent = getCardDescriptionText(item, detailMetaCache);
  }

  const thumb = card.querySelector<HTMLElement>('.admin-images-browser__thumb');
  if (!(thumb instanceof HTMLElement)) return;

  const overlayMeta = isGridView ? getCardOverlayMetaText(item, detailMetaCache) : '';
  const overlay = thumb.querySelector<HTMLElement>('.admin-images-browser__thumb-overlay');
  if (!overlayMeta) {
    overlay?.remove();
    return;
  }

  if (overlay instanceof HTMLElement) {
    const metaEl = overlay.querySelector<HTMLElement>('.admin-images-browser__thumb-meta');
    if (metaEl instanceof HTMLElement) {
      metaEl.textContent = overlayMeta;
      return;
    }
  }

  const nextOverlay = document.createElement('span');
  nextOverlay.className = 'admin-images-browser__thumb-overlay';
  nextOverlay.setAttribute('aria-hidden', 'true');

  const metaEl = document.createElement('span');
  metaEl.className = 'admin-images-browser__thumb-meta';
  metaEl.textContent = overlayMeta;

  nextOverlay.append(metaEl);
  overlay?.remove();
  thumb.append(nextOverlay);
};

export const renderDetail = ({
  detailEl,
  item,
  detailMeta,
  detailError,
  detailLoading,
  copyIcon,
  linkIcon,
  eyeIcon,
  largeFileThreshold
}: {
  detailEl: HTMLElement;
  item: AdminImageBrowseItem | null;
  detailMeta: AdminImageClientMeta | null;
  detailError: string | null;
  detailLoading: boolean;
  copyIcon: string;
  linkIcon: string;
  eyeIcon: string;
  largeFileThreshold: number;
}) => {
  if (!item) {
    detailEl.hidden = true;
    detailEl.innerHTML = '';
    return;
  }

  const dimensionsText = detailMeta?.width && detailMeta.height
    ? `${detailMeta.width} × ${detailMeta.height}`
    : detailLoading ? '正在读取…' : detailError ? '读取失败' : '未读取';
  const sizeText = detailMeta
    ? formatAdminImageBytes(detailMeta.size)
    : detailLoading ? '正在读取…' : detailError ? '读取失败' : '未读取';
  const typeText = detailMeta?.mimeType
    ?? (detailLoading ? '正在读取…' : detailError ? '读取失败' : '未读取');

  const detailBadges = [
    `<span class="admin-images-browser__badge admin-images-browser__origin-badge" data-origin="${escapeHtml(item.origin)}">${escapeHtml(getOriginBadgeLabel(item.origin))}</span>`,
    item.ownerLabel
      ? `<span class="admin-images-browser__badge">Owner: ${escapeHtml(item.ownerLabel)}</span>`
      : '',
    item.browseSubgroupLabel
      && item.browseSubgroupLabel !== item.ownerLabel
      ? `<span class="admin-images-browser__badge">${escapeHtml(item.browseSubgroupLabel)}</span>`
      : '',
    detailMeta?.size && detailMeta.size >= largeFileThreshold
      ? '<span class="admin-images-browser__badge">大文件</span>'
      : ''
  ]
    .filter(Boolean)
    .join('');

  const hasPreferredValue = item.preferredValue && item.preferredValue !== item.path;
  const fieldValue = hasPreferredValue ? item.preferredValue! : item.path;
  const fieldLabel = hasPreferredValue ? '可用值 (field-compatible)' : '文件路径';
  const fieldCopyLabel = hasPreferredValue ? '可用值' : '文件路径';
  const previewSrc = detailMeta?.previewSrc ?? item.previewSrc;

  detailEl.hidden = false;
  detailEl.innerHTML = `
    <div class="admin-images-browser__detail-layout">
      <div class="admin-images-browser__detail-media">
        ${previewSrc
      ? `<img src="${escapeHtml(previewSrc)}" alt="${escapeHtml(item.fileName)}" loading="eager" decoding="async" />`
      : '<div class="admin-images-browser__detail-fallback">无预览</div>'}
      </div>

      <div class="admin-images-browser__detail-body">
        <div class="admin-images-browser__detail-header">
          <h3 class="admin-images-browser__detail-title">${escapeHtml(item.fileName)}</h3>
          <div class="admin-images-browser__detail-badges">${detailBadges}</div>
        </div>

        <dl class="admin-images-browser__detail-meta-list">
          <div><dt>Dimensions</dt><dd>${escapeHtml(dimensionsText)}</dd></div>
          <div><dt>Size</dt><dd>${escapeHtml(sizeText)}</dd></div>
          <div><dt>Type</dt><dd>${escapeHtml(typeText)}</dd></div>
        </dl>

        <div class="admin-images-browser__detail-field">
          <h4 class="admin-images-browser__detail-label">${escapeHtml(fieldLabel)}</h4>
          <div class="admin-images-browser__code-wrapper">
            <code class="admin-images-browser__detail-code">${escapeHtml(fieldValue)}</code>
            <button
              class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-images-copy-btn"
              type="button"
              data-copy-value="${escapeHtml(fieldValue)}"
              data-copy-label="${escapeHtml(fieldCopyLabel)}"
              data-inline-feedback="true"
              title="点击复制"
              aria-label="复制${escapeHtml(fieldCopyLabel)}"
            >${copyIcon}</button>
          </div>
        </div>

        <div class="admin-images-browser__detail-field">
          <h4 class="admin-images-browser__detail-label admin-images-browser__detail-label--disabled">Markdown 引用（待开发）</h4>
          <div class="admin-images-browser__code-wrapper admin-images-browser__code-wrapper--disabled" aria-disabled="true">
            <code class="admin-images-browser__detail-code">—</code>
          </div>
        </div>

        <div class="admin-images-browser__detail-actions">
          <button
            class="admin-btn admin-btn--primary"
            type="button"
            data-copy-value="${escapeHtml(item.path)}"
            data-copy-label="资源路径"
          >
            ${linkIcon}
            复制资源路径
          </button>
          ${previewSrc
        ? `<a class="admin-btn admin-btn--ghost" href="${escapeHtml(previewSrc)}" target="_blank" rel="noreferrer">
              ${eyeIcon}
              浏览器新标签中打开
            </a>`
        : ''}
        </div>
      </div>
    </div>
  `;
};
