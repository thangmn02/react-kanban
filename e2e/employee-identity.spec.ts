import { expect, test } from '@playwright/test';
const evidence = process.env.KORA_IDENTITY_EVIDENCE || 'scratch/identity-profile-261027-1704';

test('centered landscape profile dims and contains focus, then preserves Settings and dismissal', async ({ page }) => {
  await page.goto('/home');
  const trigger = page.locator('#kora-user-trigger');
  const card = page.getByTestId('identity-profile');
  await page.screenshot({ path: evidence + '/desktop-closed.png' });
  await trigger.click();
  await expect(card).toBeVisible();
  await expect.poll(() => card.evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  await expect(card).toHaveAttribute('aria-modal', 'true');
  const bounds = await card.boundingBox(), viewport = page.viewportSize()!;
  expect(bounds!.width).toBeGreaterThanOrEqual(760);
  expect(bounds!.width).toBeGreaterThan(bounds!.height);
  expect(Math.abs(bounds!.x + bounds!.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2);
  expect(Math.abs(bounds!.y + bounds!.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(2);
  expect(await page.locator('#root').evaluate(el => el.inert)).toBe(true);
  expect(await page.getByTestId('identity-profile-backdrop').evaluate(el => getComputedStyle(el).backgroundColor)).toContain('0.45');
  await expect(card.getByText('Local Workspace', { exact: true })).toBeVisible();
  await expect(card.getByRole('definition')).toHaveCount(3);
  const portrait = card.getByTestId('identity-portrait');
  expect(await portrait.locator('img').evaluate((el: HTMLImageElement) => ({ fit: getComputedStyle(el).objectFit, valid: el.complete && el.naturalWidth > 0 }))).toEqual({ fit: 'cover', valid: true });
  const close = card.getByRole('button', { name: 'Close profile', exact: true }), settingsButton = card.getByRole('button', { name: 'Settings', exact: true });
  await close.focus(); await page.keyboard.press('Shift+Tab'); await expect(settingsButton).toBeFocused();
  await page.keyboard.press('Tab'); await expect(close).toBeFocused();
  await page.screenshot({ path: evidence + '/desktop-open.png' });
  await settingsButton.click();
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(settings).toBeVisible(); await expect(card).toHaveCount(0);
  await settings.getByRole('button', { name: 'Close settings', exact: true }).click(); await expect(trigger).toBeFocused();
  await trigger.click(); await page.keyboard.press('Escape'); await expect(card).toHaveCount(0); await expect(trigger).toBeFocused();
  await trigger.click(); await page.getByTestId('identity-profile-backdrop').click({ position: { x: 4, y: 4 } }); await expect(card).toHaveCount(0); await expect(trigger).toBeFocused();
  await trigger.click(); await card.getByRole('button', { name: 'Close profile', exact: true }).click(); await expect(card).toHaveCount(0);
  expect(await page.locator('#root').evaluate(el => el.inert)).toBe(false);
  await page.getByRole('navigation', { name: 'Main navigation' }).filter({ visible: true }).getByRole('button', { name: 'Today', exact: true }).click();
  await trigger.click(); await page.goBack(); await expect(card).toHaveCount(0); await expect(page).toHaveURL(/\/home$/);
});

test('stacked mobile profile and reduced motion preserve readable actions without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/home');
  const trigger = page.locator('#kora-user-trigger'), card = page.getByTestId('identity-profile');
  await page.screenshot({ path: evidence + '/mobile-closed.png' }); await trigger.click();
  await expect.poll(() => card.evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  const bounds = await card.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(bounds!.y).toBeGreaterThanOrEqual(0); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(568);
  expect(await card.evaluate(el => getComputedStyle(el).transform)).toMatch(/none|matrix\(1, 0, 0, 1, 0, 0\)/);
  expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(card.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  expect(await card.getByRole('button', { name: 'Close profile', exact: true }).evaluate(el => {
    const box = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
  })).toBe(true);
  await card.getByRole('combobox', { name: 'Language', exact: true }).selectOption('vi');
  await expect(card.getByRole('button', { name: 'Cài đặt', exact: true })).toBeVisible();
  await card.getByRole('combobox', { name: 'Ngôn ngữ', exact: true }).selectOption('en');
  await page.screenshot({ path: evidence + '/mobile-open.png' });
  await card.getByRole('definition').last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: evidence + '/mobile-activity.png' });
  await page.keyboard.press('Escape'); await expect(card).toHaveCount(0); await expect(trigger).toBeFocused();
  expect(await page.locator('#root').evaluate(el => el.inert)).toBe(false);
});

test('modal reveal and exit have finite restrained motion and restore focus after removal', async ({ page }) => {
  await page.goto('/home');
  await page.evaluate(() => {
    const frames: { at: number; opacity: number; y: number; angle: number; scale: number }[] = [];
    let started: number | undefined;
    const sample = () => {
      const el = document.querySelector('[data-testid="identity-profile"]');
      if (el) {
        started ??= performance.now();
        const css = getComputedStyle(el), matrix = new DOMMatrix(css.transform);
        frames.push({ at: performance.now() - started, opacity: Number(css.opacity), y: matrix.f, angle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI, scale: Math.hypot(matrix.a, matrix.b) });
      }
      if (!started || performance.now() - started < 1800) requestAnimationFrame(sample);
    };
    (window as unknown as { profileFrames: typeof frames }).profileFrames = frames;
    requestAnimationFrame(sample);
  });
  const card = page.getByTestId('identity-profile'), trigger = page.locator('#kora-user-trigger');
  await trigger.click(); await expect.poll(() => card.evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  const still = await card.evaluate(el => ({ transform: getComputedStyle(el).transform, running: el.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length }));
  expect(still.running).toBe(0);
  await page.waitForTimeout(120); await page.keyboard.press('Escape'); await expect(card).toHaveCount(0); await expect(trigger).toBeFocused();
  const frames = await page.evaluate(() => (window as unknown as { profileFrames: { at: number; opacity: number; y: number; angle: number; scale: number }[] }).profileFrames);
  expect(frames.some(frame => frame.opacity > 0 && frame.opacity < 1)).toBe(true);
  expect(frames.some(frame => frame.y > 1)).toBe(true);
  expect(Math.max(...frames.map(frame => frame.y))).toBeLessThanOrEqual(13);
  expect(frames.every(frame => Math.abs(frame.angle) < 0.1)).toBe(true);
  expect(frames.every(frame => frame.scale >= 0.96 && frame.scale <= 1.001)).toBe(true);
  await test.info().attach('modal-motion-frames', { body: JSON.stringify({ frames, still }, null, 2), contentType: 'application/json' });
});

test('fast repeated avatar-position clicks leave no stranded modal or inert background', async ({ page }) => {
  await page.goto('/home');
  const trigger = page.locator('#kora-user-trigger'), box = await trigger.boundingBox(); expect(box).not.toBeNull();
  for (let i = 0; i < 6; i++) { await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2); await page.waitForTimeout(40); }
  // The modal makes the trigger inert; clicks during its exit are backdrop dismissals.
  if(await page.getByTestId('identity-profile').count())await page.keyboard.press('Escape');
  await expect(page.getByTestId('identity-profile')).toHaveCount(0);
  expect(await page.locator('#root').evaluate(el => el.inert)).toBe(false);
  await expect(trigger).toBeFocused();
  await trigger.click(); await expect(page.getByRole('dialog', { name: 'Your Kora identity' })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByTestId('identity-profile')).toHaveCount(0); await expect(trigger).toBeFocused();
});

test('profile and Settings preserve the mounted running Focus Dock and its progressing timer', async ({ page }) => {
  await page.goto('/workspaces/local-mock-workspace/boards/local-mock-board');
  await page.getByRole('button', { name: 'Start focus session: Redesign tables card', exact: true }).click();
  await page.getByRole('button', { name: 'Start without intention', exact: true }).click();
  const dock = page.getByRole('complementary', { name: 'Focus Dock', exact: true });
  await expect(dock.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  const originalDock = await dock.elementHandle();
  const seconds = async () => {
    const clock = (await dock.innerText()).match(/(\d+):(\d{2})/); expect(clock).not.toBeNull();
    return Number(clock![1]) * 60 + Number(clock![2]);
  };
  const before = await seconds(); await page.locator('#kora-user-trigger').click();
  await page.getByTestId('identity-profile').getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true }); await expect(settings).toBeVisible();
  await settings.getByRole('button', { name: 'Close settings', exact: true }).click();
  expect(await originalDock!.evaluate(el => el.isConnected)).toBe(true);
  await expect(dock.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect.poll(seconds).toBeLessThan(before);
  await dock.getByRole('button', { name: 'Pause', exact: true }).click();
});
