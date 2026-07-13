import { expect, test } from '@playwright/test';

const boardPath = '/workspaces/local-mock-workspace/boards/local-mock-board';

test.describe('route smoke coverage', () => {
  test('loads Home without uncaught page errors', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.goto('/home');

    await expect(
      page.getByRole('heading', { name: 'Plan many tasks. Focus on one. Finish today.' }),
    ).toBeVisible();
    await expect(page.locator('#root')).not.toBeEmpty();
    expect(pageErrors).toEqual([]);
  });

  test('loads the canonical board URL without uncaught page errors', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.goto(boardPath);

    await expect(page.getByRole('button', { name: 'Add task' }).first()).toBeVisible();
    await expect(page.locator('#root')).not.toBeEmpty();
    expect(pageErrors).toEqual([]);
  });
});
