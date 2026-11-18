"use client";

import { useTransition } from "react";
import { Button, Checkbox, Tag, Tooltip } from "antd";
import dayjs from "dayjs";
import { useTranslations } from "next-intl";
import { Copy, MessageCircle, Pencil, Trash2 } from "lucide-react";

import { deleteReminder, setReminderDone } from "@/app/(app)/customers/reminders/actions";
import { ConfirmAction } from "@/components/common/confirm-action";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { customerTelesales } from "@/components/reminders/reminder-form-modal";
import { REMINDER_COLORS, reminderState } from "@/lib/reminders";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Reminder, ReminderCustomer } from "@/types/reminder";

/**
 * Một lịch nhắc: tick "đã nhắc", giờ (màu theo trạng thái), khách (trang calendar), tin nhắn,
 * người phụ trách + nút mở hội thoại / sao chép tin nhắn / sửa / xoá.
 * Dùng chung cho drawer theo khách và panel ngày ở trang calendar.
 */
export function ReminderItem({
  reminder: r,
  customer,
  showCustomer = true,
  staff,
  now,
  timeFormat = "DD-MM HH:mm",
  canEdit,
  onEdit,
}: {
  reminder: Reminder;
  /** Khách của lịch nhắc — lấy link hội thoại SMAX; `showCustomer` hiện tên/SĐT (trang calendar). */
  customer?: ReminderCustomer | null;
  showCustomer?: boolean;
  staff: StaffRef[];
  now: number;
  timeFormat?: string;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const t = useTranslations("reminders");
  const [pending, start] = useTransition();
  const state = reminderState(r, now);
  const assignee = customerTelesales(staff, customer?.staff_id);
  const link = customer?.thread?.link;

  const act = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(r.note);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <div className={cn("flex gap-3 rounded-lg border border-border p-3", state === "done" && "opacity-60")}>
      <Tooltip title={r.done_at ? t("markUndone") : t("markDone")}>
        <Checkbox
          checked={!!r.done_at}
          disabled={!canEdit || pending}
          aria-label={t("markDone")}
          className="mt-0.5 self-start"
          onChange={(e) => act(() => setReminderDone(r.id, e.target.checked))}
        />
      </Tooltip>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Tag color={REMINDER_COLORS[state]} className="me-0 tabular-nums" title={t(`state.${state}`)}>
            {dayjs(r.remind_at).format(timeFormat)}
          </Tag>
          {showCustomer && customer && (
            <span className="min-w-0 truncate font-medium">
              {customer.full_name}
              {customer.phone && <span className="ms-1.5 font-normal text-muted-foreground">{customer.phone}</span>}
            </span>
          )}
        </div>
        {r.note && (
          <p className={cn("whitespace-pre-wrap text-sm text-muted-foreground line-clamp-3", r.done_at && "line-through")}>
            {r.note}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{assignee ? staffLabel(assignee) : t("unassigned")}</span>
          <div className="-me-1 flex items-center">
            {link && (
              <Button
                type="text"
                size="small"
                href={link}
                target="_blank"
                rel="noreferrer"
                aria-label={t("openThread")}
                title={t("openThread")}
                icon={<MessageCircle className="size-4" />}
              />
            )}
            {r.note && (
              <Button
                type="text"
                size="small"
                aria-label={t("copy")}
                title={t("copy")}
                icon={<Copy className="size-4" />}
                onClick={copy}
              />
            )}
            {canEdit && (
              <>
                <Button
                  type="text"
                  size="small"
                  aria-label={t("editTitle")}
                  title={t("editTitle")}
                  icon={<Pencil className="size-4" />}
                  onClick={onEdit}
                />
                <ConfirmAction title={t("deleteConfirm")} onConfirm={() => act(() => deleteReminder(r.id))}>
                  <Button
                    type="text"
                    size="small"
                    danger
                    aria-label={t("delete")}
                    title={t("delete")}
                    icon={<Trash2 className="size-4" />}
                  />
                </ConfirmAction>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
