// 文章分享卡片弹窗；绘制模块和二维码库只在第一次打开时加载。
export const initArticlePoster = () => {
  const openButton = document.querySelector<HTMLButtonElement>('[data-article-poster-open]');
  const dialog = document.querySelector<HTMLDialogElement>('[data-article-poster]');
  const image = dialog?.querySelector<HTMLImageElement>('[data-article-poster-image]');
  const status = dialog?.querySelector<HTMLElement>('[data-article-poster-status]');
  const save = dialog?.querySelector<HTMLAnchorElement>('[data-article-poster-save]');
  const closeButton = dialog?.querySelector<HTMLButtonElement>('[data-article-poster-close]');
  if (!openButton || !dialog || !image || !status || !save || !closeButton) return;

  let state: 'idle' | 'rendering' | 'ready' = 'idle';

  const renderPoster = async () => {
    state = 'rendering';
    status.textContent = '正在生成…';

    try {
      const { renderArticlePoster } = await import('./article-poster-render');
      const { siteName = '', title = '', date = '', summary = '', authorName = '', authorAvatar = '', url } = dialog.dataset;
      const dataUrl = await renderArticlePoster({
        siteName,
        title,
        date,
        summary,
        authorName,
        authorAvatar,
        url: url || `${location.origin}${location.pathname}`
      });
      image.src = dataUrl;
      save.href = dataUrl;
      image.hidden = false;
      save.hidden = false;
      // 保留给读屏软件播报，视觉上由图片取代。
      status.textContent = '分享卡片已生成';
      status.classList.add('sr-only');
      state = 'ready';
    } catch {
      status.textContent = '生成失败，点击卡片外部关闭后重试。';
      state = 'idle';
    }
  };

  openButton.disabled = false;
  openButton.addEventListener('click', () => {
    dialog.showModal();
    if (state === 'idle') void renderPoster();
  });
  closeButton.addEventListener('click', () => dialog.close());
  // 内容都在内层面板里，点到 dialog 本身就是点到了遮罩。双击打开时第二下也会落在遮罩上，不算关闭。
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog && event.detail < 2) dialog.close();
  });
};
