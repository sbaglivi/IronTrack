import { test, expect } from '@playwright/test';

test.describe('Auth', () => {
  test('sign up and land on templates page', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1:has-text("IronTrack")')).toBeVisible();

    await page.getByRole('button', { name: 'Sign Up' }).click();
    await page.getByPlaceholder('Enter username').fill('e2e_signup_user');
    await page.getByPlaceholder('••••••••').fill('testpass123');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.locator('h1:has-text("Templates")')).toBeVisible({ timeout: 15_000 });
  });

  test('login with existing user', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign Up' }).click();
    await page.getByPlaceholder('Enter username').fill('e2e_login_user');
    await page.getByPlaceholder('••••••••').fill('testpass123');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.locator('h1:has-text("Templates")')).toBeVisible({ timeout: 15_000 });

    // Clear local state to simulate a fresh session
    await page.evaluate(() => {
      localStorage.clear();
      return indexedDB.deleteDatabase('irontrack');
    });
    await page.goto('/');

    await expect(page.locator('h1:has-text("IronTrack")')).toBeVisible();

    await page.getByPlaceholder('Enter username').fill('e2e_login_user');
    await page.getByPlaceholder('••••••••').fill('testpass123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.locator('h1:has-text("Templates")')).toBeVisible({ timeout: 15_000 });
  });
});
