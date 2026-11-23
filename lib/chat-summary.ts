import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import { AppError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/smax-messages";
import { PORTRAIT_FIELDS, type ChatSummary, type PortraitField } from "@/types/customer-360";

/**
 * Tóm tắt AI (Claude) hội thoại SMAX — dùng chung nút "Tóm tắt bằng AI" (popup 360°) và lead-form (tự chạy khi tạo khách).
 * Trả song ngữ Việt + Anh và 6 mục Chân dung nhanh (AI điền, người dùng ghi đè được). Cùng file: tách chân dung từ ghi chú NV.
 */

/** Haiku: rẻ + nhanh, đủ cho tóm tắt / tách chân dung (không có model dự phòng khi từ chối → báo lỗi, NV thử lại). */
const MODEL = "claude-haiku-5-5";
export const SUMMARY_FIELDS = "summary,summary_en,last_message_at,message_count,created_by,created_at";

// Phần prompt dùng chung cho tóm tắt hội thoại + tách chân dung từ ghi chú.
const CLINIC = `Lavian Beauty Center is a beauty clinic in Indonesia: brow, lip and eyeliner embroidery (Sulam Alis, Lip Blush, Eyeliner…), retouches, laser removal and similar services. Its sales team reads Vietnamese or English, so every text is written in both.`;

const FIELDS_GUIDE = `Portrait fields — put each piece of information in the single field it fits best:
- wish: the result, service or look the customer wants.
- pain: worries, fears, objections or bad past experiences (pain, price too high, safety, healing time, fear it looks fake).
- preference: concrete preferences and constraints (style, colour, budget range, preferred days or times, staff, branch).
- behavior: how they decide (fast, compares prices, asks husband or family, wants before/after photos or reviews, waits for promotions).
- communication: how to talk to them (language, channel, tone, short or detailed replies, best time to contact).
- personality: personality traits.
A price worry is "pain"; a stated budget is "preference". Each value is one short phrase, at most about 25 words, about the customer in the third person, with no lead-in such as "Khách nói rằng". Only state what the input supports; never guess.`;

const BILINGUAL = `Both languages, always together:
- "vi": natural, fluent Vietnamese with full diacritics, as a Vietnamese salesperson would write it.
- "en": natural English with the same meaning and details.
- Translate from whatever language the input uses (often Indonesian or mixed); never copy one side into the other.
- Keep service names, brand names and prices exactly as written (Sulam Alis, 9D Brows, Rp 1.500.000).
- Nothing to say: both "vi" and "en" are "". Never fill only one language.`;

const SYSTEM = `You summarize a customer's chat with Lavian for its sales team. ${CLINIC}
The chat lists messages oldest first. A date line (DD/MM/YYYY) starts each day; each message is "HH:mm C: …" (C = customer) or "HH:mm L: …" (L = Lavian staff). [img×N] / [file×N] mark attachments.

summary_vi / summary_en: plain text, only these headings, each followed by terse "- " bullets (fragments, not full sentences):
1. Customer wants (services, dates)
2. Concerns / objections
3. Agreed or quoted (prices, appointments, deposits)
4. Next step for sales
Skip a heading with nothing under it. No markdown such as # or **. At most about 100 words per language.

portrait: what the chat shows about the customer.
${FIELDS_GUIDE}

${BILINGUAL}`;

const bilingual = {
  type: "object",
  properties: { vi: { type: "string" }, en: { type: "string" } },
  required: ["vi", "en"],
  additionalProperties: false,
};
const PORTRAIT_SCHEMA = {
  type: "object",
  properties: Object.fromEntries(PORTRAIT_FIELDS.map((f) => [f, bilingual])),
  required: [...PORTRAIT_FIELDS],
  additionalProperties: false,
};
const SCHEMA = {
  type: "object",
  properties: { summary_vi: { type: "string" }, summary_en: { type: "string" }, portrait: PORTRAIT_SCHEMA },
  required: ["summary_vi", "summary_en", "portrait"],
  additionalProperties: false,
};
type Bilingual = { vi: string; en: string };
type Output = { summary_vi: string; summary_en: string; portrait: Record<PortraitField, Bilingual> };

/** Hội thoại gọn cho AI (tiết kiệm token): ngày ghi 1 lần/ngày, mỗi tin "HH:mm C|L: nội dung", bỏ tin rỗng, gộp khoảng trắng. */
function transcript(messages: ChatMessage[]) {
  const lines: string[] = [];
  let day = "";
  for (const m of messages) {
    const text = m.text.replace(/\s+/g, " ").trim();
    const extra = [m.images.length && `[img×${m.images.length}]`, m.files && `[file×${m.files}]`].filter(Boolean).join(" ");
    if (!text && !extra) continue;
    const at = dayjs(m.at);
    if (at.format("DD/MM/YYYY") !== day) lines.push((day = at.format("DD/MM/YYYY")));
    lines.push(`${at.format("HH:mm")} ${m.out ? "L" : "C"}: ${[text, extra].filter(Boolean).join(" ")}`);
  }
  return lines.join("\n");
}

type Ask = { system: string; content: string; schema: Record<string, unknown>; what: string };

/** Gọi Claude trả JSON theo `schema` (lỗi API → AppError tiếng Việt). */
async function askClaude<T>({ system, content, schema, what }: Ask): Promise<{ out: T; model: string }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new AppError("Thiếu ANTHROPIC_API_KEY — điền vào biến môi trường của server.");
  try {
    const res = await new Anthropic().messages.create({
      model: MODEL,
      max_tokens: 4000, // đầu ra JSON ngắn; chặn trường hợp sinh lan man
      // Tắt thinking + effort thấp: việc tóm tắt / phân loại ngắn, không cần suy nghĩ dài → ít token đầu ra nhất.
      thinking: { type: "disabled" },
      output_config: { effort: "low", format: { type: "json_schema", schema } },
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
  const chat = transcript(messages);
  if (!chat) throw new AppError("Khách chưa có tin nhắn để tóm tắt.");
  const { out, model } = await askClaude<Output>({ system: SYSTEM, content: `<chat>\n${chat}\n</chat>`, schema: SCHEMA, what: "tóm tắt hội thoại này" });
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

const DETECT_SYSTEM = `You keep the customer portrait ("chân dung khách") for Lavian's sales team. ${CLINIC}

You get the current portrait and one new note a staff member typed. The note may be Vietnamese, English or Indonesian, often mixed, with typos, missing diacritics and chat abbreviations (kh = khách hàng, ib = nhắn tin, k / ko = không, dc = được, tv = tư vấn, bn = bao nhiêu). Its source says whether it is the customer's own words or the staff member's observation; treat both as facts about the customer. Ignore greetings, scheduling logistics and anything not about the customer.

${FIELDS_GUIDE}

For each field the note informs, write its new full value: start from the current value, keep details still true, add the new ones, and drop only what the note contradicts (the note is newer). Fields the note does not inform stay "".

${BILINGUAL}

Example. Current wish: "Muốn làm lông mày tự nhiên". Note (customer's words): "mau bibir juga tp takut sakit, budget max 2jt".
wish: vi "Muốn làm lông mày tự nhiên và làm môi", en "Wants natural brows and lip embroidery"
pain: vi "Sợ đau", en "Afraid of pain"
preference: vi "Ngân sách tối đa 2 triệu Rp", en "Budget up to Rp 2 million"
Other fields: "".`;

/** AI đọc ghi chú thô của nhân viên → giá trị mới song ngữ (đã gộp với `current`) cho các mục ghi chú nói tới. */
export async function detectPortrait(note: string, source: "customer" | "staff", current: Partial<Record<PortraitField, string>>) {
  const known = PORTRAIT_FIELDS.filter((f) => current[f]).map((f) => `${f}: ${current[f]}`);
  const content = [
    `<current_portrait>${known.length ? `\n${known.join("\n")}\n` : "(empty)"}</current_portrait>`,
    `<note source="${source === "customer" ? "customer's words" : "staff observation"}">\n${note}\n</note>`,
  ].join("\n");
  const { out } = await askClaude<Record<PortraitField, Bilingual>>(
    { system: DETECT_SYSTEM, content, schema: PORTRAIT_SCHEMA, what: "phân tích ghi chú này" });
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
