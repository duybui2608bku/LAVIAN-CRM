/** Dùng khi đang gõ: chỉ bỏ dấu "+", giữ nguyên phần còn lại. */
export function normalizePhone(value: string): string {
  return value.replace(/\+/g, "").trim();
}

/**
 * Chuẩn hoá số di động Indonesia khi lưu: đầu "62" → "0", thiếu "0" thì thêm,
 * nhóm 4-4-còn lại (vd 0812-1214-1243, 0811-1011-23558, 0811-9727-970).
 * Không phải số di động Indonesia (sau chuẩn hoá không có đầu số 08x hợp lệ, hoặc
 * không đủ 10–13 số) → giữ nguyên như normalizePhone.
 */
export function formatPhone(value: string): string {
  const raw = normalizePhone(value);
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("62")) d = d.slice(2);
  if (!d.startsWith("0")) d = `0${d}`;
  // Đầu số di động Indonesia: 081x/082x/083x/085x/087x/088x/089x (không có 084/086).
  if (!/^08[1235789]/.test(d) || d.length < 10 || d.length > 13) return raw;
  const mid = Math.min(4, Math.ceil((d.length - 4) / 2));
  return `${d.slice(0, 4)}-${d.slice(4, 4 + mid)}-${d.slice(4 + mid)}`;
}
