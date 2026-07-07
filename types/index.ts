export type { Locale } from "@/i18n/config";

/**
 * Dạng lỗi tuần tự hoá được để truyền qua ranh giới server → client
 * (instance `AppError` mất field khi serialize).
 */
export interface AppErrorShape {
  message: string;
  code: string;
  status?: number;
}
