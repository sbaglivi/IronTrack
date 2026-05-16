import { test, expect } from '@playwright/test';

// PWA tests run against the built app (port 8765 via playwright.config.ts webServer)
// where VitePWA actually registers the service worker.

test.describe('PWA', () => {
  test('service worker registers and becomes active', async ({ page }) => {
    await page.goto('/');
    // Wait for SW to be ready (may take a few seconds on first install)
    const isActive = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.ready;
      return !!reg.active;
    });
    expect(isActive).toBe(true);
  });

  test('manifest.webmanifest is valid', async ({ request }) => {
    const resp = await request.get('/manifest.webmanifest');
    expect(resp.ok()).toBe(true);
    const ct = resp.headers()['content-type'] ?? '';
    expect(ct).toContain('json');

    const manifest = await resp.json();
    expect(manifest.name).toBe('IronTrack');
    expect(manifest.short_name).toBe('IronTrack');
    expect(manifest.display).toBe('standalone');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  test('sw.js is served with JS content-type', async ({ request }) => {
    const resp = await request.get('/sw.js');
    expect(resp.ok()).toBe(true);
    const ct = resp.headers()['content-type'] ?? '';
    expect(ct).toContain('javascript');
  });

  test('app shell loads from SW cache when offline', async ({ page, context }) => {
    // First visit — loads from network and caches assets
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    // Wait for SW to fully activate before cutting the network
    await page.evaluate(() => navigator.serviceWorker.ready);

    // Simulate offline and reload — SW should serve the cached shell
    await context.setOffline(true);
    await page.reload();

    // Auth page (user not signed in) should render from cache
    await expect(page.locator('h1:has-text("IronTrack")')).toBeVisible({ timeout: 10_000 });
  });
});
