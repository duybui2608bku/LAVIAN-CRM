"use client";

import { Button, Drawer, Grid } from "antd";
import { useTranslations } from "next-intl";

/**
 * Khung chung cho mọi form tạo/sửa bản ghi: Drawer bên phải, footer canh phải
 * "Huỷ" + nút chính. Trang chỉ lo nội dung `<Form>` và gọi `onSubmit`
 * (thường là `form.submit()`). Không truyền `onSubmit` = drawer CHỈ XEM: không nút Huỷ/Lưu
 * (đóng bằng nút X), footer chỉ còn `footerExtra` nếu có.
 */
export function FormDrawer({
  open,
  title,
  submitText,
  pending,
  width = 480,
  onSubmit,
  onClose,
  footerExtra,
  beside,
  children,
}: {
  open: boolean;
  title: React.ReactNode;
  submitText?: string;
  pending?: boolean;
  width?: number;
  onSubmit?: () => void;
  onClose: () => void;
  /** Nút phụ canh trái footer (vd. Xác nhận, Trả tour). */
  footerExtra?: React.ReactNode;
  /**
   * Mở bên trái 1 drawer khác rộng `beside` px, lấp phần còn lại — drawer kia vẫn nhìn thấy (vd. thêm DV cạnh drawer thẻ).
   * Màn hình < xl: mở đè như thường. Không render lồng trong drawer kia (antd sẽ đẩy nó sang trái).
   */
  beside?: number;
  children: React.ReactNode;
}) {
  const t = useTranslations("common");
  const xl = Grid.useBreakpoint().xl;
  const side = beside && xl ? beside : 0;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      size={side ? `calc(100vw - ${side}px)` : width}
      styles={side ? { wrapper: { right: side } } : undefined}
      destroyOnHidden
      title={title}
      closable={!pending}
      mask={side ? false : { closable: !pending }}
      footer={
        onSubmit || footerExtra ? (
          // Điện thoại: nút giãn đều cho dễ chạm; ẩn "Huỷ" (header đã có nút đóng).
          <div className="flex flex-wrap items-center gap-2 max-sm:[&>*]:flex-1">
            {footerExtra}
            {onSubmit && (
              <>
                <Button className="ms-auto max-sm:hidden!" onClick={onClose} disabled={pending}>
                  {t("cancel")}
                </Button>
                <Button type="primary" loading={pending} onClick={onSubmit}>
                  {submitText ?? t("save")}
                </Button>
              </>
            )}
          </div>
        ) : null
      }
    >
      {children}
    </Drawer>
  );
}
