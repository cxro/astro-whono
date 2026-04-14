export type AdminRouteId = 'overview' | 'theme' | 'content' | 'media' | 'checks' | 'data';

export type AdminRouteDefinition = {
  id: AdminRouteId;
  href:
    | '/admin/'
    | '/admin/theme/'
    | '/admin/content/'
    | '/admin/media/'
    | '/admin/checks/'
    | '/admin/data/';
  label: string;
  description: string;
};

export const ADMIN_ROUTES = [
  {
    id: 'overview',
    href: '/admin/',
    label: 'Overview',
    description: '站点快照'
  },
  {
    id: 'theme',
    href: '/admin/theme/',
    label: 'Theme',
    description: '主题设置'
  },
  {
    id: 'content',
    href: '/admin/content/',
    label: 'Content',
    description: '内容索引与 frontmatter 控制台'
  },
  {
    id: 'media',
    href: '/admin/media/',
    label: 'Media',
    description: '媒体浏览与路径辅助'
  },
  {
    id: 'checks',
    href: '/admin/checks/',
    label: 'Checks',
    description: '结构化诊断与发布前自检'
  },
  {
    id: 'data',
    href: '/admin/data/',
    label: 'Data',
    description: '设置导入导出'
  }
] as const satisfies readonly AdminRouteDefinition[];

export const isAdminRouteId = (value: string): value is AdminRouteId =>
  ADMIN_ROUTES.some((route) => route.id === value);

export const getAdminRoute = (id: AdminRouteId): AdminRouteDefinition =>
  ADMIN_ROUTES.find((route) => route.id === id) ?? ADMIN_ROUTES[0];
