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
  const dock = page.getByRole('main', { name: 'Floating Focus' });
  const marker = await dock.evaluate(el => { el.setAttribute('data-continuity-probe', 'mounted'); return true; }); expect(marker).toBe(true);
  await nav.getByRole('button', { name: 'Notes', exact: true }).click();
  await nav.getByRole('button', { name: 'Focus', exact: true }).click();
  await expect(dock).toHaveAttribute('data-continuity-probe', 'mounted');
});

test('notes autosave rich text/checklist, pin, move, resize, Peek, link, conversion and reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/notes'); await page.getByRole('button', { name: 'New note', exact: true }).click();
  const note = page.getByRole('article').first();
  await note.getByRole('textbox', { name: 'Note title' }).fill('Integration note');
  await note.getByRole('button', { name: 'Edit / expand' }).click();
  await note.getByRole('button', { name: 'Bold', exact: true }).click();
  await note.getByRole('textbox', { name: 'Note content' }).fill('Persist this thought');
  await note.getByRole('textbox', { name: 'Checklist item' }).fill('Review integration'); await note.getByRole('button', { name: 'Add', exact: true }).click();
  await note.getByRole('checkbox', { name: 'Review integration' }).check();
  await note.getByRole('button', { name: 'Pin note' }).click();
  const grip = note.getByRole('button', { name: 'Move note: Integration note' }); await grip.focus(); await grip.press('ArrowRight');
  const resize = note.getByRole('button', { name: 'Resize note' }); await resize.focus(); await resize.press('ArrowDown');
  await expect.poll(async () => (await rows(page))[0]?.height).toBe(380);
  expect((await rows(page))[0]).toMatchObject({ pinned: true, x: 10, checklist: [{ text: 'Review integration', isDone: true }] });
  await note.getByRole('button', { name: 'Peek', exact: true }).click();
  const restore = page.getByRole('button', { name: 'Restore note: Integration note' }); await expect(restore).toBeVisible();
  expect(await note.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(false);
  await restore.click(); await expect(note).not.toHaveAttribute('inert');
  await note.getByRole('button', { name: 'Minimize note' }).click(); await expect(note.getByRole('textbox', { name: 'Note title' })).toHaveCount(0);
  await note.getByRole('button', { name: 'Minimize note' }).click();
  await note.getByRole('button', { name: 'Convert note to task' }).click(); await expect(note.getByRole('button', { name: 'Converted to task' })).toBeDisabled();
  const saved = (await rows(page))[0]; expect(saved.taskId).toBeTruthy();
  await page.reload(); await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('Integration note');
  await expect(page.getByRole('checkbox', { name: 'Review integration' })).toBeChecked();
  await page.screenshot({ path: `${evidence}/notes-desktop.png` });
  await page.getByRole('button', { name: 'Open linked task' }).click(); await expect(page.getByRole('dialog', { name: 'Edit task' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Edit task' }).getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Integration note');
});

test('shell and notes fit tablet/mobile and shared preview never exposes private notes', async ({ page }) => {
  for (const width of [820, 320]) {
    await page.setViewportSize({ width, height: 800 }); await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/notes'); await page.getByRole('button', { name: 'New note', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${evidence}/shell-notes-${width}.png` });
  }
  await page.goto('/notes?filter=shared'); await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByText(/Shared notes are not available in this device-only preview/)).toBeVisible();
});

test('different notes edited simultaneously in two real tabs retain both changes', async ({ page, context }) => {
  await page.goto('/notes');
  await page.getByRole('button', { name: 'New note', exact: true }).click();
  await page.getByRole('button', { name: 'New note', exact: true }).click();
  await expect.poll(async () => (await rows(page)).length).toBe(2);
  const other = await context.newPage();
  try {
    await other.goto('/notes');
    await Promise.all([
      page.getByRole('textbox', { name: 'Note title' }).nth(0).fill('From first tab'),
      other.getByRole('textbox', { name: 'Note title' }).nth(1).fill('From second tab'),
    ]);
    await expect.poll(async () => (await rows(page)).map((row: { title: string }) => row.title)).toEqual(['From first tab', 'From second tab']);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Note title' }).nth(0)).toHaveValue('From first tab');
    await expect(page.getByRole('textbox', { name: 'Note title' }).nth(1)).toHaveValue('From second tab');
  } finally { await other.close(); }
});

test('shaking a real note grip enables Peek and keyboard restore remains available', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/notes'); await page.getByRole('button', { name: 'New note', exact: true }).click();
  const grip = page.getByRole('button', { name: 'Move note: Untitled note' });
  const rect = await grip.boundingBox(); const x = rect!.x + rect!.width / 2, y = rect!.y + rect!.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  for (const offset of [30, -30, 30, -30, 30, -30]) await page.mouse.move(x + offset, y);
  await page.mouse.up();
  const restore = page.getByRole('button', { name: 'Restore note: Untitled note' });
  await expect(restore).toBeVisible(); await restore.focus(); await page.keyboard.press('Enter');
  await expect(restore).toHaveCount(0); await expect(page.getByRole('article')).not.toHaveAttribute('inert');
});

test('same-note interleaving rejects edits that depend on a conflicted predecessor', async ({ page, context }) => {
  await page.goto('/notes'); await page.getByRole('button', { name: 'New note', exact: true }).click();
  await expect.poll(async () => (await rows(page)).length).toBe(1);
  const other = await context.newPage();
  try {
    await other.goto('/notes');
    await page.evaluate(() => new Promise<void>(ready => {
      const key = Object.keys(localStorage).find(key => key.endsWith(':notes-preview:v1'))!;
      void navigator.locks.request(`kora:notes:${key}`, () => new Promise<void>(release => {
        (window as unknown as { releaseNotesLock: () => void }).releaseNotesLock = release; ready();
      }));
    }));
    await other.getByRole('textbox', { name: 'Note title' }).fill('External winner');
    await page.getByRole('textbox', { name: 'Note title' }).fill('Uncommitted predecessor');
    await page.getByRole('textbox', { name: 'Note title' }).fill('Dependent edit');
    await page.evaluate(() => (window as unknown as { releaseNotesLock: () => void }).releaseNotesLock());
    await expect(page.getByRole('alert')).toContainText('An earlier local save failed');
    await expect.poll(async () => (await rows(page))[0].title).toBe('External winner');
    await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('Dependent edit');
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('External winner');
    const retained=page.locator('details').filter({hasText:'Retained device drafts'});await retained.locator('summary').click();
    await expect(retained).toContainText('Dependent edit');
    const download=page.waitForEvent('download');await retained.getByRole('button',{name:'Export draft',exact:true}).click();
    const stream=await(await download).createReadStream();if(!stream)throw Error('Retained draft download is unavailable.');
    const chunks:Buffer[]=[];for await(const chunk of stream)chunks.push(Buffer.from(chunk));expect(JSON.parse(Buffer.concat(chunks).toString('utf8')).title).toBe('Dependent edit');
  } finally {
    await page.evaluate(() => (window as unknown as { releaseNotesLock?: () => void }).releaseNotesLock?.());
    await other.close();
  }
});
