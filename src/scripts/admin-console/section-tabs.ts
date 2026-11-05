/* Theme Console 分组标签：一次只显示一个分组面板（其余 hidden，不卸载）；
   当前分组写进地址栏 hash，刷新后保持；含校验错误的分组在标签上显示红点。 */

type TabKeyEvent = Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>;

/** 方向键 / Home / End 切换到的标签序号（首尾循环）；其他按键或带修饰键（如 Alt+← 后退）返回 null。 */
export const getAdminSectionTabIndexForKey = (event: TabKeyEvent, current: number, count: number): number | null => {
  if (count <= 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  switch (event.key) {
    case 'ArrowRight':
      return (current + 1) % count;
    case 'ArrowLeft':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
};

type AdminSectionTabsContext = {
  root: HTMLElement;
  form: HTMLElement;
};

export const createAdminSectionTabs = ({ root, form }: AdminSectionTabsContext) => {
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-admin-tab]'));
  const getPanel = (tab: HTMLButtonElement): HTMLElement | null =>
    document.getElementById(tab.getAttribute('aria-controls') ?? '');

  const activate = (index: number, options: { focus?: boolean; updateHash?: boolean } = {}): void => {
    const nextTab = tabs[index];
    if (!nextTab) return;
    tabs.forEach((tab) => {
      const selected = tab === nextTab;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const panel = getPanel(tab);
      if (panel) panel.hidden = !selected;
    });
    if (options.focus) nextTab.focus();
    if (options.updateHash !== false) {
      history.replaceState(history.state, '', `#${nextTab.dataset.adminTab ?? ''}`);
    }
  };

  const getSelectedIndex = (): number =>
    Math.max(0, tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));

  /** 字段所在分组未显示时先切过去（校验报错定位用）。 */
  const revealField = (field: HTMLElement): void => {
    const panel = field.closest<HTMLElement>('[role="tabpanel"]');
    if (!panel?.hidden) return;
    const index = tabs.findIndex((tab) => tab.getAttribute('aria-controls') === panel.id);
    if (index >= 0) activate(index);
  };

  const syncInvalidMarkers = (): void => {
    tabs.forEach((tab) => {
      const marker = tab.querySelector<HTMLElement>('[data-admin-tab-invalid]');
      if (marker) marker.hidden = !getPanel(tab)?.querySelector('[aria-invalid="true"]');
    });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(index));
    tab.addEventListener('keydown', (event) => {
      const next = getAdminSectionTabIndexForKey(event, getSelectedIndex(), tabs.length);
      if (next === null) return;
      event.preventDefault();
      activate(next, { focus: true });
    });
  });

  // 校验标记 / 清除 aria-invalid、增删自定义社交行时同步红点。
  new MutationObserver(syncInvalidMarkers).observe(form, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['aria-invalid']
  });

  const syncFromHash = (): void => {
    const index = tabs.findIndex((tab) => tab.dataset.adminTab === window.location.hash.slice(1));
    if (index >= 0) activate(index, { updateHash: false });
  };
  window.addEventListener('hashchange', syncFromHash);
  syncFromHash();

  return { revealField };
};
