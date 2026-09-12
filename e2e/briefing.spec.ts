import { expect, test } from '@playwright/test';

test('briefing launches guarded focus and real task details', async ({ page }) => {
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Suggested next step' })).toBeVisible();
  await page.getByRole('button', { name: 'Start focus', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Start with intention' })).toBeVisible();
  await page.getByRole('button', { name: 'Start without intention' }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View details', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit task in context' })).toBeVisible();
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
