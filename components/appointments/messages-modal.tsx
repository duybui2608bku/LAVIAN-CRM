"use client";

import { Alert, Button, Empty, Modal, Spin } from "antd";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { ChatBubbles } from "@/components/appointments/chat-bubbles";
import { useCustomerMessages } from "@/components/customers/customer-360/use-customer-messages";

export type MessagesCustomer = { id: string; full_name: string; thread_link?: string | null };

/** Modal xem nhanh các tin SMAX gần nhất với khách (MESSAGE_LIMIT): khách bên trái, Lavian bên phải, cũ → mới. */
export function MessagesModal({ customer, onClose }: {
  customer: MessagesCustomer | null;
  onClose: () => void;
}) {
  const t = useTranslations("appointments");
  const { data, error, isPending } = useCustomerMessages(customer?.id);

  return <Modal open={!!customer} onCancel={onClose} footer={null} width={800}
    title={<div className="flex items-center gap-3 pe-8">
      <div className="min-w-0 flex-1 truncate">{t("messagesTitle", { name: customer?.full_name ?? "" })}</div>
      {customer?.thread_link && <Button size="small" type="link" href={customer.thread_link} target="_blank" rel="noreferrer"
        icon={<ExternalLink className="size-3.5" />} iconPlacement="end">{t("openSmax")}</Button>}
    </div>}>
    {isPending ? <div className="flex h-60 items-center justify-center"><Spin /></div>
      : error ? <Alert type="error" showIcon title={error.message} />
      : !data.length ? <Empty className="py-10" description={t("noMessages")} />
      : <ChatBubbles messages={data} className="-mx-6" />}
  </Modal>;
}
