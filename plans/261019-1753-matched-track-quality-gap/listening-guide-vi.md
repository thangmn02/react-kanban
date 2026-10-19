# Nghe so sánh Private Landing từ 0:20

Đây là kiểm tra nghe chủ quan, **không phải nhãn chuẩn hoặc điểm chính xác**.
Phản hồi đã ghi nhận: Hi-Hat ở YouTube L1 bị thiếu, chậm và đôi lúc không nháy;
H0 ngoại tuyến được bạn đánh giá tốt hơn.

## Bản thu và đoạn nghe

- Tệp: `Don Toliver - Private Landing (feat. Justin Bieber & Future) [Official Audio].mp3`.
- SHA bắt đầu bằng `df2173a39346`; thời lượng khoảng 3:58.469.
- Bắt đầu bạn chọn: **0:20**. Nghe từng đoạn **20–30**, **30–40**, rồi **40–50 giây**.
  Mốc 50 giây là giới hạn kiểm tra kỹ thuật, không phải mốc bạn đã cung cấp.

## Lab hiện có

1. Mở [Full-Song Lab](http://127.0.0.1:5173/lab/?review=matched-private-landing).
   Trong Brave, tab kiểm tra đã chọn đúng tệp, **H · Hybrid ADTOF + CNN**, Short
   Attack, vòng lặp 20–30 giây, đang dừng ở **20.000**. Nếu trạng thái thay đổi,
   chọn lại đúng tệp và dùng **Loop detail window** để về đúng đầu đoạn.
2. Bấm phát. Nghe H, sau đó chuyển A trên cùng bản thu và cùng đoạn. A là ADTOF
   ngoại tuyến; không phải phiên live L1. Trên bản thu này, phát lại L0/L1 từ
   cùng activation cho cùng danh sách đề xuất, nhưng thời điểm quyết định khác.
3. Để so sánh qua controller sản phẩm, dùng [Kora Music](http://127.0.0.1:1420/music),
   bật **Beat Grid Hybrid — Beta**, chọn đúng bản thu và nghe cùng đoạn.
   Lab và sản phẩm có đường hiển thị khác nhau; Lab tốt không tự chứng minh
   controller sản phẩm tốt.

## YouTube trong Brave

Chỉ dùng nguồn mà bạn được phép phân tích. Không dùng bản extension chẩn đoán
trong `scratch/matched-track-quality-gap/extension` với tab nhà cung cấp.

1. Kiểm tra Companion Private **0.3.25** trong trang quản lý extension của Brave.
   Mở đúng bản thu YouTube, chọn nguồn đó trong Kora và bấm biểu tượng Companion
   trên tab nguồn khi cần cấp quyền capture.
2. Trong **Private candidate → Live preview**, chọn **L1**. Chỉ đánh dấu ba xác
   nhận nếu đúng với bạn, rồi bật **Enable live preview (no audio delay)**.
3. Kiểm tra riêng: nguồn đang phát và nghe được, capture healthy, clock tiến,
   inference có hoạt động, preview bật, và trạng thái runtime/capability báo
   **L1 / early-finalization**. Chỉ thấy L1 trong dropdown là chưa đủ.
   Giữ intentional audio delay tắt. Nếu runtime vẫn báo L0, ghi lại thay vì
   coi đó là phép thử L1.
4. Nghe từ 0:20. Với mỗi đoạn, ghi: Hat thiếu/chậm/nháy thừa/không chắc; Kick và
   Snare có chậm không; chuỗi Hat nhanh có phân biệt được không. Ghi thời gian
   gần đúng và cảm nhận so với H0; không cần bấm mốc onset chính xác.
5. Sau khi đổi nguồn, seek hoặc tạm dừng làm phiên preview bị thu hồi, kiểm tra
   lại trạng thái trước khi tiếp tục. Có thể tắt preview và trở về L0 mặc định.
   Quyền và giới hạn hiện có của Spotify/Apple Music được giữ nguyên.

Không có xác nhận phiên YouTube L1 mới chạy thành công trong đợt này. PCM
YouTube và trạng thái runtime của lần nghe trước vẫn chưa được xác minh độc lập.
Không quy đổi các nhận xét trên thành Precision/Recall/F1.

[Báo cáo kỹ thuật và giới hạn bằng chứng](../reports/engineering-261019-1753-matched-track-quality-gap.md).
