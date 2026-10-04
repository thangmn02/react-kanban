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
