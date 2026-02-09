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

test.describe('Workout Flow', () => {
  test('start workout, add exercise, finish, and see it in history', async ({ page }) => {
    await signUp(page, 'e2e_flow_user');

    // Start an empty workout
    await page.getByText('Start Empty Workout').click();
    await expect(page.getByPlaceholder('Workout Name')).toBeVisible({ timeout: 10_000 });

    // Add an exercise
    await page.getByText('Add Exercise').click();
    await expect(page.getByPlaceholder('Search exercise...')).toBeVisible();
    await page.getByPlaceholder('Search exercise...').fill('Squat');
    await page.getByRole('button', { name: 'Squat' }).click();

    // Verify exercise was added
    await expect(page.getByText('Squat').first()).toBeVisible();

    // Click Finish
    await page.getByRole('button', { name: 'Finish' }).click();

    // Should navigate to history page (heading is just "History")
    await expect(page.locator('h1:has-text("History")')).toBeVisible({ timeout: 10_000 });
  });

  test('start workout from template preserves template exercises', async ({ page }) => {
    await signUp(page, 'e2e_template_flow_user');

    // Navigate to templates page
    await page.getByText('Use a Template').click();
    await expect(page.locator('h1:has-text("Templates")')).toBeVisible({ timeout: 10_000 });

    // Click the + button to create a new template (empty state has a link too)
    await page.getByText('Create your first template').click();
    await expect(page.locator('h1:has-text("New Template")')).toBeVisible({ timeout: 10_000 });

    // Name the template
    await page.getByPlaceholder('e.g. Upper Body Power').fill('Push Day');

    // Add an exercise — template editor uses inline search, not a modal
    await page.getByPlaceholder('Search exercises to add...').click();
    await page.getByPlaceholder('Search exercises to add...').fill('Bench');
    await page.getByRole('button', { name: 'Bench Press' }).click();

    // Save template
    await page.getByRole('button', { name: 'Create Template' }).click();
    await expect(page.locator('h1:has-text("Templates")')).toBeVisible({ timeout: 10_000 });

    // Start workout from template — click the "Start" button on the template card
    await page.getByRole('button', { name: 'Start' }).click();

    // Should be in workout session with the template exercise pre-loaded
    await expect(page.getByPlaceholder('Workout Name')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Bench Press')).toBeVisible();
  });
});
