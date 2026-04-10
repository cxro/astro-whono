import { toSafeHttpUrl } from '../utils/format';

type LightboxImage = {
  src: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
};

type LightboxOptions = {
  dialogId?: string;
  enableZoom?: boolean;
  enablePan?: boolean;
  enableSwipeDownClose?: boolean;
  enableSwipeNav?: boolean;
};

type ArticleLightboxOptions = LightboxOptions & {
  containerSelector?: string;
  minImageSize?: number;
  imageLinkPrefixes?: string[];
};

type LightboxOpenOptions = {
  opener?: HTMLElement | null;
};

type LightboxController = {
  open: (images: LightboxImage[], index: number, options?: LightboxOpenOptions) => void;
  close: () => void;
};

const IMAGE_EXT = /\.(avif|webp|png|jpe?g|gif|svg)(?:$|[?#&])/i;
const toSafeDocumentImageUrl = (value: string) => toSafeHttpUrl(value, window.location.href);
let codeCopyInitialized = false;

const createLightboxController = (options: LightboxOptions): LightboxController | null => {
  const merged: Required<LightboxOptions> = {
    dialogId: options.dialogId ?? 'lightbox',
    enableZoom: options.enableZoom ?? true,
    enablePan: options.enablePan ?? true,
    enableSwipeDownClose: options.enableSwipeDownClose ?? true,
    enableSwipeNav: options.enableSwipeNav ?? true
  };

  const dialog = document.getElementById(merged.dialogId) as HTMLDialogElement | null;
  if (!dialog) return null;
  const imageEl = dialog.querySelector<HTMLImageElement>('[data-lightbox-image]');
  const countEl = dialog.querySelector<HTMLElement>('[data-lightbox-count]');
  const dotsEl = dialog.querySelector<HTMLElement>('[data-lightbox-dots]');
  const captionEl = dialog.querySelector<HTMLElement>('[data-lightbox-caption]');
  const closeBtn = dialog.querySelector<HTMLButtonElement>('[data-lightbox-close]');
  const prevBtn = dialog.querySelector<HTMLButtonElement>('[data-lightbox-prev]');
  const nextBtn = dialog.querySelector<HTMLButtonElement>('[data-lightbox-next]');

  let currentImages: LightboxImage[] = [];
  let currentIndex = 0;
  let dotsTotal = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchLastX = 0;
  let touchLastY = 0;
  let isTouching = false;
  let pinchStartDistance = 0;
  let pinchStartScale = 1;
  let pinchStartTranslateX = 0;
  let pinchStartTranslateY = 0;
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let dragOffsetY = 0;
  let panStartX = 0;
  let panStartY = 0;
  let panBaseX = 0;
  let panBaseY = 0;
  let gestureMode: 'swipe' | 'pan' | 'pinch' | null = null;
  let scrollLocked = false;
  let baseWidth = 0;
  let baseHeight = 0;
  let containerWidth = 0;
  let containerHeight = 0;
  let openerEl: HTMLElement | null = null;
  const scrollState = {
    top: 0,
    bodyOverflow: '',
    bodyPosition: '',
    bodyTop: '',
    bodyWidth: '',
    bodyPaddingRight: '',
    docOverflow: ''
  };

  const showDialog = () => {
    dialog.removeAttribute('hidden');
    dialog.setAttribute('aria-hidden', 'false');
  };

  const hideDialog = () => {
    dialog.setAttribute('hidden', '');
    dialog.setAttribute('aria-hidden', 'true');
  };

  const clampIndex = (value: number, length: number) => {
    if (length <= 0) return 0;
    return Math.max(0, Math.min(value, length - 1));
  };

  const clampScale = (value: number) => Math.max(1, Math.min(value, 3));

  const syncMetrics = () => {
    if (!imageEl) return;
    const rect = imageEl.getBoundingClientRect();
    const dialogRect = dialog.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      baseWidth = rect.width / scale;
      baseHeight = rect.height / scale;
    }
    containerWidth = dialogRect.width;
    containerHeight = dialogRect.height;
  };

  const clampTranslate = () => {
    if (!baseWidth || !baseHeight || !containerWidth || !containerHeight) return;
    const scaledWidth = baseWidth * scale;
    const scaledHeight = baseHeight * scale;
    const maxX = Math.max(0, (scaledWidth - containerWidth) / 2);
    const maxY = Math.max(0, (scaledHeight - containerHeight) / 2);
    translateX = Math.min(maxX, Math.max(-maxX, translateX));
    translateY = Math.min(maxY, Math.max(-maxY, translateY));
  };

  const applyTransform = () => {
    if (!imageEl) return;
    const y = translateY + dragOffsetY;
    imageEl.style.transform = `translate(${translateX}px, ${y}px) scale(${scale})`;
  };

  const resetZoom = () => {
    scale = 1;
    translateX = 0;
    translateY = 0;
    dragOffsetY = 0;
    applyTransform();
    dialog.style.removeProperty('--lb-backdrop');
  };

  const setCaption = (caption?: string) => {
    if (!captionEl) return;
    const text = (caption ?? '').trim();
    captionEl.textContent = text;
    captionEl.toggleAttribute('hidden', !text);
  };

  const updateView = () => {
    const image = currentImages[currentIndex];
    if (!image || !imageEl) return;
    const nextSrc = toSafeDocumentImageUrl(image.src);
    if (nextSrc) imageEl.src = nextSrc;
    else imageEl.removeAttribute('src');
    imageEl.alt = image.alt ?? '';
    if (image.width) imageEl.width = image.width;
    else imageEl.removeAttribute('width');
    if (image.height) imageEl.height = image.height;
    else imageEl.removeAttribute('height');
    setCaption(image.caption);
    resetZoom();
    if (countEl) {
      countEl.textContent = `${currentIndex + 1} / ${currentImages.length}`;
    }
    updateDots();
    window.requestAnimationFrame(() => {
      syncMetrics();
      clampTranslate();
      applyTransform();
    });
  };

  const updateNav = () => {
    if (prevBtn) prevBtn.disabled = currentIndex <= 0;
    if (nextBtn) nextBtn.disabled = currentIndex >= currentImages.length - 1;
  };

  const updateDots = () => {
    if (!dotsEl) return;
    const total = currentImages.length;
    if (total <= 1) {
      dotsEl.textContent = '';
      dotsTotal = 0;
      return;
    }
    if (total !== dotsTotal) {
      dotsEl.textContent = '';
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < total; i += 1) {
        const dot = document.createElement('span');
        dot.className = 'lightbox-dot';
        fragment.appendChild(dot);
      }
      dotsEl.appendChild(fragment);
      dotsTotal = total;
    }
    const dots = Array.from(dotsEl.querySelectorAll<HTMLElement>('.lightbox-dot'));
    dots.forEach((dot, index) => {
      dot.classList.toggle('is-active', index === currentIndex);
    });
  };

  const stepIndex = (delta: number) => {
    if (currentImages.length === 0) return;
    const next = currentIndex + delta;
    if (next < 0 || next >= currentImages.length) return;
    currentIndex = next;
    updateView();
    updateNav();
  };

  const resetDrag = () => {
    dragOffsetY = 0;
    applyTransform();
    dialog.style.removeProperty('--lb-backdrop');
  };

  const lockScroll = () => {
    if (scrollLocked) return;
    const body = document.body;
    const doc = document.documentElement;
    scrollState.top = window.scrollY || doc.scrollTop || 0;
    scrollState.bodyOverflow = body.style.overflow;
    scrollState.bodyPosition = body.style.position;
    scrollState.bodyTop = body.style.top;
    scrollState.bodyWidth = body.style.width;
    scrollState.bodyPaddingRight = body.style.paddingRight;
    scrollState.docOverflow = doc.style.overflow;
    const scrollbarWidth = window.innerWidth - doc.clientWidth;
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollState.top}px`;
    body.style.width = '100%';
    doc.style.overflow = 'hidden';
    scrollLocked = true;
  };

  const unlockScroll = () => {
    if (!scrollLocked) return;
    const body = document.body;
    const doc = document.documentElement;
    body.style.overflow = scrollState.bodyOverflow;
    body.style.position = scrollState.bodyPosition;
    body.style.top = scrollState.bodyTop;
    body.style.width = scrollState.bodyWidth;
    body.style.paddingRight = scrollState.bodyPaddingRight;
    doc.style.overflow = scrollState.docOverflow;
    window.scrollTo(0, scrollState.top);
    scrollLocked = false;
  };

  const focusDialogTarget = () => {
    const target = closeBtn ?? dialog;
    window.requestAnimationFrame(() => {
      target.focus({ preventScroll: true });
    });
  };

  const restoreOpenerFocus = () => {
    const target = openerEl;
    openerEl = null;
    if (!target?.isConnected) return;
    window.requestAnimationFrame(() => {
      target.focus({ preventScroll: true });
    });
  };

  const openDialog = (images: LightboxImage[], index: number, openOptions?: LightboxOpenOptions) => {
    if (images.length === 0) return;
    openerEl = openOptions?.opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    currentImages = images;
    currentIndex = clampIndex(index, images.length);
    updateView();
    updateNav();
    showDialog();
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }
    lockScroll();
    focusDialogTarget();
  };

  const closeDialog = () => {
    if (dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
      resetDrag();
      unlockScroll();
    }
    hideDialog();
    restoreOpenerFocus();
  };

  const init = () => {
    window.addEventListener('resize', () => {
      if (!dialog.open) return;
      syncMetrics();
      clampTranslate();
      applyTransform();
    });

    prevBtn?.addEventListener('click', () => stepIndex(-1));
    nextBtn?.addEventListener('click', () => stepIndex(1));

    closeBtn?.addEventListener('click', closeDialog);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) closeDialog();
    });
    dialog.addEventListener('cancel', closeDialog);
    dialog.addEventListener('keydown', (event) => {
      if (!dialog.open) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        stepIndex(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        stepIndex(1);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog();
      }
    });

    if (imageEl) {
      imageEl.addEventListener('load', () => {
        syncMetrics();
        clampTranslate();
        applyTransform();
      });

      imageEl.addEventListener('touchstart', (event) => {
        if (!dialog.open) return;
        if (event.touches.length === 2) {
          if (!merged.enableZoom) return;
          const touchA = event.touches.item(0);
          const touchB = event.touches.item(1);
          if (!touchA || !touchB) return;
          const dx = touchA.clientX - touchB.clientX;
          const dy = touchA.clientY - touchB.clientY;
          pinchStartDistance = Math.hypot(dx, dy);
          pinchStartScale = scale;
          pinchStartTranslateX = translateX;
          pinchStartTranslateY = translateY;
          gestureMode = 'pinch';
          isTouching = true;
          return;
        }
        if (event.touches.length !== 1) return;
        const touch = event.touches.item(0);
        if (!touch) return;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchLastX = touchStartX;
        touchLastY = touchStartY;
        if (merged.enablePan && scale > 1.01) {
          gestureMode = 'pan';
          panStartX = touchStartX;
          panStartY = touchStartY;
          panBaseX = translateX;
          panBaseY = translateY;
        } else if (merged.enableSwipeNav || merged.enableSwipeDownClose) {
          gestureMode = 'swipe';
        } else {
          gestureMode = null;
        }
        isTouching = true;
      }, { passive: true });

      imageEl.addEventListener('touchmove', (event) => {
        if (!isTouching) return;
        if (gestureMode === 'pinch' && event.touches.length === 2 && merged.enableZoom) {
          const touchA = event.touches.item(0);
          const touchB = event.touches.item(1);
          if (!touchA || !touchB) return;
          const dx = touchA.clientX - touchB.clientX;
          const dy = touchA.clientY - touchB.clientY;
          const distance = Math.hypot(dx, dy);
          if (pinchStartDistance > 0) {
            const dialogRect = dialog.getBoundingClientRect();
            const centerX = (touchA.clientX + touchB.clientX) / 2 - (dialogRect.left + dialogRect.width / 2);
            const centerY = (touchA.clientY + touchB.clientY) / 2 - (dialogRect.top + dialogRect.height / 2);
            const nextScale = clampScale(pinchStartScale * (distance / pinchStartDistance));
            const ratio = nextScale / pinchStartScale;
            translateX = centerX - (centerX - pinchStartTranslateX) * ratio;
            translateY = centerY - (centerY - pinchStartTranslateY) * ratio;
            scale = nextScale;
            syncMetrics();
            clampTranslate();
            applyTransform();
          }
          return;
        }
        if (event.touches.length !== 1) return;
        const touch = event.touches.item(0);
        if (!touch) return;
        touchLastX = touch.clientX;
        touchLastY = touch.clientY;
        const dx = touchLastX - touchStartX;
        const dy = touchLastY - touchStartY;
        if (gestureMode === 'pan' && merged.enablePan) {
          translateX = panBaseX + (touchLastX - panStartX);
          translateY = panBaseY + (touchLastY - panStartY);
          syncMetrics();
          clampTranslate();
          applyTransform();
          return;
        }
        if (gestureMode === 'swipe' && merged.enableSwipeDownClose) {
          if (Math.abs(dy) > Math.abs(dx) && dy > 0) {
            dragOffsetY = dy;
            applyTransform();
            const dim = Math.max(0.4, 0.85 - dy / 420);
            dialog.style.setProperty('--lb-backdrop', `rgba(0, 0, 0, ${dim})`);
          }
        }
      }, { passive: true });

      imageEl.addEventListener('touchend', (event) => {
        if (!isTouching) return;
        if (event.touches.length > 0) {
          if (gestureMode === 'pinch' && event.touches.length === 1) {
            gestureMode = scale > 1.01 ? 'pan' : 'swipe';
          }
          return;
        }
        const dx = touchLastX - touchStartX;
        const dy = touchLastY - touchStartY;
        isTouching = false;
        if (gestureMode === 'pinch') {
          if (scale <= 1.01) {
            scale = 1;
            translateX = 0;
            translateY = 0;
            applyTransform();
          } else {
            syncMetrics();
            clampTranslate();
            applyTransform();
          }
          gestureMode = null;
          return;
        }
        if (gestureMode === 'pan') {
          syncMetrics();
          clampTranslate();
          applyTransform();
          gestureMode = null;
          return;
        }
        if (gestureMode === 'swipe') {
          if (merged.enableSwipeNav && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && scale <= 1.01) {
            stepIndex(dx > 0 ? -1 : 1);
            resetDrag();
            gestureMode = null;
            return;
          }
          if (merged.enableSwipeDownClose && dy > 80 && dy > Math.abs(dx) && scale <= 1.01) {
            closeDialog();
            gestureMode = null;
            return;
          }
          resetDrag();
        }
        gestureMode = null;
      });

      imageEl.addEventListener('touchcancel', () => {
        isTouching = false;
        gestureMode = null;
        resetDrag();
      });
    }
  };

  init();

  return {
    open: openDialog,
    close: closeDialog
  };
};

export const initCodeCopyButtons = () => {
  if (codeCopyInitialized) return;

  const buttons = document.querySelectorAll<HTMLButtonElement>('.code-copy');
  if (!buttons.length) return;

  codeCopyInitialized = true;
  buttons.forEach((button) => {
    button.disabled = false;
  });

  const legacyCopy = (value: string) => {
    const helper = document.createElement('textarea');
    helper.value = value;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    const execCommand = Reflect.get(document, 'execCommand');
    const ok = typeof execCommand === 'function' ? Boolean(execCommand.call(document, 'copy')) : false;
    helper.remove();
    return ok;
  };

  document.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest<HTMLButtonElement>('.code-copy');
    if (!button) return;

    const code = button.closest('.code-block')?.querySelector('pre code');
    const text = code?.textContent ?? '';
    if (!text) return;

    const canClipboard = Boolean(
      navigator.clipboard
      && typeof navigator.clipboard.writeText === 'function'
      && window.isSecureContext
    );

    let copied = false;
    if (canClipboard) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }
    } else {
      copied = legacyCopy(text);
    }

    if (!copied) return;

    button.dataset.state = 'copied';
    button.setAttribute('aria-label', 'Copied');
    button.setAttribute('title', 'Copied');
    window.setTimeout(() => {
      button.dataset.state = 'idle';
      button.setAttribute('aria-label', 'Copy Code');
      button.setAttribute('title', 'Copy Code');
    }, 1200);
  });
};

export const initBitsLightbox = (options: LightboxOptions = {}) => {
  const controller = createLightboxController({
    enableZoom: true,
    enablePan: true,
    enableSwipeDownClose: true,
    enableSwipeNav: true,
    ...options
  });
  if (!controller) return;

  const imagesCache = new WeakMap<HTMLElement, LightboxImage[]>();
  const parsePositiveDimension = (value: string | undefined) => {
    const parsed = Number(value ?? '');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  };
  const toBitLightboxImage = (node: HTMLElement): LightboxImage | null => {
    const safeSrc = toSafeDocumentImageUrl(node.dataset.bitImageSrc ?? '');
    if (!safeSrc) return null;
    const alt = node.dataset.bitImageAlt ?? '';
    const width = parsePositiveDimension(node.dataset.bitImageWidth);
    const height = parsePositiveDimension(node.dataset.bitImageHeight);
    return {
      src: safeSrc,
      ...(alt ? { alt } : {}),
      ...(width ? { width } : {}),
      ...(height ? { height } : {})
    };
  };

  const parseImages = (card: HTMLElement) => {
    const cached = imagesCache.get(card);
    if (cached) return cached;
    const imageNodes = Array.from(card.querySelectorAll<HTMLElement>('[data-bit-image-item]'));
    if (imageNodes.length === 0) return null;
    const sanitized = imageNodes
      .map(toBitLightboxImage)
      .filter((item): item is LightboxImage => item !== null);
    if (sanitized.length === 0) return null;
    imagesCache.set(card, sanitized);
    return sanitized;
  };

  const handleOpen = (button: HTMLButtonElement, index: number) => {
    const card = button.closest<HTMLElement>('[data-bit]');
    if (!card) return;
    const images = parseImages(card);
    if (!images || images.length === 0) return;
    controller.open(images, index, { opener: button });
  };

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const hiddenTrigger = target.closest<HTMLElement>('[data-bit-image-open-hidden]');
    if (hiddenTrigger) {
      const button = hiddenTrigger.closest<HTMLButtonElement>('[data-bit-image-button]');
      if (!button) return;
      const hiddenIndex = Number(hiddenTrigger.getAttribute('data-bit-image-open-hidden') ?? '0');
      handleOpen(button, hiddenIndex);
      return;
    }
    const button = target.closest<HTMLButtonElement>('[data-bit-image-button]');
    if (!button) return;
    const index = Number(button.getAttribute('data-bit-image-index') ?? '0');
    handleOpen(button, index);
  });
};

const isLikelyImageHref = (href: string) => {
  if (!href) return false;
  return IMAGE_EXT.test(href);
};

const isSameOriginImagePath = (href: string, prefixes: string[]) => {
  try {
    const url = new URL(href, window.location.href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (url.origin !== window.location.origin) return false;
    return prefixes.some((prefix) => url.pathname.startsWith(prefix));
  } catch {
    return false;
  }
};

const shouldUseLinkHref = (href: string, prefixes: string[]) => {
  if (!href) return false;
  return isLikelyImageHref(href) || isSameOriginImagePath(href, prefixes);
};

const getCaption = (img: HTMLImageElement) => {
  const figure = img.closest('figure');
  const caption = figure?.querySelector('figcaption');
  if (!caption) return '';
  return caption.textContent?.trim() ?? '';
};

const getPreferredSrc = (img: HTMLImageElement, href?: string) => {
  if (href) return toSafeDocumentImageUrl(href);
  return toSafeDocumentImageUrl(img.currentSrc || img.src || '');
};

const isTinyImage = (img: HTMLImageElement, minSize: number) => {
  const width = img.naturalWidth || Number(img.getAttribute('width')) || 0;
  const height = img.naturalHeight || Number(img.getAttribute('height')) || 0;
  if (!width || !height) return false;
  return width < minSize && height < minSize;
};

export const initArticleLightbox = (options: ArticleLightboxOptions = {}) => {
  const controller = createLightboxController({
    enableZoom: false,
    enablePan: false,
    enableSwipeDownClose: false,
    enableSwipeNav: true,
    ...options
  });
  if (!controller) return;

  const containerSelector = options.containerSelector ?? '.prose';
  const container = document.querySelector<HTMLElement>(containerSelector);
  if (!container) return;

  const minImageSize = options.minImageSize ?? 40;
  const linkPrefixes = options.imageLinkPrefixes ?? ['/images/', '/assets/', '/bits/'];
  const dialogId = options.dialogId ?? 'lightbox';

  const items: Array<{
    el: HTMLImageElement;
    triggerEl: HTMLElement;
    image: LightboxImage;
  }> = [];

  const images = Array.from(container.querySelectorAll<HTMLImageElement>('img'));
  images.forEach((img) => {
    if (img.dataset.lightbox === 'false') return;
    if (img.closest('[data-no-lightbox]')) return;
    if (isTinyImage(img, minImageSize)) return;

    const link = img.closest<HTMLAnchorElement>('a[href]');
    const href = link?.href ?? '';
    if (link && !shouldUseLinkHref(href, linkPrefixes)) {
      return;
    }

    const useHref = shouldUseLinkHref(href, linkPrefixes);
    const src = getPreferredSrc(img, useHref ? href : undefined);
    if (!src) return;

    const triggerEl = link ?? img;
    const image: LightboxImage = {
      src,
      alt: img.alt ?? ''
    };
    const caption = getCaption(img);
    if (caption) image.caption = caption;
    if (img.naturalWidth > 0) image.width = img.naturalWidth;
    if (img.naturalHeight > 0) image.height = img.naturalHeight;
    items.push({ el: img, triggerEl, image });
  });

  if (items.length === 0) return;

  items.forEach((item, index) => {
    item.el.dataset.lightbox = 'true';
    item.el.dataset.lightboxIndex = String(index);
    item.triggerEl.dataset.lightboxTrigger = 'true';
    item.triggerEl.dataset.lightboxIndex = String(index);
    item.triggerEl.setAttribute('aria-haspopup', 'dialog');
    item.triggerEl.setAttribute('aria-controls', dialogId);
    if (item.triggerEl === item.el) {
      item.el.tabIndex = 0;
      item.el.setAttribute('role', 'button');
      if (!item.el.getAttribute('alt')?.trim() && !item.el.getAttribute('aria-label')) {
        item.el.setAttribute('aria-label', 'Open Image Preview');
      }
    }
  });

  const openFromTrigger = (trigger: HTMLElement) => {
    const index = Number(trigger.getAttribute('data-lightbox-index') ?? '-1');
    if (!Number.isFinite(index) || index < 0 || index >= items.length) return;

    const list = items.map((item) => {
      const link = item.el.closest<HTMLAnchorElement>('a[href]');
      const href = link?.href ?? '';
      const useHref = link ? shouldUseLinkHref(href, linkPrefixes) : false;
      const nextSrc = getPreferredSrc(item.el, useHref ? href : undefined) || item.image.src;
      return {
        ...item.image,
        src: nextSrc
      };
    });
    controller.open(list, index, { opener: trigger });
  };

  container.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const trigger = target.closest<HTMLElement>('[data-lightbox-trigger="true"]');
    if (!trigger) return;
    const img = items.find((item) => item.triggerEl === trigger)?.el;
    if (!img) return;
    if (isTinyImage(img, minImageSize)) return;

    if (trigger instanceof HTMLAnchorElement) {
      if (event.metaKey || event.ctrlKey) return;
      event.preventDefault();
    } else {
      event.preventDefault();
    }

    openFromTrigger(trigger);
  });

  container.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const trigger = target.closest<HTMLElement>('[data-lightbox-trigger="true"]');
    if (!trigger || trigger instanceof HTMLAnchorElement || trigger instanceof HTMLButtonElement) return;
    event.preventDefault();
    openFromTrigger(trigger);
  });
};

export const initGalleryLightbox = (options: LightboxOptions = {}) => {
  const controller = createLightboxController({
    enableZoom: true,
    enablePan: true,
    enableSwipeDownClose: true,
    enableSwipeNav: true,
    ...options
  });
  if (!controller) return;

  const imagesCache = new WeakMap<HTMLElement, LightboxImage[]>();
  const parsePositiveDimension = (value: string | undefined) => {
    const parsed = Number(value ?? '');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  };
  const toGalleryLightboxImage = (node: HTMLElement): LightboxImage | null => {
    const safeSrc = toSafeDocumentImageUrl(node.dataset.galleryImageSrc ?? '');
    if (!safeSrc) return null;
    const alt = node.dataset.galleryImageAlt ?? '';
    const width = parsePositiveDimension(node.dataset.galleryImageWidth);
    const height = parsePositiveDimension(node.dataset.galleryImageHeight);
    return {
      src: safeSrc,
      ...(alt ? { alt } : {}),
      ...(width ? { width } : {}),
      ...(height ? { height } : {})
    };
  };

  const parseImages = (card: HTMLElement) => {
    const cached = imagesCache.get(card);
    if (cached) return cached;
    const imageNodes = Array.from(card.querySelectorAll<HTMLElement>('[data-gallery-image-item]'));
    if (imageNodes.length === 0) return null;
    const sanitized = imageNodes
      .map(toGalleryLightboxImage)
      .filter((item): item is LightboxImage => item !== null);
    if (sanitized.length === 0) return null;
    imagesCache.set(card, sanitized);
    return sanitized;
  };

  const handleOpen = (button: HTMLButtonElement, index: number) => {
    const card = button.closest<HTMLElement>('[data-gallery]');
    if (!card) return;
    const images = parseImages(card);
    if (!images || images.length === 0) return;
    controller.open(images, index, { opener: button });
  };

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const button = target.closest<HTMLButtonElement>('[data-gallery-image-button]');
    if (!button) return;
    const index = Number(button.getAttribute('data-gallery-image-index') ?? '0');
    handleOpen(button, index);
  });
};