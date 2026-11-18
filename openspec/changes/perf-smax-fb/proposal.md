## Why

Rà toàn bộ hiệu năng (DB, server action, API ngoài) — người dùng thấy Smax report / Marketing tải chậm.

Đo 2026-11-18:
- **DB không phải nút cổ chai:** bảng lớn nhất `customers` 149 dòng; query app trung bình < 16 ms (`pg_stat_statements`); advisor không báo RLS initplan. Auth đã dùng `getClaims()` + `cache()`.
- **Chậm nằm ở API SMAX / FB:** Smax report 1 ngày ~1,4–1,8 s, 1 tuần ~3,3 s, 18 ngày ~3,8 s.
  - Tải 2 lượt hội thoại: "tạo trong kỳ" và "có tin nhắn từ đầu kỳ tới nay". Đo 3 khoảng ngày: tập 1 nằm trọn trong tập 2 (90/90, 1681/1681, 1678/1678) — vì tin nhắn cuối luôn ≥ lúc tạo.
  - IG lùi 30 ngày (gộp IG ↔ WA) ~1,2–1,4 s, gọi lại y hệt mỗi lần tải; quét tin nhắn khách IG thiếu SĐT cũng lặp lại.
  - FB `fetchFbCampaigns`: lấy trạng thái chiến dịch CHỜ xong insights rồi mới gọi (2 vòng tuần tự).

## What Changes

1. **Smax report 1 lượt tải:** "khách mới" lọc từ tập "có tin nhắn" theo `created_at` (`createdIn`), bỏ lượt `byCreated` — giảm ~½ số request SMAX (cũng bớt nguy cơ SMAX 502 khi 16 luồng).
2. **Cache trong bộ nhớ server 30 phút** cho IG lùi 30 ngày (theo `from`, dùng chung Smax report + Marketing, gộp request trùng đang chạy) và kết quả quét SĐT theo hội thoại.
3. **FB:** insights + trạng thái chiến dịch gọi song song.
4. **Index:** thêm index cho 5 khoá ngoại advisor báo thiếu (`clinic_appointments.sales_id/created_by`, `tours.created_by/confirmed_by`, `profiles.department`) — rẻ, phòng khi dữ liệu lớn. KHÔNG xoá 11 index "chưa dùng" (bảng còn nhỏ nên planner chọn seq scan; index vẫn cần khi lớn).

## Không làm

- Proxy vẫn đọc `profiles` mỗi request: một số action (tour, reminders, documents) dựa vào proxy + RLS để chặn quyền — bỏ đi là hở quyền.
- Không cache số liệu báo cáo (tag là trạng thái hiện tại — "Tải lại" phải ra số mới).

## Impact

- `lib/smax-inbox.ts` (`createdIn`), `lib/smax-threads.ts` (cache), `app/(app)/customers/smax-report/actions.ts`, `lib/marketing.ts`, test.
- `supabase/migrations/20261118120000_fk_indexes.sql` (chạy tay).
