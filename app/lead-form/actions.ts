"use server";

import { z } from "zod";

import { normalizeError } from "@/lib/errors";
import { resolveSource } from "@/lib/customers";
import { createAdminClient } from "@/lib/supabase/admin";
import { CUSTOMER_OPTIONS } from "@/lib/customer-options";
import { normalizePhone } from "@/lib/phone";
import type { CustomerNote } from "@/types/customer";

const schema = z.object({
  customer_id: z.string().trim().max(200),
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().transform(normalizePhone).pipe(z.string().min(1)),
  note: z.string().trim().max(1000),
  staff_id: z.uuid().or(z.literal("")),
  stage: z.string(),
  website: z.string(),
  source: z.string(),
  platform: z.string().max(50).catch(""),
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
});

export type LeadInput = z.input<typeof schema>;
export type LeadMode = "create" | "update";

export async function checkLeadCustomer(customerId: string): Promise<boolean> {
  const id = z.string().trim().min(1).max(200).safeParse(customerId);
  if (!id.success) return false;

  const { data, error } = await createAdminClient()
    .from("customers")
    .select("id")
    .eq("smax_customer_id", id.data)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
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
      ? await checkLeadCustomer(d.customer_id)
      : false;
    if (mode === "create" && existing) {
      return { error: "Khách hàng đã tồn tại. Chỉ được cập nhật thông tin." };
    }
    if (mode === "update" && (!d.customer_id || !existing)) {
      return { error: "Khách hàng chưa tồn tại. Hãy dùng nút Submit." };
    }

    const options = CUSTOMER_OPTIONS.filter((o) => o.kind === "source");

    const customer = {
      full_name: d.full_name,
      phone: d.phone,
      smax_customer_id: d.customer_id || null,
      source: resolveSource(d.platform, options) ?? resolveSource(d.source, options) ?? "smax",
      social_name: d.social_name || null,
      picture: d.picture || null,
      tags: d.tags,
      thread: d.thread,
      stage: CUSTOMER_OPTIONS.some((o) => o.kind === "stage" && o.value === d.stage) ? d.stage : "new_lead",
      staff_id: d.staff_id || null,
      first_contact: new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
      }),
    };

    if (mode === "create") {
      const { error } = await supabase
        .from("customers")
        .insert({ ...customer, notes });
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
