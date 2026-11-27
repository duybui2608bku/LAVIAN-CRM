"use client";

import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Empty, Modal, Spin } from "antd";
import dayjs from "dayjs";
import { ExternalLink, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { getChatSummary } from "@/app/(app)/appointments/actions";
import { ChatBubbles } from "@/components/appointments/chat-bubbles";
import { StatusTag } from "@/components/common/cells";
import { useCustomerMessages } from "@/components/customers/customer-360/use-customer-messages";

export type MessagesCustomer = { id: string; full_name: string; thread_link?: string | null };

/**
 * Modal xem nhanh các tin SMAX gần nhất với khách (MESSAGE_LIMIT): khách bên trái, Lavian bên phải, cũ → mới.
 * Cột phải: bản tóm tắt AI đã lưu (tạo ở popup 360°); chưa có → empty state.
 */
export function MessagesModal({ customer, onClose }: {
  customer: MessagesCustomer | null;
  onClose: () => void;
}) {
  const t = useTranslations("appointments");
  const ta = useTranslations("c360.messages.ai");
  const locale = useLocale();
  const { data, error, isPending } = useCustomerMessages(customer?.id);
  const summary = useQuery({
    queryKey: ["chat-summary", customer?.id],
    enabled: !!customer,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await getChatSummary(customer!.id);
      if (res.error) throw new Error(res.error);
      return res.summary ?? null;
    },
  });
  const s = summary.data;
  const text = locale !== "vi" && s?.summary_en ? s.summary_en : s?.summary;
  // Có tin mới hơn tin cuối đã tóm tắt → bản tóm tắt đã cũ.
  const latestAt = data?.at(-1)?.at;
  const stale = !!(s && latestAt && (!s.last_message_at || Date.parse(latestAt) > Date.parse(s.last_message_at)));

  return <Modal open={!!customer} onCancel={onClose} footer={null} width={1080}
    title={<div className="flex items-center gap-3 pe-8">
      <div className="min-w-0 flex-1 truncate">{t("messagesTitle", { name: customer?.full_name ?? "" })}</div>
      {customer?.thread_link && <Button size="small" type="link" href={customer.thread_link} target="_blank" rel="noreferrer"
        icon={<ExternalLink className="size-3.5" />} iconPlacement="end">{t("openSmax")}</Button>}
    </div>}>
    <div className="-mx-6 grid md:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        {isPending ? <div className="flex h-60 items-center justify-center"><Spin /></div>
          : error ? <div className="px-6"><Alert type="error" showIcon title={error.message} /></div>
          : !data.length ? <Empty className="py-10" description={t("noMessages")} />
          : <ChatBubbles messages={data} />}
      </div>
      <aside className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto border-t px-5 py-3 md:border-t-0 md:border-s">
        <div className="flex items-center gap-2 font-medium">
          <Sparkles className="size-4 text-primary" aria-hidden />{ta("title")}
          {stale && <StatusTag color="orange" label={ta("stale")} className="ms-auto" />}
        </div>
        {summary.isPending ? <div className="flex h-32 items-center justify-center"><Spin size="small" /></div>
          : summary.error ? <Alert type="error" showIcon title={summary.error.message} />
          : s && text ? <>
            <p className="text-sm whitespace-pre-wrap" lang={text === s.summary_en ? "en" : "vi"}>{text}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("summaryMeta", { at: dayjs(s.created_at).format("DD/MM/YYYY HH:mm"), count: s.message_count })}
            </p>
          </>
          : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} className="my-auto py-6" description={t("summaryEmpty")} />}
      </aside>
    </div>
  </Modal>;
}
