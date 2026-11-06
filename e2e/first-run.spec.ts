import { expect, test } from '@playwright/test';

// Runs against a server without VITE_LOCAL_SAMPLE: see playwright.first-run.config.ts.
test('a new local workspace is empty, and the sample is on demand, labeled and removable', async ({ page }) => {
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Start with your first task' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Guest');
  await expect(page.getByText('Redesign tables card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create a sample board' }).click();
  await expect(page.getByRole('note').filter({ hasText: 'This is a sample board' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Active board' })).toHaveValue('local-sample-board');
  await expect(page.getByText('Redesign tables card').first()).toBeVisible();
  await page.getByRole('button', { name: 'Remove sample board' }).click();
  await expect(page.getByRole('heading', { name: 'Start with your first task' })).toBeVisible();
  await page.goto('/tasks');
  await expect(page.getByRole('combobox', { name: 'Active board' }).locator('option')).toHaveText(['Personal Tasks']);
});

test('stored data from before this change is kept as it is', async ({ page }) => {
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Start with your first task' })).toBeVisible();
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find(name => name.endsWith('board_store:v1'))!;
    const state = JSON.parse(localStorage.getItem(key)!);
    state.boards[0].title = 'HVAC Editor';
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.goto('/tasks');
  await expect(page.getByRole('combobox', { name: 'Active board' }).locator('option')).toHaveText(['HVAC Editor']);
});

test('the empty Focus dock offers Add a task, not a dead link', async ({ page }) => {
  await page.goto('/focus');
  await expect(page.getByRole('button', { name: 'Open Kora' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.getByRole('dialog').first()).toBeVisible();
});
