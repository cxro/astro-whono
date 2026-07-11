import type { AdminImageBrowseFilterOption } from '../../lib/admin-console/image-browse';
import type { AdminImageBrowseGroup, AdminImageOrigin, AdminImageScopeKey } from '../../lib/admin-console/image-contract';

export type AdminImageScope = '' | AdminImageScopeKey;

export type AdminImageBrowseItem = {
  path: string;
  origin: AdminImageOrigin;
  fileName: string;
  cloudKey?: string | null;
  owner: string | null;
  ownerLabel: string | null;
  browseGroup: Exclude<AdminImageBrowseGroup, 'all'>;
  browseGroupLabel: string;
  browseSubgroup: string;
  browseSubgroupLabel: string | null;
  preferredValue: string | null;
  previewSrc: string | null;
};

export type AdminImageListItem = AdminImageBrowseItem & {
  value: string;
  width: number | null;
  height: number | null;
  size: number | null;
  mimeType: string | null;
};

export type AdminImageBootstrap = {
  listEndpoint: string;
  metaEndpoint: string;
  cloudDeleteEndpoint: string;
  initialState: {
    scope: AdminImageScope;
    group: string;
    subgroup: string;
    query: string;
    page: number;
  };
  browseIndex: AdminImageBrowseItem[] | null;
  didRefresh: boolean;
};

export type AdminImageListResponse = {
  scope: AdminImageScope;
  group: string;
  subgroup: string;
  groupOptions: AdminImageBrowseFilterOption[];
  subgroupOptions: AdminImageBrowseFilterOption[];
  items: AdminImageListItem[];
  page: number;
  totalPages: number;
  totalCount: number;
};

export type AdminImageState = {
  scope: AdminImageScope;
  group: string;
  subgroup: string;
  query: string;
  page: number;
};

export type AdminImageViewMode = 'list' | 'grid';

export type AdminImageFilterOption = AdminImageBrowseFilterOption;

export const DEFAULT_GROUP: AdminImageBrowseGroup = 'all';
export const DEFAULT_SCOPE: AdminImageScope = '';
