import { test, expect } from '@playwright/test';

test.describe('Auth', () => {
  test('sign up and land on home page', async ({ page }) => {
    await page.goto('/');

    // Should see the auth page
    await expect(page.locator('h1:has-text("IronTrack")')).toBeVisible();

    // Switch to Sign Up tab
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Fill in credentials
    await page.getByPlaceholder('Enter username').fill('e2e_signup_user');
    await page.getByPlaceholder('••••••••').fill('testpass123');

    // Submit
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Should land on home page
    await expect(page.getByText('Welcome back, e2e_signup_user')).toBeVisible({ timeout: 10_000 });
  });

  test('login with existing user', async ({ page }) => {
    // First, sign up
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign Up' }).click();
    await page.getByPlaceholder('Enter username').fill('e2e_login_user');
    await page.getByPlaceholder('••••••••').fill('testpass123');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByText('Welcome back, e2e_login_user')).toBeVisible({ timeout: 10_000 });

    // Clear localStorage to simulate fresh session
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');

    // Should see auth page again — Login tab is default
    await expect(page.locator('h1:has-text("IronTrack")')).toBeVisible();

    // Fill login form
    await page.getByPlaceholder('Enter username').fill('e2e_login_user');
    await page.getByPlaceholder('••••••••').fill('testpass123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should land on home page
    await expect(page.getByText('Welcome back, e2e_login_user')).toBeVisible({ timeout: 10_000 });
  });
});
