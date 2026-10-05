import { createInstrumentWorker } from './instrument-runtime.js';

const button = document.getElementById('check-detection');
const output = document.getElementById('detection-result');
document.getElementById('companion-version').textContent = chrome.runtime.getManifest().version;
button.addEventListener('click', async () => {
  button.disabled = true;
  output.textContent = 'Checking supported music tabs…';
  try {
    const response = await chrome.runtime.sendMessage({ protocol: 'kanban-music-v1', action: 'diagnostics.get' });
    output.textContent = response?.ok === true
      ? JSON.stringify({ version: chrome.runtime.getManifest().version, tabs: response.tabs }, null, 2)
      : 'The companion could not check music tabs. Reload it in this browser’s extension manager.';
  } catch {
    output.textContent = 'The companion connection was interrupted. Reopen this setup page from the extension’s Details → Extension options.';
  } finally { button.disabled = false; }
});


const enable = document.getElementById('enable-instrument');
const disable = document.getElementById('disable-instrument');
const status = document.getElementById('instrument-status');
let download, generation = 0;
const saved = await chrome.storage.local.get(['instrumentNotesEnabled', 'instrumentNotesError']);
status.textContent = saved.instrumentNotesError || (saved.instrumentNotesEnabled ? 'Enabled. Original audio is delayed 3.5 seconds during capture.' : 'Not enabled. The fifth row stays dark.');
enable.addEventListener('click', async () => {
  const request = ++generation;
  enable.disabled = true; status.textContent = 'Preparing local AI models…';
  try {
    download = createInstrumentWorker({ progress: (bytes, total) => {
      status.textContent = `Loading models: ${Math.floor(bytes / total * 100)}% (${(bytes / 1000000).toFixed(1)} / ${(total / 1000000).toFixed(1)} MB)`;
    } });
    await download.ready;
    if (generation !== request) return;
    await chrome.storage.local.set({ instrumentNotesEnabled: true, instrumentNotesError: '', instrumentNotesRevision: Date.now() });
    status.textContent = 'Enabled. Return to Kora; capture restarts automatically. Audio and all five rows share a 3.5-second delay.';
  } catch (error) {
    if (generation === request) status.textContent = `Could not enable: ${error.message}. Retry the download; the fifth row stays dark.`;
  } finally {
    if (generation === request) { download?.stop(); download = undefined; enable.disabled = false; }
  }
});
disable.addEventListener('click', async () => {
  generation++; download?.stop(); download = undefined; enable.disabled = false;
  await chrome.storage.local.set({ instrumentNotesEnabled: false, instrumentNotesError: '' });
  status.textContent = 'Off. Playback has no AI delay; model downloads remain cached for next time.';
});
window.addEventListener('pagehide', () => download?.stop());
