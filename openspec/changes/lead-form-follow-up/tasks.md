# Tasks: lead-form-follow-up

## 1. Backend

- [x] 1.1 `FOLLOW_UP_STAGES` / `isFollowUpStage`; `needsAppointment` chỉ còn Booking
- [x] 1.2 `submitLead`: stage follow-up bắt buộc `follow_up_at`, lưu vào customers, bỏ lịch hẹn
- [x] 1.3 `/customers/potential` + `convertPotentialCustomer` lấy cả `consider`
- [x] 1.4 Migration cron follow-up quét cả `consider`

## 2. Frontend

- [x] 2.1 Lead form: ô Lịch nhắc follow-up thay Ngày hẹn + Nhóm DV khi Tiềm năng / Cân nhắc
- [x] 2.2 Tag "Cân nhắc" ở trang Khách tiềm năng

## 3. Kiểm chứng

- [x] 3.1 tsc + eslint sạch; DB không có lịch hẹn tạo nhầm cho khách Tiềm năng / Cân nhắc
- [x] 3.2 Chạy migration trên Supabase (Lavian, 2026-11-18)
- [ ] 3.3 Test tay lead form trong Smax
