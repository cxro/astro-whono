const body = document.body;
const readerExit = document.getElementById('reader-exit');
const readerExitAnchor = readerExit?.closest('.reader-exit-anchor') as HTMLElement | null;
const mobileMq = window.matchMedia('(max-width: 900px)');

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isLongPage = () =>
  /^(?:\/(?:archive|essay|memo)(?:\/|$))/.test(window.location.pathname);

const isReaderOn = () => body?.dataset.reading === 'immersive';

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

  window.addEventListener('astro-whono:reading-mode-change', update);
  mobileMq.addEventListener('change', update);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  update();
};

initFloatingActions();

export {};
