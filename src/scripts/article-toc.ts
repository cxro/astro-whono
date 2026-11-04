// 文章右侧目录的当前章节高亮；目录链接本身是原生 hash 导航，不依赖本脚本。
// 标题顶部越过此线即视为进入该章节。与 article-toc.css 中标题的 scroll-margin-block-start（56px）配套：
// 跳转后标题停在 56px，须越线；紧随其后的 H3（约 56 + 59px）不得越线。
const ACTIVE_LINE_OFFSET = 80;

type ActiveTocIndexInput = {
  tops: readonly number[];
  threshold: number;
  viewportHeight: number;
  atBottom: boolean;
  hashIndex: number;
};

// 返回最后一个顶部越过阈值线的标题；-1 表示尚未进入任何章节。
// 页面已滚到底时，末尾短章节的标题无法再上移到阈值线：优先采用仍在视口内的 hash 目标（刚点击的目录项），否则取最后一项。
export const resolveActiveTocIndex = ({
  tops,
  threshold,
  viewportHeight,
  atBottom,
  hashIndex
}: ActiveTocIndexInput): number => {
  let activeIndex = -1;
  tops.forEach((top, index) => {
    if (top <= threshold) activeIndex = index;
  });
  if (!atBottom) return activeIndex;

  const hashTop = tops[hashIndex];
  if (hashIndex > activeIndex && hashTop !== undefined && hashTop < viewportHeight) return hashIndex;
  return tops.length - 1;
};

const readLocationHashId = () => {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return '';
  }
};

export const initArticleToc = () => {
  const list = document.querySelector<HTMLElement>('.article-toc__list');
  if (!list) return;

  const entries = Array.from(list.querySelectorAll<HTMLAnchorElement>('.article-toc__link')).flatMap((link) => {
    const heading = document.getElementById(link.getAttribute('href')?.slice(1) ?? '');
    return heading ? [{ link, heading }] : [];
  });
  if (!entries.length) return;

  let activeIndex = -1;
  let ticking = false;

  const keepLinkVisible = (link: HTMLElement) => {
    if (list.scrollHeight <= list.clientHeight) return;
    const top = link.offsetTop;
    const bottom = top + link.offsetHeight;
    if (top < list.scrollTop) {
      list.scrollTop = top;
    } else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight;
    }
  };

  const setActive = (index: number) => {
    if (index === activeIndex) return;
    entries[activeIndex]?.link.removeAttribute('aria-current');
    activeIndex = index;
    const link = entries[index]?.link;
    if (!link) return;
    link.setAttribute('aria-current', 'location');
    keepLinkVisible(link);
  };

  const update = () => {
    ticking = false;
    // 断点只由 CSS 决定：目录隐藏（display: none）时 offsetParent 为 null，跳过布局读取。
    if (!list.offsetParent) return;

    const viewportHeight = window.innerHeight;
    const hashId = readLocationHashId();
    setActive(resolveActiveTocIndex({
      tops: entries.map(({ heading }) => heading.getBoundingClientRect().top),
      threshold: ACTIVE_LINE_OFFSET,
      viewportHeight,
      // 不可滚动的短页面不算"到底"，避免一打开就高亮最后一项。
      atBottom: window.scrollY > 0 && window.scrollY + viewportHeight >= document.documentElement.scrollHeight - 2,
      hashIndex: hashId ? entries.findIndex(({ heading }) => heading.id === hashId) : -1
    }));
  };

  const scheduleUpdate = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('hashchange', scheduleUpdate);
  window.addEventListener('astro-whono:reading-mode-change', scheduleUpdate);
  update();
};
