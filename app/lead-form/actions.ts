"use server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeError } from "@/lib/errors";
import type { CustomerNote } from "@/types/customer";

// Form public (anonymous) — RLS customers chỉ cho authenticated nên ghi bằng
// admin client (server-only). Validate lại toàn bộ ở đây (trust boundary);
// zod phía client chỉ để hiện lỗi đẹp.
const schema = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().regex(/^[0-9+ ().-]{8,15}$/),
  note: z.string().trim().max(1000),
  staff_id: z.uuid().or(z.literal("")), // chọn từ danh sách; "" = không chọn
  stage: z.string(), // chọn từ enum_options; sai định dạng rơi về 'new_lead'
  website: z.string(), // honeypot — bot điền là bỏ qua lặng lẽ
  source: z.string(), // từ ?source= — sai định dạng value thì rơi về 'smax'
  // Metadata SMAX (event __SM_FORM_CUSTOMER) — thiếu khi mở form ngoài iframe.
  // .catch(): metadata hỏng/quá cỡ chỉ bị bỏ, KHÔNG chặn lead; object strip key lạ.
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

// Định dạng value của enum_options (dùng cho source/platform/stage).
const VALUE_RE = /^[a-z0-9_]{1,50}$/;

export async function submitLead(input: LeadInput): Promise<{ error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Dữ liệu không hợp lệ" };
  const d = parsed.data;
  if (d.website) return {}; // honeypot: trả success giả, không insert

  const notes: CustomerNote[] = d.note
    ? [{ text: d.note, at: new Date().toISOString(), by: "Form SMAX" }]
    : [];

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("customers").insert({
      full_name: d.full_name,
      phone: d.phone,
      // Nguồn = platform SMAX (enum source đã đồng bộ) → ?source= → 'smax'.
      source: [d.platform, d.source].find((s) => VALUE_RE.test(s)) ?? "smax",
      social_name: d.social_name || null,
      picture: d.picture || null,
      tags: d.tags,
      thread: d.thread,
      stage: VALUE_RE.test(d.stage) ? d.stage : "new_lead",
      // FK -> profiles; uuid lạ (request tự chế) sẽ bị DB từ chối.
      staff_id: d.staff_id || null,
      // Ngày theo giờ VN — server UTC không lệch ngày lúc sáng sớm (bài học localDay).
      first_contact: new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
      }),
      notes,
    });
    if (error) throw error;
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}
