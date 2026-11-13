"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeError } from "@/lib/errors";
import { effectivePermissions } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { DEPARTMENTS, type UserDepartment, type UserRole, type UserStatus } from "@/types/user";

type Result = { error?: string };

/** Admin tạo user mới (đặt mật khẩu trực tiếp, xác nhận email sẵn). */
export async function createUser(input: {
  email: string;
  password: string;
  user_name: string;
  avatar_url?: string;
  role: UserRole;
  department?: UserDepartment | null;
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

    // Trigger đã tạo profiles (role=user, chưa bộ phận); cập nhật nếu được chọn.
    const patch: { role?: UserRole; department?: UserDepartment } = {};
    if (input.role === "admin") patch.role = "admin";
    if (input.department) patch.department = input.department;
    if (Object.keys(patch).length > 0 && data.user) {
      const { error: upErr } = await admin
        .from("profiles")
        .update(patch)
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

/** Admin gán / gỡ bộ phận cho user (null = bỏ gán). */
export async function setUserDepartment(
  id: string,
  department: UserDepartment | null,
): Promise<Result> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ department })
      .eq("id", id);
    if (error) throw error;

    revalidatePath("/users");
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Admin đổi avatar user (click avatar ở bảng /users). */
export async function setUserAvatar(
  id: string,
  avatar_url: string,
): Promise<Result> {
  try {
    await requireAdmin();
    const { error } = await createAdminClient()
      .from("profiles")
      .update({ avatar_url })
      .eq("id", id);
    if (error) throw error;

    // Avatar hiện ở shell + mọi bảng có cột nhân viên.
    revalidatePath("/", "layout");
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

/** Admin lưu quyền của các bộ phận (key lạ bị bỏ). Đổi quyền ảnh hưởng menu → revalidate cả layout. */
export async function saveDepartmentPermissions(
  input: Partial<Record<UserDepartment, string[]>>,
): Promise<Result> {
  try {
    await requireAdmin();
    const db = await createClient();
    const results = await Promise.all(
      DEPARTMENTS.filter((d) => input[d]).map((department) =>
        db
          .from("department_permissions")
          .update({ permissions: effectivePermissions(null, input[department]) })
          .eq("department", department),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}
