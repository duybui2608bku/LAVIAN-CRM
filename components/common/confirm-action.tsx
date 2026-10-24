"use client";

import { App, Popconfirm } from "antd";

/**
 * Xác nhận thao tác nguy hiểm (xoá, cấm, đăng xuất…) bằng Popconfirm — dùng
 * chung để mọi chỗ hỏi lại cùng một kiểu. `onConfirm` trả Promise thì nút OK
 * tự quay loading tới khi xong. Cấm `window.confirm()`.
 */
export function ConfirmAction({
  title,
  description,
  okText,
  cancelText,
  danger = true,
  disabled,
  onConfirm,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
  disabled?: boolean;
  onConfirm: () => void | Promise<unknown>;
  children: React.ReactElement;
}) {
  return (
    <Popconfirm
      title={title}
      description={description}
      okText={okText}
      cancelText={cancelText}
      okButtonProps={{ danger }}
      disabled={disabled}
      onConfirm={onConfirm}
      placement="bottomRight"
    >
      {children}
    </Popconfirm>
  );
}

/**
 * Hỏi xác nhận bằng Modal (cho thao tác mở từ menu — không có nút để neo
 * Popconfirm, vd. mục "Xoá" trong RowActions). Trả Promise thì OK tự loading.
 */
export function useConfirm() {
  const { modal } = App.useApp();
  return (opts: {
    title: React.ReactNode;
    content?: React.ReactNode;
    okText?: string;
    cancelText?: string;
    onOk: () => void | Promise<unknown>;
  }) =>
    modal.confirm({ ...opts, okButtonProps: { danger: true }, centered: true });
}
