import type { AdminContentValidationIssue } from './content-entry-contract';
import { isRecord } from './content-entry-utils';

export const ADMIN_CONTENT_BULK_ENTRY_LIMIT = 200;

export type AdminContentBulkResultStatus = 'succeeded' | 'unchanged' | 'skipped' | 'failed';

export type AdminContentBulkEntryInput = {
  collection: string;
  entryId: string;
  expectedRelativePath: string;
  revision?: string;
};

export type AdminContentBulkResult = {
  collection: string;
  entryId: string;
  relativePath?: string;
  status: AdminContentBulkResultStatus;
  errors?: string[];
  errorCodes?: string[];
  changedFields?: string[];
  trashedPath?: string;
};

export type AdminContentBulkSummary = {
  requested: number;
  processed: number;
  succeeded: number;
  unchanged: number;
  skipped: number;
  failed: number;
};

const ADMIN_CONTENT_BULK_SUMMARY_KEYS = [
  'requested',
  'processed',
  'succeeded',
  'unchanged',
  'skipped',
  'failed'
] as const satisfies readonly (keyof AdminContentBulkSummary)[];

export const isAdminContentBulkSummary = (value: unknown): value is AdminContentBulkSummary =>
  isRecord(value) && ADMIN_CONTENT_BULK_SUMMARY_KEYS.every((key) => typeof value[key] === 'number');

export type AdminContentBulkEntriesInputResult =
  | {
      ok: true;
      entries: AdminContentBulkEntryInput[];
      requested: number;
    }
  | {
      ok: false;
      errors: string[];
      issues: AdminContentValidationIssue[];
    };

export const createAdminContentBulkResult = (
  entry: Pick<AdminContentBulkEntryInput, 'collection' | 'entryId'>,
  result: Omit<AdminContentBulkResult, 'collection' | 'entryId'>
): AdminContentBulkResult => ({
  collection: entry.collection,
  entryId: entry.entryId,
  ...result
});

const getStringField = (value: Record<string, unknown>, key: string): string =>
  typeof value[key] === 'string' ? value[key].trim() : '';

export const readAdminContentBulkEntriesInput = (
  body: unknown,
  options: {
    requireRevision?: boolean;
  } = {}
): AdminContentBulkEntriesInputResult => {
  if (!isRecord(body)) {
    return {
      ok: false,
      errors: ['请求体必须是 JSON 对象'],
      issues: [{ path: 'body', message: '请求体必须是 JSON 对象' }]
    };
  }

  if (!Array.isArray(body.entries)) {
    return {
      ok: false,
      errors: ['请求体缺少 entries 数组'],
      issues: [{ path: 'entries', message: '请求体缺少 entries 数组' }]
    };
  }

  const errors: string[] = [];
  const issues: AdminContentValidationIssue[] = [];
  const entries: AdminContentBulkEntryInput[] = [];
  const seen = new Set<string>();

  body.entries.forEach((entry, index) => {
    const pathPrefix = `entries.${index}`;
    if (!isRecord(entry)) {
      const message = 'entries 条目必须是 JSON 对象';
      errors.push(message);
      issues.push({ path: pathPrefix, message });
      return;
    }

    const collection = getStringField(entry, 'collection');
    const entryId = getStringField(entry, 'entryId');
    const expectedRelativePath = getStringField(entry, 'expectedRelativePath');
    const revision = getStringField(entry, 'revision');

    if (!collection) {
      const message = 'entries 条目缺少 collection';
      errors.push(message);
      issues.push({ path: `${pathPrefix}.collection`, message });
    }

    if (!entryId) {
      const message = 'entries 条目缺少 entryId';
      errors.push(message);
      issues.push({ path: `${pathPrefix}.entryId`, message });
    }

    if (!expectedRelativePath) {
      const message = 'entries 条目缺少 expectedRelativePath';
      errors.push(message);
      issues.push({ path: `${pathPrefix}.expectedRelativePath`, message });
    }

    if (options.requireRevision && !revision) {
      const message = 'entries 条目缺少 revision';
      errors.push(message);
      issues.push({ path: `${pathPrefix}.revision`, message });
    }

    if (!collection || !entryId || !expectedRelativePath || (options.requireRevision && !revision)) return;

    const dedupeKey = `${collection}\u0000${entryId}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    entries.push({
      collection,
      entryId,
      expectedRelativePath,
      ...(revision ? { revision } : {})
    });
  });

  if (errors.length > 0) {
    return { ok: false, errors: Array.from(new Set(errors)), issues };
  }

  if (entries.length > ADMIN_CONTENT_BULK_ENTRY_LIMIT) {
    const message = `批量条目不能超过 ${ADMIN_CONTENT_BULK_ENTRY_LIMIT} 条`;
    return {
      ok: false,
      errors: [message],
      issues: [{ path: 'entries', message }]
    };
  }

  return {
    ok: true,
    entries,
    requested: entries.length
  };
};

export const createAdminContentBulkSummary = (
  requested: number,
  results: readonly AdminContentBulkResult[]
): AdminContentBulkSummary => {
  const summary: AdminContentBulkSummary = {
    requested,
    processed: results.length,
    succeeded: 0,
    unchanged: 0,
    skipped: 0,
    failed: 0
  };

  for (const result of results) {
    summary[result.status] += 1;
  }

  return summary;
};
