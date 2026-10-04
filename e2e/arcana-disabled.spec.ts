import { expect, test } from '@playwright/test';

test('Arcana is hidden, direct links redirect, and task completion leaves rewards untouched', async ({ page }) => {
  await page.goto('/home');
  const savedRewards = JSON.stringify({ date: '2026-10-03', completedCountToday: 3, promptsShownToday: 1, availableDraws: 5, lastPromptAt: 1 });
  await page.evaluate(value => localStorage.setItem('app.arcana.rewardState', value), savedRewards);
  await page.getByRole('button', { name: 'Open user menu' }).click();
  await expect(page.getByRole('menuitem', { name: /Arcana/i })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.goto('/arcana');
  await expect(page).toHaveURL('/home');
  await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
  await page.goto('/workspaces/local-mock-workspace/boards/local-mock-board');
  await page.getByRole('button', { name: 'Mark done: Redesign tables card', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark not done: Redesign tables card', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open now', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('app.arcana.rewardState'))).toBe(savedRewards);
});
