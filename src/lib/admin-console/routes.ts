import type { AdminIconName } from './admin-icon-names';

export type AdminRouteId = 'overview' | 'theme' | 'content' | 'images' | 'checks' | 'data';

export type AdminRouteActiveMatch = 'exact' | 'prefix';

export type AdminRouteIconName = Extract<
  AdminIconName,
  'astro-logo-color' | 'palette' | 'admin-page' | 'images' | 'shield-check' | 'database'
>;

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
  sidebarLabel: string;
  sidebarIcon: AdminRouteIconName;
  description: string;
  activeMatch?: AdminRouteActiveMatch;
};

export const ADMIN_ROUTES: readonly AdminRouteDefinition[] = [
  {
    id: 'overview',
    href: '/admin/',
    label: 'Overview',
    sidebarLabel: '概览',
    sidebarIcon: 'astro-logo-color',
    description: '后台首页',
    activeMatch: 'exact'
  },
  {
    id: 'theme',
    href: '/admin/theme/',
    label: 'Theme',
    sidebarLabel: '主题',
    sidebarIcon: 'palette',
    description: '主题设置'
  },
  {
    id: 'content',
    href: '/admin/content/',
    label: 'Content',
    sidebarLabel: '写作',
    sidebarIcon: 'admin-page',
    description: '内容管理'
  },
  {
    id: 'images',
    href: '/admin/images/',
    label: 'Images',
    sidebarLabel: '图片',
    sidebarIcon: 'images',
    description: '图片管理'
  },
  {
    id: 'checks',
    href: '/admin/checks/',
    label: 'Checks',
    sidebarLabel: '校验',
    sidebarIcon: 'shield-check',
    description: '站点诊断'
  },
  {
    id: 'data',
    href: '/admin/data/',
    label: 'Data',
    sidebarLabel: '快照',
    sidebarIcon: 'database',
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

export const isAdminRouteRailPathActive = (pathname: string, href: string): boolean =>
  isAdminRoutePathActive(pathname, href, 'exact');
