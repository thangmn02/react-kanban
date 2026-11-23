import { expect, test } from '@playwright/test';

async function addNote(page: import('@playwright/test').Page, title: string, body: string, label?: string) {
  await page.keyboard.press('c');
  const sheet = page.getByRole('dialog', { name: 'Edit note' });
  await sheet.getByRole('textbox', { name: 'Note title' }).fill(title);
  await sheet.getByRole('textbox', { name: 'Note content' }).click(); await page.keyboard.type(body);
  if (label) { await sheet.getByRole('combobox', { name: 'Add label' }).fill(label); await page.keyboard.press('Enter'); }
  await expect(sheet.getByText('Saved', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(sheet).toHaveCount(0);
}

test('phone notes: read-only list, search, labels, reader, and installable only on /phone', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/notes'); await page.getByRole('button', { name: 'New note', exact: true }).waitFor();
  await expect(page.locator('link[rel=manifest]')).toHaveCount(0);
  await addNote(page, 'Groceries', '- [ ] milk\n[x] eggs', 'Home');
  await addNote(page, 'Standup', 'Ship the phone page', 'Work');

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/phone');
  await expect(page.getByRole('heading', { name: 'Kora Notes', level: 1 })).toBeVisible();
  await expect(page.locator('link[rel=manifest]')).toHaveAttribute('href', '/kora-notes.webmanifest');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  const groceries = page.getByRole('button', { name: 'Open note: Groceries' });
  await expect(groceries).toContainText('☐ milk');
  await expect(groceries).toContainText('☑ eggs');
  await expect(page.getByRole('button', { name: /^Open note:/ })).toHaveCount(2);

  await page.getByRole('searchbox', { name: 'Search notes' }).fill('phone page');
  await expect(page.getByRole('button', { name: /^Open note:/ })).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Search notes' }).fill('');
  await page.getByRole('navigation', { name: 'Labels' }).getByRole('button', { name: 'Home' }).click();
  await expect(page.getByRole('button', { name: /^Open note:/ })).toHaveText([/Groceries/]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await groceries.click();
  const reader = page.getByRole('article', { name: 'Groceries' });
  await expect(reader.getByRole('textbox', { name: 'Note content' })).toHaveAttribute('contenteditable', 'false');
  await expect(reader.getByRole('checkbox', { name: 'eggs' })).toBeChecked();
  await expect(reader.getByRole('button', { name: 'Notes' })).toBeFocused();
  await reader.getByRole('button', { name: 'Notes' }).click();
  await expect(page.getByRole('button', { name: 'Open note: Groceries' })).toBeVisible();
  // The phone's Back button closes the reader too, and a shared link opens the note directly.
  await groceries.click(); await expect(reader).toBeVisible(); await page.goBack();
  await expect(page.getByRole('button', { name: 'Open note: Groceries' })).toBeVisible();
  await expect(page).toHaveURL(/\/phone$/);
  // Leaving /phone removes the install metadata again.
  await page.goto('/notes'); await expect(page.locator('link[rel=manifest]')).toHaveCount(0);
});

test('phone notes: iPhone visitors see the Add to Home Screen tip, and it can be hidden', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    await page.goto('/phone');
    const tip = page.getByRole('complementary', { name: 'Install Kora Notes' });
    await expect(tip).toContainText('tap Share, then Add to Home Screen');
    await tip.getByRole('button', { name: 'Hide install tip' }).click();
    await expect(tip).toHaveCount(0);
    await page.reload(); await expect(page.getByRole('heading', { name: 'Kora Notes', level: 1 })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Install Kora Notes' })).toHaveCount(0);
  } finally { await context.close(); }
});
