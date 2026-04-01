type AdminContentBootstrap = {
  endpoint: string;
  collection: 'essay' | 'bits';
  entryId: string;
  revision: string;
};

type AdminContentIssue = {
  path: string;
  message: string;
};

type AdminContentWriteResult = {
  changed: boolean;
  written: boolean;
  changedFields: string[];
  relativePath: string;
};

const adminContentRoot = document.querySelector<HTMLElement>('[data-admin-content-root]');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseBootstrap = (value: string): AdminContentBootstrap | null => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) return null;
    const endpoint = typeof parsed.endpoint === 'string' ? parsed.endpoint.trim() : '';
    const collection = parsed.collection === 'essay' || parsed.collection === 'bits' ? parsed.collection : null;
    const entryId = typeof parsed.entryId === 'string' ? parsed.entryId.trim() : '';
    const revision = typeof parsed.revision === 'string' ? parsed.revision.trim() : '';
    if (!endpoint || !collection || !entryId || !revision) return null;

    return {
      endpoint,
      collection,
      entryId,
      revision
    };
  } catch {
    return null;
  }
};

const getStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];

const parseResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const getPayloadErrors = (value: unknown): string[] =>
  isRecord(value) ? getStringArray(value.errors) : [];

const getPayloadIssues = (value: unknown): AdminContentIssue[] => {
  if (!isRecord(value) || !Array.isArray(value.issues)) return [];

  return value.issues
    .filter((item): item is AdminContentIssue => isRecord(item) && typeof item.path === 'string' && typeof item.message === 'string')
    .map((item) => ({
      path: item.path.trim(),
      message: item.message.trim()
    }));
};

const getPayloadRevision = (value: unknown): string | null => {
  if (!isRecord(value) || !isRecord(value.payload)) return null;
  const revision = value.payload.revision;
  return typeof revision === 'string' && revision.trim().length > 0 ? revision.trim() : null;
};

const getPayloadResult = (value: unknown): AdminContentWriteResult | null => {
  if (!isRecord(value) || !isRecord(value.result)) return null;
  return {
    changed: value.result.changed === true,
    written: value.result.written === true,
    changedFields: getStringArray(value.result.changedFields),
    relativePath: typeof value.result.relativePath === 'string' ? value.result.relativePath.trim() : ''
  };
};

if (!adminContentRoot) {
  // Current page does not mount the admin content console.
} else {
  const byId = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

  const statusLiveEl = byId<HTMLElement>('admin-content-status-live');
  const statusEl = byId<HTMLElement>('admin-content-status');
  const bootstrapEl = byId<HTMLDivElement>('admin-content-bootstrap');
  const editorForm = byId<HTMLFormElement>('admin-content-editor-form');
  const errorBannerEl = byId<HTMLElement>('admin-content-editor-error-banner');
  const errorTitleEl = byId<HTMLElement>('admin-content-editor-error-title');
  const errorMessageEl = byId<HTMLElement>('admin-content-editor-error-message');
  const errorListEl = byId<HTMLElement>('admin-content-editor-error-list');
  const previewEl = byId<HTMLElement>('admin-content-write-preview');
  const previewTitleEl = byId<HTMLElement>('admin-content-write-preview-title');
  const previewBodyEl = byId<HTMLElement>('admin-content-write-preview-body');
  const previewListEl = byId<HTMLElement>('admin-content-write-preview-list');
  const dryRunBtn = byId<HTMLButtonElement>('admin-content-dry-run');
  const saveBtn = byId<HTMLButtonElement>('admin-content-save');

  const setStatus = (
    state: 'idle' | 'loading' | 'ready' | 'ok' | 'warn' | 'error',
    text: string,
    options: {
      announce?: boolean;
    } = {}
  ) => {
    if (!(statusEl instanceof HTMLElement) || !(statusLiveEl instanceof HTMLElement)) return;
    const { announce = true } = options;
    statusEl.dataset.state = state;
    statusEl.textContent = text;
    statusLiveEl.textContent = announce ? text : '';
  };

  const clearPreview = () => {
    if (!(previewEl instanceof HTMLElement) || !(previewTitleEl instanceof HTMLElement) || !(previewBodyEl instanceof HTMLElement) || !(previewListEl instanceof HTMLElement)) {
      return;
    }

    previewEl.hidden = true;
    previewTitleEl.textContent = '';
    previewBodyEl.textContent = '';
    previewListEl.replaceChildren();
  };

  const clearFieldErrors = () => {
    adminContentRoot.querySelectorAll<HTMLElement>('[data-field-error]').forEach((element) => {
      element.hidden = true;
      element.textContent = '';
    });
    adminContentRoot.querySelectorAll<HTMLElement>('[data-field-path]').forEach((element) => {
      element.classList.remove('is-invalid');
    });
  };

  const clearErrors = () => {
    clearFieldErrors();
    if (!(errorBannerEl instanceof HTMLElement) || !(errorTitleEl instanceof HTMLElement) || !(errorMessageEl instanceof HTMLElement) || !(errorListEl instanceof HTMLElement)) {
      return;
    }

    errorBannerEl.hidden = true;
    errorTitleEl.textContent = 'frontmatter 未写入';
    errorMessageEl.hidden = true;
    errorMessageEl.textContent = '';
    errorListEl.hidden = true;
    errorListEl.replaceChildren();
  };

  const setIssues = (issues: readonly AdminContentIssue[]) => {
    clearFieldErrors();
    for (const issue of issues) {
      const field = adminContentRoot.querySelector<HTMLElement>(`[data-field-path="${issue.path}"]`);
      const fieldError = adminContentRoot.querySelector<HTMLElement>(`[data-field-error="${issue.path}"]`);
      field?.classList.add('is-invalid');
      if (fieldError) {
        fieldError.hidden = false;
        fieldError.textContent = issue.message;
      }
    }
  };

  const setErrors = (
    errors: readonly string[],
    issues: readonly AdminContentIssue[] = [],
    options: {
      title?: string;
      message?: string;
    } = {}
  ) => {
    if (!(errorBannerEl instanceof HTMLElement) || !(errorTitleEl instanceof HTMLElement) || !(errorMessageEl instanceof HTMLElement) || !(errorListEl instanceof HTMLElement)) {
      return;
    }

    setIssues(issues);
    errorTitleEl.textContent = options.title ?? 'frontmatter 未写入';
    if (options.message) {
      errorMessageEl.hidden = false;
      errorMessageEl.textContent = options.message;
    } else {
      errorMessageEl.hidden = true;
      errorMessageEl.textContent = '';
    }

    errorListEl.replaceChildren();
    if (errors.length > 0) {
      const fragment = document.createDocumentFragment();
      for (const error of errors) {
        const item = document.createElement('li');
        item.className = 'admin-banner__list-item';
        item.textContent = error;
        fragment.appendChild(item);
      }
      errorListEl.appendChild(fragment);
      errorListEl.hidden = false;
    } else {
      errorListEl.hidden = true;
    }

    errorBannerEl.hidden = false;
  };

  adminContentRoot.addEventListener('click', async (event) => {
    if (!(event.target instanceof Element)) return;

    const button = event.target.closest<HTMLButtonElement>('[data-admin-copy-button]');
    if (!(button instanceof HTMLButtonElement)) return;

    const copyText = button.dataset.copyText?.trim() ?? '';
    const copyLabel = button.dataset.copyLabel?.trim() ?? '内容';
    if (!copyText) {
      setStatus('error', `${copyLabel} 为空，无法复制`);
      return;
    }

    try {
      await navigator.clipboard.writeText(copyText);
      setStatus('ok', `已复制${copyLabel}`);
    } catch {
      setStatus('warn', `浏览器剪贴板不可用，请手动复制${copyLabel}`);
    }
  });

  if (
    !(bootstrapEl instanceof HTMLDivElement)
    || !(editorForm instanceof HTMLFormElement)
    || !(dryRunBtn instanceof HTMLButtonElement)
    || !(saveBtn instanceof HTMLButtonElement)
  ) {
    setStatus('idle', '等待选择条目或复制路径', { announce: false });
  } else {
    const bootstrap = parseBootstrap(bootstrapEl.textContent ?? '');
    if (!bootstrap) {
      setStatus('error', 'Content Console 初始化失败');
    } else {
      let currentRevision = bootstrap.revision;
      let busy = false;

      const syncButtons = () => {
        dryRunBtn.disabled = busy;
        saveBtn.disabled = busy;
      };

      const collectFrontmatter = () => {
        const formData = new FormData(editorForm);
        const getText = (name: string) => String(formData.get(name) ?? '');

        if (bootstrap.collection === 'essay') {
          return {
            title: getText('title'),
            description: getText('description'),
            date: getText('date'),
            tagsText: getText('tagsText'),
            draft: formData.get('draft') !== null,
            archive: formData.get('archive') !== null,
            slug: getText('slug'),
            cover: getText('cover'),
            badge: getText('badge')
          };
        }

        return {
          title: getText('title'),
          description: getText('description'),
          date: getText('date'),
          tagsText: getText('tagsText'),
          draft: formData.get('draft') !== null,
          authorName: getText('authorName'),
          authorAvatar: getText('authorAvatar'),
          imagesText: getText('imagesText')
        };
      };

      const renderPreview = (result: AdminContentWriteResult, mode: 'dry-run' | 'write') => {
        if (!(previewEl instanceof HTMLElement) || !(previewTitleEl instanceof HTMLElement) || !(previewBodyEl instanceof HTMLElement) || !(previewListEl instanceof HTMLElement)) {
          return;
        }

        previewTitleEl.textContent = mode === 'dry-run' ? 'dry-run 结果' : '写入结果';
        previewBodyEl.textContent = result.changed
          ? `${result.relativePath || '当前条目'} 将更新以下字段。`
          : '当前 frontmatter 与磁盘文件一致，不需要写盘。';
        previewListEl.replaceChildren();

        const fragment = document.createDocumentFragment();
        if (result.changedFields.length === 0) {
          const item = document.createElement('li');
          item.className = 'admin-content-editor__preview-item';
          item.textContent = '没有检测到字段变化。';
          fragment.appendChild(item);
        } else {
          for (const field of result.changedFields) {
            const item = document.createElement('li');
            item.className = 'admin-content-editor__preview-item';
            item.textContent = field;
            fragment.appendChild(item);
          }
        }

        previewListEl.appendChild(fragment);
        previewEl.hidden = false;
      };

      const requestWrite = async (dryRun: boolean) => {
        busy = true;
        syncButtons();
        clearErrors();
        clearPreview();
        setStatus('loading', dryRun ? '正在执行 dry-run' : '正在写入 frontmatter');

        try {
          const response = await fetch(
            dryRun ? `${bootstrap.endpoint}?dryRun=1` : bootstrap.endpoint,
            {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json; charset=utf-8'
              },
              cache: 'no-store',
              body: JSON.stringify({
                collection: bootstrap.collection,
                entryId: bootstrap.entryId,
                revision: currentRevision,
                frontmatter: collectFrontmatter()
              })
            }
          );

          const payload = await parseResponseBody(response);
          const nextRevision = getPayloadRevision(payload);
          if (nextRevision && response.ok) {
            currentRevision = nextRevision;
          }

          if (!response.ok || !isRecord(payload) || payload.ok !== true) {
            const issues = getPayloadIssues(payload);
            setStatus(response.status === 409 ? 'warn' : 'error', dryRun ? 'dry-run 未通过' : '写入失败');
            setErrors(
              getPayloadErrors(payload).length > 0
                ? getPayloadErrors(payload)
                : [dryRun ? 'dry-run 校验失败，请检查当前表单与磁盘状态' : '写入 frontmatter 失败，请检查响应与控制台日志'],
              issues,
              {
                title: response.status === 409 ? '检测到外部更新' : 'frontmatter 未写入',
                ...(response.status === 409 ? { message: '请刷新当前条目，确认最新内容后再继续编辑。' } : {})
              }
            );
            return;
          }

          const result = getPayloadResult(payload);
          if (!result) {
            setStatus('error', '写入响应缺少结果摘要');
            setErrors(['响应体缺少 result 字段，请检查开发日志']);
            return;
          }

          renderPreview(result, dryRun ? 'dry-run' : 'write');
          if (dryRun) {
            setStatus(result.changed ? 'ok' : 'ready', result.changed ? 'dry-run 校验完成' : '当前没有变更');
            return;
          }

          if (!result.changed) {
            setStatus('ready', '当前 frontmatter 没有变化');
            return;
          }

          setStatus('ok', 'frontmatter 已写入，正在刷新当前条目');
          window.setTimeout(() => {
            window.location.reload();
          }, 320);
        } catch {
          setStatus('error', dryRun ? 'dry-run 请求失败' : '写入请求失败');
          setErrors([dryRun ? 'dry-run 请求失败，请稍后重试' : '写入请求失败，请稍后重试']);
        } finally {
          busy = false;
          syncButtons();
        }
      };

      dryRunBtn.addEventListener('click', () => {
        void requestWrite(true);
      });

      saveBtn.addEventListener('click', () => {
        void requestWrite(false);
      });

      syncButtons();
      setStatus('idle', '等待选择条目、复制路径或执行 dry-run', { announce: false });
    }
  }
}
