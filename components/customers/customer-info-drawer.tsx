"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Descriptions, Drawer, Image, Skeleton } from "antd";
import dayjs from "dayjs";
import { useLocale, useTranslations } from "next-intl";

import { getCustomerDetail } from "@/app/(app)/appointments/actions";
import { DASH, StatusTag } from "@/components/common/cells";
import { NoteTimeline } from "@/components/common/notes";
import { Section } from "@/components/common/section";
import { staffName, type StaffRef } from "@/components/common/user-avatar";
import { SourceCell } from "@/components/customers/customers-manager";
import { formatRupiah } from "@/lib/currency";
import { CUSTOMER_OPTIONS } from "@/lib/customer-options";
import { optionLabel } from "@/lib/customers";

type Detail = Awaited<ReturnType<typeof getCustomerDetail>> & { for: string };

/** Drawer chỉ xem toàn bộ thông tin 1 khách (icon ở ô Khách hàng, /appointments). Tải khi mở. */
export function CustomerInfoDrawer({
  customer,
  staff,
  onClose,
}: {
  customer: { id: string; full_name: string } | null;
  staff: StaffRef[];
  onClose: () => void;
}) {
  const t = useTranslations("customers");
  const ta = useTranslations("appointments");
  const locale = useLocale();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, startLoading] = useTransition();
  const requestId = useRef(0);
  const customerId = customer?.id;

  // Mở cho khách nào → tải khách đó; bỏ kết quả của request cũ.
  useEffect(() => {
    if (!customerId) return;
    const current = ++requestId.current;
    startLoading(async () => {
      const res = await getCustomerDetail(customerId);
      if (current === requestId.current) setData({ ...res, for: customerId });
    });
  }, [customerId]);

  const date = (v: string | null | undefined, f = "DD/MM/YYYY") => (v ? dayjs(v).format(f) : DASH);
  const text = (v: string | null | undefined) => v || DASH;

  const c = data?.for === customerId && !loading ? data?.customer : undefined;
  const stage = c && CUSTOMER_OPTIONS.find((o) => o.kind === "stage" && o.value === c.stage);

  return (
    <Drawer open={customer !== null} onClose={onClose} size={480} destroyOnHidden title={t("infoTitle")}>
      {data?.for === customerId && !loading && data?.error ? (
        <p className="text-destructive">{data.error}</p>
      ) : !c ? (
        <Skeleton active />
      ) : (
        <div className="space-y-6">
          <Descriptions
            column={1}
            size="small"
            bordered
            items={[
              {
                key: "name",
                label: t("colName"),
                children: c.thread?.link ? (
                  <a href={c.thread.link} target="_blank" rel="noreferrer" title={t("openThread")}>{c.full_name}</a>
                ) : c.full_name,
              },
              { key: "phone", label: t("colPhone"), children: <span className="tabular-nums">{c.phone}</span> },
              { key: "social", label: t("socialName"), children: text(c.social_name) },
              { key: "source", label: t("colSource"), children: <SourceCell customer={c} /> },
              {
                key: "stage",
                label: t("colStage"),
                children: <StatusTag label={stage ? optionLabel(stage, locale) : c.stage} color={stage?.color} />,
              },
              ...(c.follow_up_at
                ? [{ key: "followUp", label: t("followUpAt"), children: date(c.follow_up_at, "DD/MM/YYYY HH:mm") }]
                : []),
              { key: "staff", label: ta("staff"), children: staffName(staff, c.staff_id) },
              { key: "sales", label: t("colSales"), children: staffName(staff, c.sales_id) },
              { key: "technician", label: t("colTechnician"), children: staffName(staff, c.technician_id) },
              { key: "firstContact", label: t("colFirstContact"), children: date(c.first_contact) },
              {
                key: "deposit",
                label: t("colDeposit"),
                children: (
                  <div className="flex items-center gap-2">
                    {c.payment_confirm_url && (
                      <Image
                        src={c.payment_confirm_url}
                        alt={t("paymentConfirm")}
                        width={40}
                        height={40}
                        className="rounded border border-border object-cover"
                      />
                    )}
                    <span className="tabular-nums">{c.deposit_amount ? formatRupiah(Number(c.deposit_amount)) : DASH}</span>
                  </div>
                ),
              },
              { key: "region", label: t("region"), children: text(data?.region) },
              { key: "address", label: t("addressDetail"), children: <span className="whitespace-pre-wrap">{text(c.address_detail)}</span> },
              { key: "created", label: t("colCreated"), children: date(c.created_at, "DD/MM/YYYY HH:mm") },
            ]}
          />

          <Section title={t("colNotes")}>
            <NoteTimeline notes={c.notes ?? []} staff={staff} />
          </Section>
        </div>
      )}
    </Drawer>
  );
}
