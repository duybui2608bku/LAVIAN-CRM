"use client";

import { Fragment } from "react";
import { Image } from "antd";
import { Paperclip } from "lucide-react";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/smax-messages";

/** Bong bóng chat SMAX (cũ → mới): khách bên trái, Lavian bên phải, vạch ngày. Mount là cuộn xuống tin mới nhất. */
export function ChatBubbles({ messages, className }: { messages: ChatMessage[]; className?: string }) {
  const t = useTranslations("appointments");
  return <Image.PreviewGroup>
    <div ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
      className={cn("max-h-[65vh] space-y-1.5 overflow-y-auto bg-muted px-4 py-3", className)}>
      {messages.map((m, i) => {
        const day = dayjs(m.at).format("DD/MM/YYYY");
        return <Fragment key={m.id}>
          {day !== (i ? dayjs(messages[i - 1].at).format("DD/MM/YYYY") : "") &&
            <div className="py-1 text-center text-xs text-muted-foreground">{day}</div>}
          <div className={cn("flex", m.out ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[80%] space-y-1 rounded-2xl px-3 py-1.5 text-sm shadow-xs",
              m.out ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-background")}>
              {m.images.length > 0 && <div className="flex flex-wrap gap-1 pt-1">
                {m.images.map((img) => <Image key={img.src} src={img.thumb} preview={{ src: img.src }} alt=""
                  width={120} height={120} className="rounded-lg object-cover" />)}
              </div>}
              {m.files > 0 && <div className="flex items-center gap-1 italic opacity-80">
                <Paperclip className="size-3.5" />{t("attachment")}
              </div>}
              {m.text && <p className="break-words whitespace-pre-wrap">{m.text}</p>}
              <div className={cn("text-end text-[11px] tabular-nums", m.out ? "opacity-75" : "text-muted-foreground")}>
                {dayjs(m.at).format("HH:mm")}
              </div>
            </div>
          </div>
        </Fragment>;
      })}
    </div>
  </Image.PreviewGroup>;
}
