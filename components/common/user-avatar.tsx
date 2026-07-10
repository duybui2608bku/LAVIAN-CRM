import avatarFallback from "@/app/assets/avt.webp";

export type StaffRef = {
  id: string;
  user_name: string;
  avatar_url: string | null;
};

/** Avatar tròn nhỏ, fallback ảnh mặc định — pattern như header. */
export function UserAvatar({ src }: { src?: string | null }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- avatar_url là host tuỳ ý, tránh cấu hình remotePatterns
    <img
      src={src || avatarFallback.src}
      alt=""
      className="size-5 shrink-0 rounded-full object-cover"
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
