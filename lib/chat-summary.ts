import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import dayjs from "dayjs";
import { AppError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/smax-messages";

/** Tóm tắt AI (Claude) hội thoại SMAX — dùng chung nút "Tóm tắt bằng AI" (popup 360°) và lead-form (tự chạy khi tạo khách). */

const MODEL = "claude-opus-5-5";
const LANGUAGES: Record<string, string> = { vi: "Vietnamese", en: "English", id: "Indonesian" };
const SYSTEM = `You summarize a customer's chat with Lavian Beauty Center, a beauty clinic in Indonesia (brow, lip and eyeliner embroidery and similar services), for the clinic's sales team.
Each message is labeled "Customer" or "Lavian" with its date and time.
Write plain text in short sections, each a heading line followed by "- " bullets:
1. What the customer wants (services, preferred dates)
2. Concerns or objections
3. What was agreed or quoted (prices, appointments, deposits)
4. Suggested next step for the sales team
Only state what the chat supports and skip a section that has nothing. No markdown symbols such as # or **. Keep it under about 150 words.`;

const transcriptLine = (m: ChatMessage) => {
  const extra = [m.images.length && `[${m.images.length} image(s)]`, m.files && `[${m.files} attachment(s)]`].filter(Boolean).join(" ");
  return `[${dayjs(m.at).format("DD/MM/YYYY HH:mm")}] ${m.out ? "Lavian" : "Customer"}: ${[m.text, extra].filter(Boolean).join(" ")}`;
};

/** Gọi Claude tóm tắt `messages` (cũ → mới) → các cột của `customer_chat_summaries` (trừ customer_id / created_by). */
export async function summarizeMessages(messages: ChatMessage[], locale: string) {
  if (!process.env.ANTHROPIC_API_KEY) throw new AppError("Thiếu ANTHROPIC_API_KEY — điền vào biến môi trường của server.");
  if (!messages.length) throw new AppError("Khách chưa có tin nhắn để tóm tắt.");
  try {
    const res = await new Anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "low" },
      // Model từ chối (an toàn) → API tự chạy lại trên model dự phòng trong cùng request.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: [
        `Write the summary in ${LANGUAGES[locale] ?? "Vietnamese"}.`, "", "<chat>", ...messages.map(transcriptLine), "</chat>",
      ].join("\n") }],
    });
    if (res.stop_reason === "refusal") throw new AppError("AI từ chối tóm tắt hội thoại này.");
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
    if (!text) throw new AppError("AI không trả về nội dung tóm tắt — thử lại.");
    return {
      summary: text.slice(0, 8000),
      last_message_at: messages.at(-1)!.at,
      message_count: messages.length,
      model: res.model,
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new AppError("ANTHROPIC_API_KEY sai hoặc đã bị thu hồi.");
    if (error instanceof Anthropic.RateLimitError) throw new AppError("AI đang quá tải — thử lại sau ít phút.");
    throw error;
  }
}
