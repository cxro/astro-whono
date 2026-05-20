import { describe, expect, it } from 'vitest';
import {
  getAdminRoute,
  isAdminRouteRailPathActive,
  isAdminRoutePathActive
} from '../src/lib/admin-console/routes';

describe('admin route helpers', () => {
  it('keeps overview exact so it does not match every admin child route', () => {
    const overviewRoute = getAdminRoute('overview');

    expect(isAdminRoutePathActive('/admin/', overviewRoute.href, overviewRoute.activeMatch)).toBe(true);
    expect(isAdminRoutePathActive('/admin/theme/', overviewRoute.href, overviewRoute.activeMatch)).toBe(false);
  });

  it('keeps Content active across content child routes', () => {
    const contentRoute = getAdminRoute('content');

    expect(isAdminRoutePathActive('/admin/content/', contentRoute.href, contentRoute.activeMatch)).toBe(true);
    expect(isAdminRoutePathActive('/admin/content/essay/_edit/admin-console-guide/', contentRoute.href, contentRoute.activeMatch)).toBe(true);
  });

  it('keeps rail active only on first-level admin route pages', () => {
    const contentRoute = getAdminRoute('content');

    expect(isAdminRouteRailPathActive('/admin/content/', contentRoute.href)).toBe(true);
    expect(isAdminRouteRailPathActive('/admin/content/essay/_edit/admin-console-guide/', contentRoute.href)).toBe(false);
  });

  it('keeps prefix matching as the default admin route behavior', () => {
    const imagesRoute = getAdminRoute('images');

    expect(isAdminRoutePathActive('/admin/images/', imagesRoute.href, imagesRoute.activeMatch)).toBe(true);
    expect(isAdminRoutePathActive('/admin/images/browse/', imagesRoute.href, imagesRoute.activeMatch)).toBe(true);
  });
});
