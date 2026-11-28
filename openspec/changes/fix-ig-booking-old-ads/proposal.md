## Why

Bảng chiến dịch `/marketing` rơi booking / KH tiềm năng / đến cơ sở của khách IG khi `ad_id` của hội thoại thuộc quảng cáo **không chạy trong khoảng ngày đang xem** (vd khách bấm QC tháng trước, tháng này mới gắn tag booking, QC đã tắt). Nguyên nhân: map `ad_id → campaign_id` chỉ lấy từ insights `level=ad` cùng khoảng ngày. Khách vẫn nằm trong tổng nhưng không vào dòng chiến dịch nào → số theo camp thấp hơn thực tế.

## What Changes

- Sau khi có map insights, gom các `ad_id` IG (hội thoại + khách) chưa khớp của người có tag tiềm năng, tra thẳng Graph API `GET /{ad_id}?fields=campaign_id` (song song tối đa 10; không cần biết tài khoản hay trạng thái QC) rồi ghép thêm vào map trước `countPotential`.
- Kết quả tra cache trong bộ nhớ server (ad → campaign không bao giờ đổi).
- Best-effort: tra lỗi thì log, phễu vẫn chạy với map cũ (không làm hỏng cột).
- Chiến dịch tìm được nhưng không có số liệu trong kỳ thì không có dòng trong bảng (bảng chỉ liệt kê camp có hiển thị trong kỳ) — giữ nguyên, ngoài phạm vi.

## Impact

- `lib/marketing.ts` (hàm mới `fetchFbAdCampaignsByIds`), `lib/smax-inbox.ts` (helper `igAdIds`), `app/(app)/marketing/actions.ts` (`fetchPotential`), test.
- Không đổi DB, không đổi UI.
