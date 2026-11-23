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

/** Gọi Claude trả JSON theo `schema` (lỗi API → AppError tiếng Việt). */
async function askClaude<T>(system: string, content: string, schema: Record<string, unknown>, what: string): Promise<{ out: T; model: string }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new AppError("Thiếu ANTHROPIC_API_KEY — điền vào biến môi trường của server.");
  try {
    const res = await new Anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      // Model từ chối (an toàn) → API tự chạy lại trên model dự phòng trong cùng request.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content }],
    });
    if (res.stop_reason === "refusal") throw new AppError(`AI từ chối ${what}.`);
    if (res.stop_reason === "max_tokens") throw new AppError("AI trả về quá dài — thử lại.");
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return { out: JSON.parse(text) as T, model: res.model };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new AppError("ANTHROPIC_API_KEY sai hoặc đã bị thu hồi.");
    if (error instanceof Anthropic.RateLimitError) throw new AppError("AI đang quá tải — thử lại sau ít phút.");
    throw error;
  }
}

/** Chỉ giữ các mục AI có nội dung (thiếu 1 ngôn ngữ → lấy ngôn ngữ kia). */
function filledPortrait(raw: Record<PortraitField, Bilingual>) {
  const portrait: Partial<Record<PortraitField, Bilingual>> = {};
  for (const f of PORTRAIT_FIELDS) {
    const vi = raw[f]?.vi.trim().slice(0, 1000) ?? "";
    const en = raw[f]?.en.trim().slice(0, 1000) ?? "";
    if (vi || en) portrait[f] = { vi: vi || en, en: en || vi };
  }
  return portrait;
}

/** Gọi Claude tóm tắt `messages` (cũ → mới) → cột của `customer_chat_summaries` + chân dung (chỉ các mục có nội dung). */
export async function summarizeMessages(messages: ChatMessage[]) {
  if (!messages.length) throw new AppError("Khách chưa có tin nhắn để tóm tắt.");
  const content = ["<chat>", ...messages.map(transcriptLine), "</chat>"].join("\n");
  const { out, model } = await askClaude<Output>(SYSTEM, content, SCHEMA, "tóm tắt hội thoại này");
  const summary = out.summary_vi.trim() || out.summary_en.trim();
  if (!summary) throw new AppError("AI không trả về nội dung tóm tắt — thử lại.");
  return {
    summary: {
      summary: summary.slice(0, 8000),
      summary_en: out.summary_en.trim().slice(0, 8000) || null,
      last_message_at: messages.at(-1)!.at,
      message_count: messages.length,
      model,
      created_at: new Date().toISOString(),
    },
    portrait: filledPortrait(out.portrait),
  };
}

const DETECT_SYSTEM = `You maintain a customer profile for Lavian Beauty Center, a beauty clinic in Indonesia (brow, lip and eyeliner embroidery and similar services). A staff member wrote a free-form note about the customer (in any language). Decide which profile fields the note gives information about:
- wish: what the customer hopes to get (desired result, service, look)
- pain: worries, fears or objections (price, pain, safety, past bad experience)
- preference: preferences (style, timing, budget, staff, location)
- behavior: how they decide (quick, compares prices, asks a partner, needs photos or reviews first)
- communication: how best to talk to them (language, tone, short or detailed messages, best time)
- personality: personality traits
You also get the field's current value. For each field the note informs, write the new full value: keep current details that are still true, add what the note says, drop what it contradicts. One short phrase or sentence, under about 25 words. Write it twice: "vi" in Vietnamese, "en" in English, same meaning.
Only state what the note supports. For a field the note says nothing about, set both "vi" and "en" to "".`;

const DETECT_SCHEMA = SCHEMA.properties.portrait;

/** AI đọc ghi chú thô của nhân viên → giá trị mới (đã gộp với `current`) cho các mục ghi chú nói tới. */
export async function detectPortrait(note: string, current: Partial<Record<PortraitField, string>>) {
  const content = [
    "<current_profile>", ...PORTRAIT_FIELDS.map((f) => `${f}: ${current[f] ?? "(empty)"}`), "</current_profile>",
    "<note>", note, "</note>",
  ].join("\n");
  const { out } = await askClaude<Record<PortraitField, Bilingual>>(DETECT_SYSTEM, content, DETECT_SCHEMA, "phân tích ghi chú này");
  return filledPortrait(out);
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
