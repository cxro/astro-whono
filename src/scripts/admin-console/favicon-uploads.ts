import { ADMIN_SITE_ASSET_UPLOAD_API_PATH } from '@/lib/admin-console/admin-api-paths';
import { createWithBase } from '@/utils/format';

type StatusSetter = (
  state: string,
  text: string,
  options?: { announce?: boolean }
) => void;

type FaviconUploadSlot = 'png' | 'appleTouchIcon';

const UPLOAD_SLOTS: readonly FaviconUploadSlot[] = ['png', 'appleTouchIcon'];
const SLOT_LABELS: Record<FaviconUploadSlot, string> = {
  png: '标签页图标',
  appleTouchIcon: '触摸图标'
};

const base = import.meta.env.BASE_URL ?? '/';
const withBase = createWithBase(base);

// 预览常显：空槽位显示主题默认图标（半透明），自定义后显示自定义图标。
const DEFAULT_PREVIEW_SRC: Record<FaviconUploadSlot, string> = {
  png: '/favicon-32x32.png',
  appleTouchIcon: '/apple-touch-icon.png'
};

/* 与 image-fields 的 DOM sink 边界一致：写入 <img src> 前用 URL 构造器重新解析同源路径。 */
const toSafePreviewSrc = (value: string): string | null => {
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  try {
    const parsed = new URL(withBase(value), window.location.origin);
    if (parsed.origin !== window.location.origin || parsed.protocol !== window.location.protocol) return null;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
};

export const createAdminFaviconUploads = ({
  root,
  inputs,
  setStatus
}: {
  root: ParentNode;
  inputs: Record<FaviconUploadSlot, HTMLInputElement>;
  setStatus: StatusSetter;
}) => {
  const endpoint = withBase(ADMIN_SITE_ASSET_UPLOAD_API_PATH);

  const refreshPreview = (slot: FaviconUploadSlot): void => {
    const previewWrap = root.querySelector<HTMLElement>(`[data-favicon-preview="${slot}"]`);
    const previewImg = root.querySelector<HTMLImageElement>(`[data-favicon-preview-img="${slot}"]`);
    const clearBtn = root.querySelector<HTMLButtonElement>(`[data-favicon-clear="${slot}"]`);
    if (!previewWrap || !previewImg) return;

    const value = inputs[slot].value.trim();
    const safeSrc = value ? toSafePreviewSrc(value) : null;
    const isCustom = Boolean(safeSrc);

    previewImg.src = safeSrc ?? withBase(DEFAULT_PREVIEW_SRC[slot]);
    previewWrap.dataset.state = isCustom ? 'custom' : 'default';
    previewWrap.title = isCustom ? value : '主题默认';
    if (clearBtn) clearBtn.disabled = !isCustom;
  };

  const applyUploadedPath = (slot: FaviconUploadSlot, nextPath: string): void => {
    const input = inputs[slot];
    input.value = nextPath;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    refreshPreview(slot);
  };

  const uploadFile = async (slot: FaviconUploadSlot, file: File): Promise<void> => {
    const uploadBtn = root.querySelector<HTMLButtonElement>(`[data-favicon-upload="${slot}"]`);
    if (uploadBtn) uploadBtn.disabled = true;
    setStatus('loading', `正在上传${SLOT_LABELS[slot]}…`, { announce: false });

    try {
      const formData = new FormData();
      formData.set('slot', slot);
      formData.set('image', file);
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        errors?: string[];
        result?: { path?: string; width?: number; height?: number };
      };

      if (!response.ok || !payload.ok || typeof payload.result?.path !== 'string') {
        const message = payload.errors?.length ? payload.errors.join('；') : '站点图标上传失败';
        setStatus('warn', message);
        return;
      }

      applyUploadedPath(slot, payload.result.path);
      const sizeText = payload.result.width ? `（${payload.result.width}x${payload.result.height}）` : '';
      setStatus('ok', `已上传${SLOT_LABELS[slot]}${sizeText}，保存后生效`);
    } catch {
      setStatus('warn', '站点图标上传失败，请检查 dev server 是否在运行');
    } finally {
      if (uploadBtn) uploadBtn.disabled = false;
    }
  };

  UPLOAD_SLOTS.forEach((slot) => {
    const input = inputs[slot];
    const uploadBtn = root.querySelector<HTMLButtonElement>(`[data-favicon-upload="${slot}"]`);
    const clearBtn = root.querySelector<HTMLButtonElement>(`[data-favicon-clear="${slot}"]`);
    const fileInput = root.querySelector<HTMLInputElement>(`[data-favicon-file="${slot}"]`);

    uploadBtn?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (file) void uploadFile(slot, file);
    });

    clearBtn?.addEventListener('click', () => {
      if (!input.value.trim()) return;
      applyUploadedPath(slot, '');
      setStatus('ok', `已恢复${SLOT_LABELS[slot]}为主题默认，保存后生效`);
    });

    input.addEventListener('input', () => refreshPreview(slot));
    input.addEventListener('change', () => refreshPreview(slot));
    refreshPreview(slot);
  });

  return {
    refreshAll: (): void => {
      UPLOAD_SLOTS.forEach((slot) => refreshPreview(slot));
    }
  };
};
