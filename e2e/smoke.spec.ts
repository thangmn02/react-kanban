import { expect, test } from '@playwright/test';

const boardPath = '/workspaces/local-mock-workspace/boards/local-mock-board';

test.describe('route smoke coverage', () => {
  test('opens the task-free dock only through explicit Focus navigation', async ({ page }) => {
    await page.goto('/home');
    await expect(page.locator('.island-bar, .floating-focus')).toHaveCount(0);
    await page.getByRole('button', { name: 'Focus', exact: true }).click();
    await expect(page.locator('.floating-focus')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Pop out dock' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Music', exact: true }).click();
    await page.getByRole('tab', { name: 'Beat grid', exact: true }).click();
    await expect(page.locator('.beat-square')).toHaveCount(32);
    expect(page.context().pages()).toHaveLength(1);
  });
  test('loads Home without uncaught page errors', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.goto('/home');

    await expect(
      page.getByRole('heading', { level: 1, name: /Good (morning|afternoon|evening),/ }),
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
