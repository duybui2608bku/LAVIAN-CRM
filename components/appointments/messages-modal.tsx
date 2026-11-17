"use client";

import { Fragment } from "react";
import { Alert, Button, Empty, Image, Modal, Spin } from "antd";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Paperclip } from "lucide-react";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { getCustomerMessages } from "@/app/(app)/appointments/actions";
import { cn } from "@/lib/utils";

/** Modal xem nhanh các tin SMAX gần nhất với khách (MESSAGE_LIMIT): khách bên trái, Lavian bên phải, cũ → mới. */
export function MessagesModal({ customer, onClose }: {
  customer: { id: string; full_name: string; thread_link?: string | null } | null;
  onClose: () => void;
}) {
  const t = useTranslations("appointments");
  const id = customer?.id;
  const { data, error, isPending } = useQuery({
    queryKey: ["smax-messages", id],
    enabled: !!id,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await getCustomerMessages(id!);
      if (res.error) throw new Error(res.error);
      return res.messages ?? [];
    },
  });

  return <Modal open={!!customer} onCancel={onClose} footer={null} width={800}
    title={<div className="flex items-center gap-3 pe-8">
      <div className="min-w-0 flex-1 truncate">{t("messagesTitle", { name: customer?.full_name ?? "" })}</div>
      {customer?.thread_link && <Button size="small" type="link" href={customer.thread_link} target="_blank" rel="noreferrer"
        icon={<ExternalLink className="size-3.5" />} iconPlacement="end">{t("openSmax")}</Button>}
    </div>}>
    {isPending ? <div className="flex h-60 items-center justify-center"><Spin /></div>
      : error ? <Alert type="error" showIcon title={error.message} />
      : !data.length ? <Empty className="py-10" description={t("noMessages")} />
      : <Image.PreviewGroup>
        {/* Mở modal là cuộn xuống tin mới nhất. */}
        <div ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
          className="-mx-6 max-h-[65vh] space-y-1.5 overflow-y-auto bg-muted px-4 py-3">
          {data.map((m, i) => {
            const day = dayjs(m.at).format("DD/MM/YYYY");
            return <Fragment key={m.id}>
              {day !== (i ? dayjs(data[i - 1].at).format("DD/MM/YYYY") : "") &&
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
      </Image.PreviewGroup>}
  </Modal>;
}
