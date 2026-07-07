"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeError } from "@/lib/errors";
import type { UserRole, UserStatus } from "@/types/user";

type Result = { error?: string };

/** Admin tạo user mới (đặt mật khẩu trực tiếp, xác nhận email sẵn). */
export async function createUser(input: {
  email: string;
  password: string;
  user_name: string;
  avatar_url?: string;
  role: UserRole;
}): Promise<Result> {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const { data, error } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        user_name: input.user_name,
        avatar_url: input.avatar_url || null,
      },
    });
    if (error) throw error;

    // Trigger đã tạo profiles với role=user; nâng admin nếu được chọn.
    if (input.role === "admin" && data.user) {
      const { error: upErr } = await admin
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", data.user.id);
      if (upErr) throw upErr;
    }

    revalidatePath("/users");
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Cấm / bỏ cấm (đổi status). Không cho tự cấm chính mình. */
export async function setUserStatus(
  id: string,
  status: UserStatus,
): Promise<Result> {
  try {
    const me = await requireAdmin();
    if (id === me.id && status === "banned") {
      return { error: "Không thể tự cấm chính mình." };
    }
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ status })
      .eq("id", id);
    if (error) throw error;

    revalidatePath("/users");
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Admin đặt lại mật khẩu cho user. */
export async function resetPassword(
  id: string,
  password: string,
): Promise<Result> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) throw error;
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}
