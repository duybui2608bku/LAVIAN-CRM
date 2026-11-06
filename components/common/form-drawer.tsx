"use client";

import { Button, Drawer } from "antd";
import { useTranslations } from "next-intl";

/**
 * Khung chung cho mọi form tạo/sửa bản ghi: Drawer bên phải, footer canh phải
 * "Huỷ" + nút chính. Trang chỉ lo nội dung `<Form>` và gọi `onSubmit`
 * (thường là `form.submit()`).
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
  children,
}: {
  open: boolean;
  title: React.ReactNode;
  submitText?: string;
  pending?: boolean;
  width?: number;
  onSubmit: () => void;
  onClose: () => void;
  /** Nút phụ canh trái footer (vd. Xác nhận, Trả tour). */
  footerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations("common");
  return (
    <Drawer
      open={open}
      onClose={onClose}
      size={width}
      destroyOnHidden
      title={title}
      closable={!pending}
      mask={{ closable: !pending }}
      footer={
        // Điện thoại: nút giãn đều cho dễ chạm; ẩn "Huỷ" (header đã có nút đóng).
        <div className="flex flex-wrap items-center gap-2 max-sm:[&>*]:flex-1">
          {footerExtra}
          <Button className="ms-auto max-sm:hidden!" onClick={onClose} disabled={pending}>
            {t("cancel")}
          </Button>
          <Button type="primary" loading={pending} onClick={onSubmit}>
            {submitText ?? t("save")}
          </Button>
        </div>
      }
    >
      {children}
    </Drawer>
  );
}
