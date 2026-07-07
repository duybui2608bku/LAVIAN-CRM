/**
 * Chuyển đổi giữa chuỗi `YYYY-MM-DD` và `Date` theo GIỜ ĐỊA PHƯƠNG.
 * ponytail: dựng/đọc Date bằng thành phần local (không qua ISO/UTC) để tránh
 *           lệch 1 ngày ở các timezone âm khi người dùng chọn lịch.
 */

/** Parse `YYYY-MM-DD` → Date lúc nửa đêm local. Chuỗi rỗng/không hợp lệ → undefined. */
export function parseISODate(s?: string | null): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

/** Format Date → `YYYY-MM-DD` theo local. undefined → "". */
export function formatISODate(d?: Date | null): string {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
