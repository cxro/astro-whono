import type {
  AdminBitsEditorValues,
  AdminContentEditorValues,
  AdminContentEditorPayload,
  AdminEssayEditorValues
} from '../../../lib/admin-console/content-editor-payload';
import type { AdminContentCollectionKey } from '../../../lib/admin-console/content-collections';
import type { AdminContentDeletableCollectionKey } from '../../../lib/admin-console/content-delete-contract';
import {
  getPayloadDeleteResult,
  getPayloadEditorBody,
  getPayloadEditorPayload,
  getPayloadEditorValues,
  getPayloadErrors,
  getPayloadIssues,
  getPayloadPreviewResult,
  getPayloadResult,
  getPayloadRevision,
  isRecord,
  isPayloadOk,
  parseResponseBody,
  type AdminContentDeleteResult,
  type AdminContentIssue,
  type AdminContentPreviewResult,
  type AdminContentWriteResult
} from '../../../scripts/admin-content/entry-transport';

export type {
  AdminContentDeleteResult,
  AdminContentIssue,
  AdminContentPreviewResult,
  AdminContentWriteResult
};

type FetchLike = typeof fetch;

type ContentEditorRequestOutcome = {
  responseOk: boolean;
  status: number;
  payloadOk: boolean;
  revision: string | null;
  errors: string[];
  issues: AdminContentIssue[];
};

type ContentEditorSaveBaseInput = {
  endpoint: string;
  entryId: string;
  revision: string;
  dryRun?: boolean;
  fetchImpl?: FetchLike;
};

export type ContentEditorSaveInput = ContentEditorSaveBaseInput & (
  | {
      collection: 'essay';
      frontmatter: AdminEssayEditorValues;
      body?: string;
    }
  | {
      collection: 'bits';
      frontmatter: AdminBitsEditorValues;
      body?: string;
    }
  | {
      collection: 'memo';
      body: string;
    }
  | {
      collection: 'about';
      body: string;
    }
);

export type ContentEditorSaveOutcome = ContentEditorRequestOutcome & {
  result: AdminContentWriteResult | null;
  latestValues: AdminContentEditorValues | null;
  latestBody: string | null;
};

export type ContentEditorPreviewInput = {
  endpoint: string;
  collection: AdminContentCollectionKey;
  entryId: string;
  source: string;
  signal?: AbortSignal;
  fetchImpl?: FetchLike;
};

export type ContentEditorPreviewOutcome = Omit<ContentEditorRequestOutcome, 'revision' | 'issues'> & {
  issues: AdminContentIssue[];
  result: AdminContentPreviewResult | null;
};

export type ContentEditorDeleteInput = {
  endpoint: string;
  collection: AdminContentDeletableCollectionKey;
  entryId: string;
  revision: string;
  expectedRelativePath: string;
  fetchImpl?: FetchLike;
};

export type ContentEditorDeleteOutcome = ContentEditorRequestOutcome & {
  result: AdminContentDeleteResult | null;
};

export type ContentEditorCreateInput = {
  endpoint: string;
  collection: 'essay';
  entryId: string;
  frontmatter: AdminEssayEditorValues;
  fetchImpl?: FetchLike;
};

export type ContentEditorCreateOutcome = Omit<ContentEditorRequestOutcome, 'revision'> & {
  result: AdminContentWriteResult | null;
  payload: AdminContentEditorPayload | null;
  editHref: string | null;
};

const JSON_REQUEST_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json; charset=utf-8'
} as const;

const getFetch = (fetchImpl?: FetchLike): FetchLike => fetchImpl ?? fetch;

const buildContentWriteEndpoint = (endpoint: string, dryRun: boolean): string => {
  if (!dryRun) return endpoint;
  const baseUrl = typeof window === 'undefined' ? 'http://127.0.0.1/' : window.location.href;
  const url = new URL(endpoint, baseUrl);
  url.searchParams.set('dryRun', '1');
  return url.toString();
};

const buildContentWriteRequestBody = (input: ContentEditorSaveInput): Record<string, unknown> => {
  const requestBody: Record<string, unknown> = {
    collection: input.collection,
    entryId: input.entryId,
    revision: input.revision
  };

  if (input.collection === 'essay' || input.collection === 'bits') {
    requestBody.frontmatter = input.frontmatter;
  }
  if ('body' in input) {
    requestBody.body = input.body;
  }

  return requestBody;
};

export const saveContentEntry = async (input: ContentEditorSaveInput): Promise<ContentEditorSaveOutcome> => {
  const { endpoint, collection, dryRun = false, fetchImpl } = input;
  const response = await getFetch(fetchImpl)(buildContentWriteEndpoint(endpoint, dryRun), {
    method: 'POST',
    headers: JSON_REQUEST_HEADERS,
    cache: 'no-store',
    body: JSON.stringify(buildContentWriteRequestBody(input))
  });
  const payload = await parseResponseBody(response);

  return {
    responseOk: response.ok,
    status: response.status,
    payloadOk: isPayloadOk(payload),
    revision: getPayloadRevision(payload),
    errors: getPayloadErrors(payload),
    issues: getPayloadIssues(payload),
    result: getPayloadResult(payload),
    latestValues: getPayloadEditorValues(payload, collection),
    latestBody: getPayloadEditorBody(payload, collection)
  };
};

export const renderContentPreview = async ({
  endpoint,
  collection,
  entryId,
  source,
  signal,
  fetchImpl
}: ContentEditorPreviewInput): Promise<ContentEditorPreviewOutcome> => {
  const requestInit: RequestInit = {
    method: 'POST',
    headers: JSON_REQUEST_HEADERS,
    cache: 'no-store',
    body: JSON.stringify({
      collection,
      entryId,
      source
    })
  };
  if (signal) requestInit.signal = signal;

  const response = await getFetch(fetchImpl)(endpoint, requestInit);
  const payload = await parseResponseBody(response);

  return {
    responseOk: response.ok,
    status: response.status,
    payloadOk: isPayloadOk(payload),
    errors: getPayloadErrors(payload),
    issues: getPayloadIssues(payload),
    result: getPayloadPreviewResult(payload)
  };
};

export const deleteContentEntry = async ({
  endpoint,
  collection,
  entryId,
  revision,
  expectedRelativePath,
  fetchImpl
}: ContentEditorDeleteInput): Promise<ContentEditorDeleteOutcome> => {
  const response = await getFetch(fetchImpl)(endpoint, {
    method: 'POST',
    headers: JSON_REQUEST_HEADERS,
    cache: 'no-store',
    body: JSON.stringify({
      collection,
      entryId,
      revision,
      expectedRelativePath
    })
  });
  const payload = await parseResponseBody(response);

  return {
    responseOk: response.ok,
    status: response.status,
    payloadOk: isPayloadOk(payload),
    revision: getPayloadRevision(payload),
    errors: getPayloadErrors(payload),
    issues: getPayloadIssues(payload),
    result: getPayloadDeleteResult(payload)
  };
};

export const createContentEntry = async ({
  endpoint,
  collection,
  entryId,
  frontmatter,
  fetchImpl
}: ContentEditorCreateInput): Promise<ContentEditorCreateOutcome> => {
  const response = await getFetch(fetchImpl)(endpoint, {
    method: 'POST',
    headers: JSON_REQUEST_HEADERS,
    cache: 'no-store',
    body: JSON.stringify({
      collection,
      entryId,
      frontmatter
    })
  });
  const payload = await parseResponseBody(response);

  return {
    responseOk: response.ok,
    status: response.status,
    payloadOk: isPayloadOk(payload),
    errors: getPayloadErrors(payload),
    issues: getPayloadIssues(payload),
    result: getPayloadResult(payload),
    payload: getPayloadEditorPayload(payload),
    editHref: isRecord(payload) && typeof payload.editHref === 'string' ? payload.editHref : null
  };
};
