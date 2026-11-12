"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Đăng nhập bằng email + mật khẩu. Trả về lỗi chung, thành công thì redirect. */
export async function signIn(input: {
  email: string;
  password: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  // Lỗi chung để không lộ email nào tồn tại. Proxy sẽ chặn nếu tài khoản banned.
  if (error) {
    // ponytail: chỉ lộ lỗi thật khi dev để chẩn đoán; prod vẫn dùng câu chung.
    if (process.env.NODE_ENV === "development") {
      console.error("[signIn] Supabase auth error:", error.status, error.message);
      return { error: `[dev] ${error.status ?? ""} ${error.message}`.trim() };
    }
    return { error: "Email hoặc mật khẩu không đúng." };
  }

  redirect("/");
}

/**
 * Huỷ phiên, KHÔNG redirect: client tự tải lại cứng `/login` để xoá sạch modal,
 * menu và cache của phiên cũ (redirect trong action làm Promise không bao giờ
 * resolve → modal xác nhận treo lại trên trang login).
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

/** Đăng xuất dùng làm form action (trang `/banned`). */
export async function signOutAndRedirect() {
  await signOut();
  redirect("/login");
}

/**
 * User tự đổi tên hiển thị + avatar của mình. profiles chỉ admin ghi được (RLS)
 * nên ghi bằng admin client, khoá cứng `id` = người đang đăng nhập và chỉ 2 cột này.
 */
export async function updateMyProfile(input: {
  user_name: string;
  avatar_url: string | null;
}): Promise<{ error?: string }> {
  try {
    const me = await getCurrentProfile();
    if (!me) return { error: "Bạn cần đăng nhập." };
    const user_name = input.user_name.trim();
    if (!user_name) return { error: "Vui lòng nhập tên." };

    const { error } = await createAdminClient()
      .from("profiles")
      .update({ user_name, avatar_url: input.avatar_url || null })
      .eq("id", me.id);
    if (error) throw error;

    // Tên/avatar hiện ở shell + mọi bảng có cột nhân viên.
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}
