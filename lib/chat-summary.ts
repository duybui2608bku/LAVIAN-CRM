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
/** Tách chân dung từ ghi chú NV: việc ngắn, nhiều lần/ngày → Haiku. */
const FAST_MODEL = "claude-haiku-5-5";
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

type Ask = { system: string; content: string; schema: Record<string, unknown>; what: string };
type Response = Awaited<ReturnType<Anthropic["messages"]["create"]>> | Awaited<ReturnType<Anthropic["beta"]["messages"]["create"]>>;

/** Gọi Claude trả JSON theo `schema` (lỗi API → AppError tiếng Việt). `fast` = Haiku (rẻ, nhanh — không có model dự phòng khi từ chối). */
async function askClaude<T>({ system, content, schema, what }: Ask, fast = false): Promise<{ out: T; model: string }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new AppError("Thiếu ANTHROPIC_API_KEY — điền vào biến môi trường của server.");
  try {
    const client = new Anthropic();
    const messages = [{ role: "user" as const, content }];
    const format = { type: "json_schema" as const, schema };
    const res: Response = fast
      ? await client.messages.create({
        model: FAST_MODEL, max_tokens: 8000, output_config: { effort: "medium", format }, system, messages,
      })
      : await client.beta.messages.create({
        model: MODEL, max_tokens: 16000, output_config: { effort: "low", format }, system, messages,
        // Model từ chối (an toàn) → API tự chạy lại trên model dự phòng trong cùng request.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
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
  const { out, model } = await askClaude<Output>({ system: SYSTEM, content, schema: SCHEMA, what: "tóm tắt hội thoại này" });
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

const DETECT_SYSTEM = `You keep the customer profile ("chân dung khách") for Lavian Beauty Center, a beauty clinic in Indonesia: brow, lip and eyeliner embroidery (Sulam Alis, Lip Blush, Eyeliner…), retouches, laser removal and similar services. The sales team is Vietnamese and Indonesian staff who read the profile in Vietnamese or English, so every value is stored in both languages.

You get the current profile and one new free-form note a staff member typed. The note may be in Vietnamese, English or Indonesian, often mixed, with typos, missing diacritics and chat abbreviations (kh / khach = khách hàng, ib = nhắn tin, k / ko = không, dc = được, tv = tư vấn, bn = bao nhiêu). The note's source says whether these are the customer's own words or the staff member's own observation; treat both as facts about the customer.

Fields — put each piece of information in the single field it fits best:
- wish: the result, service or look the customer wants (e.g. natural brows, fuller lips, removing old tattoo).
- pain: worries, fears, objections or bad past experiences (pain, price too high, safety, healing time, fear it looks fake).
- preference: concrete preferences and constraints (style, colour, budget range, preferred days or times, preferred staff, branch).
- behavior: how they make the decision (decides fast, compares prices, asks husband or family first, wants before/after photos or reviews, waits for promotions).
- communication: how to talk to them (language, channel, tone, short or detailed replies, best time to contact).
- personality: personality traits (careful, cheerful, demanding, shy, easy-going…).
A price worry is "pain"; a stated budget is "preference". Skip greetings, scheduling logistics and anything that is not about the customer.

For each field the note informs, write its new full value:
- Start from the current value. Keep details that are still true, add the new ones, and drop only what the note contradicts (the note is newer and wins).
- One short phrase or sentence, at most about 25 words, about the customer in the third person, with no lead-in such as "Khách nói rằng" or "The customer said that".
- Keep service names, brand names and prices exactly as written (Sulam Alis, 9D Brows, Rp 1.500.000).
- Only state what the note or the current value supports. Do not guess or add advice.

Both languages, always together:
- "vi": natural, fluent Vietnamese with full diacritics, as a Vietnamese salesperson would write it.
- "en": natural English with the same meaning and the same details.
- Translate whatever language the note is in; never leave one side in the note's language when that is not the target language, and never copy one side into the other.
- A field the note says nothing about: both "vi" and "en" are "". A field is never filled in only one language.

Example. Current wish: "Muốn làm lông mày tự nhiên". Note (customer's words): "mau bibir juga tp takut sakit, budget max 2jt".
wish → vi "Muốn làm lông mày tự nhiên và làm môi", en "Wants natural brows and lip embroidery"
pain → vi "Sợ đau", en "Afraid of pain"
preference → vi "Ngân sách tối đa 2 triệu Rp", en "Budget up to Rp 2 million"
All other fields → "".`;

const DETECT_SCHEMA = SCHEMA.properties.portrait;

/** AI đọc ghi chú thô của nhân viên → giá trị mới song ngữ (đã gộp với `current`) cho các mục ghi chú nói tới. */
export async function detectPortrait(note: string, source: "customer" | "staff", current: Partial<Record<PortraitField, string>>) {
  const content = [
    "<current_profile>", ...PORTRAIT_FIELDS.map((f) => `${f}: ${current[f] || "(empty)"}`), "</current_profile>",
    `<note source="${source === "customer" ? "customer's own words" : "staff observation"}">`, note, "</note>",
  ].join("\n");
  const { out } = await askClaude<Record<PortraitField, Bilingual>>(
    { system: DETECT_SYSTEM, content, schema: DETECT_SCHEMA, what: "phân tích ghi chú này" }, true);
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
