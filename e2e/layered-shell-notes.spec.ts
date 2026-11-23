import { expect, test } from '@playwright/test';
const evidence = 'scratch/integration-261027-0739';
async function rows(page: import('@playwright/test').Page) {
  return page.evaluate(() => { const key = Object.keys(localStorage).find(key => key.endsWith(':notes-preview:v1')); return key ? JSON.parse(localStorage.getItem(key)!) : []; });
}
test('layered shell retains routes, context filters, collapsed state and running Focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/today');
  const nav = page.getByRole('navigation', { name: 'Main navigation' }).filter({ visible: true });
  expect((await nav.boundingBox())!.width).toBe(56);
  const context = page.getByRole('complementary', { name: 'Context' });
  expect((await context.boundingBox())!.width).toBe(240);
  await page.screenshot({ path: `${evidence}/shell-today-desktop.png` });
  await context.getByRole('button', { name: 'Collapse context sidebar' }).click();
  await expect.poll(async () => (await context.boundingBox())!.width).toBe(40);
  await context.getByRole('button', { name: 'Expand context sidebar' }).click();
  await nav.getByRole('button', { name: 'Board', exact: true }).click();
  await expect(context.getByRole('heading', { name: 'Board' })).toBeVisible();
  await context.getByRole('button', { name: 'High priority', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Filters active' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Change priority:/ })).toHaveText(['High']);
  await context.getByRole('button', { name: 'Clear filters' }).click();
  await page.screenshot({ path: `${evidence}/shell-board-desktop.png` });
  await nav.getByRole('button', { name: 'Focus', exact: true }).click();
  await expect.poll(async () => (await context.boundingBox())!.width).toBe(40);
  const dock = page.getByRole('region', { name: 'Floating Focus' });
  const marker = await dock.evaluate(el => { el.setAttribute('data-continuity-probe', 'mounted'); return true; }); expect(marker).toBe(true);
  await nav.getByRole('button', { name: 'Notes', exact: true }).click();
  await nav.getByRole('button', { name: 'Focus', exact: true }).click();
  await expect(dock).toHaveAttribute('data-continuity-probe', 'mounted');
});

test('notes manager: autosave in the sheet, card checklist, pin, labels, archive, conversion and reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/notes'); await page.getByRole('button', { name: 'New note', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Edit note' });
  await sheet.getByRole('textbox', { name: 'Note title' }).fill('Integration note');
  await sheet.getByRole('button', { name: 'Bold', exact: true }).click();
  await sheet.getByRole('textbox', { name: 'Note content' }).fill('Persist this thought');
  await sheet.getByRole('textbox', { name: 'Checklist item' }).fill('Review integration'); await sheet.getByRole('button', { name: 'Add', exact: true }).click();
  await sheet.getByRole('combobox', { name: 'Add label' }).fill('Work/Integration'); await page.keyboard.press('Enter');
  await sheet.getByRole('button', { name: 'Pin', exact: true }).click();
  await expect.poll(async () => (await rows(page))[0]?.labels).toEqual(['Work/Integration']);
  await page.keyboard.press('Escape'); await expect(sheet).toHaveCount(0);
  const card = page.getByRole('article', { name: 'Integration note' });
  await expect(page.getByRole('region', { name: 'Pinned' })).toContainText('Integration note');
  await card.getByRole('checkbox', { name: 'Review integration' }).check();
  await expect(sheet).toHaveCount(0);
  await expect.poll(async () => (await rows(page))[0]).toMatchObject({ pinned: true, checklist: [{ text: 'Review integration', isDone: true }] });
  await page.getByRole('button', { name: 'Show notes labelled Work', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.keyboard.press('/'); await page.keyboard.type('nothing matches');
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Search notes' }).fill('');
  await card.getByRole('button', { name: 'Open note: Integration note' }).click();
  await sheet.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Convert to task' }).click();
  await expect.poll(async () => (await rows(page))[0]?.taskId).toBeTruthy();
  await expect(sheet.getByRole('button', { name: /^Linked to / })).toBeVisible();
  await sheet.getByRole('button', { name: 'Archive', exact: true }).click(); await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect.poll(async () => (await rows(page))[0]?.archivedAt).toBeTruthy();
  await page.getByRole('navigation', { name: 'Labels' }).getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Integration note' })).toBeVisible();
  await page.reload(); await expect(page.getByRole('article', { name: 'Integration note' })).toBeVisible();
  await page.getByRole('button', { name: 'Open note: Integration note' }).click();
  await expect(sheet.getByRole('textbox', { name: 'Note title' })).toHaveValue('Integration note');
  await expect(sheet.getByRole('checkbox', { name: 'Review integration' })).toBeChecked();
  await sheet.getByRole('button', { name: 'Unarchive' }).click();
  await page.screenshot({ path: `${evidence}/notes-desktop.png` });
  await page.goto('/notes'); await page.getByRole('button', { name: 'Open note: Integration note' }).click();
  await sheet.getByRole('button', { name: /^Linked to / }).click(); await expect(page.getByRole('dialog', { name: 'Edit task' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Edit task' }).getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Integration note');
});

test('notes manager keyboard: C creates and opens a note, Escape closes, multi-select pins and trashes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/notes'); await page.getByRole('button', { name: 'New note', exact: true }).waitFor();
  for (const title of ['First', 'Second', 'Third']) {
    await page.keyboard.press('c');
    const sheet = page.getByRole('dialog', { name: 'Edit note' });
    await sheet.getByRole('textbox', { name: 'Note title' }).fill(title);
    await page.keyboard.press('Escape'); await expect(sheet).toHaveCount(0);
  }
  await expect.poll(async () => (await rows(page)).length).toBe(3);
  await page.getByRole('checkbox', { name: 'Select Third' }).click();
  await page.getByRole('checkbox', { name: 'Select First' }).click({ modifiers: ['Shift'] });
  const toolbar = page.getByRole('toolbar', { name: '3 selected' });
  await toolbar.getByRole('button', { name: 'Pin', exact: true }).click();
  await expect.poll(async () => (await rows(page)).every((row: { pinned: boolean }) => row.pinned)).toBe(true);
  await toolbar.getByRole('button', { name: 'Move to Trash' }).click();
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Labels' }).getByRole('button', { name: 'Trash', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(3);
  await page.getByRole('article', { name: 'Second' }).getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByRole('article')).toHaveCount(2);
});

test('notes editing helpers: [ ] starts a checklist, Enter continues and ends it, Tab indents, and the card ticks through autosave', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/notes'); await page.getByRole('button', { name: 'New note', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Edit note' });
  await sheet.getByRole('textbox', { name: 'Note title' }).fill('Shopping');
  const body = sheet.getByRole('textbox', { name: 'Note content' }); await body.click();
  await page.keyboard.type('- [ ] milk'); await page.keyboard.press('Enter');
  await page.keyboard.type('oat'); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  await page.keyboard.press('Enter'); await page.keyboard.press('Shift+Tab'); await page.keyboard.type('eggs');
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.keyboard.type('Thanks');
  await expect(body).toBeFocused();
  await expect(body.getByRole('checkbox')).toHaveCount(3);
  await expect(body.locator('li[data-checked] li[data-checked] > div')).toHaveText('oat');
  await expect(body.getByRole('checkbox', { name: 'milk', exact: true })).toBeVisible();
  await expect(sheet.getByText('Saved', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(sheet).toHaveCount(0);
  const card = page.getByRole('article', { name: 'Shopping' });
  await expect(card.getByText('Thanks')).toBeVisible();
  await card.getByRole('checkbox', { name: 'eggs' }).check();
  await expect(sheet).toHaveCount(0);
  await expect.poll(async () => (await rows(page))[0].html).toMatch(/data-checked="true"[^]*eggs/);
  await page.reload();
  await expect(page.getByRole('article', { name: 'Shopping' }).getByRole('checkbox', { name: 'eggs' })).toBeChecked();
  await expect(page.getByRole('article', { name: 'Shopping' }).getByRole('checkbox', { name: 'milk' })).not.toBeChecked();
  // The editor reads the tick back, and the toolbar turns plain lines into a checklist.
  await (await openNote(page, 0)).waitFor();
  await expect(sheet.locator('li[data-checked="true"] > div')).toHaveText('eggs');
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true);
  await expect(body).toHaveAttribute('contenteditable', 'true'); await page.waitForTimeout(150);
  // Rarely under heavy parallel load the caret lands at the start right after the click (cause not found; see phase report), so confirm it first.
  await expect(async () => {
    await body.getByText('Thanks', { exact: true }).click(); await page.keyboard.press('End');
    expect(await page.evaluate(() => getSelection()?.anchorNode?.textContent)).toBe('Thanks');
  }).toPass({ timeout: 5000 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('bread'); await expect(body.getByText('bread', { exact: true })).toBeVisible();
  await sheet.getByRole('button', { name: 'Checklist', exact: true }).click();
  await expect(body.locator('li[data-checked] > div', { hasText: 'bread' })).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('article', { name: 'Shopping' }).getByRole('checkbox', { name: 'bread' })).toBeVisible();
});

test('shell and notes fit tablet/mobile and shared preview never exposes private notes', async ({ page }) => {
  for (const width of [820, 320]) {
    await page.setViewportSize({ width, height: 800 }); await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/notes'); await page.getByRole('button', { name: 'New note', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Edit note' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${evidence}/shell-notes-${width}.png` });
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.goto('/notes?filter=shared'); await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByText(/Shared notes are not available in this device-only preview/)).toBeVisible();
});

async function createAndClose(page: import('@playwright/test').Page, title = `Note ${Math.random().toString(36).slice(2, 7)}`) {
  await page.getByRole('button', { name: 'New note', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Edit note' }); await expect(sheet).toBeVisible();
  // An empty note is discarded when its sheet closes, so give it a title.
  await sheet.getByRole('textbox', { name: 'Note title' }).fill(title);
  await page.keyboard.press('Escape'); await expect(sheet).toHaveCount(0);
}
async function openNote(page: import('@playwright/test').Page, index: number) {
  await page.getByRole('button', { name: /^Open note:/ }).nth(index).click();
  return page.getByRole('dialog', { name: 'Edit note' }).getByRole('textbox', { name: 'Note title' });
}

test('different notes edited simultaneously in two real tabs retain both changes', async ({ page, context }) => {
  await page.goto('/notes');
  await createAndClose(page); await createAndClose(page);
  await expect.poll(async () => (await rows(page)).length).toBe(2);
  const [first, second] = (await rows(page)).map((row: { id: string }) => row.id);
  const other = await context.newPage();
  try {
    await other.goto('/notes');
    const titleIn = async (target: import('@playwright/test').Page, id: string) => { await target.locator(`[data-note-card="${id}"]`).getByRole('button', { name: /^Open note:/ }).click(); return target.getByRole('dialog', { name: 'Edit note' }).getByRole('textbox', { name: 'Note title' }); };
    const [a, b] = await Promise.all([titleIn(page, first), titleIn(other, second)]);
    await Promise.all([a.fill('From first tab'), b.fill('From second tab')]);
    await expect.poll(async () => (await rows(page)).map((row: { title: string }) => row.title)).toEqual(['From first tab', 'From second tab']);
    await page.reload();
    await expect(page.getByRole('article', { name: 'From first tab' })).toBeVisible();
    await expect(page.getByRole('article', { name: 'From second tab' })).toBeVisible();
  } finally { await other.close(); }
});

test('same-note interleaving rejects edits that depend on a conflicted predecessor', async ({ page, context }) => {
  await page.goto('/notes'); await createAndClose(page);
  await expect.poll(async () => (await rows(page)).length).toBe(1);
  const other = await context.newPage();
  try {
    await other.goto('/notes');
    const mine = await openNote(page, 0), theirs = await openNote(other, 0);
    await page.evaluate(() => new Promise<void>(ready => {
      const key = Object.keys(localStorage).find(key => key.endsWith(':notes-preview:v1'))!;
      void navigator.locks.request(`kora:notes:${key}`, () => new Promise<void>(release => {
        (window as unknown as { releaseNotesLock: () => void }).releaseNotesLock = release; ready();
      }));
    }));
    await theirs.fill('External winner');
    await mine.fill('Uncommitted predecessor');
    await mine.fill('Dependent edit');
    await page.evaluate(() => (window as unknown as { releaseNotesLock: () => void }).releaseNotesLock());
    await expect(page.getByRole('dialog', { name: 'Edit note' }).getByRole('alert')).toContainText('An earlier local save failed');
    await expect.poll(async () => (await rows(page))[0].title).toBe('External winner');
    await expect(mine).toHaveValue('Dependent edit');
    await page.reload();
    await expect(page.getByRole('article', { name: 'External winner' })).toBeVisible();
    const retained=page.locator('details').filter({hasText:'Unsaved device drafts'});await retained.locator('summary').click();
    await expect(retained).toContainText('Dependent edit');
    const download=page.waitForEvent('download');await retained.getByRole('button',{name:'Export draft',exact:true}).click();
    const stream=await(await download).createReadStream();if(!stream)throw Error('Retained draft download is unavailable.');
    const chunks:Buffer[]=[];for await(const chunk of stream)chunks.push(Buffer.from(chunk));expect(JSON.parse(Buffer.concat(chunks).toString('utf8')).title).toBe('Dependent edit');
  } finally {
    await page.evaluate(() => (window as unknown as { releaseNotesLock?: () => void }).releaseNotesLock?.());
    await other.close();
  }
});

test('Quick Notes: a non-modal sticky card autosaves, never blocks the page, discards empty notes and expands into Notes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/today');
  await page.getByRole('banner').getByRole('button', { name: 'Quick note', exact: true }).first().click();
  const card = page.getByRole('dialog', { name: 'Quick note' });
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('aria-modal', 'false');
  await expect(card.getByRole('button', { name: 'Save' })).toHaveCount(0);
  await expect(card.getByRole('textbox', { name: 'Note content' })).toBeFocused();
  // Closing it untouched leaves nothing behind (only a trashed copy).
  await page.keyboard.press('Escape'); await expect(card).toHaveCount(0);
  await expect.poll(async () => (await rows(page)).filter((row: { deletedAt?: string | null }) => !row.deletedAt).length).toBe(0);
  await page.keyboard.press('Control+Alt+n');
  await expect(card).toBeVisible();
  await expect(card.getByRole('textbox', { name: 'Note content' })).toBeFocused();
  await expect(card.locator('[data-placeholder]')).toHaveAttribute('data-placeholder', 'Type anything to remember');
  await expect(card.locator('[data-note-source]')).toHaveText('Kora');
  await expect(card.getByRole('textbox', { name: 'Note title' })).toHaveCount(0);
  await page.keyboard.type('Call the printer about the invoice');
  await expect(card.locator('[data-save-state]')).toHaveText('Saved');
  await expect.poll(async () => (await rows(page)).find((row: { deletedAt?: string | null }) => !row.deletedAt)?.html).toContain('Call the printer');
  expect((await rows(page)).find((row: { deletedAt?: string | null }) => !row.deletedAt)?.title).toBe('Call the printer about the invoice');
  // The page behind stays usable while the card is open.
  await page.getByRole('navigation', { name: 'Main navigation' }).filter({ visible: true }).getByRole('button', { name: 'Notes', exact: true }).click();
  await expect(page).toHaveURL(/\/notes/); await expect(card).toBeVisible();
  const box = (await card.boundingBox())!;
  const grip = card.getByRole('button', { name: 'Move quick note' }); await grip.focus(); await grip.press('ArrowLeft');
  expect((await card.boundingBox())!.x).toBeLessThan(box.x);
  await card.getByRole('button', { name: 'Open in Notes' }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Edit note' }).getByRole('textbox', { name: 'Note content' })).toContainText('Call the printer');
  await page.screenshot({ path: `${evidence}/quick-note-expanded.png` });
});
