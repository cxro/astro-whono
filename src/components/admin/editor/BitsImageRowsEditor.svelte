<script lang="ts">
import { onMount, tick } from 'svelte';
import {
  getAdminImageFieldPreviewSrc,
  getAdminRenderedImagePreviewSrc
} from '../../../lib/admin-console/image-params';
import {
  formatAdminImageMetaSummary,
  type AdminImageClientItem
} from '../../../scripts/admin-shared/image-client';
import type { AdminImagePickerController } from '../../../scripts/admin-shared/image-picker';
import AdminEditorIcon from './AdminEditorIcon.svelte';
import {
  createEmptyBitsImageRow,
  type BitsImageRowDraft
} from './bits-image-rows';
import type { AdminContentIssue } from './content-editor-client';
import { uploadBitsEditorImage, type EditorImageUploadResult } from './editor-image-upload';
import type { StatusState } from './editor-shell-helpers';

type RowMetaState = {
  text: string;
  previewSrc: string;
  loading: boolean;
  token: number;
  timer: number | null;
};

type Props = {
  rows: BitsImageRowDraft[];
  issues?: readonly AdminContentIssue[];
  disabled?: boolean;
  uploadEndpoint?: string;
  entryId?: string;
  picker?: AdminImagePickerController | null;
  onStatus?: (state: StatusState, text: string) => void;
  onDirty?: () => void;
  onUploadPendingChange?: (pending: boolean) => void;
};

const EMPTY_META_TEXT = '等待选择图片或输入路径';
const PENDING_META_TEXT = '等待确认路径并读取元数据';
const META_PREVIEW_DEBOUNCE_MS = 360;
const IMAGE_DETAIL_PANEL_ID = 'admin-bits-image-detail-panel';
const IMAGE_INSERT_TAB_ID = 'admin-bits-image-insert-tab';
const IMAGE_ISSUE_FIELDS = ['src', 'width', 'height'] as const;
const base = import.meta.env.BASE_URL ?? '/';

let {
  rows = $bindable(),
  issues = [],
  disabled = false,
  uploadEndpoint = '',
  entryId = '',
  picker = null,
  onStatus = () => {},
  onDirty = () => {},
  onUploadPendingChange = () => {}
}: Props = $props();

let rowMeta = $state<RowMetaState[]>([]);
let pendingUploadCount = 0;
let activeRowIndex = $state<number | null>(null);

const createRowMeta = (): RowMetaState => ({
  text: EMPTY_META_TEXT,
  previewSrc: '',
  loading: false,
  token: 0,
  timer: null
});

const getIssue = (path: string): string =>
  issues.find((issue) => issue.path === path)?.message ?? '';

const getImageIssue = (index: number, field: 'src' | 'width' | 'height'): string =>
  getIssue(`images[${index}].${field}`);

const getRowIssueCount = (index: number): number =>
  IMAGE_ISSUE_FIELDS
    .map((field) => getImageIssue(index, field))
    .filter(Boolean).length;

const isEmptyImageRow = (row: BitsImageRowDraft): boolean =>
  !row.src.trim() && !row.width.trim() && !row.height.trim() && !row.alt.trim();

const shouldShowImageTile = (row: BitsImageRowDraft): boolean =>
  !isEmptyImageRow(row);

const getInsertRowIndex = (): number => {
  const emptyIndex = rows.findIndex(isEmptyImageRow);
  return emptyIndex >= 0 ? emptyIndex : rows.length;
};

const getImageTileCount = (): number =>
  rows.filter(shouldShowImageTile).length;

const isInsertTileActive = (): boolean => {
  if (activeRowIndex === null) return false;
  const row = rows[activeRowIndex];
  return Boolean(row && isEmptyImageRow(row));
};

const getImageTabLabel = (index: number): string =>
  `图片 #${index + 1}`;

const getImageShortLabel = (index: number): string =>
  `#${index + 1}`;

const getImageTabStatus = (index: number, row: BitsImageRowDraft, meta: RowMetaState): string => {
  if (meta.loading) return '读取中';
  if (getRowIssueCount(index) > 0) return '需处理';
  if (!row.src.trim()) return '待填写';
  return meta.previewSrc ? '已就绪' : '已填写';
};

const selectRow = (index: number) => {
  activeRowIndex = Math.min(Math.max(index, 0), Math.max(0, rows.length - 1));
};

const clampActiveRowIndex = () => {
  if (activeRowIndex === null) return;
  const maxIndex = rows.length - 1;
  if (maxIndex < 0) {
    activeRowIndex = null;
    return;
  }
  if (activeRowIndex > maxIndex) activeRowIndex = maxIndex;
  if (activeRowIndex < 0) activeRowIndex = 0;
};

const setRowMeta = (index: number, patch: Partial<RowMetaState>) => {
  rowMeta = rowMeta.map((meta, currentIndex) =>
    currentIndex === index ? { ...meta, ...patch } : meta
  );
};

const syncRowMetaLength = () => {
  if (rowMeta.length === rows.length) return;
  rowMeta = rows.map((_, index) => rowMeta[index] ?? createRowMeta());
};

const clearMetaTimer = (index: number) => {
  const timer = rowMeta[index]?.timer ?? null;
  if (timer !== null) window.clearTimeout(timer);
  setRowMeta(index, { timer: null });
};

const clearAllMetaTimers = () => {
  rowMeta.forEach((meta) => {
    if (meta.timer !== null) window.clearTimeout(meta.timer);
  });
};

const updateUploadPending = (pending: boolean) => {
  pendingUploadCount = Math.max(0, pendingUploadCount + (pending ? 1 : -1));
  onUploadPendingChange(pendingUploadCount > 0);
};

const clearStaleUploadMeta = (index: number, token: number) => {
  const meta = rowMeta[index];
  if (meta?.token !== token) return;
  setRowMeta(index, { loading: false, text: EMPTY_META_TEXT });
};

const updateRow = (index: number, patch: Partial<BitsImageRowDraft>) => {
  rows = rows.map((row, currentIndex) =>
    currentIndex === index ? { ...row, ...patch } : row
  );
  onDirty();
};

const resolveBitsImagePreviewSrc = (value: string): string | null =>
  getAdminImageFieldPreviewSrc('bits.images', value, base)
    ?? getAdminRenderedImagePreviewSrc(value, base);

const setPreview = (index: number, previewSrc: string | null | undefined) => {
  const safePreviewSrc = previewSrc ? resolveBitsImagePreviewSrc(previewSrc) : null;
  setRowMeta(index, { previewSrc: safePreviewSrc ?? '' });
};

const applyMeta = async (index: number) => {
  const row = rows[index];
  if (!row) return;

  clearMetaTimer(index);
  const value = row.src.trim();
  setPreview(index, value);

  if (!value) {
    setRowMeta(index, { text: EMPTY_META_TEXT, loading: false });
    return;
  }

  if (!picker) {
    setRowMeta(index, { text: '当前页面未挂载 image picker', loading: false });
    return;
  }

  const token = (rowMeta[index]?.token ?? 0) + 1;
  setRowMeta(index, { token, loading: true, text: '正在读取图片元数据' });

  try {
    const meta = await picker.readMeta({ field: 'bits.images', value });
    const latest = rows[index];
    if (!latest || latest.src.trim() !== value || rowMeta[index]?.token !== token) return;

    setRowMeta(index, {
      text: formatAdminImageMetaSummary(meta),
      loading: false
    });
    setPreview(index, meta.previewSrc);

    if (meta.kind === 'local' && (meta.width || meta.height)) {
      updateRow(index, {
        ...(meta.width ? { width: String(meta.width) } : {}),
        ...(meta.height ? { height: String(meta.height) } : {})
      });
    }
  } catch (error) {
    const latest = rows[index];
    if (!latest || latest.src.trim() !== value || rowMeta[index]?.token !== token) return;
    setRowMeta(index, {
      text: error instanceof Error ? error.message : '路径暂时无法读取',
      loading: false
    });
  }
};

const scheduleMetaPreview = (index: number) => {
  clearMetaTimer(index);
  const timer = window.setTimeout(() => {
    setRowMeta(index, { timer: null });
    void applyMeta(index);
  }, META_PREVIEW_DEBOUNCE_MS);
  setRowMeta(index, { timer });
};

const handleSourceInput = (index: number, value: string) => {
  updateRow(index, { src: value, width: '', height: '', alt: '' });
  setPreview(index, value.trim());
  setRowMeta(index, {
    text: value.trim() ? PENDING_META_TEXT : EMPTY_META_TEXT,
    loading: false
  });
  scheduleMetaPreview(index);
};

const removeRow = (index: number) => {
  clearMetaTimer(index);
  const removedRowWasEmpty = rows[index] ? isEmptyImageRow(rows[index]) : true;
  if (rows.length <= 1) {
    rows = [createEmptyBitsImageRow()];
    rowMeta = [createRowMeta()];
    activeRowIndex = null;
  } else {
    const nextRows = rows.filter((_, currentIndex) => currentIndex !== index);
    rows = nextRows;
    rowMeta = rowMeta.filter((_, currentIndex) => currentIndex !== index);
    if (activeRowIndex !== null && activeRowIndex > index) {
      activeRowIndex -= 1;
    } else if (activeRowIndex === index) {
      activeRowIndex = null;
    }
  }
  if (!removedRowWasEmpty) onDirty();
};

const focusRowSourceInput = async (index: number) => {
  await tick();
  document.getElementById(`admin-bits-image-${index}-src`)?.focus();
};

const openInsertRow = async () => {
  const insertIndex = getInsertRowIndex();
  if (insertIndex === rows.length) {
    rows = [...rows, createEmptyBitsImageRow()];
    rowMeta = [...rowMeta, createRowMeta()];
  }
  activeRowIndex = insertIndex;
  await focusRowSourceInput(insertIndex);
};

const handleInsertTileClick = async () => {
  if (disabled) return;
  await openInsertRow();
};

const handleImageTileClick = (index: number) => {
  selectRow(index);
};

const toDimensionText = (value: number | null | undefined): string => (value ? String(value) : '');

const applyPickedImage = (index: number, item: AdminImageClientItem) => {
  updateRow(index, {
    src: item.value,
    width: toDimensionText(item.width),
    height: toDimensionText(item.height),
    alt: ''
  });
  setRowMeta(index, {
    text: formatAdminImageMetaSummary({
      kind: 'local',
      origin: item.origin,
      width: item.width,
      height: item.height,
      size: item.size
    }),
    loading: false
  });
  setPreview(index, item.previewSrc);
  onStatus('ok', `已选择本地图片：${item.value}`);
};

const getUploadPreviewSrc = (result: EditorImageUploadResult): string =>
  result.src.startsWith('https://') || result.src.startsWith('/') ? result.src : `/${result.src}`;

const applyUploadedImage = (index: number, result: EditorImageUploadResult) => {
  updateRow(index, {
    src: result.src,
    width: toDimensionText(result.width),
    height: toDimensionText(result.height),
    alt: ''
  });
  setRowMeta(index, {
    text: formatAdminImageMetaSummary({
      kind: 'local',
      origin: 'public',
      width: result.width,
      height: result.height,
      size: result.size
    }),
    loading: false
  });
  setPreview(index, getUploadPreviewSrc(result));
  onStatus('ok', `已上传图片：${result.src}`);
};

const handleUploadInput = async (index: number, input: HTMLInputElement) => {
  const file = input.files?.[0] ?? null;
  input.value = '';
  if (!file) return;

  if (!uploadEndpoint || !entryId) {
    onStatus('warn', '当前页面未挂载图片上传入口');
    return;
  }

  clearMetaTimer(index);
  const originalRow = rows[index];
  if (!originalRow) return;
  const token = (rowMeta[index]?.token ?? 0) + 1;
  setPreview(index, null);
  setRowMeta(index, { token, loading: true, text: '正在上传图片' });
  updateUploadPending(true);

  try {
    const upload = await uploadBitsEditorImage({ uploadEndpoint, entryId, file });
    if (rows[index] !== originalRow || rowMeta[index]?.token !== token) {
      clearStaleUploadMeta(index, token);
      return;
    }

    if (!upload.ok) {
      setRowMeta(index, { loading: false, text: upload.error });
      onStatus('error', upload.error);
      return;
    }

    applyUploadedImage(index, upload.result);
  } finally {
    updateUploadPending(false);
  }
};

const openPicker = (index: number) => {
  if (!picker) {
    onStatus('warn', '当前页面未挂载 image picker');
    return;
  }

  picker.open({
    field: 'bits.images',
    title: '为 bits.images 选择本地图片',
    description: '仅列出可直接写入 `bits.images[*].src` 的本地 public/** 资源。',
    query: rows[index]?.src ?? '',
    currentValue: rows[index]?.src ?? '',
    onSelect: (item) => {
      applyPickedImage(index, item);
    }
  });
};

$effect(() => {
  syncRowMetaLength();
  clampActiveRowIndex();
});

onMount(() => {
  syncRowMetaLength();
  rows.forEach((row, index) => {
    if (row.src.trim()) void applyMeta(index);
  });

  return () => {
    clearAllMetaTimers();
    if (pendingUploadCount > 0) {
      pendingUploadCount = 0;
      onUploadPendingChange(false);
    }
  };
});
</script>

<div class="admin-field admin-content-editor__field admin-field--full" data-field-path="imagesText">
  <p class="admin-content-editor__error" hidden={!getIssue('imagesText')}>{getIssue('imagesText')}</p>

  <div class="admin-content-image-editor">
    <div class="admin-content-image-strip">
      <div class="admin-content-image-film" role="tablist" aria-label={`bits.images 图片顺序，共 ${getImageTileCount()} 张`}>
        {#each rows as row, index}
          {#if shouldShowImageTile(row)}
            {@const meta = rowMeta[index] ?? createRowMeta()}
            {@const selected = activeRowIndex === index}
            {@const issueCount = getRowIssueCount(index)}
            <button
              id={`admin-bits-image-${index}-tab`}
              class="admin-content-image-thumb"
              class:is-active={selected}
              class:is-empty={!row.src.trim()}
              class:is-invalid={issueCount > 0}
              class:is-loading={meta.loading}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={selected ? IMAGE_DETAIL_PANEL_ID : undefined}
              title={`${getImageTabLabel(index)}：${getImageTabStatus(index, row, meta)}`}
              onclick={() => handleImageTileClick(index)}
            >
              <span class="admin-content-image-thumb__media" aria-hidden="true">
                {#if meta.previewSrc}
                  <img src={meta.previewSrc} alt="" loading="lazy" decoding="async" />
                {:else}
                  <AdminEditorIcon name={row.src.trim() ? 'image' : 'image-plus'} size={18} strokeWidth={1.8} />
                {/if}
              </span>
              <span class="admin-content-image-thumb__body">
                <span class="admin-content-image-thumb__label">{getImageShortLabel(index)}</span>
                <span class="admin-content-image-thumb__status">
                  {getImageTabStatus(index, row, meta)}
                </span>
              </span>
              {#if issueCount > 0}
                <span class="admin-content-image-thumb__alert" aria-label={`${issueCount} 个字段错误`}>
                  <AdminEditorIcon name="triangle-alert" size={12} strokeWidth={2.2} ariaHidden={false} />
                </span>
              {/if}
            </button>
          {/if}
        {/each}
        <button
          id={IMAGE_INSERT_TAB_ID}
          class="admin-content-image-thumb admin-content-image-thumb--insert"
          class:is-active={isInsertTileActive()}
          type="button"
          role="tab"
          aria-selected={isInsertTileActive()}
          aria-controls={isInsertTileActive() ? IMAGE_DETAIL_PANEL_ID : undefined}
          disabled={disabled}
          title="插入图片"
          onclick={() => void handleInsertTileClick()}
        >
          <span class="admin-content-image-thumb__media" aria-hidden="true">
            <AdminEditorIcon name="image-plus" size={18} strokeWidth={1.8} />
          </span>
          <span class="admin-content-image-thumb__body">
            <span class="admin-content-image-thumb__label">插入图片</span>
          </span>
        </button>
      </div>
    </div>

    {#if activeRowIndex !== null && rows[activeRowIndex]}
      {@const index = activeRowIndex}
      {@const activeRow = rows[index] ?? createEmptyBitsImageRow()}
      {@const activeRowIsEmpty = isEmptyImageRow(activeRow)}
      {@const srcIssue = getImageIssue(index, 'src')}
      {@const meta = rowMeta[index] ?? createRowMeta()}
      {@const rowDisabled = disabled || meta.loading}
      <div
        id={IMAGE_DETAIL_PANEL_ID}
        class="admin-content-image-row"
        role="tabpanel"
        aria-labelledby={activeRowIsEmpty ? IMAGE_INSERT_TAB_ID : `admin-bits-image-${index}-tab`}
      >
        <div class="admin-content-image-row__grid">
          <div class="admin-field admin-content-image-row__field admin-content-image-row__field--src" class:is-invalid={Boolean(srcIssue)}>
            <label class="admin-sr-only" for={`admin-bits-image-${index}-src`}>图片路径</label>
            <input
              id={`admin-bits-image-${index}-src`}
              class="admin-field__control"
              type="text"
              value={activeRow.src}
              spellcheck="false"
              aria-label={`${activeRowIsEmpty ? '插入图片' : getImageTabLabel(index)}路径`}
              aria-invalid={srcIssue ? 'true' : undefined}
              placeholder="请上传图片或输入图片链接"
              disabled={rowDisabled}
              oninput={(event) => handleSourceInput(index, event.currentTarget.value)}
              onchange={() => void applyMeta(index)}
            />
            <p class="admin-content-editor__error" hidden={!srcIssue}>{srcIssue}</p>
          </div>

          <div class="admin-content-image-row__actions" aria-label={`${activeRowIsEmpty ? '插入图片' : getImageTabLabel(index)} 操作`}>
            <input
              id={`admin-bits-image-${index}-upload`}
              type="file"
              accept="image/avif,image/gif,image/jpeg,image/png,image/svg+xml,image/webp"
              hidden
              disabled={rowDisabled}
              onchange={(event) => void handleUploadInput(index, event.currentTarget)}
            />
            <button
              class="admin-btn admin-btn--secondary admin-content-image-row__action"
              type="button"
              disabled={rowDisabled}
              title="上传到 public/bits/"
              onclick={() => document.getElementById(`admin-bits-image-${index}-upload`)?.click()}
            >
              <AdminEditorIcon name="upload" size={14} strokeWidth={2} class="admin-icon" />
              <span>上传</span>
            </button>
            <button
              class="admin-btn admin-btn--ghost admin-content-image-row__action"
              type="button"
              disabled={rowDisabled}
              title="从本地图片库选择"
              onclick={() => openPicker(index)}
            >
              <AdminEditorIcon name="images" size={14} strokeWidth={2} class="admin-icon" />
              <span>选择</span>
            </button>
            <button
              class="admin-btn admin-btn--ghost admin-content-image-row__remove"
              type="button"
              disabled={rowDisabled}
              title={activeRowIsEmpty ? '取消插入图片' : `移除${getImageTabLabel(index)}`}
              aria-label={activeRowIsEmpty ? '取消插入图片' : `移除${getImageTabLabel(index)}`}
              onclick={() => removeRow(index)}
            >
              <AdminEditorIcon name="trash" size={14} strokeWidth={2} class="admin-icon" />
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
