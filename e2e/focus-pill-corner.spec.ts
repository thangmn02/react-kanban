import { expect, test, type Page } from '@playwright/test';

/** The pill rests in a corner of the content area and stays there through reloads, resizes and navigation. */
const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
async function withFocusTask(page: Page) {
  await page.goto('/home');
  await page.getByRole('button', { name: /^Add to focus:/ }).first().click();
}
const gap = (page: Page) => page.evaluate(() => {
  // A view that is still loading has no header yet: not in any corner, so the poll tries again.
  const element = (selector: string) => document.querySelector(selector)?.getBoundingClientRect() ?? new DOMRect(-9999, -9999);
  const box = element('.focus-island'), content = element('[data-content-area]'), header = element('[data-app-header]');
  return { left: Math.round(box.left - content.left), right: Math.round(Math.min(content.right, document.documentElement.clientWidth) - box.right),
    top: Math.round(box.top - header.bottom), bottom: Math.round(innerHeight - box.bottom) };
});
const inCorner = (value: Awaited<ReturnType<typeof gap>>, corner: string) => {
  const [vertical, horizontal] = corner.split('-') as ['top' | 'bottom', 'left' | 'right'];
  return [value[vertical], value[horizontal]];
};

for (const size of [{ width: 1280, height: 800 }, { width: 1920, height: 1080 }]) test(`snaps to every corner and stays there at ${size.width}`, async ({ page }) => {
  await page.setViewportSize(size);
  await withFocusTask(page);
  const bar = page.locator('.island-bar');
  await expect(bar).toBeVisible();
  expect(inCorner(await gap(page), 'bottom-left')).toEqual([16, 16]);
  for (const corner of corners) {
    const grip = (await page.locator('.island-grip').boundingBox())!;
    await page.mouse.move(grip.x + 7, grip.y + 8);
    await page.mouse.down();
    await page.mouse.move(corner.endsWith('left') ? 420 : size.width - 120, corner.startsWith('top') ? 180 : size.height - 120, { steps: 8 });
    await page.mouse.up();
    expect(inCorner(await gap(page), corner)).toEqual([16, 16]);
    await page.reload();
    await expect(bar).toBeVisible();
    await expect.poll(async () => inCorner(await gap(page), corner)).toEqual([16, 16]);
    // Dock-sized and back.
    await page.setViewportSize({ width: 520, height: 580 });
    await page.setViewportSize(size);
    await expect.poll(async () => inCorner(await gap(page), corner)).toEqual([16, 16]);
    for (const path of ['/today', '/notes', '/home']) {
      await page.goto(path);
      await expect(bar).toBeVisible();
      await expect.poll(async () => inCorner(await gap(page), corner)).toEqual([16, 16]);
    }
  }
});

test('shows one focus widget at a time', async ({ page }) => {
  await withFocusTask(page);
  await page.locator('.island-task').click();
  await expect(page.locator('.island-details')).toBeVisible();
  await expect(page.locator('.island-bar')).toHaveCount(0);
  await page.getByRole('button', { name: /Minimize/ }).first().click();
  await expect(page.locator('.island-bar')).toBeVisible();
});
