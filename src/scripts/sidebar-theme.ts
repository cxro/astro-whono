const KEY = 'theme';
const root = document.documentElement;
const themeBtn = document.getElementById('theme-toggle');

const isDark = () => root.dataset.theme === 'dark';

const setControlLabel = (element: HTMLElement, label: string) => {
  element.setAttribute('aria-label', label);
  if (element.hasAttribute('data-tooltip')) {
    element.setAttribute('data-tooltip', label);
    element.removeAttribute('title');
    return;
  }
  element.setAttribute('title', label);
};

const applyTheme = (theme: string) => {
  root.dataset.theme = theme;
  const dark = theme === 'dark';
  if (themeBtn) {
    themeBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    const label = dark ? '浅色模式' : '夜间模式';
    setControlLabel(themeBtn, label);
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

initTheme();

export {};
