## Why
Bảng chiến dịch trang Marketing chỉ có cột "Số WA" — không thấy chiến dịch chạy Instagram, và chiến dịch chạy cả WA + IG thì phễu KH tiềm năng bị cộng chung, không biết bên nào ra khách. Tên chiến dịch cũng không bấm sang Ads Manager được.

## What Changes
- Cột "Số WA" → **"Nền tảng"**: icon WhatsApp (kèm số WA) và/hoặc icon Instagram.
- Chiến dịch có cả WA + IG → dòng mở rộng được, bung 2 dòng con **WA** và **IG** với phễu KH tiềm năng / Đặt lịch / Đến cơ sở riêng từng bên (chi tiêu, tin nhắn… chỉ ở dòng cha — Meta không tách được theo đích vì 1 nhóm QC chạy đa đích).
- Tên chiến dịch là link mở tab mới sang Ads Manager (`act` = id tài khoản QC, `selected_campaign_ids` = id chiến dịch).

## Impact
- `lib/wa.ts` (+`campaignIg`), `lib/marketing.ts` (+`accountId`, `platforms` theo `destination_type`), `components/marketing/ads-stats.tsx`, `messages/{vi,en}.json`.
- Không đổi DB.
