export type AdminImageOrigin = 'public' | 'src/assets' | 'src/content' | 'cloud';
export type AdminImageBrowseGroup = 'all' | 'essay' | 'bits' | 'memo' | 'assets' | 'pages' | 'cloud' | 'uncategorized';
export type AdminImageScopeKey = 'recent';

export const ADMIN_IMAGE_DEFAULT_LIST_LIMIT = 20;

export const ADMIN_IMAGE_BROWSE_GROUP_LABELS = {
  all: '全部',
  essay: '随笔',
  bits: 'Bits',
  memo: 'Memo',
  assets: '配置素材',
  pages: '页面插图',
  cloud: '云端图片',
  uncategorized: '未归类'
} as const satisfies Record<AdminImageBrowseGroup, string>;

export const ADMIN_IMAGE_BROWSE_GROUP_ORDER = [
  'all',
  'essay',
  'bits',
  'memo',
  'assets',
  'pages',
  'cloud',
  'uncategorized'
] as const satisfies readonly AdminImageBrowseGroup[];

export const ADMIN_IMAGE_SCOPE_LABELS = {
  recent: '最新修改'
} as const satisfies Record<AdminImageScopeKey, string>;

export const isAdminImageOrigin = (value: unknown): value is AdminImageOrigin =>
  value === 'public' || value === 'src/assets' || value === 'src/content' || value === 'cloud';

export const isAdminImageBrowseGroup = (value: unknown): value is AdminImageBrowseGroup =>
  typeof value === 'string' && value in ADMIN_IMAGE_BROWSE_GROUP_LABELS;

export const isAdminImageScopeKey = (value: unknown): value is AdminImageScopeKey =>
  typeof value === 'string' && value in ADMIN_IMAGE_SCOPE_LABELS;
