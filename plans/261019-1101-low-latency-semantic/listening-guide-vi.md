# Hướng dẫn nghe thử L0 hiện tại — chưa có ứng viên nhanh hơn

Ngày 19/10/2026. Đây là kiểm tra định tính của đường live ADTOF đang có,
không phải xác nhận độ chính xác hay đồng bộ vật lý. D1 đã xong; L1/L2 chưa
được triển khai. H0 cục bộ và live ADTOF là hai đường khác nhau.

1. Dùng Brave có Kora Music Companion Private 0.3.24 và mở
   <http://127.0.0.1:1420/music>. Máy chủ phải đang chạy.
2. Tắt **Beat Grid Hybrid — Beta** nếu muốn nghe thử đường live. Chọn một tab
   âm thanh mà bạn có quyền phân tích; có thể dùng nguồn kiểm soát được cấp phép.
   Chỉ thử YouTube khi phù hợp quyền sử dụng và hạn chế hiện hành.
3. Phát nhạc trong tab nguồn rồi bấm biểu tượng Companion tại chính tab đó để
   bật capture. Quay lại Kora, chọn đúng nguồn và mở tab **Beat grid**.
4. Mở **Private candidate**, rồi **Live preview**. Chỉ xác nhận ba ô nếu các
   phát biểu đúng: được phép phân tích, nghe được âm thanh capture bình thường,
   và chấp nhận nháy sai hoặc trễ trong thử nghiệm riêng. Bật live preview.
   Không bật calibrated delay/buffer để che độ trễ. Âm thanh nguồn giữ nguyên.
5. Nghe riêng từng hàng Kick, Snare, Hat và Bass. Ghi tên bài, khoảng thời gian
   gần đúng, hàng bị sai, kiểu lỗi (nhầm nhạc cụ, thiếu hit, thêm hit, cụm nháy
   trễ) và nhịp lặp có mất dần không. Không cần bấm mốc onset thật chính xác.
6. Thử pause/resume, seek và đổi video/nguồn. Sự kiện cũ phải được xóa; không
   tiếp tục nháy theo nguồn cũ. Nếu nguồn không đủ điều kiện phân tích, giữ
   nguyên hạn chế thay vì tìm cách vượt qua.
7. Tắt live preview để dừng thử. L0 vẫn là đường live hiện tại, không có lựa
   chọn L1/L2 mới ở bản kiểm tra này.

Nếu chỉ viền nháy, đó có thể là phản hồi trang trí; không tính là nhận diện
Kick/Snare/Hat. Spotify không được bật phân tích semantic riêng; Apple Music
được bảo vệ cũng không được phân tích. Khám phá nguồn/điều khiển phát nhạc có
thể hoạt động dù phân tích âm thanh bị chặn.

Để nghe lại H0 cục bộ, tắt live preview, bật **Beat Grid Hybrid — Beta**, chọn
đúng bản thu cục bộ đã chuẩn bị và phát bằng Music Player. H0 vẫn dùng ADTOF
cho Kick/Snare, CNN cho Hat và Bass độc lập; không gán tên H0 cho đường live.

Các mốc bạn ghi là `provisional-human-reference`, không phải ground truth hoàn
chỉnh. Không dùng chúng để tính Precision/Recall/F1 chính thức hoặc kết luận
mọi nháy không khớp là false positive. Độ trễ callback đo bằng phần mềm không
thay thế đo loa–màn hình bằng thiết bị đã hiệu chuẩn:

**PHYSICAL SPEAKER-TO-PIXEL SYNC — UNVERIFIED**.
