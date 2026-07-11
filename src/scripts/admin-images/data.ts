import {
  fetchAdminImageJson,
  isNullableNumber,
  isNullableString,
  isRecord,
  parseAdminImageMetaResponse,
  type AdminImageClientMeta
} from '../admin-shared/image-client';
import {
  isAdminImageBrowseGroup,
  isAdminImageOrigin,
  isAdminImageScopeKey
} from '../../lib/admin-console/image-contract';
import {
  normalizeAdminImageBrowseGroup
} from '../../lib/admin-console/image-browse';
import {
  DEFAULT_GROUP,
  DEFAULT_SCOPE,
  type AdminImageBootstrap,
  type AdminImageBrowseItem,
  type AdminImageFilterOption,
  type AdminImageListItem,
  type AdminImageListResponse,
  type AdminImageScope,
  type AdminImageState
} from './types';

const parsePositiveInteger = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

export const toBrowseItem = (item: AdminImageListItem): AdminImageBrowseItem => ({
  path: item.path,
  origin: item.origin,
  fileName: item.fileName,
  cloudKey: item.cloudKey ?? null,
  owner: item.owner,
  ownerLabel: item.ownerLabel,
  browseGroup: item.browseGroup,
  browseGroupLabel: item.browseGroupLabel,
  browseSubgroup: item.browseSubgroup,
  browseSubgroupLabel: item.browseSubgroupLabel,
  preferredValue: item.preferredValue,
  previewSrc: item.previewSrc
});

export const toCachedMeta = (item: AdminImageListItem): AdminImageClientMeta => ({
  kind: 'local',
  path: item.path,
  value: item.value,
  origin: item.origin,
  width: item.width,
  height: item.height,
  size: item.size,
  mimeType: item.mimeType,
  previewSrc: item.previewSrc
});

const LIST_RESPONSE_FORMAT_ERROR = '图片列表响应格式无效';

const isFilterOption = (item: unknown): item is AdminImageFilterOption =>
  isRecord(item)
  && typeof item.value === 'string'
  && typeof item.label === 'string'
  && typeof item.count === 'number';

const parseFilterOptions = (payload: unknown): AdminImageFilterOption[] => {
  if (!Array.isArray(payload)) {
    throw new Error(LIST_RESPONSE_FORMAT_ERROR);
  }

  return payload.map((item) => {
    if (!isFilterOption(item)) {
      throw new Error(LIST_RESPONSE_FORMAT_ERROR);
    }

    return item;
  });
};

const isBrowseItem = (item: unknown): item is AdminImageBrowseItem =>
  isRecord(item)
  && typeof item.path === 'string'
  && isAdminImageOrigin(item.origin)
  && typeof item.fileName === 'string'
  && (item.cloudKey === undefined || isNullableString(item.cloudKey))
  && isNullableString(item.owner)
  && isNullableString(item.ownerLabel)
  && isAdminImageBrowseGroup(item.browseGroup)
  && item.browseGroup !== DEFAULT_GROUP
  && typeof item.browseGroupLabel === 'string'
  && typeof item.browseSubgroup === 'string'
  && isNullableString(item.browseSubgroupLabel)
  && isNullableString(item.preferredValue)
  && isNullableString(item.previewSrc);

const isListItem = (item: unknown): item is AdminImageListItem =>
  isRecord(item)
  && typeof item.path === 'string'
  && isAdminImageOrigin(item.origin)
  && typeof item.fileName === 'string'
  && (item.cloudKey === undefined || isNullableString(item.cloudKey))
  && isNullableString(item.owner)
  && isNullableString(item.ownerLabel)
  && isAdminImageBrowseGroup(item.browseGroup)
  && item.browseGroup !== DEFAULT_GROUP
  && typeof item.browseGroupLabel === 'string'
  && typeof item.browseSubgroup === 'string'
  && isNullableString(item.browseSubgroupLabel)
  && isNullableString(item.preferredValue)
  && isNullableString(item.previewSrc)
  && typeof item.value === 'string'
  && isNullableNumber(item.width)
  && isNullableNumber(item.height)
  && isNullableNumber(item.size)
  && isNullableString(item.mimeType);

const parseListItem = (item: unknown): AdminImageListItem => {
  if (!isListItem(item)) {
    throw new Error(LIST_RESPONSE_FORMAT_ERROR);
  }

  return item;
};

const parseScope = (value: unknown): AdminImageScope => {
  if (value === '' || isAdminImageScopeKey(value)) return value;
  throw new Error(LIST_RESPONSE_FORMAT_ERROR);
};

const parseGroup = (value: unknown): string => {
  if (value === '' || isAdminImageBrowseGroup(value)) return value;
  throw new Error(LIST_RESPONSE_FORMAT_ERROR);
};

const parseSubgroup = (value: unknown): string => {
  if (typeof value === 'string') return value;
  throw new Error(LIST_RESPONSE_FORMAT_ERROR);
};

const parseListResult = (result: unknown): AdminImageListResponse => {
  if (!isRecord(result) || !Array.isArray(result.items)) {
    throw new Error(LIST_RESPONSE_FORMAT_ERROR);
  }

  if (
    !isPositiveInteger(result.page)
    || !isPositiveInteger(result.totalPages)
    || !isNonNegativeInteger(result.totalCount)
  ) {
    throw new Error(LIST_RESPONSE_FORMAT_ERROR);
  }

  return {
    scope: parseScope(result.scope),
    group: parseGroup(result.group),
    subgroup: parseSubgroup(result.subgroup),
    groupOptions: parseFilterOptions(result.groupOptions),
    subgroupOptions: parseFilterOptions(result.subgroupOptions),
    items: result.items.map(parseListItem),
    page: result.page,
    totalPages: result.totalPages,
    totalCount: result.totalCount
  };
};

const parseBrowseIndex = (payload: unknown): AdminImageBrowseItem[] | null => {
  if (payload == null) return null;
  if (!Array.isArray(payload)) return null;
  return payload.filter(isBrowseItem);
};

export const parseBootstrap = (text: string): AdminImageBootstrap | null => {
  try {
    const payload = JSON.parse(text) as unknown;
    if (
      !isRecord(payload)
      || typeof payload.listEndpoint !== 'string'
      || typeof payload.metaEndpoint !== 'string'
      || typeof payload.cloudDeleteEndpoint !== 'string'
      || !isRecord(payload.initialState)
    ) {
      return null;
    }

    const browseIndex = parseBrowseIndex(payload.browseIndex);
    if (payload.browseIndex != null && browseIndex === null) {
      return null;
    }
    const normalizedScope = typeof payload.initialState.scope === 'string'
      ? payload.initialState.scope.trim().toLowerCase()
      : '';
    const normalizedGroup = typeof payload.initialState.group === 'string'
      ? normalizeAdminImageBrowseGroup(payload.initialState.group)
      : '';
    const initialScope = isAdminImageScopeKey(normalizedScope) ? normalizedScope : DEFAULT_SCOPE;

    return {
      listEndpoint: payload.listEndpoint,
      metaEndpoint: payload.metaEndpoint,
      cloudDeleteEndpoint: payload.cloudDeleteEndpoint,
      initialState: {
        scope: initialScope,
        group: isAdminImageBrowseGroup(normalizedGroup) ? normalizedGroup : DEFAULT_GROUP,
        subgroup: typeof payload.initialState.subgroup === 'string' ? payload.initialState.subgroup.trim() : '',
        query: typeof payload.initialState.query === 'string' ? payload.initialState.query : '',
        page: parsePositiveInteger(payload.initialState.page, 1)
      },
      browseIndex,
      didRefresh: payload.didRefresh === true
    };
  } catch {
    return null;
  }
};

export const deleteCloudImage = async (
  endpoint: string,
  key: string
): Promise<void> => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify({ key })
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (response.ok && isRecord(payload) && payload.ok === true) return;

  const errors = isRecord(payload) && Array.isArray(payload.errors)
    ? payload.errors.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  throw new Error(errors[0] ?? `云端图片删除失败（HTTP ${response.status}）`);
};

const parseListResponse = (payload: unknown): AdminImageListResponse => {
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.result) || !Array.isArray(payload.result.items)) {
    throw new Error('图片列表响应格式无效');
  }

  return parseListResult(payload.result);
};

export const fetchList = async (
  endpoint: string,
  state: AdminImageState,
  limit: number
): Promise<AdminImageListResponse> => {
  const params = new URLSearchParams({
    page: String(state.page),
    limit: String(limit)
  });

  if (state.scope) {
    params.set('scope', state.scope);
  } else {
    params.set('group', state.group || DEFAULT_GROUP);
  }

  if (!state.scope && state.group !== DEFAULT_GROUP && state.subgroup.trim()) {
    params.set('sub', state.subgroup.trim());
  }
  if (state.query.trim()) {
    params.set('q', state.query.trim());
  }

  const payload = await fetchAdminImageJson(`${endpoint}?${params.toString()}`, '图片列表请求失败');
  return parseListResponse(payload);
};

export const fetchMetaByPath = async (endpoint: string, assetPath: string): Promise<AdminImageClientMeta> => {
  const payload = await fetchAdminImageJson(
    `${endpoint}?${new URLSearchParams({ path: assetPath }).toString()}`,
    '图片元数据请求失败'
  );
  return parseAdminImageMetaResponse(payload);
};

export const updateUrl = (state: AdminImageState) => {
  const url = new URL(window.location.href);
  url.searchParams.delete('refresh');

  if (state.scope) {
    url.searchParams.set('scope', state.scope);
  } else {
    url.searchParams.delete('scope');
  }

  if (!state.scope && state.group !== DEFAULT_GROUP && state.group.trim()) {
    url.searchParams.set('group', state.group.trim());
  } else {
    url.searchParams.delete('group');
  }

  if (!state.scope && state.group !== DEFAULT_GROUP && state.subgroup.trim()) {
    url.searchParams.set('sub', state.subgroup.trim());
  } else {
    url.searchParams.delete('sub');
  }

  if (state.query.trim()) {
    url.searchParams.set('q', state.query.trim());
  } else {
    url.searchParams.delete('q');
  }

  if (state.page > 1) {
    url.searchParams.set('page', String(state.page));
  } else {
    url.searchParams.delete('page');
  }

  history.replaceState(null, '', `${url.pathname}${url.search}`);
};

export const navigateToRefresh = ({ resetState = false }: { resetState?: boolean } = {}) => {
  const url = new URL(window.location.href);
  if (resetState) {
    url.searchParams.delete('scope');
    url.searchParams.delete('group');
    url.searchParams.delete('sub');
    url.searchParams.delete('q');
    url.searchParams.delete('page');
  }
  url.searchParams.set('refresh', '1');
  window.location.assign(`${url.pathname}${url.search}`);
};

export const copyText = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.append(textarea);
  textarea.select();
  const execCommand = Reflect.get(document as object, 'execCommand') as
    | ((commandId: string, showUI?: boolean, input?: string) => boolean)
    | undefined;
  const copied = execCommand?.call(document, 'copy') ?? false;
  textarea.remove();

  if (!copied) {
    throw new Error('浏览器阻止了复制动作');
  }
};
