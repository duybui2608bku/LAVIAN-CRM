import { Avatar } from "antd";

import avatarFallback from "@/app/assets/avt.webp";

export type StaffRef = {
  id: string;
  user_name: string;
  avatar_url: string | null;
  department?: string | null;
  status?: "active" | "banned";
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

/** Avatar + tên — dùng cho cell bảng lẫn option trong Select nhân viên. */
export function staffLabel(s: StaffRef) {
  return (
    <span className="flex items-center gap-1.5">
      <UserAvatar src={s.avatar_url} />
      {s.user_name || "—"}
    </span>
  );
}
