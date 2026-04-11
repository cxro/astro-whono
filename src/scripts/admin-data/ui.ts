import type { AdminSettingsExportBundle } from '../../lib/admin-console/settings-data';
import type { AdminDataControls } from './controls';
import {
  GROUP_FILES,
  GROUP_LABELS,
  GROUP_ORDER,
  PREVIEW_BADGE_LABELS,
  getWriteResultChangedFieldCount,
  hasWriteResultChanges,
  type AdminDataStatusState,
  type PreviewState,
  type WriteFieldChange,
  type WriteResult,
  type WriteResultsMap
} from './shared';

type AdminDataErrorOptions = {
  title?: string;
  message?: string;
};

type AdminDataPreviewEmptyOptions = {
  state: PreviewState;
  title: string;
  body: string;
  badgeText?: string;
};

type AdminDataPreviewRenderOptions = {
  state: PreviewState;
  title?: string;
  body?: string;
  note?: string;
};

type AdminDataActionState = {
  busy: boolean;
  hasBundle: boolean;
  canApply: boolean;
  dryRunStepState: AdminDataActionButtonStepState;
  applyStepState: AdminDataActionButtonStepState;
};

type AdminDataActionButtonStepState = 'blocked' | 'ready' | 'running' | 'done';

type DropzoneMetaField = {
  label: string;
  value: string;
  wide?: boolean;
  compact?: boolean;
};

type ResultItemOptions = {
  marker?: string;
  titleBadge?: HTMLElement;
};

type ChangeValueRowKind = 'current' | 'imported';

const ACTION_PROGRESS_DELAY_MS = 320;
const CHANGE_MARKERS: Record<WriteFieldChange['kind'], string> = {
  added: '+',
  removed: '-',
  updated: '~'
};
const CHANGE_VALUE_ROW_MARKERS: Record<ChangeValueRowKind, string> = {
  current: '-',
  imported: '+'
};

export const createAdminDataUi = ({
  statusLiveEl,
  statusEl,
  errorBannerEl,
  errorTitleEl,
  errorMessageEl,
  errorListEl,
  exportBtn,
  fileInput,
  dropzoneEl,
  dropzoneTriggerBtn,
  dropzoneReselectBtn,
  dropzoneEmptyEl,
  dropzoneSummaryEl,
  dropzoneMetaEl,
  selectedFileEl,
  dryRunBtn,
  applyBtn,
  previewEl,
  previewBadgeEl,
  previewEmptyEl,
  previewEmptyTitleEl,
  previewEmptyBodyEl,
  previewContentEl,
  previewTitleEl,
  previewBodyEl,
  previewNoteEl,
  resultListEl
}: AdminDataControls) => {
  const pad2 = (value: number): string => String(value).padStart(2, '0');

  const formatLocalDateTime = (value: Date): string =>
    `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())} ${pad2(value.getHours())}:${pad2(value.getMinutes())}`;

  const formatUtcOffset = (offsetMinutes: number): string => {
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absoluteMinutes = Math.abs(offsetMinutes);
    const hours = Math.floor(absoluteMinutes / 60);
    const minutes = absoluteMinutes % 60;
    if (minutes === 0) {
      return `UTC${sign}${hours}`;
    }
    return `UTC${sign}${hours}:${pad2(minutes)}`;
  };

  const formatManifestCreatedAt = (value: string): string => {
    const normalized = value.trim();
    const date = new Date(normalized);
    if (!normalized || Number.isNaN(date.valueOf())) {
      return value;
    }

    const localOffsetMinutes = -date.getTimezoneOffset();
    return `${formatLocalDateTime(date)} (${formatUtcOffset(localOffsetMinutes)})`;
  };

  const setStatus = (
    state: AdminDataStatusState,
    text: string,
    options: {
      announce?: boolean;
    } = {}
  ) => {
    const { announce = true } = options;
    statusEl.dataset.state = state;
    statusEl.textContent = text;
    statusLiveEl.textContent = announce ? text : '';
  };

  const setPreviewState = (
    state: PreviewState,
    badgeText: string = PREVIEW_BADGE_LABELS[state]
  ) => {
    previewEl.dataset.previewState = state;
    previewBadgeEl.dataset.state = state;
    previewBadgeEl.textContent = badgeText;
  };

  const setOptionalPreviewCopy = (element: HTMLElement, text?: string) => {
    const normalized = text?.trim() ?? '';
    element.textContent = normalized;
    element.hidden = normalized.length === 0;
  };

  const clearErrors = () => {
    errorBannerEl.hidden = true;
    errorMessageEl.hidden = true;
    errorMessageEl.textContent = '';
    errorListEl.hidden = true;
    errorListEl.replaceChildren();
  };

  const setErrors = (
    errors: readonly string[],
    options: AdminDataErrorOptions = {}
  ) => {
    errorTitleEl.textContent = options.title ?? '导入导出未完成';

    if (options.message) {
      errorMessageEl.hidden = false;
      errorMessageEl.textContent = options.message;
    } else {
      errorMessageEl.hidden = true;
      errorMessageEl.textContent = '';
    }

    errorListEl.replaceChildren();
    if (errors.length > 0) {
      const fragment = document.createDocumentFragment();
      for (const error of errors) {
        const item = document.createElement('li');
        item.className = 'admin-banner__list-item';
        item.textContent = error;
        fragment.appendChild(item);
      }
      errorListEl.appendChild(fragment);
      errorListEl.hidden = false;
    } else {
      errorListEl.hidden = true;
    }

    errorBannerEl.hidden = false;
  };

  const clearActionButtonProgress = (button: HTMLButtonElement) => {
    const timerId = Number(button.dataset.progressTimer ?? '');
    if (Number.isFinite(timerId) && timerId > 0) {
      window.clearTimeout(timerId);
    }

    delete button.dataset.progressTimer;
    delete button.dataset.progressVisible;
    button.removeAttribute('aria-busy');
  };

  const scheduleActionButtonProgress = (button: HTMLButtonElement) => {
    clearActionButtonProgress(button);
    button.setAttribute('aria-busy', 'true');

    const timerId = window.setTimeout(() => {
      if (!button.isConnected || button.dataset.stepState !== 'running') return;
      button.dataset.progressVisible = 'true';
      delete button.dataset.progressTimer;
    }, ACTION_PROGRESS_DELAY_MS);

    button.dataset.progressTimer = String(timerId);
  };

  const setActionButtonStepState = (
    button: HTMLButtonElement,
    stepState: AdminDataActionButtonStepState
  ) => {
    button.dataset.stepState = stepState;

    if (stepState === 'running') {
      scheduleActionButtonProgress(button);
      return;
    }

    clearActionButtonProgress(button);
  };

  const createResultItem = (
    title: string,
    meta: string,
    options: ResultItemOptions = {}
  ) => {
    const item = document.createElement('li');
    item.className = 'admin-data-terminal__list-item';

    const header = document.createElement('div');
    header.className = 'admin-data-terminal__list-head';

    const heading = document.createElement('p');
    heading.className = 'admin-data-terminal__list-title';

    const label = document.createElement('span');
    label.className = 'admin-data-terminal__list-label';
    label.textContent = title;

    if (options.marker) {
      const marker = document.createElement('span');
      marker.className = 'admin-data-terminal__list-marker';
      marker.textContent = options.marker;

      heading.append(marker, label);
    } else {
      heading.appendChild(label);
    }

    if (options.titleBadge) {
      heading.appendChild(options.titleBadge);
    }

    header.appendChild(heading);

    const metaEl = document.createElement('p');
    metaEl.className = 'admin-data-terminal__list-meta';
    metaEl.textContent = meta;

    item.append(header, metaEl);
    return {
      item,
      header
    };
  };

  const createChangedCountBadge = (count: number) => {
    const badge = document.createElement('span');
    badge.className = 'admin-data-terminal__list-badge';
    badge.textContent = String(count);
    badge.title = `${count} 处字段`;
    badge.setAttribute('aria-label', `${count} 处字段`);
    return badge;
  };

  const normalizeChangedPathLabel = (path: string): string => path === 'root' ? '(整个分组)' : path;

  const createChangeValueRow = (
    label: string,
    value: string,
    kind: ChangeValueRowKind
  ) => {
    const row = document.createElement('div');
    row.className = 'admin-data-terminal__change-row';
    row.dataset.changeValueKind = kind;

    const labelEl = document.createElement('span');
    labelEl.className = 'admin-data-terminal__change-row-label';

    const signEl = document.createElement('span');
    signEl.className = 'admin-data-terminal__change-row-sign';
    signEl.textContent = CHANGE_VALUE_ROW_MARKERS[kind];
    signEl.setAttribute('aria-hidden', 'true');

    const labelTextEl = document.createElement('span');
    labelTextEl.textContent = label;

    labelEl.append(signEl, labelTextEl);

    const valueEl = document.createElement('code');
    valueEl.className = 'admin-data-terminal__change-row-value';
    valueEl.textContent = value;

    row.append(labelEl, valueEl);
    return row;
  };

  const createChangedPathList = (paths: readonly string[]) => {
    const list = document.createElement('ul');
    list.className = 'admin-data-terminal__paths';

    for (const path of paths) {
      const item = document.createElement('li');
      item.className = 'admin-data-terminal__path';

      const marker = document.createElement('span');
      marker.className = 'admin-data-terminal__path-marker';
      marker.textContent = '+';

      const code = document.createElement('code');
      code.className = 'admin-data-terminal__path-code';
      code.textContent = normalizeChangedPathLabel(path);

      item.append(marker, code);
      list.appendChild(item);
    }

    return list;
  };

  const createChangedFieldList = (result: WriteResult) => {
    if (result.changes.length === 0) {
      return createChangedPathList(result.changedPaths);
    }

    const list = document.createElement('ul');
    list.className = 'admin-data-terminal__changes';

    for (const change of result.changes) {
      const item = document.createElement('li');
      item.className = 'admin-data-terminal__change';

      const head = document.createElement('div');
      head.className = 'admin-data-terminal__change-head';

      const marker = document.createElement('span');
      marker.className = 'admin-data-terminal__change-marker';
      marker.dataset.kind = change.kind;
      marker.textContent = CHANGE_MARKERS[change.kind];

      const code = document.createElement('code');
      code.className = 'admin-data-terminal__path-code';
      code.textContent = normalizeChangedPathLabel(change.path);

      head.append(marker, code);

      const values = document.createElement('div');
      values.className = 'admin-data-terminal__change-values';
      values.append(
        createChangeValueRow('当前', change.before, 'current'),
        createChangeValueRow('导入', change.after, 'imported')
      );

      item.append(head, values);
      list.appendChild(item);
    }

    return list;
  };

  const createDropzoneMetaItem = ({
    label,
    value,
    wide = false,
    compact = false
  }: DropzoneMetaField) => {
    const item = document.createElement('div');
    item.className = 'admin-data-dropzone__summary-field';
    if (wide) item.classList.add('admin-data-dropzone__summary-field--wide');
    if (compact) item.classList.add('admin-data-dropzone__summary-field--compact');

    const labelEl = document.createElement('dt');
    labelEl.className = 'admin-data-dropzone__summary-field-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('dd');
    valueEl.className = 'admin-data-dropzone__summary-field-value';
    valueEl.textContent = value;

    item.append(labelEl, valueEl);
    return item;
  };

  const showPreviewEmpty = (options: AdminDataPreviewEmptyOptions) => {
    setPreviewState(options.state, options.badgeText);
    previewEmptyTitleEl.textContent = options.title;
    previewEmptyBodyEl.textContent = options.body;
    previewTitleEl.textContent = '';
    previewTitleEl.hidden = true;
    previewBodyEl.textContent = '';
    previewBodyEl.classList.remove('admin-data-terminal__section-body--summary');
    setOptionalPreviewCopy(previewNoteEl);
    previewEmptyEl.hidden = false;
    previewContentEl.hidden = true;
    resultListEl.replaceChildren();
  };

  const resetPreview = () => {
    showPreviewEmpty({
      state: 'idle',
      title: '等待导入快照',
      body: '选择 JSON 快照并执行 dry-run 后，此处显示预览结果'
    });
  };

  const renderPreview = (
    results: WriteResultsMap | null,
    options: AdminDataPreviewRenderOptions
  ) => {
    setPreviewState(options.state);
    previewEmptyEl.hidden = true;
    previewContentEl.hidden = false;
    const title = options.title?.trim() ?? '';
    previewTitleEl.textContent = title;
    previewTitleEl.hidden = title.length === 0;
    previewBodyEl.textContent = options.body ?? '';
    previewBodyEl.classList.toggle('admin-data-terminal__section-body--summary', options.state === 'applied');
    setOptionalPreviewCopy(previewNoteEl, options.note);
    resultListEl.replaceChildren();

    const changedGroups = GROUP_ORDER.filter((group) => hasWriteResultChanges(results?.[group]));
    if (changedGroups.length === 0) {
      previewBodyEl.textContent = options.body ?? '';
      const cleanState = createResultItem(
        '当前导入快照与本地 settings 一致',
        'dry-run 未检测到需要写入的分组，可以继续保留当前本地配置。'
      );
      resultListEl.appendChild(
        cleanState.item
      );
      return;
    }

    const totalChangedCount = changedGroups.reduce(
      (sum, group) => sum + getWriteResultChangedFieldCount(results?.[group]),
      0
    );
    if (options.state === 'diff') {
      previewBodyEl.classList.add('admin-data-terminal__section-body--summary');
      previewBodyEl.textContent = `${changedGroups.length} 个分组待更新，共 ${totalChangedCount} 处字段将变更`;
    }

    const fragment = document.createDocumentFragment();
    for (const group of changedGroups) {
      const result = results?.[group];
      if (!hasWriteResultChanges(result)) continue;

      const changedCount = getWriteResultChangedFieldCount(result);
      const resultItem = createResultItem(
        `${GROUP_LABELS[group]} · ${result.written ? '已写入' : '待更新'}`,
        GROUP_FILES[group],
        {
          marker: '#',
          titleBadge: createChangedCountBadge(changedCount)
        }
      );
      if (result.changedPaths.length > 0 || result.changes.length > 0) {
        resultItem.item.appendChild(createChangedFieldList(result));
      }
      fragment.appendChild(resultItem.item);
    }

    resultListEl.appendChild(fragment);
  };

  const renderFileMeta = (
    bundle: AdminSettingsExportBundle | null,
    fileName: string | null
  ) => {
    dropzoneMetaEl.replaceChildren();
    if (!bundle || !fileName) {
      dropzoneMetaEl.hidden = true;
      return;
    }

    const dropzoneMetaFields: DropzoneMetaField[] = [
      {
        label: '创建时间',
        value: formatManifestCreatedAt(bundle.manifest.createdAt),
        wide: true
      },
      {
        label: 'Schema',
        value: `v${bundle.manifest.schemaVersion}`
      },
      {
        label: 'Locale',
        value: bundle.manifest.locale ?? '(missing)',
        compact: true
      },
      {
        label: 'Scope',
        value: bundle.manifest.includedScopes.join(', '),
        compact: true
      },
      {
        label: '不包含',
        value: bundle.manifest.excludes.length > 0 ? bundle.manifest.excludes.join(', ') : '（无）',
        wide: true
      }
    ];

    const dropzoneFragment = document.createDocumentFragment();
    for (const field of dropzoneMetaFields) {
      dropzoneFragment.appendChild(createDropzoneMetaItem(field));
    }

    dropzoneMetaEl.appendChild(dropzoneFragment);
    dropzoneMetaEl.hidden = false;
  };

  const setSelectedFileLabel = (fileName: string | null) => {
    if (!fileName) {
      dropzoneEmptyEl.hidden = false;
      dropzoneSummaryEl.hidden = true;
      dropzoneMetaEl.hidden = true;
      dropzoneMetaEl.replaceChildren();
      selectedFileEl.hidden = true;
      selectedFileEl.textContent = '';
      selectedFileEl.removeAttribute('title');
      dropzoneEl.dataset.hasFile = 'false';
      return;
    }

    dropzoneEmptyEl.hidden = true;
    dropzoneSummaryEl.hidden = false;
    selectedFileEl.hidden = false;
    selectedFileEl.textContent = fileName;
    selectedFileEl.title = fileName;
    dropzoneEl.dataset.hasFile = 'true';
  };

  const syncActionState = ({
    busy,
    hasBundle,
    canApply,
    dryRunStepState,
    applyStepState
  }: AdminDataActionState) => {
    exportBtn.disabled = busy;
    fileInput.disabled = busy;
    dropzoneTriggerBtn.disabled = busy;
    dropzoneReselectBtn.disabled = busy;
    dropzoneEl.dataset.disabled = String(busy);
    dropzoneEl.setAttribute('aria-disabled', String(busy));
    dryRunBtn.disabled = busy || !hasBundle;
    applyBtn.disabled = busy || !canApply;
    setActionButtonStepState(dryRunBtn, dryRunStepState);
    setActionButtonStepState(applyBtn, applyStepState);
  };

  const setDropzoneDragActive = (active: boolean) => {
    dropzoneEl.dataset.dragActive = String(active);
  };

  const showBootstrapError = (message: string) => {
    setStatus('error', '初始化失败');
    showPreviewEmpty({
      state: 'error',
      title: 'Data Console 初始化失败',
      body: message
    });
  };

  return {
    setStatus,
    clearErrors,
    setErrors,
    showPreviewEmpty,
    resetPreview,
    renderPreview,
    renderFileMeta,
    setSelectedFileLabel,
    syncActionState,
    setDropzoneDragActive,
    showBootstrapError
  };
};
