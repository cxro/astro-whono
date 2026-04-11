import { PREVIEW_BADGE_LABELS } from './shared';

export type AdminDataControls = {
  bootstrapEl: HTMLDivElement;
  statusLiveEl: HTMLElement;
  statusEl: HTMLElement;
  errorBannerEl: HTMLElement;
  errorTitleEl: HTMLElement;
  errorMessageEl: HTMLElement;
  errorListEl: HTMLElement;
  exportBtn: HTMLButtonElement;
  fileInput: HTMLInputElement;
  dropzoneEl: HTMLElement;
  dropzoneTriggerBtn: HTMLButtonElement;
  dropzoneReselectBtn: HTMLButtonElement;
  dropzoneEmptyEl: HTMLElement;
  dropzoneSummaryEl: HTMLElement;
  dropzoneMetaEl: HTMLElement;
  selectedFileEl: HTMLElement;
  dryRunBtn: HTMLButtonElement;
  applyBtn: HTMLButtonElement;
  previewEl: HTMLElement;
  previewBadgeEl: HTMLElement;
  previewEmptyEl: HTMLElement;
  previewEmptyTitleEl: HTMLElement;
  previewEmptyBodyEl: HTMLElement;
  previewContentEl: HTMLElement;
  previewTitleEl: HTMLElement;
  previewBodyEl: HTMLElement;
  previewNoteEl: HTMLElement;
  resultListEl: HTMLElement;
};

export type AdminDataPartialControls = {
  [Key in keyof AdminDataControls]: AdminDataControls[Key] | null;
};

type AdminDataControlQueryResult =
  | {
      ok: true;
      controls: AdminDataControls;
    }
  | {
      ok: false;
      controls: AdminDataPartialControls;
      missing: string[];
    };

const CONTROL_IDS: Record<keyof AdminDataControls, string> = {
  bootstrapEl: 'admin-data-bootstrap',
  statusLiveEl: 'admin-data-status-live',
  statusEl: 'admin-data-status',
  errorBannerEl: 'admin-data-error-banner',
  errorTitleEl: 'admin-data-error-title',
  errorMessageEl: 'admin-data-error-message',
  errorListEl: 'admin-data-error-list',
  exportBtn: 'admin-data-export',
  fileInput: 'admin-data-file',
  dropzoneEl: 'admin-data-dropzone',
  dropzoneTriggerBtn: 'admin-data-dropzone-empty',
  dropzoneReselectBtn: 'admin-data-dropzone-reselect',
  dropzoneEmptyEl: 'admin-data-dropzone-empty',
  dropzoneSummaryEl: 'admin-data-dropzone-summary',
  dropzoneMetaEl: 'admin-data-dropzone-meta',
  selectedFileEl: 'admin-data-selected-file',
  dryRunBtn: 'admin-data-dry-run',
  applyBtn: 'admin-data-apply',
  previewEl: 'admin-data-preview',
  previewBadgeEl: 'admin-data-preview-badge',
  previewEmptyEl: 'admin-data-preview-empty',
  previewEmptyTitleEl: 'admin-data-preview-empty-title',
  previewEmptyBodyEl: 'admin-data-preview-empty-body',
  previewContentEl: 'admin-data-preview-content',
  previewTitleEl: 'admin-data-preview-title',
  previewBodyEl: 'admin-data-preview-body',
  previewNoteEl: 'admin-data-preview-note',
  resultListEl: 'admin-data-result-list'
};

const byId = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

const appendErrorItems = (listEl: HTMLElement, details: readonly string[]) => {
  listEl.replaceChildren();
  if (details.length === 0) {
    listEl.hidden = true;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const detail of details) {
    const item = document.createElement('li');
    item.className = 'admin-banner__list-item';
    item.textContent = detail;
    fragment.appendChild(item);
  }

  listEl.appendChild(fragment);
  listEl.hidden = false;
};

export const queryAdminDataControls = (): AdminDataControlQueryResult => {
  const controls: AdminDataPartialControls = {
    bootstrapEl: byId<HTMLDivElement>(CONTROL_IDS.bootstrapEl),
    statusLiveEl: byId<HTMLElement>(CONTROL_IDS.statusLiveEl),
    statusEl: byId<HTMLElement>(CONTROL_IDS.statusEl),
    errorBannerEl: byId<HTMLElement>(CONTROL_IDS.errorBannerEl),
    errorTitleEl: byId<HTMLElement>(CONTROL_IDS.errorTitleEl),
    errorMessageEl: byId<HTMLElement>(CONTROL_IDS.errorMessageEl),
    errorListEl: byId<HTMLElement>(CONTROL_IDS.errorListEl),
    exportBtn: byId<HTMLButtonElement>(CONTROL_IDS.exportBtn),
    fileInput: byId<HTMLInputElement>(CONTROL_IDS.fileInput),
    dropzoneEl: byId<HTMLElement>(CONTROL_IDS.dropzoneEl),
    dropzoneTriggerBtn: byId<HTMLButtonElement>(CONTROL_IDS.dropzoneTriggerBtn),
    dropzoneReselectBtn: byId<HTMLButtonElement>(CONTROL_IDS.dropzoneReselectBtn),
    dropzoneEmptyEl: byId<HTMLElement>(CONTROL_IDS.dropzoneEmptyEl),
    dropzoneSummaryEl: byId<HTMLElement>(CONTROL_IDS.dropzoneSummaryEl),
    dropzoneMetaEl: byId<HTMLElement>(CONTROL_IDS.dropzoneMetaEl),
    selectedFileEl: byId<HTMLElement>(CONTROL_IDS.selectedFileEl),
    dryRunBtn: byId<HTMLButtonElement>(CONTROL_IDS.dryRunBtn),
    applyBtn: byId<HTMLButtonElement>(CONTROL_IDS.applyBtn),
    previewEl: byId<HTMLElement>(CONTROL_IDS.previewEl),
    previewBadgeEl: byId<HTMLElement>(CONTROL_IDS.previewBadgeEl),
    previewEmptyEl: byId<HTMLElement>(CONTROL_IDS.previewEmptyEl),
    previewEmptyTitleEl: byId<HTMLElement>(CONTROL_IDS.previewEmptyTitleEl),
    previewEmptyBodyEl: byId<HTMLElement>(CONTROL_IDS.previewEmptyBodyEl),
    previewContentEl: byId<HTMLElement>(CONTROL_IDS.previewContentEl),
    previewTitleEl: byId<HTMLElement>(CONTROL_IDS.previewTitleEl),
    previewBodyEl: byId<HTMLElement>(CONTROL_IDS.previewBodyEl),
    previewNoteEl: byId<HTMLElement>(CONTROL_IDS.previewNoteEl),
    resultListEl: byId<HTMLElement>(CONTROL_IDS.resultListEl)
  };

  const missing = (Object.entries(CONTROL_IDS) as Array<[keyof AdminDataControls, string]>).flatMap(([key, id]) =>
    controls[key] ? [] : [id]
  );

  if (missing.length > 0) {
    return {
      ok: false,
      controls,
      missing
    };
  }

  return {
    ok: true,
    controls: controls as AdminDataControls
  };
};

export const reportAdminDataSetupError = (
  controls: AdminDataPartialControls,
  options: {
    title: string;
    statusText?: string;
    message: string;
    details: readonly string[];
  }
) => {
  const { title, statusText = title, message, details } = options;

  console.error('[admin-data] 初始化失败:', message, details);

  if (controls.statusEl) {
    controls.statusEl.dataset.state = 'error';
    controls.statusEl.textContent = statusText;
  }

  if (controls.statusLiveEl) {
    controls.statusLiveEl.textContent = statusText;
  }

  if (controls.errorTitleEl) {
    controls.errorTitleEl.textContent = title;
  }

  if (controls.errorMessageEl) {
    controls.errorMessageEl.hidden = false;
    controls.errorMessageEl.textContent = message;
  }

  if (controls.errorListEl) {
    appendErrorItems(controls.errorListEl, details);
  }

  if (controls.errorBannerEl) {
    controls.errorBannerEl.hidden = false;
  }

  if (controls.previewEl) {
    controls.previewEl.dataset.previewState = 'error';
  }

  if (controls.previewBadgeEl) {
    controls.previewBadgeEl.dataset.state = 'error';
    controls.previewBadgeEl.textContent = PREVIEW_BADGE_LABELS.error;
  }

  if (controls.previewEmptyTitleEl) {
    controls.previewEmptyTitleEl.textContent = title;
  }

  if (controls.previewEmptyBodyEl) {
    controls.previewEmptyBodyEl.textContent = message;
  }

  if (controls.previewEmptyEl) {
    controls.previewEmptyEl.hidden = false;
  }

  if (controls.previewContentEl) {
    controls.previewContentEl.hidden = true;
  }

  if (controls.resultListEl) {
    controls.resultListEl.replaceChildren();
  }
};
