const copy = {
  en: {
    back: "← Back to Kora",
    eyebrow: "KORA MUSIC COMPANION",
    title: "Your music, beside your focus timer.",
    intro: "Connect browser music to the Kora web dock or Windows app. Works in Chrome, Edge and Brave.",
    release: "Early access: not in the browser store yet, so it takes four steps to install.",
    downloadTitle: "Download and unzip",
    downloadBody: "Download the file, then right-click it in Downloads and choose “Extract All” (on Mac, double-click it). Keep the folder.",
    download: "Download music extension",
    browserTitle: "Open the Extensions page",
    browserBody: "Copy this address into your browser’s address bar and press Enter.",
    copy: "Copy address",
    installTitle: "Load the folder",
    installBody: "Turn on “Developer mode”, click “Load unpacked” and choose the folder you unzipped.",
    returnTitle: "Play music and open your dock",
    returnWeb: "Web: refresh Kora and open Floating Focus.",
    returnWindows: "Windows app: open dock settings → Install or update Companion, then load the folder it shows.",
    return: "Return to Kora",
    updateTitle: "Update the Companion",
    updateBody: "Windows app: dock settings → Install or update Companion. Web: download again, replace the files in your extension folder, click Reload on the Extensions page, then refresh Kora.",
    beatTitle: "How the beat grid works",
    beatBody: "Kick, Snare, Hat and Bass light up from audio analyzed in your browser. If the grid stays gray, click the Kora icon on the music tab. Busy songs can cause missed or extra flashes, and other sound in the same browser (like calls) can affect them.",
    helpTitle: "No song showing up?",
    helpBody: "Press play in the music tab once. Keep Kora and the music in the same browser and profile, then refresh Kora. Turn off duplicate copies of the Companion.",
    privacy: "Audio is analyzed on your device. Nothing is recorded or uploaded.",
    privacyLink: "Privacy details",
    copied: "Address copied. Paste it into your browser’s address bar.",
    copyFailed: "Select the address above and copy it manually.",
  },
  vi: {
    back: "← Quay lại Kora",
    eyebrow: "TIỆN ÍCH NHẠC KORA",
    title: "Nhạc của bạn, bên cạnh đồng hồ tập trung.",
    intro: "Kết nối nhạc trình duyệt với dock web hoặc ứng dụng Windows của Kora. Dùng được trên Chrome, Edge và Brave.",
    release: "Bản dùng thử: chưa có trên cửa hàng trình duyệt nên cần bốn bước để cài.",
    downloadTitle: "Tải xuống và giải nén",
    downloadBody: "Tải tệp về, nhấp chuột phải trong thư mục Tải xuống và chọn “Extract All / Giải nén tất cả” (Mac: nhấp đúp). Giữ lại thư mục.",
    download: "Tải tiện ích nhạc",
    browserTitle: "Mở trang Tiện ích",
    browserBody: "Dán địa chỉ này vào thanh địa chỉ của trình duyệt rồi nhấn Enter.",
    copy: "Sao chép địa chỉ",
    installTitle: "Tải thư mục lên",
    installBody: "Bật “Developer mode”, nhấn “Load unpacked” rồi chọn thư mục vừa giải nén.",
    returnTitle: "Phát nhạc và mở dock",
    returnWeb: "Web: tải lại Kora và mở Floating Focus.",
    returnWindows: "Ứng dụng Windows: mở cài đặt dock → Install or update Companion, rồi tải thư mục được hiển thị.",
    return: "Quay lại Kora",
    updateTitle: "Cập nhật Companion",
    updateBody: "Ứng dụng Windows: cài đặt dock → Install or update Companion. Web: tải lại tệp, thay các tệp trong thư mục tiện ích, nhấn Reload trên trang Tiện ích rồi tải lại Kora.",
    beatTitle: "Lưới nhịp hoạt động thế nào",
    beatBody: "Kick, Snare, Hat và Bass sáng theo âm thanh được phân tích trong trình duyệt. Nếu lưới vẫn xám, nhấn biểu tượng Kora trên thẻ nhạc. Bài nhiều nhạc cụ có thể bỏ sót hoặc nháy dư, và âm thanh khác trong cùng trình duyệt (như cuộc gọi) có thể ảnh hưởng.",
    helpTitle: "Chưa thấy bài hát?",
    helpBody: "Nhấn phát trong thẻ nhạc một lần. Giữ Kora và nhạc ở cùng trình duyệt, cùng hồ sơ, rồi tải lại Kora. Tắt các bản Companion trùng lặp.",
    privacy: "Âm thanh được phân tích trên thiết bị. Không ghi âm hay tải lên.",
    privacyLink: "Chi tiết quyền riêng tư",
    copied: "Đã sao chép. Dán vào thanh địa chỉ của trình duyệt.",
    copyFailed: "Chọn địa chỉ bên trên và sao chép thủ công.",
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
