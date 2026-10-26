import { expect, test, type Page } from '@playwright/test';

const boardPath = '/workspaces/local-mock-workspace/boards/local-mock-board';
const nav = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' }).filter({ visible: true });
async function command(page: Page, query: string) {
  await page.getByRole('button', { name: 'Search or command...' }).click();
  await page.getByRole('combobox', { name: 'Search commands' }).fill(query);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeHidden();
}

test('Today task context survives close, deep link, save and completion', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/today');
  await page.getByRole('button', { name: 'Redesign tables card', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Edit task' });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/today\?task=task1&taskBoard=local-mock-board/);
  const taskUrl = page.url();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL('/today');
  await page.goto(taskUrl);
  await expect(dialog.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Redesign tables card');
  await dialog.getByRole('textbox', { name: 'Title', exact: true }).fill('UX persisted task');
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL('/today');
  await page.getByRole('button', { name: 'Mark done: UX persisted task', exact: true }).first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Completed: UX persisted task' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mark done: UX persisted task', exact: true })).toHaveCount(0);
  await nav(page).getByRole('button', { name: 'Board', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open task: UX persisted task', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Calendar month, Table sort and filters survive view switches with keyboard task access', async ({ page }) => {
  await page.goto(boardPath);
  await command(page, 'Go to Calendar');
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  const month = await page.locator('main h2').first().innerText();
  await command(page, 'Go to Table');
  await page.getByRole('button', { name: 'Title', exact: true }).click();
  const direction = await page.locator('th').first().getAttribute('aria-sort');
  await command(page, 'Go to Calendar');
  await expect(page.locator('main h2').first()).toHaveText(month);
  await command(page, 'Go to Table');
  await expect(page.locator('th').first()).toHaveAttribute('aria-sort', direction!);
  const task = page.getByRole('button', { name: 'Redesign tables card', exact: true });
  await task.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Edit task' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Edit task' })).toBeHidden();
  await expect(task).toBeFocused();
  await command(page, 'Show high priority tasks');
  await command(page, 'Go to Table');
  await expect(page.getByRole('button', { name: 'Create Javascript elements', exact: true })).toHaveCount(0);
});

test('Home first action and Today start use the existing intention and running controller', async ({ page }) => {
  await page.goto('/home');
  await page.getByRole('region', { name: 'Start here' }).getByRole('button', { name: /^Start focus:/ }).click();
  await expect(page.getByRole('dialog', { name: 'Start with intention' })).toBeVisible();
  await page.getByRole('button', { name: 'Start without intention' }).click();
  await nav(page).getByRole('button', { name: 'Today', exact: true }).click();
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  await expect(pause).toBeVisible();
  await nav(page).getByRole('button', { name: 'Focus', exact: true }).click();
  const dock = page.getByRole('main', { name: 'Floating Focus' });
  await expect(dock.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  const tasks = dock.getByRole('tab', { name: 'Tasks', exact: true });
  await tasks.focus(); await page.keyboard.press('ArrowRight');
  await expect(dock.getByRole('tab', { name: 'Music', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(dock.getByRole('tab', { name: 'Beat grid', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(dock.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await command(page, 'Open focus history');
  await expect(page.getByRole('dialog', { name: 'Edit task' })).toBeVisible();
  await expect(page).toHaveURL(/\/focus\?tab=beat&task=task1&taskBoard=local-mock-board/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Edit task' })).toBeHidden();
  await expect(page).toHaveURL('/focus?tab=beat');
  await page.reload();
  await expect(page.getByRole('main', { name: 'Floating Focus' }).getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
});

test('narrow layout, reduced motion and palette keyboard stay usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/home');
  await expect(page.getByRole('region', { name: 'Start here' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const trigger = page.getByRole('button', { name: 'Search or command...' });
  await trigger.click();
  const input = page.getByRole('combobox', { name: 'Search commands' });
  await expect(input).toBeFocused();
  await input.fill('Go to '); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/today');
  await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: 'Redesign tables card', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Edit task' });
  await expect(dialog).toBeVisible();
  for (let index = 0; index < 45; index++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
});

test('saved context opens in one action and returns to the unchanged task drawer', async ({ page }) => {
  await page.goto(boardPath);
  await page.getByRole('button', { name: 'Open task: Redesign tables card', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit task' });
  await dialog.getByPlaceholder('Attachment name').fill('Project reference');
  await dialog.getByPlaceholder('https://...').fill('https://example.com/reference');
  await dialog.getByRole('button', { name: 'Add attachment', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Start focus session', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(dialog).toBeHidden();
  await nav(page).getByRole('button', { name: 'Today', exact: true }).click();
  await page.getByRole('button', { name: 'Redesign tables card', exact: true }).first().click();
  const [popup] = await Promise.all([page.waitForEvent('popup'), dialog.getByRole('link', { name: 'Project reference' }).click()]);
  try { expect(popup.url()).toContain('example.com/reference'); }
  finally { await popup.close(); }
  await expect(dialog.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Redesign tables card');
  await page.keyboard.press('Escape'); await expect(page).toHaveURL('/today');
});

test('keyboard task movement settles and persists without opening the editor', async ({ page }) => {
  await page.goto(boardPath);
  const task = page.locator('[data-task-id="task1"]');
  const original = await task.locator('xpath=ancestor::*[@data-list-id]').getAttribute('data-list-id');
  const handle = task.getByRole('button', { name: 'Move task: Redesign tables card', exact: true });
  await handle.focus(); await page.keyboard.press('Space', { delay: 40 });
  await expect(page.locator('[id^="DndLiveRegion"]')).toContainText(/task1.*(picked up|moved over)/);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[id^="DndLiveRegion"]')).toContainText('moved over droppable area task-list-list2');
  await page.keyboard.press('Space');
  await expect.poll(() => task.locator('xpath=ancestor::*[@data-list-id]').getAttribute('data-list-id')).not.toBe(original);
  const moved = await task.locator('xpath=ancestor::*[@data-list-id]').getAttribute('data-list-id');
  await page.reload();
  await expect(task.locator('xpath=ancestor::*[@data-list-id]')).toHaveAttribute('data-list-id', moved!);
  await expect(page.getByRole('dialog', { name: 'Edit task' })).toBeHidden();
});

test('pointer drag changes columns and retains the result after reload', async ({ page }) => {
  await page.goto(boardPath);
  const task = page.locator('[data-task-id="task1"]');
  const source = await task.getByRole('button', { name: 'Move task: Redesign tables card', exact: true }).boundingBox();
  const targetTask = page.locator('[data-list-id="list2"] [data-task-id]').first();
  const targetId = await targetTask.getAttribute('data-task-id');
  const target = await targetTask.boundingBox();
  expect(source).not.toBeNull(); expect(target).not.toBeNull();
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
  await page.mouse.down();
  await page.mouse.move(source!.x + 20, source!.y, { steps: 4 });
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, { steps: 20 });
  await expect(page.locator('[id^="DndLiveRegion"]')).toContainText(new RegExp(`moved over droppable area (${targetId}|task-list-list2)`));
  await page.mouse.up();
  await expect(task.locator('xpath=ancestor::*[@data-list-id]')).toHaveAttribute('data-list-id', 'list2');
  await page.reload();
  await expect(task.locator('xpath=ancestor::*[@data-list-id]')).toHaveAttribute('data-list-id', 'list2');
});

test('returning Home restores its scroll position after visiting Today', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 450 });
  await page.goto('/home');
  await expect(page.getByRole('region', { name: 'Start here' })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 320));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(250);
  const previous = await page.evaluate(() => window.scrollY);
  await nav(page).getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Day', exact: true })).toBeVisible();
  await nav(page).getByRole('button', { name: 'Home', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(previous - 15);
});

test('an unavailable task link returns to its original view with feedback', async ({ page }) => {
  await page.goto('/today?task=missing-task&taskBoard=local-mock-board');
  await expect(page).toHaveURL('/today');
  await expect(page.getByRole('heading', { name: 'My Day', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Edit task' })).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: /no longer available/i })).toBeVisible();
});
