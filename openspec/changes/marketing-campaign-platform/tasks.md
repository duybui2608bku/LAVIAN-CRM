## 1. Dữ liệu
- [x] 1.1 `campaignIg(name)` trong `lib/wa.ts` + test
- [x] 1.2 `FbCampaign.accountId` (field `account_id` của insights)
- [x] 1.3 `FbCampaign.platforms` từ `adsets{destination_type}` lồng trong lệnh `/campaigns` sẵn có + `destinationPlatforms` + test

## 2. UI
- [x] 2.1 Cột Nền tảng (icon WA + số, icon IG), filter theo số WA / Instagram
- [x] 2.2 Dòng con WA / IG cho chiến dịch 2 nền tảng (phễu tách riêng)
- [x] 2.3 Tên chiến dịch → link Ads Manager (desktop + mobile)
- [x] 2.4 i18n vi/en

## 3. Phễu + chỉ số
- [x] 3.1 Cột Chi tiêu / Đặt lịch; thẻ Đặt lịch, Đến cơ sở
- [x] 3.2 `countPotential` theo lúc gắn tag; purchase chỉ là Đến cơ sở; test
- [x] 3.3 Chỉ hỏi meta (trạng thái, destination_type) của chiến dịch có số liệu (`fetchFbCampaignMeta`, lọc id IN)
