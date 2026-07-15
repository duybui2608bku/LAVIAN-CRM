"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeError } from "@/lib/errors";
import type { ServiceInput } from "@/types/service";

type Result = { error?: string };

export async function createService(input: ServiceInput): Promise<Result> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("services").insert(input);
    if (error) throw error;
    revalidatePath("/services");
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

export async function updateService(
  id: string,
  input: ServiceInput,
): Promise<Result> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase
      .from("services")
      .update(input)
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/services");
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

/** Xóa cứng — nhưng chặn nếu còn khách hàng đang gắn dịch vụ này (pattern deleteOption). */
export async function deleteService(id: string): Promise<Result> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    // Đếm MỌI dòng nối (kể cả khách/lịch đã soft-delete) — khớp hành vi FK restrict.
    const { count, error: cErr } = await supabase
      .from("customer_services")
      .select("customer_id", { count: "exact", head: true })
      .eq("service_id", id);
    if (cErr) throw cErr;
    if ((count ?? 0) > 0) {
      return {
        error: `Đang có ${count} khách hàng gắn dịch vụ này — hãy tắt "Kích hoạt" thay vì xóa.`,
      };
    }
    const { count: apptCount, error: aErr } = await supabase
      .from("appointment_services")
      .select("appointment_id", { count: "exact", head: true })
      .eq("service_id", id);
    if (aErr) throw aErr;
    if ((apptCount ?? 0) > 0) {
      return {
        error: `Đang có ${apptCount} lịch hẹn gắn dịch vụ này — hãy tắt "Kích hoạt" thay vì xóa.`,
      };
    }
    const { count: ledgerCount, error: lErr } = await supabase
      .from("service_ledgers")
      .select("id", { count: "exact", head: true })
      .eq("service_id", id);
    if (lErr) throw lErr;
    if ((ledgerCount ?? 0) > 0) {
      return {
        error: `Đang có ${ledgerCount} sổ tiền gắn dịch vụ này — hãy tắt "Kích hoạt" thay vì xóa.`,
      };
    }

    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/services");
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}
