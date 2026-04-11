import {
  parseAdminSettingsExportBundle,
  type AdminSettingsExportBundle
} from '../../lib/admin-console/settings-data';
import {
  queryAdminDataControls,
  reportAdminDataSetupError
} from './controls';
import {
  getBundleKey,
  getDownloadFileName,
  getPayloadErrors,
  getPayloadResults,
  getPayloadRevision,
  GROUP_ORDER,
  hasWriteResultChanges,
  isRecord,
  parseBootstrap,
  parseResponseBody,
  type WriteResultsMap
} from './shared';
import { createAdminDataUi } from './ui';

const root = document.querySelector<HTMLElement>('[data-admin-data-root]');
type ImportAction = 'dry-run' | 'apply';
type ImportFailureOptions = {
  status: 'error' | 'warn';
  statusText: string;
  errors: readonly string[];
  errorTitle?: string;
  previewState?: 'error' | 'warn';
  previewTitle: string;
  previewBody: string;
};

if (!root) {
  // Current page does not use admin data console.
} else {
  const controlState = queryAdminDataControls();
  if (!controlState.ok) {
    reportAdminDataSetupError(controlState.controls, {
      title: 'Data Console 初始化失败',
      statusText: '初始化失败',
      message: '页面缺少必要控件，客户端脚本已停止初始化。请刷新页面，或检查模板与控件 id 是否仍保持一致。',
      details: controlState.missing.map((id) => `缺少节点：#${id}`)
    });
  } else {
    const controls = controlState.controls;
    const ui = createAdminDataUi(controls);
    const bootstrap = parseBootstrap(controls.bootstrapEl.textContent ?? '');

    if (!bootstrap) {
      console.error('[admin-data] bootstrap 数据无效');
      ui.showBootstrapError('当前页面未能完成 bootstrap 初始化，请刷新页面或重启开发服务器后重试。');
    } else {
      let currentRevision = bootstrap.revision;
      let currentBundle: AdminSettingsExportBundle | null = null;
      let busy = false;
      let dragDepth = 0;
      let lastDryRunKey = '';
      let lastDryRunHasChanges = false;
      let hasCompletedApply = false;
      let activeAction: ImportAction | null = null;

      const syncActionState = () => {
        const hasBundle = currentBundle !== null;
        const canApply = hasBundle
          && lastDryRunKey === getBundleKey(currentBundle)
          && lastDryRunHasChanges;
        const dryRunStepState = !hasBundle
          ? 'blocked'
          : activeAction === 'dry-run'
            ? 'running'
            : lastDryRunKey !== '' || hasCompletedApply
              ? 'done'
              : 'ready';
        const applyStepState = !hasBundle
          ? 'blocked'
          : activeAction === 'apply'
            ? 'running'
            : hasCompletedApply
              ? 'done'
              : canApply
                ? 'ready'
                : 'blocked';

        ui.syncActionState({
          busy,
          hasBundle,
          canApply,
          dryRunStepState,
          applyStepState
        });
      };

      const resetDropzoneDragState = () => {
        dragDepth = 0;
        ui.setDropzoneDragActive(false);
      };

      const resetImportConfirmation = () => {
        lastDryRunKey = '';
        lastDryRunHasChanges = false;
        hasCompletedApply = false;
      };

      const resetImportSession = () => {
        resetImportConfirmation();
        activeAction = null;
        currentBundle = null;
        ui.renderFileMeta(null, null);
      };

      const showImportFailure = ({
        status,
        statusText,
        errors,
        errorTitle,
        previewState = 'error',
        previewTitle,
        previewBody
      }: ImportFailureOptions) => {
        resetImportConfirmation();
        ui.setStatus(status, statusText);
        ui.setErrors(errors, errorTitle ? { title: errorTitle } : {});
        ui.showPreviewEmpty({
          state: previewState,
          title: previewTitle,
          body: previewBody
        });
      };

      const showImportActionLoading = (action: ImportAction) => {
        const isDryRun = action === 'dry-run';
        ui.setStatus('loading', isDryRun ? '正在执行 dry-run' : '正在写入');
        ui.showPreviewEmpty({
          state: 'loading',
          title: isDryRun ? '正在执行 dry-run 校验' : '正在写入 settings',
          body: isDryRun
            ? '正在比对当前 settings 与导入快照，完成后会在这里生成差异摘要。'
            : '正在沿用现有事务链路写入 settings，完成后会在这里回填写入结果。'
        });
      };

      const completeDryRun = (results: WriteResultsMap | null) => {
        if (!currentBundle) return;

        const hasChanges = GROUP_ORDER.some((group) => hasWriteResultChanges(results?.[group]));
        lastDryRunKey = getBundleKey(currentBundle);
        lastDryRunHasChanges = hasChanges;
        hasCompletedApply = false;
        ui.renderPreview(
          results,
          hasChanges
            ? {
                state: 'diff',
                note: '确认写入前会再次校验 revision，避免覆盖外部修改。'
              }
            : {
                state: 'clean',
                body: '当前导入快照与本地 settings 一致，不需要写盘。'
              }
        );
        ui.setStatus(hasChanges ? 'ok' : 'ready', 'dry-run 完成');
      };

      const completeApply = (results: WriteResultsMap | null) => {
        lastDryRunKey = '';
        lastDryRunHasChanges = false;
        hasCompletedApply = true;
        ui.renderPreview(results, {
          state: 'applied',
          body: '✅ 写入成功',
          note: '继续导入其他快照前，请重新执行 dry-run。'
        });
        ui.setStatus('ok', '写入完成');
      };

      const handleSelectedFile = async (file: File | null) => {
        ui.clearErrors();
        resetImportSession();
        syncActionState();

        if (!file) {
          ui.setSelectedFileLabel(null);
          ui.resetPreview();
          ui.setStatus('idle', '等待操作', { announce: false });
          return;
        }

        ui.setSelectedFileLabel(file.name);
        ui.showPreviewEmpty({
          state: 'loading',
          title: '正在解析导入快照',
          body: `正在读取 ${file.name} 并校验 manifest 结构。`
        });
        ui.setStatus('loading', '正在解析', { announce: false });

        try {
          const text = await file.text();
          const json = JSON.parse(text) as unknown;
          const parsed = parseAdminSettingsExportBundle(json);

          if (!parsed.ok) {
            showImportFailure({
              status: 'error',
              statusText: '解析失败',
              errors: parsed.errors,
              errorTitle: '导入文件不符合 settings 导出协议',
              previewTitle: '导入文件解析失败',
              previewBody: '当前文件不符合 settings 导出协议。请确认 schemaVersion、includedScopes 与 JSON 结构后重试。'
            });
            return;
          }

          currentBundle = parsed.bundle;
          ui.renderFileMeta(parsed.bundle, file.name);
          ui.showPreviewEmpty({
            state: 'ready',
            title: '快照已就绪',
            body: `${file.name}\n已完成 manifest 解析，可执行 dry-run`
          });
          ui.setStatus('ready', '快照已解析');
        } catch {
          showImportFailure({
            status: 'error',
            statusText: 'JSON 无效',
            errors: ['所选文件不是合法 JSON，或编码内容已损坏'],
            previewTitle: '导入文件不是合法 JSON',
            previewBody: '所选文件不是合法 JSON，或编码内容已损坏。请重新选择导出快照。'
          });
        } finally {
          syncActionState();
        }
      };

      const runImportAction = async (action: ImportAction) => {
        if (!currentBundle) return;

        const isDryRun = action === 'dry-run';
        activeAction = action;
        if (isDryRun) {
          hasCompletedApply = false;
        }
        busy = true;
        syncActionState();
        ui.clearErrors();
        showImportActionLoading(action);

        try {
          const response = await fetch(
            isDryRun ? `${bootstrap.importEndpoint}?dryRun=1` : bootstrap.importEndpoint,
            {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json; charset=utf-8'
              },
              cache: 'no-store',
              body: JSON.stringify({
                revision: currentRevision,
                settings: currentBundle.settings
              })
            }
          );

          const payload = await parseResponseBody(response);
          const latestRevision = getPayloadRevision(payload);
          if (latestRevision) {
            currentRevision = latestRevision;
          }

          if (!response.ok || !isRecord(payload) || payload.ok !== true) {
            const isRevisionConflict = response.status === 409;
            const payloadErrors = getPayloadErrors(payload);
            showImportFailure({
              status: isRevisionConflict ? 'warn' : 'error',
              statusText: isDryRun ? 'dry-run 未通过' : '写入失败',
              errors: payloadErrors.length > 0
                ? payloadErrors
                : [isDryRun ? 'dry-run 校验失败，请检查导入文件与当前配置状态' : '写入 settings 失败，请检查响应与控制台日志'],
              errorTitle: isRevisionConflict ? '检测到外部更新' : '导入未完成',
              previewState: isRevisionConflict ? 'warn' : 'error',
              previewTitle: isRevisionConflict ? '检测到外部更新' : isDryRun ? 'dry-run 未通过' : '写入失败',
              previewBody: isRevisionConflict
                ? '本次导入已停止，避免静默覆盖外部修改。请重新执行 dry-run，并在最新 revision 上确认结果。'
                : isDryRun
                  ? '当前未生成可提交的变更预览，请修正错误清单后再次执行 dry-run。'
                  : '本次写入未完成，请先处理错误清单，再重新提交配置快照。'
            });
            return;
          }

          const results = getPayloadResults(payload);
          if (isDryRun) {
            completeDryRun(results);
          } else {
            completeApply(results);
          }
        } catch {
          showImportFailure({
            status: 'error',
            statusText: isDryRun ? 'dry-run 请求失败' : '写入请求失败',
            errors: [isDryRun ? 'dry-run 请求失败，请稍后重试' : '写入请求失败，请稍后重试'],
            previewTitle: isDryRun ? 'dry-run 请求失败' : '写入请求失败',
            previewBody: isDryRun
              ? '当前未拿到服务端响应，请检查开发服务器状态后重新执行 dry-run。'
              : '写入结果尚未确认，请检查开发服务器状态后重新提交。'
          });
        } finally {
          activeAction = null;
          busy = false;
          syncActionState();
        }
      };

      controls.exportBtn.addEventListener('click', async () => {
        busy = true;
        syncActionState();
        ui.clearErrors();
        ui.setStatus('loading', '正在导出快照');

        try {
          const response = await fetch(bootstrap.exportEndpoint, {
            method: 'GET',
            headers: {
              Accept: 'application/json'
            },
            cache: 'no-store'
          });

          if (!response.ok) {
            const payload = await parseResponseBody(response);
            ui.setStatus(response.status === 409 ? 'warn' : 'error', '导出失败');
            ui.setErrors(
              getPayloadErrors(payload).length > 0
                ? getPayloadErrors(payload)
                : ['当前 settings 状态不可导出，请先修复本地配置后重试'],
              {
                title: response.status === 409 ? 'settings 当前不可导出' : '导出失败'
              }
            );
            return;
          }

          const blob = await response.blob();
          const downloadUrl = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = downloadUrl;
          anchor.download = getDownloadFileName(response);
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(downloadUrl);
          ui.setStatus('ok', '快照已导出');
        } catch {
          ui.setStatus('error', '导出请求失败');
          ui.setErrors(['导出请求失败，请检查开发服务器状态后重试']);
        } finally {
          busy = false;
          syncActionState();
        }
      });

      controls.fileInput.addEventListener('change', () => {
        const file = controls.fileInput.files?.[0] ?? null;
        controls.fileInput.value = '';
        void handleSelectedFile(file);
      });

      const requestFileSelection = () => {
        if (!busy) {
          controls.fileInput.click();
        }
      };

      controls.dropzoneTriggerBtn.addEventListener('click', requestFileSelection);
      controls.dropzoneReselectBtn.addEventListener('click', requestFileSelection);

      controls.dropzoneEl.addEventListener('dragenter', (event) => {
        event.preventDefault();
        if (busy) return;

        dragDepth += 1;
        ui.setDropzoneDragActive(true);
      });

      controls.dropzoneEl.addEventListener('dragover', (event) => {
        event.preventDefault();
        if (busy) return;

        ui.setDropzoneDragActive(true);
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'copy';
        }
      });

      controls.dropzoneEl.addEventListener('dragleave', (event) => {
        event.preventDefault();
        if (busy) {
          resetDropzoneDragState();
          return;
        }

        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) {
          ui.setDropzoneDragActive(false);
        }
      });

      controls.dropzoneEl.addEventListener('drop', (event) => {
        event.preventDefault();
        resetDropzoneDragState();
        if (busy) return;

        const file = event.dataTransfer?.files?.[0] ?? null;
        if (file) {
          void handleSelectedFile(file);
        }
      });

      controls.dryRunBtn.addEventListener('click', () => {
        void runImportAction('dry-run');
      });

      controls.applyBtn.addEventListener('click', () => {
        void runImportAction('apply');
      });

      syncActionState();
      resetDropzoneDragState();
      ui.setSelectedFileLabel(null);
      ui.resetPreview();
      ui.setStatus('idle', '准备就绪', { announce: false });
    }
  }
}
