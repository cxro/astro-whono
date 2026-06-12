import { afterEach, describe, expect, it, vi } from 'vitest';

describe('admin editor recovery', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  const createDocumentRoot = ({ shellMounted = false } = {}) => {
    class TestElement {
      hidden = true;
      textContent = '';
      dataset: Record<string, string> = {};
      listeners = new Map<string, EventListener>();
      attributes = new Map<string, string>();

      constructor(public selector: string) {}

      addEventListener(type: string, listener: EventListener) {
        this.listeners.set(type, listener);
      }

      removeEventListener(type: string, listener: EventListener) {
        if (this.listeners.get(type) === listener) this.listeners.delete(type);
      }

      click() {
        this.listeners.get('click')?.({} as Event);
      }

      focus = vi.fn();

      querySelector(selector: string): TestElement | null {
        if (selector === '[data-admin-editor-recovery-copy]') return elements.copyButton;
        return null;
      }

      setAttribute(name: string, value: string) {
        this.attributes.set(name, value);
      }

      getAttribute(name: string): string | null {
        return this.attributes.get(name) ?? null;
      }

      hasAttribute(name: string): boolean {
        return name === 'hidden' ? this.hidden : this.attributes.has(name);
      }
    }

    const elements = {
      root: new TestElement('[data-admin-editor-recovery]'),
      trigger: new TestElement('[data-admin-editor-recovery-trigger]'),
      modal: new TestElement('[data-admin-editor-recovery-modal]'),
      copyButton: new TestElement('[data-admin-editor-recovery-copy]'),
      reloadButton: new TestElement('[data-admin-editor-recovery-reload]'),
      closeButton: new TestElement('[data-admin-editor-recovery-close]'),
      status: new TestElement('[data-admin-editor-recovery-status]'),
      shell: shellMounted ? new TestElement('.admin-editor-shell') : null
    };
    elements.closeButton.dataset.adminEditorRecoveryClose = 'restore';
    elements.trigger.setAttribute('aria-expanded', 'false');

    const lookup = new Map<string, TestElement | null>([
      ['[data-admin-editor-recovery]', elements.root],
      ['[data-admin-editor-recovery-trigger]', elements.trigger],
      ['[data-admin-editor-recovery-modal]', elements.modal],
      ['[data-admin-editor-recovery-copy]', elements.copyButton],
      ['[data-admin-editor-recovery-reload]', elements.reloadButton],
      ['[data-admin-editor-recovery-status]', elements.status],
      ['.admin-editor-shell', elements.shell]
    ]);

    return {
      elements,
      listeners: new Map<string, EventListener>(),
      setShellMounted: (mounted: boolean) => {
        lookup.set('.admin-editor-shell', mounted ? new TestElement('.admin-editor-shell') : null);
      },
      querySelector: vi.fn((selector: string) => lookup.get(selector) ?? null),
      querySelectorAll: vi.fn((selector: string) =>
        selector === '[data-admin-editor-recovery-close]' ? [elements.closeButton] : []
      ),
      addEventListener: vi.fn(function (
        this: { listeners: Map<string, EventListener> },
        type: string,
        listener: EventListener
      ) {
        this.listeners.set(type, listener);
      }),
      removeEventListener: vi.fn(function (
        this: { listeners: Map<string, EventListener> },
        type: string,
        listener: EventListener
      ) {
        if (this.listeners.get(type) === listener) this.listeners.delete(type);
      })
    } as unknown as Document & {
      elements: typeof elements;
      listeners: Map<string, EventListener>;
      setShellMounted: (mounted: boolean) => void;
    };
  };

  const createWindowRef = ({ manualAnimationFrame = false } = {}) => {
    const listeners = new Map<string, EventListener>();
    const animationFrameCallbacks: FrameRequestCallback[] = [];
    return {
      listeners,
      animationFrameCallbacks,
      location: {
        reload: vi.fn()
      },
      requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
        if (manualAnimationFrame) {
          animationFrameCallbacks.push(callback);
          return animationFrameCallbacks.length;
        }
        callback(0);
        return 1;
      }),
      setTimeout: (callback: () => void) => {
        callback();
        return 1;
      },
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        listeners.set(type, listener);
      }),
      removeEventListener: vi.fn((type: string, listener: EventListener) => {
        if (listeners.get(type) === listener) listeners.delete(type);
      })
    } as unknown as Window & {
      animationFrameCallbacks: FrameRequestCallback[];
      listeners: Map<string, EventListener>;
    };
  };

  it('classifies editor optimized-dep dynamic import failures', async () => {
    const { isAdminEditorRecoveryError } = await import('../src/scripts/admin-content/editor-recovery');

    expect(isAdminEditorRecoveryError(
      new Error('Failed to fetch dynamically imported module: http://localhost:4321/node_modules/.vite/deps/emoji-picker-element.js?v=old')
    )).toBe(true);
    expect(isAdminEditorRecoveryError({
      message: 'Outdated Optimize Dep',
      url: 'http://localhost:4321/src/components/admin/editor/EditorShell.svelte'
    })).toBe(true);
    expect(isAdminEditorRecoveryError({
      message: 'Outdated Optimize Dep',
      url: 'http://localhost:4321/@id/astro/runtime/client/dev-toolbar/entrypoint.js'
    })).toBe(false);
  });

  it('reveals the badge and modal when editor shell is not mounted', async () => {
    const { initAdminEditorRecovery } = await import('../src/scripts/admin-content/editor-recovery');
    const documentRoot = createDocumentRoot();
    const windowRef = createWindowRef();

    initAdminEditorRecovery(windowRef, documentRoot);
    windowRef.listeners.get('unhandledrejection')?.({
      reason: new Error('Failed to fetch dynamically imported module: http://localhost:4321/node_modules/.vite/deps/svelte.js?v=old')
    } as PromiseRejectionEvent);

    expect(documentRoot.elements.root.hidden).toBe(false);
    expect(documentRoot.elements.trigger.hidden).toBe(false);
    expect(documentRoot.elements.modal.hidden).toBe(false);
  });

  it('does not reveal recovery when editor shell has mounted', async () => {
    const { initAdminEditorRecovery } = await import('../src/scripts/admin-content/editor-recovery');
    const documentRoot = createDocumentRoot({ shellMounted: true });
    const windowRef = createWindowRef();

    initAdminEditorRecovery(windowRef, documentRoot);
    windowRef.listeners.get('vite:preloadError')?.({
      payload: {
        message: 'Outdated Optimize Dep',
        url: 'http://localhost:4321/node_modules/.vite/deps/svelte.js?v=old'
      }
    } as unknown as Event);

    expect(documentRoot.elements.root.hidden).toBe(true);
    expect(documentRoot.elements.modal.hidden).toBe(true);
  });

  it('uses error event filename and script target src when classifying failures', async () => {
    const { initAdminEditorRecovery } = await import('../src/scripts/admin-content/editor-recovery');
    const documentRoot = createDocumentRoot();
    const windowRef = createWindowRef();

    initAdminEditorRecovery(windowRef, documentRoot);
    windowRef.listeners.get('error')?.({
      message: 'error loading dynamically imported module',
      filename: '',
      target: {
        src: 'http://localhost:4321/node_modules/.vite/deps/emoji-picker-element.js?v=old'
      }
    } as unknown as ErrorEvent);

    expect(documentRoot.elements.root.hidden).toBe(false);
    expect(documentRoot.elements.modal.hidden).toBe(false);
  });

  it('reveals recovery for Astro hydration errors on editor islands', async () => {
    const { initAdminEditorRecovery } = await import('../src/scripts/admin-content/editor-recovery');
    const documentRoot = createDocumentRoot();
    const windowRef = createWindowRef();

    initAdminEditorRecovery(windowRef, documentRoot);
    windowRef.listeners.get('astro:hydration-error')?.({
      detail: {
        error: new Error('Failed to fetch dynamically imported module: http://localhost:4321/src/components/admin/editor/EditorShell.svelte#astro-retry=1'),
        componentUrl: '/src/components/admin/editor/EditorShell.svelte'
      }
    } as unknown as Event);

    expect(documentRoot.elements.root.hidden).toBe(false);
    expect(documentRoot.elements.modal.hidden).toBe(false);
  });

  it('waits a frame before showing recovery so a late-mounted shell can suppress it', async () => {
    const { initAdminEditorRecovery } = await import('../src/scripts/admin-content/editor-recovery');
    const documentRoot = createDocumentRoot();
    const windowRef = createWindowRef({ manualAnimationFrame: true });

    initAdminEditorRecovery(windowRef, documentRoot);
    windowRef.listeners.get('unhandledrejection')?.({
      reason: new Error('Failed to fetch dynamically imported module: http://localhost:4321/node_modules/.vite/deps/svelte.js?v=old')
    } as PromiseRejectionEvent);
    documentRoot.setShellMounted(true);
    windowRef.animationFrameCallbacks[0]?.(0);

    expect(documentRoot.elements.root.hidden).toBe(true);
    expect(documentRoot.elements.modal.hidden).toBe(true);
  });

  it('copies dev clean command and reloads on user actions', async () => {
    const { initAdminEditorRecovery } = await import('../src/scripts/admin-content/editor-recovery');
    const documentRoot = createDocumentRoot();
    const windowRef = createWindowRef();
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    initAdminEditorRecovery(windowRef, documentRoot);
    documentRoot.elements.copyButton.click();
    await Promise.resolve();
    documentRoot.elements.reloadButton.click();

    expect(writeText).toHaveBeenCalledWith('npm run dev:clean');
    expect(documentRoot.elements.status.textContent).toBe('已复制');
    expect(windowRef.location.reload).toHaveBeenCalledTimes(1);
  });
});
