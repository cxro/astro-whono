const KEY = 'theme';
const root = document.documentElement;
const body = document.body;

const themeBtn = document.getElementById('theme-toggle');
const readerBtn = document.getElementById('reader-toggle');
const readerExit = document.getElementById('reader-exit');
const readerExitAnchor = readerExit?.closest('.reader-exit-anchor') as HTMLElement | null;
const mobileMq = window.matchMedia('(max-width: 900px)');

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isLongPage = () =>
  /^(?:\/(?:archive|essay|memo)(?:\/|$))/.test(window.location.pathname);

let updateFloating = () => {};

const isDark = () => root.dataset.theme === 'dark';

const applyTheme = (theme: string) => {
  root.dataset.theme = theme;
  const dark = theme === 'dark';
  if (themeBtn) {
    themeBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    const label = dark ? 'Light mode' : 'Dark mode';
    themeBtn.setAttribute('aria-label', label);
    themeBtn.setAttribute('title', label);
  }
};

const initTheme = () => {
  const current = isDark() ? 'dark' : 'light';
  applyTheme(current);
  themeBtn?.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(KEY, next);
    } catch (_) {}
  });
};

const isReaderOn = () => body?.dataset.reading === 'immersive';
const isImmersivePage = body?.classList.contains('immersive-page');

const setReaderDisabled = (disabled: boolean) => {
  if (!readerBtn) return;
  readerBtn.setAttribute('aria-pressed', 'false');
  readerBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  if (disabled) {
    readerBtn.setAttribute('title', 'Reading mode (only available on article/memo pages)');
    readerBtn.setAttribute('aria-label', 'Reading mode (only available on article/memo pages)');
    readerBtn.tabIndex = -1;
  } else {
    readerBtn.setAttribute('title', 'Reading mode');
    readerBtn.setAttribute('aria-label', 'Reading mode');
    readerBtn.tabIndex = 0;
  }
};

const applyReader = (on: boolean) => {
  if (!body) return;
  if (on) {
    body.dataset.reading = 'immersive';
  } else {
    delete body.dataset.reading;
  }
  if (readerBtn) {
    readerBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  if (readerExit) {
    readerExit.setAttribute('aria-label', 'Exit reading');
    readerExit.setAttribute('title', 'Exit reading');
  }
  setVisible(readerExit as HTMLElement | null, on);
  updateFloating();
};

const createScrollTopButton = () => {
  const template = document.getElementById('scroll-top-template');
  if (!(template instanceof HTMLTemplateElement)) return null;

  const button = template.content.firstElementChild?.cloneNode(true);
  if (!(button instanceof HTMLButtonElement)) return null;

  button.addEventListener('click', () => {
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
    window.scrollTo({ top: 0, behavior });
  });
  return button;
};

const setVisible = (el: HTMLElement | null, visible: boolean) => {
  if (!el) return;
  if (visible) {
    el.dataset.visible = 'true';
    el.removeAttribute('aria-hidden');
    el.tabIndex = 0;
  } else {
    delete el.dataset.visible;
    el.setAttribute('aria-hidden', 'true');
    el.tabIndex = -1;
  }
};

const setReaderExitInline = (inlineVisible: boolean) => {
  if (!readerExitAnchor) return;
  if (readerExitAnchor.hasAttribute('data-reader-exit-inline') === inlineVisible) return;
  readerExitAnchor.toggleAttribute('data-reader-exit-inline', inlineVisible);
};

const initFloatingActions = () => {
  if (!isLongPage()) return;

  let scrollTopBtn: HTMLButtonElement | null = null;
  let threshold = Math.max(600, window.innerHeight * 2);
  let ticking = false;

  const ensureScrollTop = () => {
    if (scrollTopBtn || !body) return;
    const nextButton = createScrollTopButton();
    if (!nextButton) return;
    scrollTopBtn = nextButton;
    body.appendChild(scrollTopBtn);
  };

  const updateThreshold = () => {
    threshold = Math.max(600, window.innerHeight * 2);
  };

  const update = () => {
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    const scrolledPast = y >= threshold;
    const isReading = isReaderOn();
    const floatExit = isReading && mobileMq.matches && scrolledPast;

    if (mobileMq.matches) {
      ensureScrollTop();
      if (scrollTopBtn) {
        scrollTopBtn.dataset.stack = floatExit ? 'true' : 'false';
      }
      setVisible(scrollTopBtn, scrolledPast);
    } else {
      setVisible(scrollTopBtn, false);
    }

    if (readerExit) {
      if (floatExit) {
        readerExit.classList.add('float-action');
      } else {
        readerExit.classList.remove('float-action');
      }
    }
    setReaderExitInline(isReading && !floatExit);
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  };

  const onResize = () => {
    updateThreshold();
    update();
  };

  updateFloating = update;
  mobileMq.addEventListener('change', update);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  update();
};

const initReader = () => {
  if (!readerBtn) return;
  if (!isImmersivePage) {
    setReaderDisabled(true);
    return;
  }

  setReaderDisabled(false);
  applyReader(false);

  readerBtn.addEventListener('click', () => {
    applyReader(!isReaderOn());
  });

  readerExit?.addEventListener('click', () => {
    applyReader(false);
  });
};

initTheme();
initFloatingActions();
initReader();
