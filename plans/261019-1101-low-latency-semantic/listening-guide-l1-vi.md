# Nghe thử L0 / L1 trong Kora — bản riêng tư

Ngày 19/10/2026. L1 giảm độ trễ p95 bằng phần mềm khoảng 10–24 ms trong các
lần thử có kiểm soát; vẫn còn khoảng 200 ms và một số trường hợp chậm nhất tệ
hơn L0. Chưa xác nhận độ chính xác tổng quát hoặc đồng bộ loa–màn hình ±50 ms.
L0 vẫn là mặc định. Đây không phải H0 và không phải model mới.

1. Dùng **Brave**, nơi Companion của bạn đang hoạt động. Trong trang Extensions,
   reload bản unpacked ở thư mục
   `C:\Users\thang\OneDrive\Documents\react-kanban\react-kanban\scratch\browser-first-candidate\extension`.
   Kiểm tra tên **Kora Music Companion Private**, phiên bản **0.3.25**. Chỉ bật
   một Companion và mở một grid Kora. Công cụ trình duyệt không thể thao tác
   trang Extensions bị chặn; bước reload này cần bạn thực hiện.
2. Refresh tab nhạc và mở <http://127.0.0.1:1420/music>. Máy chủ riêng tư đang
   được giữ chạy ở cổng 1420. Nếu đã dừng, chạy
   `node scripts/serve-hybrid-beta.mjs` từ thư mục repository và giữ terminal mở;
   không mở thêm máy chủ nếu cổng đang được dùng. Không dùng các cổng 5173/5174
   của bài thử cũ cho lần nghe này.
3. Tắt **Beat Grid Hybrid — Beta** để thử đường live. Phát nguồn không được bảo
   vệ mà bạn có quyền phân tích, ví dụ YouTube phù hợp quyền sử dụng. Bấm biểu
   tượng Companion trên chính tab nguồn để cấp capture, rồi chọn đúng nguồn
   trong Kora. Phát nhạc và thấy metadata chưa có nghĩa là đã capture thành công.
4. Mở **Music → Private candidate → Live preview**. Giữ nhạc đang phát. Chỉ tick
   ba ô nếu đúng: được phép phân tích, nghe âm thanh capture bình thường, chấp
   nhận nháy sai/trễ trong thử nghiệm. Chọn **L0 · Frozen live ADTOF baseline**
   và bấm **Enable live preview (no audio delay)**. Không cần calibration hoặc
   bật calibrated delay. Âm thanh nguồn giữ nguyên tốc độ và không thêm buffer.
5. Nghe một đoạn với L0, rồi chọn **L1 · Earlier peak finalization (experimental)**
   trong **Live detector**. Phải thấy **LIVE SEMANTIC CANDIDATE — EXPERIMENTAL**.
   Nếu không có selector, kiểm tra lại phiên bản và refresh cả hai tab. Đổi về
   L0 trong cùng selector để quay lại baseline ngay, không cần thay bản thu.
6. So sánh cùng đoạn, thiết bị, âm lượng và tốc độ. Ghi thời gian gần đúng,
   hàng Kick/Snare/Hat/Bass, nháy trễ, thiếu hit, nhầm nhạc cụ, thêm Hat, cụm
   nháy hoặc nhịp lặp mất dần. Không cần click timestamp onset chính xác. Live
   vẫn dùng ADTOF cho Hat; không có CNN Hat của H0 trong đường live này.
7. Thử pause/resume, seek và đổi video/nguồn. Preview phải bị thu hồi và sự kiện
   cũ phải dừng. Khi phát lại, bật preview lại cho đúng nguồn. Không dùng cách
   vượt chặn nếu nguồn không đủ điều kiện. Spotify và Apple Music được bảo vệ
   vẫn không được phép phân tích semantic qua thử nghiệm này.
8. Bấm **Disable live preview** khi xong. Muốn nghe H0 cục bộ, tắt live preview,
   bật **Beat Grid Hybrid — Beta**, chọn bản thu đã chuẩn bị và phát bằng Music
   Player. H0 giữ ADTOF Kick/Snare, CNN Hat và Bass độc lập; Lead không thay đổi.

Gợi ý đoạn nghe: Nujabes để chú ý chuỗi Hat; bản Rằng Em Mãi Ở Bên thật ở
26–44 giây; HSKT cho hit chồng nhau; bài Trung Quốc 爱人错过 ở 200–220 giây;
XO Tour Llif3 ở 45–57 giây; Whiplash ở đoạn bạn thấy khó. Kiểm tra đúng tên
bản thu; nhãn slot cũ không bảo đảm đang trỏ đúng file. Không đổi nhãn thành
ground truth hay kết luận mọi nháy không khớp là false positive.

Ghi chú nghe của bạn là **`provisional-human-reference`**. Nếu không chắc nhạc
cụ hay thời điểm, ghi rõ “không chắc” và khoảng thời gian mơ hồ. Chúng giúp
điều tra, không dùng tính Precision/Recall/F1 chính thức hoặc tự động cho qua
accuracy gate. Cần tập tham chiếu riêng đã kiểm chứng, đủ coverage và onset
chính xác để đánh giá chính thức.

**PHYSICAL SPEAKER-TO-PIXEL SYNC — UNVERIFIED.**
