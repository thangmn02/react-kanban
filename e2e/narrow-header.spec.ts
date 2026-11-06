import { expect, test } from '@playwright/test';

for (const width of [375, 320]) {
  test(`${width}px keeps one top row, five destinations and no overlap`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/tasks');
    const nav = page.getByRole('navigation', { name: 'Main navigation' }).filter({ visible: true });
    await expect(nav.getByRole('button')).toHaveCount(5);
    const labels = await nav.locator('button span').evaluateAll(spans => spans.map(span => span.getBoundingClientRect()).map(box => [box.left, box.right]));
    for (let index = 1; index < labels.length; index++) expect(labels[index][0]).toBeGreaterThanOrEqual(labels[index - 1][1]);
    expect((await page.locator('header').first().boundingBox())!.height).toBeLessThanOrEqual(140);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('complementary', { name: 'Context' })).toBeHidden();
  });
}

test('Workspace and Contact stay one tap away on a phone, by keyboard too', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/home');
  const more = page.getByRole('button', { name: 'More', exact: true });
  await more.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Contact' }).click();
  await expect(page).toHaveURL('/contact');
  await more.click();
  await expect(page.getByRole('menuitem', { name: 'Workspace' })).toBeVisible();
});

test('Notes keeps its Context row on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/notes');
  await page.getByRole('complementary', { name: 'Context' }).getByRole('button', { name: /Context/ }).first().click();
  await page.getByRole('link', { name: 'Personal' }).first().click();
  await expect(page).toHaveURL(/scope=personal/);
});
