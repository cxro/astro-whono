export type AdminRouteId = 'overview' | 'theme' | 'content' | 'images' | 'checks' | 'data';

export type AdminRouteActiveMatch = 'exact' | 'prefix';

export type AdminRouteDefinition = {
  id: AdminRouteId;
  href:
    | '/admin/'
    | '/admin/theme/'
    | '/admin/content/'
    | '/admin/images/'
    | '/admin/checks/'
    | '/admin/data/';
  label: string;
  description: string;
  railActiveMatch?: AdminRouteActiveMatch;
};

export const ADMIN_ROUTES: readonly AdminRouteDefinition[] = [
  {
    id: 'overview',
    href: '/admin/',
    label: 'Overview',
    description: '后台首页'
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
    description: '内容管理',
    railActiveMatch: 'exact'
  },
  {
    id: 'images',
    href: '/admin/images/',
    label: 'Images',
    description: '图片管理'
  },
  {
    id: 'checks',
    href: '/admin/checks/',
    label: 'Checks',
    description: '站点诊断'
  },
  {
    id: 'data',
    href: '/admin/data/',
    label: 'Data',
    description: '设置导入导出'
  }
] as const;

export const isAdminRouteId = (value: string): value is AdminRouteId =>
  ADMIN_ROUTES.some((route) => route.id === value);

export const getAdminRoute = (id: AdminRouteId): AdminRouteDefinition =>
  ADMIN_ROUTES.find((route) => route.id === id) ?? ADMIN_ROUTES[0]!;

export const isAdminRoutePathActive = (
  pathname: string,
  href: string,
  match: AdminRouteActiveMatch = 'prefix'
): boolean =>
  match === 'exact'
    ? pathname === href
    : pathname === href || pathname.startsWith(href);
