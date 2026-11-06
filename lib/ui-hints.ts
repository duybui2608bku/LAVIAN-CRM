// Gợi ý giao diện server đọc được trước khi client mount (chống nháy theme / nhảy layout).
// File này import được cả ở client — phần đọc cookie/header nằm ở `app/layout.tsx`.

/** Cookie `AntdProvider` ghi theme đã áp dụng (`dark` | `light`) — next-themes chỉ lưu localStorage. */
export const THEME_COOKIE = "theme-resolved";

/** Màu nền app (khớp `--background` trong globals.css) cho thanh trạng thái điện thoại. */
export const THEME_BG = { light: "#f7f7f9", dark: "#0f0f12" } as const;

export type UiHints = {
  /** `true`/`false` khi đã có cookie; `undefined` = chưa biết (lần đầu). */
  dark?: boolean;
  /** Đoán thiết bị cảm ứng qua User-Agent (client sửa lại bằng `pointer: coarse`). */
  touch: boolean;
  /** Đoán màn hình điện thoại qua User-Agent (client sửa lại bằng media query). */
  mobile: boolean;
};
