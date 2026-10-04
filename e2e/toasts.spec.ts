import { expect, test } from '@playwright/test';

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test.describe(`toast lifetime (${reducedMotion})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion });
      await page.goto('/home');
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches))
        .toBe(reducedMotion === 'reduce');
    });

    test('focus confirmation disappears automatically', async ({ page }) => {
      await page.getByRole('button', { name: /^Add to focus:/ }).first().click();
      await page.getByRole('button', { name: 'Start focus', exact: true }).click();
      await page.getByRole('button', { name: 'Start without intention' }).click();
      await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
      await page.mouse.move(0, 0);
      const toast = page.getByRole('status').filter({ hasText: 'Focus started:' });
      await expect(toast).toBeVisible();
      const progress = toast.getByRole('progressbar');
      await expect(progress).toHaveCSS('animation-duration', '2.5s');
      await expect(progress).toHaveCSS('animation-name', 'Toastify__trackProgress');
      await expect(progress).toHaveCSS('animation-play-state', 'running');
      if (reducedMotion === 'reduce') {
        await expect(toast.locator('.Toastify__progress-bar--wrp')).toHaveCSS('opacity', '0');
      }
      // Real elapsed time verifies reduced motion does not make messages flash away.
      await page.waitForTimeout(1000);
      await expect(toast).toBeVisible();
      await expect(toast).toHaveCount(0, { timeout: 6000 });
    });

    test('due-date notification pauses on hover and disappears after leaving', async ({ page }) => {
      const toast = page.getByRole('status').filter({ hasText: /due today.*overdue/ });
      await expect(toast).toBeVisible();
      const progress = toast.getByRole('progressbar');
      await expect(progress).toHaveCSS('animation-duration', '3s');
      await expect(progress).toHaveCSS('animation-play-state', 'running');
      await toast.hover();
      await expect(progress).toHaveCSS('animation-play-state', 'paused');
      // Exceed the entire info lifetime while paused, then resume the real clock.
      await page.waitForTimeout(3500);
      await expect(toast).toBeVisible();
      await page.mouse.move(0, 0);
      await expect(progress).toHaveCSS('animation-play-state', 'running');
      await expect(toast).toHaveCount(0, { timeout: 6000 });
    });
  });
}
