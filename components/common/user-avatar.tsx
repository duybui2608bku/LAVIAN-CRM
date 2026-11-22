import { Avatar } from "antd";

import avatarFallback from "@/app/assets/avt.webp";
import { DASH } from "@/components/common/cells";
import { TELESALES_DEPARTMENTS } from "@/types/user";

export type StaffRef = {
  id: string;
  user_name: string;
  avatar_url: string | null;
  department?: string | null;
  status?: string | null;
};

/** Avatar tròn, fallback ảnh mặc định. */
export function UserAvatar({
  src,
  size = 20,
}: {
  src?: string | null;
  size?: number;
}) {
  return (
    <Avatar
      src={src || avatarFallback.src}
      size={size}
      className="shrink-0"
      alt=""
    />
  );
}

/** Avatar + tên — dùng cho cell bảng lẫn option trong Select nhân viên. Không có người → "—". */
export function staffLabel(s?: StaffRef | null, size = 20) {
  if (!s) return DASH;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <UserAvatar src={s.avatar_url} size={size} />
      <span className="truncate">{s.user_name || "—"}</span>
    </span>
  );
}

/** Tra id → avatar + tên (hoặc "—"). */
export const staffName = (staff: StaffRef[], id?: string | null) => staffLabel(id ? staff.find((s) => s.id === id) : undefined);

/**
 * Option chọn nhân viên: user chưa bị khoá thuộc bộ phận `depts` (mặc định Telesales) + người đang gán
 * (để vẫn hiển thị khi đã đổi bộ phận / bị khoá). `title` = tên → dùng `showSearch={{ optionFilterProp: "title" }}`
 * (label là avatar + tên dạng ReactNode, lọc theo label không ra ai).
 */
export const staffOptions = (staff: StaffRef[], current?: string | null, depts: readonly string[] = TELESALES_DEPARTMENTS) =>
  staff
    .filter((s) => s.id === current || (s.status !== "banned" && depts.includes(s.department ?? "")))
    .map((s) => ({ value: s.id, label: staffLabel(s), title: s.user_name }));
