"use server";

import { z } from "zod";

import { normalizeError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { CUSTOMER_OPTIONS, leadSource } from "@/lib/customer-options";
import { formatPhone } from "@/lib/phone";
import type { CustomerNote } from "@/types/customer";

const schema = z.object({
  customer_id: z.string().trim().max(200),
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().transform(formatPhone).pipe(z.string().min(1)),
  note: z.string().trim().max(1000),
  staff_id: z.uuid().or(z.literal("")),
  stage: z.string(),
  website: z.string(),
  social_name: z.string().trim().max(200).catch(""),
  picture: z.string().trim().max(2000).catch(""),
  tags: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().max(200),
        alias: z.string().optional(),
        time: z.string().optional(),
      }),
    )
    .max(50)
    .catch([]),
  thread: z
    .object({
      id: z.string().optional(),
      tid: z.string().optional(),
      message: z.string().max(2000).optional(),
      link: z.string().max(2000).optional(),
    })
    .nullable()
    .catch(null),
  // Nguyên `data` của event __SM_FORM_CUSTOMER — giới hạn ~200KB, hỏng thì bỏ qua.
  smax_data: z
    .record(z.string(), z.unknown())
    .refine((v) => JSON.stringify(v).length <= 200_000)
    .nullable()
    .catch(null),
});

export type LeadInput = z.input<typeof schema>;
export type LeadMode = "create" | "update";

export type LeadCustomer = {
  stage: string;
  staff_id: string;
  staff_name: string;
};

// Khách đã có trong CRM → trả giai đoạn + CSKH hiện tại để form fill sẵn,
// tránh bấm Cập nhật đè giá trị mặc định lên dữ liệu đã đổi ở CRM.
export async function checkLeadCustomer(
  customerId: string,
): Promise<LeadCustomer | null> {
  const id = z.string().trim().min(1).max(200).safeParse(customerId);
  if (!id.success) return null;

  const { data, error } = await createAdminClient()
    .from("customers")
    .select("stage, staff_id, staff:profiles!staff_id(user_name)")
    .eq("smax_customer_id", id.data)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    stage: data.stage ?? "new_lead",
    staff_id: data.staff_id ?? "",
    // Quan hệ nhiều-1 nên PostgREST trả object (type suy ra mảng do client không typed).
    staff_name:
      (data.staff as unknown as { user_name: string } | null)?.user_name ?? "",
  };
}

export async function submitLead(
  input: LeadInput,
  mode: LeadMode,
): Promise<{ error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Dữ liệu không hợp lệ" };
  const d = parsed.data;
  if (d.website) return {};
  const notes: CustomerNote[] = d.note
    ? [{ text: d.note, at: new Date().toISOString(), by: "Form SMAX" }]
    : [];

  try {
    const supabase = createAdminClient();
    const existing = d.customer_id
      ? (await checkLeadCustomer(d.customer_id)) !== null
      : false;
    if (mode === "create" && existing) {
      return { error: "Khách hàng đã tồn tại. Chỉ được cập nhật thông tin." };
    }
    if (mode === "update" && (!d.customer_id || !existing)) {
      return { error: "Khách hàng chưa tồn tại. Hãy dùng nút Submit." };
    }

    const customer = {
      full_name: d.full_name,
      phone: d.phone,
      smax_customer_id: d.customer_id || null,
      source: leadSource(d.thread?.link), // tự tính: hội thoại WA → WA, còn lại IG
      social_name: d.social_name || null,
      picture: d.picture || null,
      tags: d.tags,
      thread: d.thread,
      // Payload hỏng/thiếu → null: không ghi đè smax_data đang có khi cập nhật.
      ...(d.smax_data ? { smax_data: d.smax_data } : {}),
      stage: CUSTOMER_OPTIONS.some((o) => o.kind === "stage" && o.value === d.stage) ? d.stage : "new_lead",
      staff_id: d.staff_id || null,
    };

    if (mode === "create") {
      const { error } = await supabase.from("customers").insert({
        ...customer,
        notes,
        // Chỉ đặt lúc tạo — cập nhật giữ ngày liên hệ đầu tiên.
        first_contact: new Date().toLocaleDateString("en-CA", {
          timeZone: "Asia/Ho_Chi_Minh",
        }),
      });
      if (error) throw error;
    } else {
      const { data: current, error: readError } = await supabase
        .from("customers")
        .select("notes")
        .eq("smax_customer_id", d.customer_id)
        .is("deleted_at", null)
        .single();
      if (readError) throw readError;

      const { error } = await supabase
        .from("customers")
        .update({
          ...customer,
          notes: notes.length ? [...(current.notes ?? []), ...notes] : current.notes,
        })
        .eq("smax_customer_id", d.customer_id)
        .is("deleted_at", null);
      if (error) throw error;
    }
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}
