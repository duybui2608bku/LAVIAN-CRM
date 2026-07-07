"use server";

import { redirect } from "next/navigation";

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

/** Đăng xuất (dùng làm form action). */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
