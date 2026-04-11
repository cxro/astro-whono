import { test, expect } from '@playwright/test';

test.describe('admin boundary', () => {
  test('/api/admin/settings/ returns static redirect shell in production preview', async ({
    page,
  }) => {
    const response = await page.goto('/api/admin/settings/');
    expect(response).not.toBeNull();
    const contentType = response!.headers()['content-type'] ?? '';
    expect(contentType).not.toContain('application/json');
    const body = await response!.text();
    expect(body).toContain('Redirecting to: /api/admin/settings/');
    expect(body).not.toContain('"revision"');
    expect(body).not.toContain('"settings"');
  });
});
