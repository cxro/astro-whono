import {
  ADMIN_SIDEBAR_NAV_ADMIN,
  ADMIN_SIDEBAR_NAV_MODE_STORAGE_KEY,
  ADMIN_SIDEBAR_NAV_PUBLIC,
  isAdminSidebarNavMode,
  type AdminSidebarNavMode
} from '../lib/admin-console/ui-prefs-keys';

type SidebarNavElements = {
  container: HTMLElement;
  stage: HTMLElement;
  panels: Record<AdminSidebarNavMode, HTMLElement>;
};

type Cleanup = () => void;

const ADMIN_RAIL_VIEWPORT_QUERY = '(max-width: 900px)';
const NAV_SWITCH_LABEL = '后台导航';

const getNavSwitchTitle = (mode: AdminSidebarNavMode): string =>
  mode === ADMIN_SIDEBAR_NAV_ADMIN ? '切换到前台导航' : '切换到后台导航';

const readStoredMode = (): AdminSidebarNavMode | null => {
  try {
    const stored = sessionStorage.getItem(ADMIN_SIDEBAR_NAV_MODE_STORAGE_KEY) ?? undefined;
    return isAdminSidebarNavMode(stored) ? stored : null;
  } catch (_) {
    return null;
  }
};

const writeStoredMode = (mode: AdminSidebarNavMode) => {
  try {
    sessionStorage.setItem(ADMIN_SIDEBAR_NAV_MODE_STORAGE_KEY, mode);
  } catch (_) {}
};

const getSidebarNavElements = (): SidebarNavElements[] =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-admin-sidebar-nav]'))
    .map((container) => {
      const stage = container.querySelector<HTMLElement>('[data-admin-nav-stage]');
      const publicPanel = container.querySelector<HTMLElement>(
        `[data-admin-nav-panel="${ADMIN_SIDEBAR_NAV_PUBLIC}"]`
      );
      const adminPanel = container.querySelector<HTMLElement>(
        `[data-admin-nav-panel="${ADMIN_SIDEBAR_NAV_ADMIN}"]`
      );

      if (!stage || !publicPanel || !adminPanel) return null;

      return {
        container,
        stage,
        panels: {
          [ADMIN_SIDEBAR_NAV_PUBLIC]: publicPanel,
          [ADMIN_SIDEBAR_NAV_ADMIN]: adminPanel
        }
      };
    })
    .filter((entry): entry is SidebarNavElements => entry !== null);

const setNavItemDelays = (elements: readonly SidebarNavElements[]) => {
  elements.forEach(({ panels }) => {
    Object.values(panels).forEach((panel) => {
      Array.from(panel.children).forEach((item, index) => {
        if (item instanceof HTMLElement) {
          item.style.setProperty('--sidebar-nav-item-delay', `${45 + index * 18}ms`);
        }
      });
    });
  });
};

const updatePanelAccessibility = (
  elements: readonly SidebarNavElements[],
  mode: AdminSidebarNavMode
) => {
  elements.forEach(({ panels }) => {
    Object.entries(panels).forEach(([panelMode, panel]) => {
      const isActive = panelMode === mode;
      panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      panel.toggleAttribute('inert', !isActive);
    });
  });
};

const measurePanelHeight = (elements: SidebarNavElements, mode: AdminSidebarNavMode): number =>
  elements.panels[mode].offsetHeight;

const syncStageHeight = (elements: readonly SidebarNavElements[], mode: AdminSidebarNavMode) => {
  elements.forEach((entry) => {
    const height = measurePanelHeight(entry, mode);
    entry.stage.style.setProperty('--sidebar-nav-stage-height', `${height}px`);
  });
};

const markPanelsReady = (elements: readonly SidebarNavElements[]) => {
  elements.forEach(({ container }) => {
    container.dataset.adminNavReady = 'true';
  });
};

const clearStageState = (elements: readonly SidebarNavElements[]) => {
  elements.forEach(({ container, stage }) => {
    delete container.dataset.adminNavReady;
    stage.style.removeProperty('--sidebar-nav-stage-height');
  });
};

const syncSwitchers = (
  switchers: readonly HTMLButtonElement[],
  mode: AdminSidebarNavMode
) => {
  const isAdminMode = mode === ADMIN_SIDEBAR_NAV_ADMIN;
  const title = getNavSwitchTitle(mode);
  switchers.forEach((button) => {
    button.setAttribute('aria-checked', isAdminMode ? 'true' : 'false');
    button.setAttribute('aria-label', NAV_SWITCH_LABEL);
    button.setAttribute('title', title);
  });
};

export function initAdminSidebarNavMode() {
  const root = document.documentElement;
  const isAdminPage = document.body.classList.contains('admin-page');
  const railViewportQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia(ADMIN_RAIL_VIEWPORT_QUERY)
    : null;
  let activeCleanup: Cleanup | null = null;

  const isAdminRailViewport = () => isAdminPage && Boolean(railViewportQuery?.matches);

  const mount = (): Cleanup | null => {
    const navElements = getSidebarNavElements();
    const switchers = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-admin-nav-switcher]')
    );
    if (switchers.length === 0 || navElements.length === 0) return null;

    const initialMode = isAdminSidebarNavMode(root.dataset.adminNavMode)
      ? root.dataset.adminNavMode
      : (readStoredMode() ?? ADMIN_SIDEBAR_NAV_PUBLIC);
    let current: AdminSidebarNavMode = initialMode;
    let pendingFrame: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const cleanupSwitchers: Cleanup[] = [];

    setNavItemDelays(navElements);

    const applyMode = (mode: AdminSidebarNavMode, persist: boolean, animate = true) => {
      const previous = current;
      current = mode;

      if (animate) {
        syncStageHeight(navElements, previous);
      }
      root.dataset.adminNavMode = mode;
      updatePanelAccessibility(navElements, mode);
      syncSwitchers(switchers, mode);

      if (animate) {
        if (pendingFrame !== null) {
          cancelAnimationFrame(pendingFrame);
        }
        pendingFrame = requestAnimationFrame(() => {
          pendingFrame = null;
          syncStageHeight(navElements, mode);
        });
      } else {
        syncStageHeight(navElements, mode);
      }

      if (persist) writeStoredMode(mode);
    };

    applyMode(current, false, false);
    markPanelsReady(navElements);

    const syncCurrentStageHeight = () => syncStageHeight(navElements, current);
    window.addEventListener('resize', syncCurrentStageHeight);
    window.addEventListener('load', syncCurrentStageHeight, { once: true });

    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(syncCurrentStageHeight);
      navElements.forEach(({ panels }) => {
        Object.values(panels).forEach((panel) => resizeObserver?.observe(panel));
      });
    }

    switchers.forEach((button) => {
      const handleClick = () => {
        applyMode(
          current === ADMIN_SIDEBAR_NAV_ADMIN ? ADMIN_SIDEBAR_NAV_PUBLIC : ADMIN_SIDEBAR_NAV_ADMIN,
          true
        );
      };
      button.addEventListener('click', handleClick);
      cleanupSwitchers.push(() => button.removeEventListener('click', handleClick));
    });

    return () => {
      window.removeEventListener('resize', syncCurrentStageHeight);
      window.removeEventListener('load', syncCurrentStageHeight);
      if (pendingFrame !== null) {
        cancelAnimationFrame(pendingFrame);
        pendingFrame = null;
      }
      resizeObserver?.disconnect();
      cleanupSwitchers.forEach((cleanup) => cleanup());
      clearStageState(navElements);
    };
  };

  const unmount = () => {
    activeCleanup?.();
    activeCleanup = null;
  };

  const syncLifecycle = () => {
    if (isAdminRailViewport()) {
      unmount();
      return;
    }

    if (!activeCleanup) {
      activeCleanup = mount();
    }
  };

  syncLifecycle();

  if (!isAdminPage || !railViewportQuery) return;

  const handleViewportChange = () => {
    syncLifecycle();
  };

  railViewportQuery.addEventListener('change', handleViewportChange);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminSidebarNavMode, { once: true });
} else {
  initAdminSidebarNavMode();
}
