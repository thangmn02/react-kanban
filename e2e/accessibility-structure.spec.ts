import { expect, test } from '@playwright/test';

for (const route of ['/home', '/today', '/tasks', '/notes', '/focus', '/contact']) {
  test(`${route} has one main, one H1 and a working skip link`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('main#main')).toHaveCount(1);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
  });
}

test('the board search has an accessible name and the board title is the H1', async ({ page }) => {
  await page.goto('/tasks');
  await expect(page.getByRole('textbox', { name: 'Search tasks' })).toBeVisible();
  const select = page.getByRole('combobox', { name: 'Active board' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText((await select.locator('option:checked').textContent()) ?? '');
});
