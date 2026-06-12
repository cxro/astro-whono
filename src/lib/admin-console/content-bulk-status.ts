import {
  persistAdminFileTransaction
} from './admin-api';
import {
  createAdminContentBulkResult as createResult,
  type AdminContentBulkEntryInput,
  type AdminContentBulkResult
} from './content-bulk';
import {
  isAdminContentCollectionKey,
  isAdminContentDraftStatusCollectionKey
} from './content-collections';
import {
  AdminContentEntryResolutionError,
  loadAdminContentSourceState
} from './content-entry-source';
import { patchMarkdownFrontmatter } from './frontmatter';
import { withAdminContentWriteLock } from './content-write-lock';

class AdminContentBulkStatusConflictError extends Error {
  constructor() {
    super('Admin content draft status changed before write');
  }
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

const patchOneAdminContentDraftStatus = async (
  entry: AdminContentBulkEntryInput,
  targetDraft: boolean
): Promise<AdminContentBulkResult> => {
  if (!isAdminContentCollectionKey(entry.collection)) {
    return createResult(entry, {
      status: 'skipped',
      errors: [`不支持的 content collection：${entry.collection}`],
      errorCodes: ['unsupported_collection']
    });
  }

  if (!isAdminContentDraftStatusCollectionKey(entry.collection)) {
    return createResult(entry, {
      status: 'skipped',
      errors: [`当前 collection 暂不支持批量发布或改草稿：${entry.collection}`],
      errorCodes: ['unsupported_collection']
    });
  }

  const collection = entry.collection;
  try {
    const state = await loadAdminContentSourceState(collection, entry.entryId);
    if (state.relativePath !== entry.expectedRelativePath) {
      return createResult(entry, {
        status: 'failed',
        relativePath: state.relativePath,
        errors: ['检测到内容文件路径与列表不一致，请刷新后重试'],
        errorCodes: ['relative_path_mismatch']
      });
    }

    const currentDraft = state.rawFrontmatter.draft === true;
    if (currentDraft === targetDraft) {
      return createResult(entry, {
        status: 'unchanged',
        relativePath: state.relativePath
      });
    }

    const nextSourceText = patchMarkdownFrontmatter(state.sourceText, [
      { path: ['draft'], action: 'set', value: targetDraft }
    ]);

    await persistAdminFileTransaction([
      {
        id: 'entry',
        filePath: state.sourcePath,
        content: nextSourceText
      }
    ], {
      beforeWrite: async () => {
        const latestState = await loadAdminContentSourceState(collection, entry.entryId);
        if (latestState.revision !== state.revision || latestState.relativePath !== state.relativePath) {
          throw new AdminContentBulkStatusConflictError();
        }
      }
    });

    return createResult(entry, {
      status: 'succeeded',
      relativePath: state.relativePath,
      changedFields: ['draft']
    });
  } catch (error) {
    if (error instanceof AdminContentEntryResolutionError) {
      return createResult(entry, {
        status: 'failed',
        errors: [error.message],
        errorCodes: [error.code === 'source-not-found' ? 'source_not_found' : 'invalid_entry_id']
      });
    }

    return createResult(entry, {
      status: 'failed',
      errors: [
        error instanceof AdminContentBulkStatusConflictError
          ? '检测到内容文件已在外部更新，已跳过该条目，请刷新后重试'
          : getErrorMessage(error, '更新内容状态失败，请检查本地文件权限或日志')
      ],
      errorCodes: [
        error instanceof AdminContentBulkStatusConflictError
          ? 'revision_conflict'
          : 'update_failed'
      ]
    });
  }
};

export const patchAdminContentDraftStatusBulk = async (
  entries: readonly AdminContentBulkEntryInput[],
  targetDraft: boolean
): Promise<AdminContentBulkResult[]> =>
  withAdminContentWriteLock(async () => {
    const results: AdminContentBulkResult[] = [];
    for (const entry of entries) {
      results.push(await patchOneAdminContentDraftStatus(entry, targetDraft));
    }
    return results;
  });
