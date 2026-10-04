// Headless layout check with explicitly synthetic music, never live evidence.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import FloatingFocus from '/src/components/focus/FloatingFocus.tsx';
import { I18nProvider } from '/src/i18n/index.ts';
import css from '/src/components/focus/floatingFocus.css?inline';
import nativeCss from '/src/features/native/nativeDock.css?inline';
const channel = 'kanban-music-v1';
let subscription;
let onsetSequence = 0;
const session = { id: 'synthetic-song', title: 'Synthetic layout test — NOT live music', artist: 'Test fixture', source: 'music.youtube.com', paused: false, playing: true, currentTime: 1 };
window.syntheticMelody = true;
const event = (fields) => window.postMessage({ channel, direction: 'extension-event', event: 'beat', sessionId: session.id, subscriptionId: subscription, ...fields }, location.origin);
window.syntheticHit = () => event({ kind: 'onset', captureId: 'synthetic-capture', bands: ['bass'], sequence: ++onsetSequence });
window.addEventListener('message', ({ data }) => {
  if (data?.direction !== 'app-to-extension') return;
  window.postMessage({ channel, direction: 'extension-to-app', requestId: data.requestId, ok: true, sessions: [session] }, location.origin);
  if (data.action === 'dock.beat.sync.start') {
    subscription = data.subscriptionId;
    event({ kind: 'sync.state', mode: 'capture', captureId: 'synthetic-capture' });
  }
});
setInterval(() => { if (subscription) event({ kind: 'melody.state', captureId: 'synthetic-capture', melody: { active: window.syntheticMelody, level: window.syntheticMelody ? .6 : 0, note: 1 } }); }, 100);
const shadow = document.querySelector('#host').attachShadow({ mode: 'open' });
const style = document.createElement('style'); style.textContent = css + nativeCss;
const root = document.createElement('div'); shadow.append(style, root);
window.durationPatch = null;
createRoot(root).render(<I18nProvider><FloatingFocus isWidget activeTask={null} focusTasks={[]} cycleTotal={4}
  timerState={{ mode: 'focus', activeTaskId: null, isRunning: false, remainingSeconds: 1500, startedAt: null, endsAt: null, plannedSeconds: null }}
  timerSettings={{ focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 }}
  remainingSeconds={1500} onStart={() => {}} onPause={() => {}} onReset={() => {}}
  onTimerSettingsChange={(patch) => window.durationPatch = patch} onModeChange={() => {}} /></I18nProvider>);
`;

const server = await createServer({ server: { host: '127.0.0.1', port: 1435, strictPort: true }, plugins: [{
  name: 'synthetic-dock-check',
  resolveId(id) { if (id === '/__dock-check.jsx') return id; },
  load(id) { if (id === '/__dock-check.jsx') return fixture; },
  configureServer(vite) {
    vite.middlewares.use('/__dock-check.html', async (_req, res) => {
      const html = await vite.transformIndexHtml('/__dock-check.html', '<!doctype html><html><head><title>Synthetic dock layout check</title><style>html,body,#host{height:100%;margin:0}</style></head><body><div id="host"></div><script type="module" src="/__dock-check.jsx"></script></body></html>');
      res.setHeader('Content-Type', 'text/html'); res.end(html);
    });
  },
}] });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:1435/__dock-check.html');
  await page.locator('.beat-square').first().waitFor();
  const glass = await page.locator('.floating-focus').evaluate((dock) => {
    const css = getComputedStyle(dock);
    return { radius: css.borderRadius, background: css.backgroundImage,
      blur: css.backdropFilter, shadow: css.boxShadow,
      rim: getComputedStyle(dock, '::before').boxShadow,
      rimPointerEvents: getComputedStyle(dock, '::before').pointerEvents };
  });
  assert.equal(glass.radius, '8px');
  assert(glass.background.includes('linear-gradient') && glass.blur.includes('blur(22px)'), JSON.stringify(glass));
  assert(glass.shadow.includes('inset'), 'Native CSS keeps its inner glow');
  assert(glass.rim.includes('inset'), 'The bevel stays above the dock panes');
  assert.equal(glass.rimPointerEvents, 'none', 'The glass rim must not intercept controls');
  async function check(size) {
    await page.waitForTimeout(450);
    const result = await page.evaluate(() => {
      const root = document.querySelector('#host').shadowRoot;
      const dock = root.querySelector('.floating-focus');
      const visible = [...root.querySelectorAll('.dock-panel')].filter((panel) => panel.getAttribute('aria-hidden') !== 'true');
      return { style: dock.dataset.style, overflow: dock.scrollHeight - dock.clientHeight,
        boxes: visible.flatMap((panel) => [...panel.querySelectorAll('.beat-square, button, .dock-session-row')]).map((element) => {
          const box = element.getBoundingClientRect();
          return { kind: element.className, x: box.x, y: box.y, right: box.right, bottom: box.bottom, height: box.height };
        }) };
    });
    assert(result.overflow <= 2, JSON.stringify({ size, ...result }));
    for (const box of result.boxes) {
      assert(box.height > 0 && box.x >= -2 && box.y >= -2 && box.right <= size.width + 2 && box.bottom <= size.height + 2,
        JSON.stringify({ size, style: result.style, box }));
    }
    return result.style;
  }
  for (const size of [{ width: 360, height: 320 }, { width: 520, height: 460 }, { width: 760, height: 460 }]) {
    await page.setViewportSize(size);
    for (let index = 0; index < 5; index++) {
      const style = await check(size);
      if (style === 'deck') {
        await page.getByRole('button', { name: 'Fan out cards' }).click();
        await check(size);
        await page.getByRole('button', { name: 'Fan out cards' }).click();
      }
      if (style === 'tabs') {
        await page.getByRole('tab', { name: 'Beat', exact: true }).click();
        await check(size);
        await page.getByRole('tab', { name: 'Pomodoro', exact: true }).click();
      }
      await page.getByRole('button', { name: 'Switch dock style' }).click();
    }
  }
  await page.getByRole('button', { name: 'Timer settings' }).click();
  await page.getByRole('spinbutton', { name: 'Focus length' }).fill('45');
  assert.deepEqual(await page.evaluate(() => window.durationPatch), { focusMinutes: 45 });
  await page.keyboard.press('Escape');
  assert(await page.locator('.melody-held').count() > 0);
  // Test actual CSS/composited hit contrast, not just a class appearing in DOM.
  for (let hit = 0; hit < 3; hit++) {
    await page.evaluate(() => window.syntheticHit());
    await page.waitForTimeout(110);
    const flash = page.locator('.shape-beat-flash').first();
    assert(await flash.count() > 0, 'A captured bass hit must reflash the held melody shape');
    const style = await flash.evaluate((element) => {
      const flashStyle = getComputedStyle(element), base = getComputedStyle(element.parentElement);
      return { opacity: Number(flashStyle.opacity), hit: flashStyle.backgroundColor,
        base: base.backgroundColor, width: element.getBoundingClientRect().width };
    });
    assert(style.opacity > .3 && style.width > 0 && style.hit !== style.base, JSON.stringify(style));
    await page.waitForTimeout(600);
    assert(await flash.evaluate((element) => Number(getComputedStyle(element).opacity)) < .01);
    assert(await page.locator('.moment-lit').count() > 0, 'The shape stays visible between real hits');
  }
  assert(await page.locator('.channel-icon').evaluateAll((icons) => icons.every((icon) =>
    getComputedStyle(icon).animationName === 'none' && getComputedStyle(icon).transform === 'none')));
  await page.evaluate(() => window.syntheticMelody = false);
  await page.waitForTimeout(700);
  assert.equal(await page.locator('.melody-held').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Synthetic native CSS: five layouts fit at 360/520/760px; timer adjustment and three visible shape reflashes pass. Not live audio.');
} finally { await browser?.close(); await server.close(); }
