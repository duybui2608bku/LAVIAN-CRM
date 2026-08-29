## ADDED Requirements

### Requirement: Một shell trang duy nhất
Mọi trang trong `app/(app)/` SHALL dựng bằng `<Page>` + `<PageHeader>` của `components/layout/page.tsx`. `PageHeader` SHALL nhận `title`, `description` (tuỳ chọn) và `actions` (tuỳ chọn). Tiêu đề trang SHALL là `text-xl font-semibold tracking-tight` — không trang nào tự đặt cỡ/độ đậm riêng.

#### Scenario: Thêm trang mới
- **WHEN** dựng một trang mới trong shell
- **THEN** trang dùng `<Page>`/`<PageHeader>`, không lặp lại chuỗi `flex flex-1 flex-col gap-5 p-4 sm:p-6` hay tự viết thẻ `<h1>`

#### Scenario: Trang có nút thao tác
- **WHEN** trang cần nút ở đầu trang (Tạo mới, Tải lại…)
- **THEN** nút truyền qua prop `actions`, canh phải cùng hàng với tiêu đề, xuống dòng dưới tiêu đề trên màn hình hẹp

### Requirement: Một loại mặt phẳng (surface)
Mọi khối nội dung có viền (bảng, card số liệu, khung biểu đồ) SHALL dùng utility `surface` — viền 1px `--border`, nền `--card`, bo `--radius-xl`, **không đổ bóng**. Các khối này SHALL KHÔNG có hiệu ứng `hover` thay đổi bóng/độ nâng trừ khi bản thân khối là phần tử bấm được.

#### Scenario: Card số liệu trên dashboard
- **WHEN** rê chuột lên một card số liệu không bấm được
- **THEN** card không đổi bóng, không nhấc lên

### Requirement: Thang chữ và màu ngữ nghĩa
Giao diện SHALL chỉ dùng cỡ chữ trong thang Tailwind (`text-xs` … `text-2xl`) — không dùng cỡ tuỳ ý dạng `text-[13px]`. Số liệu SHALL dùng `font-semibold tabular-nums`. Màu SHALL lấy từ token dự án (`--success`, `--destructive`, `--info`, `--warning`, `--chart-*`) — không dùng bảng màu Tailwind cứng (`emerald-600`, `red-600`, `purple-100`…). Màu SHALL chỉ dùng để mang nghĩa (trạng thái, tăng/giảm, tag danh mục), không dùng để trang trí.

#### Scenario: Chỉ số tăng trưởng
- **WHEN** một chỉ số tăng so với kỳ trước
- **THEN** hiển thị bằng `--success`; khi giảm dùng `--destructive`; cả hai kèm mũi tên và dấu, không nhận biết chỉ bằng màu

#### Scenario: Card số liệu
- **WHEN** render bất kỳ card số liệu nào trên dashboard
- **THEN** dùng chung một component với một bố cục duy nhất (nhãn → giá trị → biến động), không có ô icon tô màu thuần trang trí

### Requirement: Chiều cao control đồng nhất
Mọi control trong thanh lọc (ô tìm kiếm, select, multi-select, chọn ngày) SHALL cao `h-8`. Ô nhập nhiều dòng SHALL dùng `components/ui/textarea.tsx` — không khai báo lại chuỗi class field trong từng file.

#### Scenario: Thanh lọc trang khách hàng
- **WHEN** xem thanh lọc `/customers`
- **THEN** ô tìm kiếm, các select và ô chọn khoảng ngày cùng chiều cao, chân cùng đường thẳng

### Requirement: Xác nhận xoá bằng AlertDialog
Mọi thao tác xoá SHALL xác nhận bằng `AlertDialog` của dự án. Giao diện SHALL KHÔNG dùng `window.confirm()`.

#### Scenario: Xoá một dịch vụ hoặc một danh mục
- **WHEN** bấm nút xoá ở `/services` hoặc `/enums/[kind]`
- **THEN** hiện `AlertDialog` cùng kiểu với `/customers`, không hiện hộp thoại mặc định của trình duyệt

### Requirement: Một kiểu thao tác trên dòng bảng
Các thao tác phụ của một dòng bảng SHALL gom vào menu `RowActions` dùng chung (`components/common/row-actions.tsx`). `/customers` và `/appointments` SHALL dùng cùng component này.

#### Scenario: Dòng lịch hẹn
- **WHEN** xem một dòng ở `/appointments`
- **THEN** các thao tác phụ (upsale, thanh toán, sửa, xoá) nằm trong menu 3 chấm giống `/customers`, chỉ thao tác chuyển trạng thái nhanh còn hiện ngoài
