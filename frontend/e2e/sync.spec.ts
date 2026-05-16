import { test, expect, type Page } from '@playwright/test';

async function signUp(page: Page, username: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await page.getByPlaceholder('Enter username').fill(username);
  await page.getByPlaceholder('••••••••').fill('testpass123');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.locator('h1:has-text("Templates")')).toBeVisible({ timeout: 15_000 });
}

async function signIn(page: Page, username: string) {
  await page.goto('/');
  await page.getByPlaceholder('Enter username').fill(username);
  await page.getByPlaceholder('••••••••').fill('testpass123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.locator('h1:has-text("Templates")')).toBeVisible({ timeout: 15_000 });
}

async function createTemplate(page: Page, name: string) {
  // Works from any state — uses empty-state button or generic nav
  await page.getByText('Create your first template').click();
  await expect(page.locator('h1').filter({ hasText: /Template/ })).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder('e.g. Upper Body Power').fill(name);
  await page.getByRole('button', { name: 'Create Template' }).click();
  await expect(page.locator('h1:has-text("Templates")')).toBeVisible({ timeout: 10_000 });
}

test.describe('Sync', () => {
  test('local data persists in IndexedDB after offline reload', async ({ page, context }) => {
    await signUp(page, 'e2e_sync_persist_user');

    // Create template while online — saved to IndexedDB + queued to outbox + flushed to server
    await createTemplate(page, 'Persistence Test');
    await expect(page.getByText('Persistence Test')).toBeVisible();

    // Go offline and reload — data must come from IndexedDB, not server
    await context.setOffline(true);
    await page.reload();

    await expect(page.locator('h1:has-text("Templates")')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Persistence Test')).toBeVisible();
  });

  test('outbox flushes on reconnect and data appears in a second context', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await signUp(page1, 'e2e_sync_outbox_user');

    // Go offline then create a template — saved locally, outbox queued but can't flush
    await ctx1.setOffline(true);
    await createTemplate(page1, 'Outbox Flush Template');
    await expect(page1.getByText('Outbox Flush Template')).toBeVisible();

    // Go back online — flushOutbox fires via the 'online' window event
    await ctx1.setOffline(false);

    // Second fresh context: sign in as the same user (triggers pullSync)
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await signIn(page2, 'e2e_sync_outbox_user');

    // Poll: reload re-runs pullSync; template appears once ctx1's outbox flush reaches the server
    await expect.poll(
      async () => {
        await page2.reload();
        await page2.waitForLoadState('networkidle');
        return page2.getByText('Outbox Flush Template').isVisible();
      },
      { timeout: 20_000, intervals: [3_000] },
    ).toBe(true);

    await ctx1.close();
    await ctx2.close();
  });

  test('two contexts same account — template created in one appears after sync in other', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await signUp(page1, 'e2e_sync_twocontext_user');

    // Create template online — syncs to server immediately
    await createTemplate(page1, 'Shared Template');

    // Wait for the outbox to flush (pullSync already ran; flushOutbox queued on login)
    // Verify server has it by polling
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await signIn(page2, 'e2e_sync_twocontext_user');

    await expect.poll(
      async () => {
        await page2.reload();
        await page2.waitForLoadState('networkidle');
        return page2.getByText('Shared Template').isVisible();
      },
      { timeout: 20_000, intervals: [2_000] },
    ).toBe(true);

    await ctx1.close();
    await ctx2.close();
  });
});
