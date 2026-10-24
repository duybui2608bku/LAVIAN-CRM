import type { MessageInstance } from "antd/es/message/interface";

/**
 * Thông báo nhanh toàn app — chữ ký giữ như sonner cũ (`toast.success(msg)`).
 * Chạy trên `App.useApp().message` để ăn theme/dark mode của ConfigProvider;
 * instance được gắn bởi `<ToastBridge />` trong AntdProvider.
 */
let api: MessageInstance | null = null;

export function bindToast(instance: MessageInstance) {
  api = instance;
}

type Content = React.ReactNode;

export const toast = {
  success: (content: Content) => void api?.success(content),
  error: (content: Content) => void api?.error(content),
  info: (content: Content) => void api?.info(content),
  warning: (content: Content) => void api?.warning(content),
};
