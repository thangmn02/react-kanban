import { expect, test } from '@playwright/test';

// Route-level smoke test (Phase 5). Loads URL-addressable routes in local mock
// mode and asserts the app shell renders without an uncaught error.
test.describe('smoke — local mock mode routes', () => {
  test('home route renders the app shell', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/home');

    // The root is populated (not a blank screen / hard crash).
    await expect(page.locator('#root')).not.toBeEmpty();
    // Title is the app shell.
    await expect(page).toHaveTitle(/react-kanban-tailwind/i);

    expect(errors, `unexpected page errors: ${errors.join(', ')}`).toEqual([]);
  });

  test('board route renders the app shell', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/board');

    await expect(page.locator('#root')).not.toBeEmpty();
    expect(errors, `unexpected page errors: ${errors.join(', ')}`).toEqual([]);
  });
});
