import { test, expect } from '@playwright/test';

test.describe('critical pages', () => {
  test('homepage renders with sidebar and dark mode toggle', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('aside.sidebar')).toBeVisible();
    await expect(page.locator('#theme-toggle')).toBeVisible();
  });

  test('bits page loads and image cards have lightbox data attributes', async ({
    page,
  }) => {
    await page.goto('/bits/');
    const images = page.locator('[data-bit-image-button] img');
    await expect(images.first()).toBeVisible();
  });

  test('archive page contains essay cards', async ({ page }) => {
    await page.goto('/archive/');
    const cards = page.locator('.archive-row');
    await expect(cards.first()).toBeVisible();
  });

  test('dark mode toggle is clickable', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('#theme-toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();
  });
});
