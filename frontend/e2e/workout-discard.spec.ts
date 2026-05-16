import { test, expect, type Page } from '@playwright/test';

async function signUp(page: Page, username: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await page.getByPlaceholder('Enter username').fill(username);
  await page.getByPlaceholder('••••••••').fill('testpass123');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.locator('h1:has-text("Templates")')).toBeVisible({ timeout: 15_000 });
}

test.describe('Workout Discard', () => {
  test('discarding a workout with exercises navigates home without errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await signUp(page, 'e2e_discard_user');

    await page.getByText('Start Empty').click();
    await expect(page.getByPlaceholder('Workout Name')).toBeVisible({ timeout: 10_000 });

    await page.getByText('Add Exercise').click();
    await expect(page.getByPlaceholder('Search exercise...')).toBeVisible();
    // Use the full exercise name so the create button text contains it
    await page.getByPlaceholder('Search exercise...').fill('Bench Press');
    await page.getByRole('button', { name: 'Bench Press' }).click();

    await expect(page.getByText('Bench Press')).toBeVisible();

    // Click X to trigger discard modal
    await page.locator('header button').first().click();
    await expect(page.getByText('Leave Workout?')).toBeVisible();

    await page.getByRole('button', { name: 'Discard Workout' }).click();

    await expect(page.locator('h1:has-text("Templates")')).toBeVisible({ timeout: 10_000 });

    // Draft should be cleaned up — no resume banner
    await expect(page.getByText('Resume Workout')).not.toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test('discarding an empty workout (no exercises) navigates home directly', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await signUp(page, 'e2e_discard_empty_user');

    await page.getByText('Start Empty').click();
    await expect(page.getByPlaceholder('Workout Name')).toBeVisible({ timeout: 10_000 });

    // Click X — no exercises so no discard modal, navigates directly
    await page.locator('header button').first().click();

    await expect(page.locator('h1:has-text("Templates")')).toBeVisible({ timeout: 10_000 });

    expect(pageErrors).toEqual([]);
  });
});
