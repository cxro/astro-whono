const body = document.body;

const readerBtn = document.getElementById('reader-toggle');
const readerExit = document.getElementById('reader-exit');

const setControlLabel = (element: HTMLElement, label: string) => {
  element.setAttribute('aria-label', label);
  if (element.hasAttribute('data-tooltip')) {
    element.setAttribute('data-tooltip', label);
    element.removeAttribute('title');
    return;
  }
  element.setAttribute('title', label);
};

const isReaderOn = () => body?.dataset.reading === 'immersive';
const isImmersivePage = body?.classList.contains('immersive-page');

const notifyReadingModeChange = () => {
  window.dispatchEvent(new CustomEvent('astro-whono:reading-mode-change'));
};

const setReaderDisabled = (disabled: boolean) => {
  if (!readerBtn) return;
  readerBtn.setAttribute('aria-pressed', 'false');
  readerBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  if (disabled) {
    setControlLabel(readerBtn, '阅读模式（仅文章/小记页可用）');
    readerBtn.tabIndex = -1;
  } else {
    setControlLabel(readerBtn, '阅读模式');
    readerBtn.tabIndex = 0;
  }
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
    setControlLabel(readerExit, '退出阅读');
  }
  setVisible(readerExit as HTMLElement | null, on);
  notifyReadingModeChange();
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

initReader();

export {};
