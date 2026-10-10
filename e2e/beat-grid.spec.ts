import { expect, test } from '@playwright/test';

test('Focus retains four rows and internal Music access across compatible links and refresh', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', error => errors.push(error));
  await page.goto('/beat-grid');
  await expect(page).toHaveURL(/\/focus\?tab=beat$/);
  await expect(page.getByRole('tabpanel', { name: 'Beat grid' })).toContainText('No music detected');
  await expect(page.getByRole('link', { name: 'Add music controls' })).toBeVisible();
  // The existing diagnostic grid renders without inventing a captured source.
  await page.goto('/beat-grid?musicDebug=1');
  const grid = page.getByRole('tabpanel', { name: 'Beat grid' });
  await expect(grid.locator('.beat-channel')).toHaveCount(4);
  await expect(grid.locator('.beat-square')).toHaveCount(32);
  await expect(grid.locator('.beat-square.onset, .melody-beat-flash')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Music', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Music', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Beat grid', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('tabpanel', { name: 'Beat grid' }).locator('.beat-square')).toHaveCount(32);
  expect(errors).toEqual([]);
});
