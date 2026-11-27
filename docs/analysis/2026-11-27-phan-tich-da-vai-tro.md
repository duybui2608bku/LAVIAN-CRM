# Phân tích đa vai trò LAVIAN-CRM — 27/11/2026

Năm góc nhìn: **BA** (nghiệp vụ), **Tester** (lỗi, bảo mật), **PO** (giá trị sản phẩm), **TO** (kỹ thuật), **PM** (tiến độ, rủi ro). Cả năm agent chỉ đọc code. PM có chạy 2 câu SELECT chỉ đọc trên DB thật để đối chiếu.

**Cách đọc nhãn:**
- ✅ = đã kiểm lại trực tiếp trong code khi tổng hợp.
- 🗄️ = đã kiểm trên DB.
- Không có nhãn = phát hiện của agent qua đọc code, chưa kiểm lại.

---

## 1. Tóm tắt

1. **Làm nhanh nhưng không có nghiệm thu.**
   - Tháng 11 có 209 session và 347 commit, riêng tuần 47 là 118 session.
   - Trong memory-bank, cụm "chưa xem trên trình duyệt" xuất hiện hơn 140 lần.
   - Chưa có luồng nào được nhân viên thật (Telesales, Sales, Master ở Indonesia) nghiệm thu.
2. **Lỗ hổng lớn nhất là lead-form công khai.**
   - `checkLeadCustomer` và `submitLead` là server action không cần đăng nhập và dùng admin client.
   - Chỉ cần biết SĐT là đọc được tiền cọc, URL bill và Telesales phụ trách, đồng thời ghi đè được dữ liệu của khách.
3. **Có 3 bug nghiệp vụ ở thẻ và tour**, gồm huỷ thẻ, thẻ có 2 vùng và hoàn thẻ.
   - Cả ba đều nằm trong luồng mới làm từ 22/11 tới nay và chưa được test trên trình duyệt.
4. **Cùng một dữ liệu nằm ở nhiều nơi**, nên các màn hình đang ra số khác nhau:
   - Trạng thái: có 4 cơ chế.
   - Master: lưu ở 4 nơi.
   - Tiền cọc: 2 nguồn.
   - "Đặt lịch": 3 định nghĩa.
5. **Repo và DB lệch nhau** 🗄️:
   - Migration `drop_dead_finance_fields` và `customer_phone_unique` chưa chạy.
   - Bảng `enum_options` đã bị xoá khỏi DB nhưng memory-bank vẫn ghi là còn.
   - Không có sổ ghi migration nào đã chạy.
6. **Thiếu tiếng Indonesia** ✅. `i18n/config.ts` chỉ có `["en","vi"]`, thư mục `messages/` không có `id.json`. Memory-bank ghi "3 locale" là sai.

---

## 2. Bug đã xác nhận (Tester, BA)

| # | Mức | Bug | Vị trí |
|---|---|---|---|
| B1 ✅ | Cao | **Không huỷ được thẻ có tour dự kiến.** `cancelCard` đếm mọi tour chưa xoá mà không lọc `planned=false`. Thẻ bán ở Sales Management luôn sinh tour dự kiến ngay, nên lần huỷ nào cũng báo `hasTours`. | `app/(app)/cards/actions.ts:140` |
| B2 ✅ | Cao | **Thẻ có 2 vùng (mày + môi) bị khoá bước.** `confirmPlannedTour` chỉ cho chốt tour dự kiến sớm nhất của *cả thẻ*. Phần sync thì đã tách theo vùng, nhưng phần chốt lịch thì chưa. | `app/(app)/tour/actions.ts:139-143` |
| B3 ✅ | Cao | **Hoàn thẻ không gỡ tour thật đang "Chờ nhận".** RPC chỉ xoá tour `planned`, còn `claimTour` không kiểm tra thẻ đã hoàn. Hệ quả: Master vẫn nhận tour và được tính công trên thẻ đã hoàn tiền. | `20261123160000_card_code_refund_delete.sql:168`, `tour/actions.ts:40-48` |
| B4 ✅ | Cao | **Tổng tiền ở `/tour` và file Excel bị nhân theo số buổi.** Mỗi tour lấy `bill_amount` bằng giá *cả dòng thẻ*, nên dòng thẻ 3 buổi bị cộng giá 3 lần. | `components/tour/tour-view.tsx:220`, `types/tour.ts:19` |
| B5 | TB | **Trigger tự điền Master vào lịch hẹn sai trong 3 trường hợp:**<br>(a) A nhận tour, trả lại, rồi B nhận: lịch vẫn giữ A.<br>(b) Lịch bán thẻ bị điền Master của buổi Dặm 2 tháng sau.<br>(c) Dời `tour_date` hoặc chốt tour dự kiến thì trigger không chạy. | `20261127100000_tour_master_to_appointment.sql:21-38` |
| B6 | TB | **Ghim ngày làm đảo thứ tự bước.** Ghim bước k sang sau bước k+1 thì cờ ghim nhảy sang bước khác. `setPlannedTourDate` cũng không chặn ngày trong quá khứ hay ngày trước bước liền trước. | `lib/roadmap-sync.ts:33-42` |
| B7 | TB | **Stage `purchase` lẫn giữa tự động và chọn tay.** RPC bán thẻ tự đặt `purchase`, nhưng lead-form vẫn cho chọn và ghi đè mọi stage. Khách đã mua có thể bị kéo về "Đang tư vấn". | `lead-form.tsx:403`, `lead-form/actions.ts:238` |
| B8 | Thấp | Lead-form báo mọi lỗi 23505 là "trùng lịch hẹn", kể cả khi trùng SĐT hoặc trùng SMAX id. | `lead-form/actions.ts:305,320` |

## 3. Bảo mật

| # | Mức | Vấn đề |
|---|---|---|
| S1 ✅ | **Cao** | `checkLeadCustomer` (file `"use server"`, không có auth) trả về giai đoạn, tên Telesales, **tiền cọc**, URL ảnh bill và địa chỉ của bất kỳ SĐT nào. |
| S2 | **Cao** | `submitLead` ở chế độ update ghi đè được họ tên, stage, Telesales, `deposit_amount` và tạo được lịch hẹn. Mỗi lần gọi còn kích một lượt gọi Claude (tốn tiền). Chống bot chỉ có honeypot, không giới hạn tần suất. |
| S3 | **Cao** | **Ảnh B/A của tour nằm trên CDN công khai** (đi qua `/api/upload`). Ảnh B/A của lịch hẹn thì ở bucket riêng tư `ba-photos`. Như vậy ảnh mặt khách đang có 2 mức bảo mật khác nhau. |
| S4 | Cao | **RLS rộng hơn server action:**<br>- `tours_update` chỉ cần `tour.edit`, nên Master gọi REST thẳng là đổi được `technician_id` (cướp tour) hoặc đổi Loại Dặm (3%) thành Làm mới (7%).<br>- `treatment_card_items` vẫn còn grant update `refund_amount`. |
| S5 | TB | `/api/upload` không cần đăng nhập, không giới hạn tần suất, tin `file.type` do client gửi lên (lọt được SVG). |
| S6 | TB | "Ghi nhớ đăng nhập" lưu **mật khẩu dạng plaintext** trong localStorage. |
| S7 | Thấp | FB token nằm trong query string (dễ lọt vào log). `requireAdmin` không kiểm `status=active`. |

## 4. Mâu thuẫn nghiệp vụ

1. **Bốn cơ chế trạng thái chồng nhau:** `customers.stage`, `booking_confirm`, `visit_status` và `checked_in`.
   - Báo cáo Telesales đếm huỷ/đổi lịch theo `booking_confirm`, còn trang Quản lý bán hàng đếm theo `visit_status`.
   - Gỡ "đã đến" thì stage luôn về `booked`, kể cả khi trước đó khách là `deposited`.
2. **Master lưu ở 4 nơi:** `customers.technician_id` (chỉ điền lần đầu), `clinic_appointments.technician_id` (do trigger điền), `tours.technician_id` (dùng để tính công) và `appointment_performers`.
3. **Tiền cọc có 2 nguồn:**
   - `customers.deposit_amount` là 1 con số, ghi đè được và không có ngày.
   - `treatment_cards.deposit_used` được chốt cứng lúc bán.
   - Khách cọc mà không đến thì khoản cọc không vào doanh thu. Chưa có quy trình hoàn cọc khi khách chưa có thẻ.
4. **"Đặt lịch" có 3 định nghĩa:**
   - `/reports`: khách có ≥ 1 lịch hoặc stage từ booked trở lên.
   - Báo cáo Telesales: theo ngày tạo lịch.
   - Báo cáo SMAX: theo tag SMAX.
   - Ngoài ra, chỉ số "Đặt cọc" đang đếm cả khách `booked` chưa cọc.
5. **Hoa hồng Sales** tính cho `treatment_cards.created_by`, không phải `sales_id`. Huỷ thẻ thì doanh thu của các kỳ đã qua bị sửa ngược lại.
6. **Công Master** (7% Làm mới / 3% Dặm) tính trên giá *cả dòng* cho mỗi buổi, không trừ phần hoàn, không xét khách đã trả đủ chưa. Admin xem tổng có cả tour chưa xác nhận, còn màn hình của Master chỉ tính tour đã xác nhận.
7. **Phân quyền có 2 hệ song song:**
   - Ma trận `has_permission`.
   - Các luật cứng theo bộ phận: `canConfirmShowUp` chỉ cho `sales`, `canSeeFinance`/`canSeePhotos` cũng cố định. Admin đổi ma trận không ảnh hưởng tới các luật này.
   - `/documents` không có key quyền nào, ai đăng nhập cũng vào được.
8. **Thuật ngữ bị trùng nghĩa:**
   - "Tiềm năng" vừa là stage vừa là rating.
   - Tag SMAX `purchase` nghĩa là *đến cơ sở*, còn stage CRM `purchase` nghĩa là *đã mua thẻ*.
   - Code còn 24 chỗ "KTV" và 12 chỗ "CSKH", dù sếp đã chốt không dùng hai từ này.
9. **Quyết định đổi qua đổi lại:**
   - Tài chính ở lịch hẹn: thêm, bỏ, thêm lại, rồi drop.
   - Dịch vụ ở Khách hàng: bỏ, rồi thêm lại.
   - `StatusTag` đổi sang `StatusDot` rồi đổi về trong cùng ngày.
   - Người gọi khách Đến hạn: đổi từ Sales sang Telesales trong cùng ngày.

## 5. Điểm thừa và tàn dư

- **Ba cơ chế nhắc việc:**
  - `customer_reminders` + trang `/customers/reminders`: đã tắt bằng `REMINDERS_ENABLED=false`, nhưng popup 360° và chuông thông báo vẫn đọc dữ liệu này.
  - `follow_up_at` + cron.
  - `journeyDue` (trang Đến hạn).
- **Ba cách hoàn tiền:** Hoàn DV kiểu cũ (`cardMoney` vẫn tính), thanh toán âm, và Hoàn cả thẻ.
- **Năm màn báo cáo** mỗi màn định nghĩa KPI một kiểu: `/reports`, `/reports/telesales`, `/customers/smax-report`, `/marketing` và dải pipeline ở `/customers`.
- `/customers/bookings` và `/appointments` cùng đọc `clinic_appointments`, bộ lọc và cột gần như trùng nhau.
- **Tàn dư:**
  - Bucket `images`.
  - Cột `checked_in` (suy ra từ `visit_status`).
  - `customers.technician_id`.
  - Loại tour `debt` và tour không có thẻ.
  - Cột `smax_data`, trùng với `tags`/`thread`.
  - 3 cột tiền ở lịch hẹn và tour vẫn còn trên DB 🗄️.
- **OpenSpec:**
  - 87 change đang mở, trong đó 47 change đã xong 100% task nhưng chưa archive.
  - 7 change "API" từ tháng 7 không còn code tương ứng.
  - Spec chính duy nhất (`money-audit`) mô tả một bảng đã bị drop.
- **Git:** 33 nhánh local và 3 nhánh remote chưa merge.

## 6. Kỹ thuật và vận hành (TO, PM)

- **Kiểm tra tĩnh và test:**
  - tsc sạch, chỉ còn lỗi cũ trong `.next/types`.
  - eslint chỉ báo lỗi ở `.claude/skills/**`, do config chưa ignore thư mục này.
  - 126/126 test `node:test` đạt, nhưng `package.json` không có script `test`.
  - Không có CI: workflow duy nhất là xoá nhánh đã merge.
- **Tải toàn bảng rồi lọc ở client:** `customers-view.tsx:19`, `appointments/page.tsx:15`. PostgREST trả tối đa 1000 dòng, quá mốc này dữ liệu sẽ **bị cắt mà không báo**.
- **Ghi chú lưu dạng jsonb** theo kiểu đọc, nối, ghi đè, nên 2 người ghi cùng lúc sẽ mất 1 ghi chú.
- **Nguy cơ chạy lại migration cũ:**
  - Mở lại quyền: các policy `*_staff`, `*_all` và `using(true)` được tạo lại.
  - Lùi logic: các function bị định nghĩa lại nhiều lần (`log_clinic_appointment_change` ×8).
  - Có 2 cặp file trùng timestamp (`20261118120000`, `20261118140000`).
- **Gọi API ngoài** (FB, SMAX, Claude) không có timeout, retry hay cache.
  - FB token hết hạn từ 21/11.
  - `ANTHROPIC_API_KEY` ở máy dev trống, nên AI chưa từng được gọi thật.
- **Không có môi trường staging:** mọi lần "thử trong transaction rollback" đều chạy trên DB production.
- **Memory-bank đã lệch thực tế:** vẫn ghi shadcn, `window.confirm`, "SĐT không unique", dashboard đếm bảng `appointments`, 3 locale, `enum_options` còn trong DB.

## 7. Câu hỏi cần sếp chốt

1. **Trạng thái:**
   - Huỷ/đổi lịch thì lấy theo `booking_confirm` hay `visit_status`?
   - Stage có tự lùi khi huỷ lịch hoặc hoàn thẻ không?
   - Có cấm chọn tay `purchase` không?
   - Có cần lại trạng thái "Rớt" kèm lý do không?
2. **KPI:** chọn 1 định nghĩa duy nhất cho "Đặt lịch" và "Đến cơ sở". Đếm theo ngày tạo hay ngày hẹn, theo lịch hẹn hay tag SMAX?
3. **Cọc:**
   - Ghi doanh thu vào ngày nhận cọc hay ngày bán thẻ?
   - Khách cọc nhiều lần thì sao?
   - Hoàn cọc khi khách không đến thế nào?
   - Khách có nhiều thẻ thì trừ cọc vào thẻ nào?
4. **Công Master:**
   - Tính trên giá cả dòng hay giá 1 buổi?
   - Có trừ phần hoàn không? Chỉ tính khi khách đã trả đủ?
   - Chỉ tính tour đã xác nhận?
5. **Hoa hồng Sales:** tính cho người tạo thẻ, cho Sales của lịch hẹn hay cho người thu tiền? Kỳ đã chốt có được sửa không?
6. **CSKH:** có phải bộ phận riêng không? Ai gọi Đến hạn, hỏi thăm sau dịch vụ, nhận bảo hành và khiếu nại?
7. **Tiếng Indonesia:** có bắt buộc không? Ai duyệt bản dịch?
8. **Gộp màn hình:**
   - Báo cáo: rút từ 5 trang về 2 trang (Điều hành / Marketing-Telesales)?
   - Gộp Bookings với Appointments theo vai trò?
9. **Ảnh B/A:** chuyển hết ảnh tour về bucket riêng tư chứ? Có cần khách đồng ý trước khi dùng ảnh không?
10. **Khách trùng SĐT** (Lapis Legit / Lily) xử lý thế nào để chạy được migration unique?
11. **Bỏ "nhớ mật khẩu"**, chỉ nhớ email?
12. **Đóng băng tính năng mới 1–2 tuần để UAT.** Ai nghiệm thu cho từng vai trò?

---

## 8. Kế hoạch 5 sprint (bắt đầu 30/11)

> Thứ tự ưu tiên: **chặn rủi ro → nghiệm thu → chốt nghiệp vụ → dọn dẹp → mở rộng**. Đóng băng tính năng mới tới hết Sprint 3, trừ lỗi đang chặn công việc.

### Sprint 1 (30/11–4/12) — Vá bảo mật và bug nặng
| Hạng mục | Phụ trách | Nghiệm thu |
|---|---|---|
| Lead-form: `checkLeadCustomer` chỉ trả giai đoạn và Telesales (bỏ tiền cọc, bill, địa chỉ); thêm token ký cho iframe SMAX hoặc secret dùng chung; rate-limit; chế độ update chỉ chạy khi khớp `smax_customer_id` | Dev | Gọi ẩn danh không ra tiền cọc, không ghi đè được (TC04) |
| `/api/upload`: bắt buộc đăng nhập (trừ lead-form có token), kiểm MIME bằng magic bytes, chặn SVG | Dev | TC15 |
| Sửa B1 (lọc `planned`), B2 (chốt theo vùng), B3 (hoàn thẻ xoá tour Chờ nhận + guard `claimTour`), B4 (tổng tiền `/tour`: cộng mỗi dòng thẻ 1 lần, hoặc chờ sếp chốt) | Dev | TC01–TC03 + unit test |
| RLS `tours_update`: Master chỉ được sửa tour của mình và chỉ các cột ảnh/ghi chú; thu hồi grant `refund_*` ở `treatment_card_items` | Dev | TC13, TC14 |
| Bỏ lưu mật khẩu plaintext | Dev + Sếp đồng ý | — |
| Cấp FB System User token; gắn `ANTHROPIC_API_KEY` trên Vercel | Sếp / vận hành | Trang Marketing có số; AI trả kết quả thật |
| Lập **sổ migration** (file, ngày chạy, người chạy, câu SQL kiểm tra); chạy `drop_dead_finance_fields`; kiểm `fk_indexes` | Dev | Mọi migration có trạng thái rõ |

### Sprint 2 (7–11/12) — UAT đợt 1
- Dùng tài khoản thật của Telesales, Sales, Master và Leader, chạy trên cả PC và điện thoại theo kịch bản: lead SMAX → đặt lịch → đến cơ sở → bán thẻ (mày + môi) → thu tiền → tour → Master nhận → admin xác nhận → hoàn thẻ → báo cáo.
- Dùng bảng test case TC01–TC18 (báo cáo Tester) làm checklist.
- **Nghiệm thu:** checklist có chữ ký xác nhận, danh sách bug được xếp ưu tiên, tick xong khoảng 38 task "xem trên trình duyệt" trong openspec.

### Sprint 3 (14–18/12) — Sửa lỗi UAT + chốt nghiệp vụ
- Sếp trả lời 12 câu hỏi ở mục 7. Ghi các quyết định thành spec chính trong `openspec/specs/`, gồm từ điển KPI và mô hình trạng thái.
- Dùng chung 1 module KPI trong `lib/` cho mọi trang báo cáo. Nghiệm thu: số liệu khớp nhau trên cùng một khoảng ngày.
- Sửa B5–B8, dọn cặp khách trùng SĐT rồi chạy migration unique.
- **Nghiệm thu:** không còn bug mức chặn.

### Sprint 4 (21–25/12) — Dọn dẹp
- Archive các openspec đã xong; xoá `money-audit` spec, các change API zombie và nhánh cũ; đổi tên 2 migration trùng timestamp.
- Thêm file migration "dọn policy thừa" chạy sau cùng (`drop policy if exists *_staff/_all`) và ghi chú "KHÔNG CHẠY LẠI" ở các file cũ.
- **CI:** chạy tsc + eslint (ignore `.claude/**`) + `node --test` + `next build` trên PR; thêm script `test`.
- Gộp 3 cơ chế nhắc việc thành "Hàng đợi việc", hoặc xoá `customer_reminders`. Bỏ Hoàn DV kiểu cũ, `enum_options` code, bucket `images`, `smax_data`.
- Ghi chú dạng append qua RPC (`notes = notes || $1`).
- Timeout 10s cho FB/SMAX; cache ngắn cho insights.
- Viết lại mục "Trạng thái hiện tại" của memory-bank cho đúng thực tế.

### Sprint 5 (28/12–1/1) — Staging + mở rộng có kiểm soát
- Dựng staging bằng Supabase branch, hoặc project riêng kèm preview Vercel. Từ đây migration chạy trên staging trước production.
- Mở backlog mới theo thứ tự sếp duyệt, **tối đa 2 tính năng mỗi sprint**:
  1. Giao diện tiếng Indonesia (`id.json` + test đối chiếu key).
  2. CSKH sau dịch vụ v1.
  3. Trạng thái "Rớt" kèm lý do.
  4. Phân trang và lọc phía server cho customers/appointments, trước khi vượt 1000 dòng.
  5. Gom Master về 1 nguồn duy nhất.
  6. ROAS theo chiến dịch tính trên doanh thu thẻ.

### Quy trình áp dụng ngay
- **Định nghĩa "xong" (DoD).** Một việc chỉ tính là xong khi đủ tất cả:
  - tsc, eslint và test đều sạch.
  - **Đã xem trên trình duyệt (PC + điện thoại) bằng tài khoản đúng bộ phận.**
  - Migration (nếu có) đã chạy và đã ghi vào sổ.
  - Openspec đã tick đủ task và đã archive.
  - Memory-bank đã cập nhật.
- **Giới hạn WIP:** còn quá 5 mục "chưa xem" thì không mở change mới.
- **Gom PR:** mỗi tính năng 1 PR.
- **Nhịp UAT:** demo cho sếp mỗi thứ Sáu; nhân viên Indonesia test 30 phút mỗi thứ Hai.
- **Yêu cầu mới:** đi qua `openspec propose`, không làm ngay trong ngày (trừ lỗi đang chặn công việc).
