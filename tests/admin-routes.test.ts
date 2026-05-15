import { describe, expect, it } from 'vitest';
import {
  getAdminRoute,
  isAdminRoutePathActive
} from '../src/lib/admin-console/routes';

describe('admin route helpers', () => {
  it('keeps Content rail active only on the top-level content route', () => {
    const contentRoute = getAdminRoute('content');

    expect(isAdminRoutePathActive('/admin/content/', contentRoute.href, contentRoute.railActiveMatch)).toBe(true);
    expect(isAdminRoutePathActive('/admin/content/essay/_edit/admin-console-guide/', contentRoute.href, contentRoute.railActiveMatch)).toBe(false);
  });

  it('keeps prefix matching as the default rail route behavior', () => {
    const imagesRoute = getAdminRoute('images');

    expect(isAdminRoutePathActive('/admin/images/', imagesRoute.href, imagesRoute.railActiveMatch)).toBe(true);
    expect(isAdminRoutePathActive('/admin/images/browse/', imagesRoute.href, imagesRoute.railActiveMatch)).toBe(true);
  });
});
