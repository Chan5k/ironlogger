import { test, expect } from '@playwright/test';

/**
 * Simulates a phone user: landing → auth screens → (optional) logged-in shell with side menu.
 * Requires API on port 5000 for login/register tests (Vite proxies /api).
 */
test.describe('Mobile user journey', () => {
  test('landing: primary CTAs visible and tappable', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'IronLog', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/progress/i);
    await expect(page.getByRole('link', { name: 'Sign up free' })).toBeVisible();
    await page.getByRole('link', { name: 'Log in' }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  });

  test('login screen: form fits mobile viewport', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    const box = await page.getByRole('textbox', { name: 'Email' }).boundingBox();
    expect(box?.width).toBeGreaterThan(200);
  });

  test('register screen: username field visible', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password (min 8)')).toBeVisible();
  });
});

test.describe('Mobile shell (authenticated)', () => {
  test('opens side menu and navigates to Workouts', async ({ page }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD to run authenticated mobile flow');

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/app\/?$/i, { timeout: 15_000 });

    await page.getByTestId('mobile-menu-button').click();
    await expect(page.locator('#mobile-navigation')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'App sections' })).toBeVisible();

    await page.getByRole('link', { name: 'Workouts' }).click();
    await expect(page).toHaveURL(/\/app\/workouts/);

    await page.getByTestId('mobile-menu-button').click();
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/app\/settings/);
  });
});
