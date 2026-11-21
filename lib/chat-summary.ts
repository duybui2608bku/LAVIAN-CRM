import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import { AppError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/smax-messages";
import { PORTRAIT_FIELDS, type ChatSummary, type PortraitField } from "@/types/customer-360";

/**
 * Tóm tắt AI (Claude) hội thoại SMAX — dùng chung nút "Tóm tắt bằng AI" (popup 360°) và lead-form (tự chạy khi tạo khách).
 * Trả song ngữ Việt + Anh và 6 mục Chân dung nhanh (AI điền, người dùng ghi đè được).
 */

const MODEL = "claude-opus-5-5";
export const SUMMARY_FIELDS = "summary,summary_en,last_message_at,message_count,created_by,created_at";

const SYSTEM = `You summarize a customer's chat with Lavian Beauty Center, a beauty clinic in Indonesia (brow, lip and eyeliner embroidery and similar services), for the clinic's sales team. The team reads Vietnamese and English, so every text is written twice: "vi" in Vietnamese, "en" in English, with the same meaning.
Each message is labeled "Customer" or "Lavian" with its date and time.

summary_vi / summary_en: plain text in short sections, each a heading line followed by "- " bullets:
1. What the customer wants (services, preferred dates)
2. Concerns or objections
3. What was agreed or quoted (prices, appointments, deposits)
4. Suggested next step for the sales team
Skip a section that has nothing. No markdown symbols such as # or **. Keep each under about 150 words.

portrait: a quick profile of the customer, one short phrase or sentence per field (under about 25 words):
- wish: what the customer hopes to get (desired result, service, look)
- pain: worries, fears or objections (price, pain, safety, past bad experience)
- preference: preferences (style, timing, budget, staff, location)
- behavior: how they decide (quick, compares prices, asks a partner, needs photos or reviews first)
- communication: how best to talk to them (language, tone, short or detailed messages, best time)
- personality: personality traits the chat shows
Only state what the chat supports. When the chat says nothing about a field, set both its "vi" and "en" to "".`;

const bilingual = {
  type: "object",
  properties: { vi: { type: "string" }, en: { type: "string" } },
  required: ["vi", "en"],
  additionalProperties: false,
};
const SCHEMA = {
  type: "object",
  properties: {
    summary_vi: { type: "string" },
    summary_en: { type: "string" },
    portrait: {
      type: "object",
      properties: Object.fromEntries(PORTRAIT_FIELDS.map((f) => [f, bilingual])),
      required: [...PORTRAIT_FIELDS],
      additionalProperties: false,
    },
  },
  required: ["summary_vi", "summary_en", "portrait"],
  additionalProperties: false,
};
type Bilingual = { vi: string; en: string };
type Output = { summary_vi: string; summary_en: string; portrait: Record<PortraitField, Bilingual> };

const transcriptLine = (m: ChatMessage) => {
  const extra = [m.images.length && `[${m.images.length} image(s)]`, m.files && `[${m.files} attachment(s)]`].filter(Boolean).join(" ");
  return `[${dayjs(m.at).format("DD/MM/YYYY HH:mm")}] ${m.out ? "Lavian" : "Customer"}: ${[m.text, extra].filter(Boolean).join(" ")}`;
};

/** Gọi Claude tóm tắt `messages` (cũ → mới) → cột của `customer_chat_summaries` + chân dung (chỉ các mục có nội dung). */
export async function summarizeMessages(messages: ChatMessage[]) {
  if (!process.env.ANTHROPIC_API_KEY) throw new AppError("Thiếu ANTHROPIC_API_KEY — điền vào biến môi trường của server.");
  if (!messages.length) throw new AppError("Khách chưa có tin nhắn để tóm tắt.");
  try {
    const res = await new Anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      // Model từ chối (an toàn) → API tự chạy lại trên model dự phòng trong cùng request.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: ["<chat>", ...messages.map(transcriptLine), "</chat>"].join("\n") }],
    });
    if (res.stop_reason === "refusal") throw new AppError("AI từ chối tóm tắt hội thoại này.");
    if (res.stop_reason === "max_tokens") throw new AppError("AI trả về quá dài — thử lại.");
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const out = JSON.parse(text) as Output;
    const summary = out.summary_vi.trim() || out.summary_en.trim();
    if (!summary) throw new AppError("AI không trả về nội dung tóm tắt — thử lại.");
    const portrait: Partial<Record<PortraitField, Bilingual>> = {};
    for (const f of PORTRAIT_FIELDS) {
      const vi = out.portrait[f]?.vi.trim().slice(0, 1000) ?? "";
      const en = out.portrait[f]?.en.trim().slice(0, 1000) ?? "";
      if (vi || en) portrait[f] = { vi: vi || en, en: en || vi };
    }
    return {
      summary: {
        summary: summary.slice(0, 8000),
        summary_en: out.summary_en.trim().slice(0, 8000) || null,
        last_message_at: messages.at(-1)!.at,
        message_count: messages.length,
        model: res.model,
        created_at: new Date().toISOString(),
      },
      portrait,
    };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new AppError("ANTHROPIC_API_KEY sai hoặc đã bị thu hồi.");
    if (error instanceof Anthropic.RateLimitError) throw new AppError("AI đang quá tải — thử lại sau ít phút.");
    throw error;
  }
}

/**
 * Tóm tắt rồi lưu: ghi đè bản tóm tắt (1 dòng / khách) và điền Chân dung nhanh.
 * Chân dung chỉ thêm bản AI khi mục đó chưa có gì hoặc bản mới nhất cũng là AI (và khác nội dung)
 * — bản người dùng nhập luôn thắng, tóm tắt lại không đè lên.
 */
export async function summarizeAndSave(db: SupabaseClient, customerId: string, messages: ChatMessage[], createdBy: string) {
  const { summary, portrait } = await summarizeMessages(messages);
  const { data: saved, error } = await db.from("customer_chat_summaries")
    .upsert({ customer_id: customerId, ...summary, created_by: createdBy }).select(SUMMARY_FIELDS).single();
  if (error) throw error;

  const fields = Object.keys(portrait) as PortraitField[];
  if (fields.length) {
    const { data: rows, error: readErr } = await db.from("customer_portrait_entries").select("field,text,source")
      .eq("customer_id", customerId).in("field", fields).order("created_at", { ascending: false });
    if (readErr) throw readErr;
    const latest = new Map<string, { text: string; source: string }>();
    for (const r of rows ?? []) if (!latest.has(r.field)) latest.set(r.field, r);
    const inserts = fields.filter((f) => {
      const cur = latest.get(f);
      return !cur || (cur.source === "ai" && cur.text !== portrait[f]!.vi);
    }).map((f) => ({
      customer_id: customerId, field: f, text: portrait[f]!.vi, text_en: portrait[f]!.en,
      source: "ai", message_ref: null, created_by: createdBy,
    }));
    if (inserts.length) {
      const { error: insErr } = await db.from("customer_portrait_entries").insert(inserts);
      if (insErr) throw insErr;
    }
  }
  return saved as ChatSummary;
}
