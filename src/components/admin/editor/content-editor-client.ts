import type {
  AdminContentEditorValues,
  AdminContentWriteCollectionKey
} from '../../../lib/admin-console/content-shared';
import {
  getPayloadDeleteResult,
  getPayloadEditorBody,
  getPayloadEditorValues,
  getPayloadErrors,
  getPayloadIssues,
  getPayloadPreviewResult,
  getPayloadResult,
  getPayloadRevision,
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

export type ContentEditorSaveInput = {
  endpoint: string;
  collection: AdminContentWriteCollectionKey;
  entryId: string;
  revision: string;
  frontmatter: AdminContentEditorValues;
  body?: string;
  dryRun?: boolean;
  fetchImpl?: FetchLike;
};

export type ContentEditorSaveOutcome = ContentEditorRequestOutcome & {
  result: AdminContentWriteResult | null;
  latestValues: AdminContentEditorValues | null;
  latestBody: string | null;
};

export type ContentEditorPreviewInput = {
  endpoint: string;
  collection: AdminContentWriteCollectionKey;
  entryId: string;
  source: string;
  signal?: AbortSignal;
  fetchImpl?: FetchLike;
};

export type ContentEditorPreviewOutcome = Omit<ContentEditorRequestOutcome, 'revision' | 'issues'> & {
  result: AdminContentPreviewResult | null;
};

export type ContentEditorDeleteInput = {
  endpoint: string;
  collection: AdminContentWriteCollectionKey;
  entryId: string;
  revision: string;
  expectedRelativePath: string;
  fetchImpl?: FetchLike;
};

export type ContentEditorDeleteOutcome = ContentEditorRequestOutcome & {
  result: AdminContentDeleteResult | null;
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

export const saveContentEntry = async ({
  endpoint,
  collection,
  entryId,
  revision,
  frontmatter,
  body,
  dryRun = false,
  fetchImpl
}: ContentEditorSaveInput): Promise<ContentEditorSaveOutcome> => {
  const response = await getFetch(fetchImpl)(buildContentWriteEndpoint(endpoint, dryRun), {
    method: 'POST',
    headers: JSON_REQUEST_HEADERS,
    cache: 'no-store',
    body: JSON.stringify({
      collection,
      entryId,
      revision,
      frontmatter,
      ...(body !== undefined ? { body } : {})
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
