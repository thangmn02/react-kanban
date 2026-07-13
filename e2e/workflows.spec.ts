import { expect, test, type Page } from '@playwright/test';

const boardPath = '/workspaces/local-mock-workspace/boards/local-mock-board';

function collectPageErrors(page: Page) {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  return errors;
}

async function openBoard(page: Page) {
  await page.goto(boardPath);
  await expect(page.getByRole('button', { name: 'Add task' }).first()).toBeVisible();
}

test('task CRUD persists after reload and the task drawer opens and closes', async ({ page }) => {
  const errors = collectPageErrors(page);
  const suffix = Date.now().toString(36);
  const originalTitle = `E2E task ${suffix}`;
  const updatedTitle = `${originalTitle} updated`;

  await openBoard(page);
  await page.getByRole('button', { name: 'Add task' }).first().click();
  await expect(page.getByRole('heading', { name: 'Add a richer task' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Refine the task title' }).fill(originalTitle);
  await page.getByRole('button', { name: 'Add new task', exact: true }).click();
  await expect(page.getByRole('button', { name: `Open task: ${originalTitle}`, exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: `Open task: ${originalTitle}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit task in context' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Refine the task title' })).toHaveValue(originalTitle);
  await page.getByRole('textbox', { name: 'Refine the task title' }).fill(updatedTitle);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('button', { name: `Open task: ${updatedTitle}`, exact: true })).toBeVisible();

  await page.getByRole('button', { name: `Open task: ${updatedTitle}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit task in context' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Refine the task title' })).toHaveValue(updatedTitle);
  for (const dismissButton of await page.getByRole('button', { name: 'Dismiss notification' }).all()) {
    await dismissButton.click({ force: true });
  }
  await page.getByRole('button', { name: 'Close task drawer' }).click();
  await expect(page.getByRole('heading', { name: 'Edit task in context' })).toBeHidden();

  await page.getByRole('button', { name: `Open task: ${updatedTitle}`, exact: true }).hover();
  await page.getByRole('button', { name: `Delete task: ${updatedTitle}`, exact: true }).click();
  await page.getByRole('button', { name: "Yes, I'm sure" }).click();
  await expect(page.getByRole('button', { name: `Open task: ${updatedTitle}`, exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: `Open task: ${updatedTitle}`, exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('focus and Pomodoro state survives reload', async ({ page }) => {
  const errors = collectPageErrors(page);

  await openBoard(page);
  await page.getByRole('button', { name: 'Start focus session: Redesign tables card', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Start with intention' })).toBeVisible();
  await page.getByRole('button', { name: 'Start without intention' }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();

  await page.reload();
  const expandDock = page.getByRole('button', { name: 'Expand Focus Dock' });
  if (await expandDock.isVisible()) await expandDock.click();
  await expect(page.getByRole('combobox', { name: 'Choose active focus timer task' })).toContainText(
    'Redesign tables card',
  );
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('route navigation participates in browser history', async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto('/home');
  await page.getByRole('button', { name: 'Open board: HVAC Editor' }).click();
  await expect(page).toHaveURL(boardPath);
  await page.getByRole('button', { name: 'Board options' }).click();
  await page.getByRole('button', { name: 'Table', exact: true }).click();
  await expect(page).toHaveURL(`${boardPath}/table`);
  await expect(page.getByRole('table')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(boardPath);
  await expect(page.getByRole('button', { name: 'Add task' }).first()).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(`${boardPath}/table`);
  expect(errors).toEqual([]);
});

test('unknown and auth routes settle without redirect loops', async ({ page }) => {
  const errors = collectPageErrors(page);
  const navigations: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });

  await page.goto('/definitely-not-a-route');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page).toHaveURL('/definitely-not-a-route');
  expect(navigations.length).toBeLessThanOrEqual(3);

  navigations.length = 0;
  await page.goto('/auth/sign-in');
  await expect(page).toHaveURL('/home');
  await expect(page.locator('#root')).not.toBeEmpty();
  expect(navigations.length).toBeLessThanOrEqual(3);
  expect(errors).toEqual([]);
});
