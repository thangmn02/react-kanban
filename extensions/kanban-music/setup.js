const copy = {
  en: {
    title: 'Kora Music Companion', ready: 'Ready', version: 'Version',
    notMusicTab: 'This tab isn’t a music player. Open YouTube, YouTube Music, SoundCloud, Spotify, Apple Music, Deezer or Tidal, then click the Kora icon on that tab.',
    pin: 'Pin it: open the puzzle-piece Extensions menu and click the pin next to Kora Music Companion.',
    play: 'Play music in this browser on YouTube, YouTube Music, SoundCloud, Spotify, Apple Music, Deezer or Tidal.',
    open: 'Open Floating Focus in Kora. Refresh Kora once after installing or updating.', openKora: 'Open Kora',
    grayTitle: 'Beat grid stays gray?', grayBody: 'Click the Kora icon on the music tab to allow live beats. A new music tab or an extension reload may need one more click.',
    privacy: 'Audio is analyzed only in your browser. Nothing is recorded or uploaded.',
    missingTitle: 'Music not appearing?', missingBody: 'Keep Kora and the music tab open in this same browser and profile. Install the Companion in each browser profile you use.',
    check: 'Check music detection', reportNote: 'The report lists only website names, media counts and status codes.',
    checking: 'Checking supported music tabs…', checkFailed: 'The companion could not check music tabs. Reload it on your browser’s Extensions page.',
    interrupted: 'The companion connection was interrupted. Reopen this page from the extension’s Details → Extension options.',
  },
  vi: {
    title: 'Kora Music Companion', ready: 'Sẵn sàng', version: 'Phiên bản',
    notMusicTab: 'Thẻ này không phải trình phát nhạc. Mở YouTube, YouTube Music, SoundCloud, Spotify, Apple Music, Deezer hoặc Tidal rồi nhấn biểu tượng Kora trên thẻ đó.',
    pin: 'Ghim tiện ích: mở menu Tiện ích (hình mảnh ghép) và nhấn ghim cạnh Kora Music Companion.',
    play: 'Phát nhạc trong trình duyệt này trên YouTube, YouTube Music, SoundCloud, Spotify, Apple Music, Deezer hoặc Tidal.',
    open: 'Mở Floating Focus trong Kora. Tải lại Kora một lần sau khi cài hoặc cập nhật.', openKora: 'Mở Kora',
    grayTitle: 'Lưới nhịp vẫn xám?', grayBody: 'Nhấn biểu tượng Kora trên thẻ nhạc để cho phép nhịp trực tiếp. Thẻ nhạc mới hoặc tải lại tiện ích có thể cần nhấn thêm một lần.',
    privacy: 'Âm thanh chỉ được phân tích trong trình duyệt. Không ghi âm hay tải lên.',
    missingTitle: 'Chưa thấy nhạc?', missingBody: 'Giữ Kora và thẻ nhạc mở trong cùng trình duyệt, cùng hồ sơ. Cài Companion trong từng hồ sơ trình duyệt bạn dùng.',
    check: 'Kiểm tra nhận nhạc', reportNote: 'Báo cáo chỉ gồm tên trang web, số lượng media và mã trạng thái.',
    checking: 'Đang kiểm tra các thẻ nhạc…', checkFailed: 'Tiện ích chưa kiểm tra được thẻ nhạc. Hãy nhấn Reload trên trang Tiện ích của trình duyệt.',
    interrupted: 'Kết nối với tiện ích bị gián đoạn. Mở lại trang này từ Chi tiết → Tùy chọn tiện ích.',
  },
};
let language = (navigator.language || '').toLowerCase().startsWith('vi') ? 'vi' : 'en';
const languageButton = document.getElementById('language');
function render() {
  document.documentElement.lang = language;
  document.querySelectorAll('[data-copy]').forEach((element) => { element.textContent = copy[language][element.dataset.copy]; });
  languageButton.textContent = language === 'en' ? 'Tiếng Việt' : 'English';
}
languageButton.addEventListener('click', () => { language = language === 'en' ? 'vi' : 'en'; render(); });
render();

// The toolbar action leaves a one-time reason when it opens this page from a non-music tab.
void chrome.storage.session.get('setupReason').then(({ setupReason }) => {
  if (setupReason !== 'not-music-tab') return;
  document.getElementById('reason').hidden = false;
  return chrome.storage.session.remove('setupReason');
}).catch(() => {});

const button = document.getElementById('check-detection');
const output = document.getElementById('detection-result');
document.getElementById('companion-version').textContent = chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version;
button.addEventListener('click', async () => {
  button.disabled = true;
  output.textContent = copy[language].checking;
  try {
    const response = await chrome.runtime.sendMessage({ protocol: 'kanban-music-v1', action: 'diagnostics.get' });
    output.textContent = response?.ok === true
      ? JSON.stringify({ version: chrome.runtime.getManifest().version, tabs: response.tabs }, null, 2)
      : copy[language].checkFailed;
  } catch {
    output.textContent = copy[language].interrupted;
  } finally { button.disabled = false; }
});
