const copy = {
  en: {
    back: '← Back to Kanban', eyebrow: 'KANBAN MUSIC COMPANION', title: 'Your music, beside your focus timer.',
    intro: 'Our small extension for Chrome, Edge, or Brave on a computer connects your music tabs to Floating Focus. Once installed, it connects automatically.',
    release: 'Early access: the extension is not in the browser store yet. These steps let you try it now. The public version will use an “Add to browser” button.',
    downloadTitle: 'Download and open the folder', downloadBody: 'Download the file below. In Downloads, right-click it and choose “Extract All” (Windows), or double-click it (Mac). Keep the extracted folder.', download: 'Download music extension',
    browserTitle: 'Open your browser’s extension page', browserBody: 'Copy this address, paste it into the address bar at the top of your browser, and press Enter.', copy: 'Copy address',
    installTitle: 'Add the downloaded folder', installBody: 'Turn on “Developer mode”. Click “Load unpacked”, then select the extracted “kanban-music-companion” folder. You only do this once.',
    returnTitle: 'Return to Kanban', returnBody: 'Refresh your Kanban tab once, then open Floating Focus. Play a song on YouTube, SoundCloud, or Spotify Web in this same browser. Its name and play/pause controls appear automatically.', return: 'Return to Kanban',
    beatTitle: 'Make the lights follow your music', beatBody: 'Beat sync starts automatically when Chrome permits capture. If Chrome needs permission, open the music tab, click the puzzle-piece Extensions button, then Kanban Music Companion. Squares stay still when capture is unavailable; they never simulate a beat. Nothing is recorded or uploaded.',
    helpTitle: 'No song showing up?', helpBody: 'Keep the music tab open and press play there once. Check that Kanban and your music are in the same browser and profile. Then refresh Kanban. Updating an older copy? Replace its extracted files, click Reload on the extension page, and refresh Kanban. Disable any duplicate copies.',
    privacy: 'Your track information stays in your browser. No music account or extension ID to enter.', privacyLink: 'Privacy details', copied: 'Address copied. Paste it into your browser’s address bar.', copyFailed: 'Select the address above and copy it manually.',
  },
  vi: {
    back: '← Quay lại Kanban', eyebrow: 'TIỆN ÍCH NHẠC KANBAN', title: 'Nhạc của bạn, bên cạnh đồng hồ tập trung.',
    intro: 'Tiện ích nhỏ dành cho Chrome, Edge hoặc Brave trên máy tính kết nối thẻ nhạc của bạn với Floating Focus. Cài một lần, ứng dụng tự kết nối.',
    release: 'Bản dùng thử: tiện ích chưa có trên cửa hàng trình duyệt. Làm theo các bước dưới đây để thử ngay. Bản chính thức sẽ chỉ cần nút “Thêm vào trình duyệt”.',
    downloadTitle: 'Tải xuống và mở thư mục', downloadBody: 'Tải tệp bên dưới. Trong thư mục Tải xuống, nhấp chuột phải và chọn “Extract All / Giải nén tất cả” (Windows), hoặc nhấp đúp (Mac). Giữ lại thư mục đã giải nén.', download: 'Tải tiện ích nhạc',
    browserTitle: 'Mở trang tiện ích của trình duyệt', browserBody: 'Sao chép địa chỉ này, dán vào thanh địa chỉ ở đầu trình duyệt rồi nhấn Enter.', copy: 'Sao chép địa chỉ',
    installTitle: 'Thêm thư mục vừa tải', installBody: 'Bật “Developer mode / Chế độ nhà phát triển”. Nhấn “Load unpacked / Tải tiện ích đã giải nén”, rồi chọn thư mục “kanban-music-companion” đã giải nén. Chỉ cần làm một lần.',
    returnTitle: 'Quay lại Kanban', returnBody: 'Tải lại thẻ Kanban một lần, rồi mở Floating Focus. Phát một bài trên YouTube, SoundCloud hoặc Spotify Web trong cùng trình duyệt. Tên bài và nút phát/dừng sẽ tự hiện.', return: 'Quay lại Kanban',
    beatTitle: 'Cho ánh sáng nháy theo nhạc', beatBody: 'Đồng bộ nhịp tự bắt đầu khi Chrome cho phép. Nếu Chrome cần cấp quyền, mở thẻ nhạc, nhấn biểu tượng mảnh ghép Tiện ích rồi chọn Kanban Music Companion. Các ô vuông đứng yên khi chưa thu được nhịp thật, không giả nhịp bằng đồng hồ. Không ghi âm hay tải âm thanh lên máy chủ.',
    helpTitle: 'Chưa thấy bài hát?', helpBody: 'Giữ thẻ nhạc mở và nhấn phát ở đó một lần. Đảm bảo Kanban và nhạc ở cùng trình duyệt, cùng hồ sơ. Sau đó tải lại Kanban. Nâng cấp bản cũ? Thay các tệp đã giải nén, nhấn Tải lại trên trang tiện ích rồi tải lại Kanban. Tắt các bản tiện ích trùng lặp.',
    privacy: 'Thông tin bài hát ở lại trong trình duyệt. Không cần nhập tài khoản nhạc hay mã tiện ích.', privacyLink: 'Chi tiết quyền riêng tư', copied: 'Đã sao chép. Dán vào thanh địa chỉ của trình duyệt.', copyFailed: 'Chọn địa chỉ bên trên và sao chép thủ công.',
  },
};
let language = new URLSearchParams(location.search).get('lang') === 'vi' ? 'vi' : 'en';
const addresses = { chrome: 'chrome://extensions', edge: 'edge://extensions', brave: 'brave://extensions' };
function setLanguage() {
  document.documentElement.lang = language;
  document.querySelectorAll('[data-copy]').forEach((element) => { element.textContent = copy[language][element.dataset.copy]; });
  document.querySelector('#language').textContent = language === 'en' ? 'Tiếng Việt' : 'English';
  document.querySelector('#notice').textContent = '';
}
function chooseBrowser(name) {
  document.querySelector('#address').textContent = addresses[name];
  document.querySelectorAll('[data-browser]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.browser === name)));
}
document.querySelector('#language').addEventListener('click', () => { language = language === 'en' ? 'vi' : 'en'; setLanguage(); });
document.querySelectorAll('[data-browser]').forEach((button) => button.addEventListener('click', () => chooseBrowser(button.dataset.browser)));
document.querySelector('#copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(document.querySelector('#address').textContent); document.querySelector('#notice').textContent = copy[language].copied; }
  catch { document.querySelector('#notice').textContent = copy[language].copyFailed; }
});
chooseBrowser(navigator.userAgent.includes('Edg/') ? 'edge' : 'chrome');
setLanguage();
