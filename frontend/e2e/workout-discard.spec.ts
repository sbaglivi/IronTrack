import { test, expect } from '@playwright/test';

// Helper: sign up and get to home page
async function signUp(page: import('@playwright/test').Page, username: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await page.getByPlaceholder('Enter username').fill(username);
  await page.getByPlaceholder('••••••••').fill('testpass123');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByText(`Welcome back, ${username}`)).toBeVisible({ timeout: 10_000 });
}

test.describe('Workout Discard', () => {
  test('discarding a workout with exercises navigates home without errors', async ({ page }) => {
    // Collect uncaught page errors
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await signUp(page, 'e2e_discard_user');

    // Start an empty workout
    await page.getByText('Start Empty Workout').click();
    await expect(page.getByPlaceholder('Workout Name')).toBeVisible({ timeout: 10_000 });

    // Add an exercise
    await page.getByText('Add Exercise').click();
    await expect(page.getByPlaceholder('Search exercise...')).toBeVisible();
    await page.getByPlaceholder('Search exercise...').fill('Bench');
    await page.getByRole('button', { name: 'Bench Press' }).click();

    // Verify exercise was added
    await expect(page.getByText('Bench Press')).toBeVisible();

    // Click X to trigger discard modal
    // The X button is the first button in the header (top-left)
    await page.locator('header button').first().click();
    await expect(page.getByText('Leave Workout?')).toBeVisible();

    // Click "Discard Workout"
    await page.getByRole('button', { name: 'Discard Workout' }).click();

    // Should navigate to home page
    await expect(page.getByText('Welcome back, e2e_discard_user')).toBeVisible({ timeout: 10_000 });

    // Should NOT show resume workout banner (draft should be cleaned up)
    await expect(page.getByText('Resume Workout')).not.toBeVisible();

    // Should have no uncaught errors
    expect(pageErrors).toEqual([]);
  });

  test('discarding an empty workout (no exercises) navigates home directly', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await signUp(page, 'e2e_discard_empty_user');

    // Start an empty workout
    await page.getByText('Start Empty Workout').click();
    await expect(page.getByPlaceholder('Workout Name')).toBeVisible({ timeout: 10_000 });

    // Click X — should navigate directly (no modal since no exercises)
    await page.locator('header button').first().click();

    // Should be back on home page
    await expect(page.getByText('Welcome back, e2e_discard_empty_user')).toBeVisible({ timeout: 10_000 });

    // No errors
    expect(pageErrors).toEqual([]);
  });
});
