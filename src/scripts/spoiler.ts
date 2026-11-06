// `:spoiler[...]` / `:::spoiler` 模糊内容：点击或按 Enter / 空格后显示。
// 事件委托到 document，后台预览重新渲染后无需重新绑定。
const HIDDEN_SPOILER_SELECTOR = '.spoiler:not(.is-revealed)';

const findHiddenSpoiler = (target: EventTarget | null): HTMLElement | null =>
  target instanceof Element ? target.closest<HTMLElement>(HIDDEN_SPOILER_SELECTOR) : null;

const reveal = (spoiler: HTMLElement) => {
  spoiler.classList.add('is-revealed');
  spoiler.removeAttribute('role');
  spoiler.removeAttribute('aria-label');
  spoiler.removeAttribute('title');
  // 保留 -1 而不是删除，键盘焦点停在原位置。
  spoiler.tabIndex = -1;
};

document.addEventListener('click', (event) => {
  const spoiler = findHiddenSpoiler(event.target);
  if (!spoiler) return;
  // 位于链接或折叠标题内时，第一次点击只显示内容。
  event.preventDefault();
  reveal(spoiler);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.matches(HIDDEN_SPOILER_SELECTOR)) return;
  event.preventDefault();
  reveal(target);
});
