import { createWithBase } from '../../utils/format';
import { formatAdminImageMetaSummary, type AdminImageClientItem } from '../admin-shared/image-client';
import type { AdminImagePickerController, AdminImagePickerField } from '../admin-shared/image-picker';

type StatusSetter = (
  state: string,
  text: string,
  options?: { announce?: boolean }
) => void;

const base = import.meta.env.BASE_URL ?? '/';
const withBase = createWithBase(base);

type ThemeImageFieldConfig = {
  field: AdminImagePickerField;
  inputId: string;
  buttonSelector: string;
  pickerTitle: string;
  pickerDescription: string;
  pickerResetLabel: string;
  pickerResetStatus: string;
  pickerFallbackCurrentValue?: string;
  pickerFallbackCurrentLabel?: string;
};

type ThemeImageFieldState = {
  enabled?: boolean;
  inactivePreviewText?: string;
  inactiveMetaText?: string;
};

type ThemeImagePreviewState =
  | { kind: 'hidden' }
  | { kind: 'image'; src: string }
  | { kind: 'placeholder'; text: string };

const FIELD_CONFIGS: readonly ThemeImageFieldConfig[] = [
  {
    field: 'home.heroImageSrc',
    inputId: 'home-hero-image-src',
    buttonSelector: '[data-admin-images-open="home.heroImageSrc"]',
    pickerTitle: '更换 Hero 图片',
    pickerDescription: '',
    pickerResetLabel: '恢复默认',
    pickerResetStatus: '已恢复 Hero 默认图',
    pickerFallbackCurrentValue: 'src/assets/hero.png',
    pickerFallbackCurrentLabel: '默认图片'
  },
  {
    field: 'page.bits.defaultAuthor.avatar',
    inputId: 'page-bits-author-avatar',
    buttonSelector: '[data-admin-images-open="page.bits.defaultAuthor.avatar"]',
    pickerTitle: '更换 Bits 作者头像',
    pickerDescription: '仅列出可直接写入 page.bits.defaultAuthor.avatar 的本地 public/** 资源。',
    pickerResetLabel: '清空头像',
    pickerResetStatus: '已清空 Bits 默认头像'
  }
];

const getPreviewSrc = (value: string): string | null => {
  const normalized = value.trim();
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith('src/assets/')) return null;
  return withBase(normalized.startsWith('/') ? normalized : `/${normalized}`);
};

const getDefaultPreviewSrc = (previewWrap: HTMLElement | null): string | null =>
  previewWrap?.getAttribute('data-admin-images-default-preview-src')?.trim() || null;

const setPreview = (
  previewWrap: HTMLElement | null,
  previewImg: HTMLImageElement | null,
  previewPlaceholder: HTMLElement | null,
  state: ThemeImagePreviewState
): void => {
  if (!(previewWrap instanceof HTMLElement)) return;

  previewWrap.setAttribute('data-admin-images-preview-state', state.kind);

  if (state.kind === 'hidden') {
    previewWrap.hidden = true;
    previewImg?.removeAttribute('src');
    if (previewImg instanceof HTMLImageElement) previewImg.hidden = true;
    if (previewPlaceholder instanceof HTMLElement) {
      previewPlaceholder.textContent = '';
      previewPlaceholder.hidden = true;
    }
    return;
  }

  previewWrap.hidden = false;

  if (state.kind === 'image') {
    if (!(previewImg instanceof HTMLImageElement)) {
      previewWrap.hidden = true;
      return;
    }
    previewImg.src = state.src;
    previewImg.hidden = false;
    if (previewPlaceholder instanceof HTMLElement) {
      previewPlaceholder.textContent = '';
      previewPlaceholder.hidden = true;
    }
    return;
  }

  previewImg?.removeAttribute('src');
  if (previewImg instanceof HTMLImageElement) previewImg.hidden = true;
  if (!(previewPlaceholder instanceof HTMLElement)) {
    previewWrap.hidden = true;
    return;
  }
  previewPlaceholder.textContent = state.text;
  previewPlaceholder.hidden = false;
};

const setMetaText = (metaEl: HTMLElement | null, text: string): void => {
  if (!(metaEl instanceof HTMLElement)) return;
  metaEl.textContent = text;
  metaEl.hidden = text.trim().length === 0;
};

export const createAdminThemeImageFields = ({
  root,
  picker,
  setStatus,
  getFieldState = () => ({ enabled: true })
}: {
  root: ParentNode;
  picker: AdminImagePickerController | null;
  setStatus: StatusSetter;
  getFieldState?: (field: AdminImagePickerField) => ThemeImageFieldState;
}) => {
  const bindings = FIELD_CONFIGS.map((config) => {
    const input = root.querySelector<HTMLInputElement>(`#${config.inputId}`);
    const button = root.querySelector<HTMLButtonElement>(config.buttonSelector);
    const metaEl = root.querySelector<HTMLElement>(`[data-admin-images-meta="${config.field}"]`);
    const previewWrap = root.querySelector<HTMLElement>(`[data-admin-images-preview="${config.field}"]`);
    const previewImg = root.querySelector<HTMLImageElement>(`[data-admin-images-preview-img="${config.field}"]`);
    const previewPlaceholder = root.querySelector<HTMLElement>(
      `[data-admin-images-preview-placeholder="${config.field}"]`
    );
    return {
      config,
      input,
      button,
      metaEl,
      previewWrap,
      previewImg,
      previewPlaceholder
    };
  }).filter((binding) => binding.input instanceof HTMLInputElement);

  if (!bindings.length) return null;

  const updateField = async (field: AdminImagePickerField) => {
    const binding = bindings.find((item) => item.config.field === field);
    if (!binding || !(binding.input instanceof HTMLInputElement)) return;

    const state = getFieldState(field);
    const isEnabled = state.enabled !== false;
    if (binding.button instanceof HTMLButtonElement) {
      binding.button.disabled = !isEnabled || binding.input.disabled;
    }

    if (!isEnabled) {
      setMetaText(binding.metaEl, state.inactiveMetaText ?? '');
      setPreview(
        binding.previewWrap,
        binding.previewImg,
        binding.previewPlaceholder,
        state.inactivePreviewText
          ? { kind: 'placeholder', text: state.inactivePreviewText }
          : { kind: 'hidden' }
      );
      return;
    }

    const value = binding.input.value.trim();
    if (!value) {
      setMetaText(binding.metaEl, '');
      const defaultPreviewSrc = getDefaultPreviewSrc(binding.previewWrap);
      setPreview(
        binding.previewWrap,
        binding.previewImg,
        binding.previewPlaceholder,
        defaultPreviewSrc ? { kind: 'image', src: defaultPreviewSrc } : { kind: 'hidden' }
      );
      return;
    }

    const previewSrc = getPreviewSrc(value);
    setPreview(
      binding.previewWrap,
      binding.previewImg,
      binding.previewPlaceholder,
      previewSrc ? { kind: 'image', src: previewSrc } : { kind: 'hidden' }
    );

    if (!picker) {
      setMetaText(binding.metaEl, '当前页面未挂载 image picker');
      return;
    }

    try {
      const meta = await picker.readMeta({
        field,
        value
      });
      if (binding.input.value.trim() !== value) return;
      if (getFieldState(field).enabled === false) return;
      if (meta.previewSrc) {
        setPreview(
          binding.previewWrap,
          binding.previewImg,
          binding.previewPlaceholder,
          { kind: 'image', src: meta.previewSrc }
        );
      }
      setMetaText(binding.metaEl, formatAdminImageMetaSummary(meta));
    } catch (error) {
      if (binding.input.value.trim() !== value) return;
      if (getFieldState(field).enabled === false) return;
      setMetaText(binding.metaEl, error instanceof Error ? error.message : '路径暂时无法读取');
    }
  };

  bindings.forEach((binding) => {
    if (!(binding.input instanceof HTMLInputElement)) return;

    binding.input.addEventListener('input', () => {
      setMetaText(binding.metaEl, '等待确认路径并读取元数据');
    });
    binding.input.addEventListener('change', () => {
      void updateField(binding.config.field);
    });

    binding.button?.addEventListener('click', () => {
      if (getFieldState(binding.config.field).enabled === false) return;
      if (!picker) {
        setStatus('warn', '当前页面未挂载 image picker');
        return;
      }

      const pickerOptions = {
        field: binding.config.field,
        title: binding.config.pickerTitle,
        description: binding.config.pickerDescription,
        query: binding.input?.value ?? '',
        currentValue: binding.input?.value ?? '',
        resetLabel: binding.config.pickerResetLabel,
        onReset: () => {
          if (!(binding.input instanceof HTMLInputElement)) return;
          if (getFieldState(binding.config.field).enabled === false) return;
          binding.input.value = '';
          binding.input.dispatchEvent(new Event('input', { bubbles: true }));
          binding.input.dispatchEvent(new Event('change', { bubbles: true }));
          setStatus('ok', binding.config.pickerResetStatus);
        },
        onSelect: (item: AdminImageClientItem) => {
          if (!(binding.input instanceof HTMLInputElement)) return;
          if (getFieldState(binding.config.field).enabled === false) return;
          binding.input.value = item.value;
          binding.input.dispatchEvent(new Event('input', { bubbles: true }));
          binding.input.dispatchEvent(new Event('change', { bubbles: true }));
          setStatus('ok', `已选择本地图片：${item.value}`);
        }
      };

      picker.open({
        ...pickerOptions,
        ...(binding.config.pickerFallbackCurrentValue
          ? {
            fallbackCurrentValue: binding.config.pickerFallbackCurrentValue,
            ...(binding.config.pickerFallbackCurrentLabel
              ? { fallbackCurrentLabel: binding.config.pickerFallbackCurrentLabel }
              : {})
          }
          : {})
      });
    });

    void updateField(binding.config.field);
  });

  return {
    refresh: (field: AdminImagePickerField) => {
      void updateField(field);
    },
    refreshAll: () => {
      bindings.forEach((binding) => {
        void updateField(binding.config.field);
      });
    }
  };
};
