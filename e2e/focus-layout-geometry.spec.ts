import { expect, test, type Page } from '@playwright/test';

/**
 * Floating Focus layout contract. A fake Companion answers the page bridge so every music state renders without a
 * browser extension; the checks then assert geometry, not pixels: controls never overlap, the music timeline and
 * time labels stay inside their player, and nothing scrolls horizontally.
 */
type MusicState = 'none' | 'empty' | 'playing' | 'paused';
const longTitle = 'An Extraordinarily Long Song Title That Keeps Going (Extended Live Session Remix) feat. Several Guest Artists';

async function fakeCompanion(page: Page, state: MusicState) {
  await page.addInitScript(([state, title]) => {
    if (state === 'none') return;
    const session = { id: 'tab-1', title, artist: 'A Long Artist Name With Many Words', source: 'YouTube Music', paused: state === 'paused',
      playing: state === 'playing', canControl: true, canSeek: true, canPrevious: true, canNext: true, currentTime: 83, duration: 245,
      volume: .6, muted: false, playbackRate: 1, sampledAt: Date.now(), syncState: { mode: 'clock' } };
    window.addEventListener('message', event => {
      const data = event.data;
      if (event.source !== window || data?.channel !== 'kanban-music-v1' || data.direction !== 'app-to-extension') return;
      window.postMessage({ channel: 'kanban-music-v1', direction: 'extension-to-app', requestId: data.requestId, ok: true,
        sessions: state === 'empty' ? [] : [{ ...session, sampledAt: Date.now() }] }, window.location.origin);
    });
  }, [state, longTitle] as const);
}

interface Box { name: string; x: number; y: number; w: number; h: number }
async function geometry(page: Page) {
  return page.evaluate(() => {
    const rootNode = document.querySelector('#floating-focus-widget')?.shadowRoot ?? document;
    const dock = rootNode.querySelector<HTMLElement>('.floating-focus');
    if (!dock) return null;
    const box = (element: Element, name: string) => { const r = element.getBoundingClientRect(); return { name, x: r.x, y: r.y, w: r.width, h: r.height }; };
    const visible = (element: Element) => { const r = element.getBoundingClientRect(); const style = getComputedStyle(element);
      return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && !element.closest('[hidden],[inert]'); };
    const controls = [...dock.querySelectorAll('button, input, select, [role="tab"], .music-times span')].filter(visible)
      .map((element, index) => box(element, `${element.tagName.toLowerCase()}${element.getAttribute('aria-label') ? `[${element.getAttribute('aria-label')}]` : ''}#${index}:${(element.textContent || '').trim().slice(0, 20)}`));
    const contained: { child: Box; parent: Box }[] = [];
    for (const [childSelector, parentSelector] of [['.music-timeline', '.dock-track-pane'], ['.music-timeline input', '.music-timeline'], ['.music-times', '.music-timeline'],
      ['.music-controls', '.dock-track-pane'], ['.music-volume', '.dock-track-pane'], ['.music-heading', '.dock-track-pane'], ['.dock-toolbar', '.floating-focus'],
      ['.dock-tabbar', '.floating-focus'], ['.tab-content-area', '.floating-focus'], ['.music-now-playing-strip', '.floating-focus'], ['.dock-focus-actions', '.dock-focus-pane'],
      ['.beat-grid, .semantic-motion-grid, .beat-pattern', '.dock-beat-pane']] as const) {
      for (const child of dock.querySelectorAll(childSelector)) {
        if (!visible(child)) continue;
        const parent = child.parentElement?.closest(parentSelector) ?? (dock.matches(parentSelector) ? dock : null);
        if (parent && visible(parent)) contained.push({ child: box(child, childSelector), parent: box(parent, parentSelector) });
      }
    }
    // Every icon renders inside its own button, and the timer label inside its ring.
    for (const button of dock.querySelectorAll('button')) {
      const icon = button.querySelector(':scope > svg');
      if (icon && visible(button)) contained.push({ child: box(icon, `icon of ${button.getAttribute('aria-label') || button.className}`), parent: box(button, button.getAttribute('aria-label') || button.className) });
    }
    const ring = dock.querySelector('.dock-ring'), time = ring?.querySelector('.time');
    if (ring && time && visible(ring)) contained.push({ child: box(time, 'timer label'), parent: box(ring, 'timer ring') });
    const strip = dock.querySelector('.mini-player-wrapper');
    return { stripHeight: strip ? strip.getBoundingClientRect().height : 0, dock: box(dock, 'dock'), controls, contained, scrollWidth: document.documentElement.scrollWidth, viewport: window.innerWidth,
      dockOverflow: dock.scrollWidth - dock.clientWidth };
  });
}

const overlaps = (a: Box, b: Box) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1;
const inside = ({ child, parent }: { child: Box; parent: Box }) => child.x >= parent.x - 1 && child.y >= parent.y - 1
  && child.x + child.w <= parent.x + parent.w + 1 && child.y + child.h <= parent.y + parent.h + 1;
const contains = (outer: Box, inner: Box) => inner.x >= outer.x - 1 && inner.y >= outer.y - 1 && inner.x + inner.w <= outer.x + outer.w + 1 && inner.y + inner.h <= outer.y + outer.h + 1;

for (const width of [600, 900, 1280]) {
  for (const [tab, state] of [['focus', 'playing'], ['music', 'playing'], ['music', 'paused'], ['music', 'empty'], ['music', 'none'], ['beat', 'playing'], ['beat', 'empty']] as const) {
    test(`Floating Focus ${tab} tab with ${state} music fits at ${width}px`, async ({ page }, info) => {
      await fakeCompanion(page, state);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/focus?tab=${tab}`);
      const host = page.getByTestId('focus-dock-page');
      await expect(host).toBeAttached();
      if (state === 'playing' || state === 'paused') await expect.poll(async () => (await geometry(page))?.controls.some(control => control.name.includes('Seek')) || tab !== 'music').toBe(true);
      await page.waitForTimeout(400);
      const result = await geometry(page);
      expect(result, 'Floating Focus renders').not.toBeNull();
      await page.screenshot({ path: info.outputPath(`${tab}-${state}-${width}.png`), fullPage: true });
      if (tab === 'music' || state === 'none' || state === 'empty') expect(result!.stripHeight, 'no empty now-playing band').toBe(0);
      expect(result!.scrollWidth, 'no horizontal page scroll').toBeLessThanOrEqual(result!.viewport);
      expect(result!.dockOverflow, 'no horizontal overflow inside the dock').toBeLessThanOrEqual(1);
      for (const pair of result!.contained) expect(inside(pair), `${pair.child.name} stays inside ${pair.parent.name}: ${JSON.stringify(pair)}`).toBe(true);
      const controls = result!.controls;
      for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
        if (contains(controls[i], controls[j]) || contains(controls[j], controls[i])) continue;
        expect(overlaps(controls[i], controls[j]), `${controls[i].name} overlaps ${controls[j].name}`).toBe(false);
      }
    });
  }
}

test('pausing music does not shift the Floating Focus layout', async ({ page }) => {
  await page.addInitScript(() => {
    let paused = false;
    window.addEventListener('message', event => {
      const data = event.data;
      if (event.source !== window || data?.channel !== 'kanban-music-v1' || data.direction !== 'app-to-extension') return;
      if (data.action === 'media.pause') paused = true;
      if (data.action === 'media.play') paused = false;
      window.postMessage({ channel: 'kanban-music-v1', direction: 'extension-to-app', requestId: data.requestId, ok: true, sessions: [{ id: 'tab-1', title: 'Song',
        artist: 'Artist', source: 'YouTube', paused, playing: !paused, canControl: true, canSeek: true, currentTime: 10, duration: 200, volume: .5, sampledAt: Date.now() }] }, window.location.origin);
    });
  });
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto('/focus?tab=focus');
  const strip = page.locator('.music-strip-play');
  await expect(strip).toBeVisible();
  const before = await page.locator('.floating-focus').boundingBox();
  await strip.click();
  // A paused session hides the strip content; its reserved slot keeps the dock height unchanged.
  await expect(strip).toBeHidden();
  await page.waitForTimeout(400);
  const after = await page.locator('.floating-focus').boundingBox();
  expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(1);
});
