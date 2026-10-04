import { expect, test } from '@playwright/test';

test('briefing launches guarded focus and real task details', async ({ page }) => {
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
  await page.getByRole('button', { name: /^Add to focus:/ }).first().click();
  await expect(page.getByRole('button', { name: 'Expand Focus Dock' })).toBeVisible();
  await page.getByRole('button', { name: 'Start focus', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Start with intention' })).toBeVisible();
  await page.getByRole('button', { name: 'Start without intention' }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View details', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit task' })).toBeVisible();
});

test('mobile navigation keeps Today, workspace and account reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/home');
  const nav = page.getByRole('navigation', { name: 'Main navigation' }).filter({ visible: true });
  await expect(page.getByRole('combobox', { name: 'Active workspace' })).toBeVisible();
  for (const button of await page.getByRole('button', { name: 'Dismiss notification' }).all()) await button.click();
  await page.getByRole('button', { name: 'Open user menu' }).click();
  await expect(page.getByLabel('Language', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await nav.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page).toHaveURL('/today');
  await expect(nav.getByRole('button', { name: 'Today', exact: true })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL('/home');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('exiting paused Home focus restores the dock and stays exited in a new run', async ({ page }) => {
  await page.goto('/home');
  await page.getByRole('button', { name: /^Add to focus:/ }).first().click();
  await page.getByRole('button', { name: 'Start focus', exact: true }).click();
  await page.getByRole('button', { name: 'Start without intention' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const remaining = await page.getByRole('timer').textContent();
  await page.getByRole('button', { name: 'Exit focus', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Expand Focus Dock' })).toBeVisible();
  await expect(page.locator('.island-time')).toHaveText(remaining!);

  // This page has the saved timer/local preferences, but fresh sessionStorage.
  const newRun = await page.context().newPage();
  await newRun.goto('/home');
  await expect(newRun.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
  await expect(newRun.getByRole('button', { name: 'Exit focus' })).toHaveCount(0);
  await expect(newRun.locator('.island-time')).toHaveText(remaining!);
  await newRun.reload();
  await expect(newRun.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
  await expect(newRun.locator('.island-time')).toHaveText(remaining!);
  await newRun.close();
});
