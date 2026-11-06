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
  children,
}: {
  open: boolean;
  title: React.ReactNode;
  submitText?: string;
  pending?: boolean;
  width?: number;
  onSubmit: () => void;
  onClose: () => void;
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
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={pending}>
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
