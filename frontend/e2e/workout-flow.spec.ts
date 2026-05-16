import { test, expect, type Page } from '@playwright/test';

async function signUp(page: Page, username: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await page.getByPlaceholder('Enter username').fill(username);
  await page.getByPlaceholder('••••••••').fill('testpass123');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.locator('h1:has-text("Templates")')).toBeVisible({ timeout: 15_000 });
}

test.describe('Workout Flow', () => {
  test('start workout, add exercise, finish, and see it in history', async ({ page }) => {
    await signUp(page, 'e2e_flow_user');

    await page.getByText('Start Empty').click();
    await expect(page.getByPlaceholder('Workout Name')).toBeVisible({ timeout: 10_000 });

    await page.getByText('Add Exercise').click();
    await expect(page.getByPlaceholder('Search exercise...')).toBeVisible();
    await page.getByPlaceholder('Search exercise...').fill('Squat');
    await page.getByRole('button', { name: 'Squat' }).click();

    await expect(page.getByText('Squat').first()).toBeVisible();

    await page.getByRole('button', { name: 'Finish' }).click();

    await expect(page.locator('h1:has-text("History")')).toBeVisible({ timeout: 10_000 });
  });

  test('start workout from template preserves template exercises', async ({ page }) => {
    await signUp(page, 'e2e_template_flow_user');

    // Already on Templates page — create a new template
    await page.getByText('Create your first template').click();
    await expect(page.locator('h1:has-text("New Template")')).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder('e.g. Upper Body Power').fill('Push Day');

    // Use the full exercise name so the create button matches
    await page.getByPlaceholder('Search exercises to add...').click();
    await page.getByPlaceholder('Search exercises to add...').fill('Bench Press');
    await page.getByRole('button', { name: 'Bench Press' }).click();

    await page.getByRole('button', { name: 'Create Template' }).click();
    await expect(page.locator('h1:has-text("Templates")')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Start' }).click();

    await expect(page.getByPlaceholder('Workout Name')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Bench Press')).toBeVisible();
  });
});
