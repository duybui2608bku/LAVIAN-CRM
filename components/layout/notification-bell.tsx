"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Empty, Popover } from "antd";
import dayjs from "dayjs";
import { Bell, BellRing, CalendarClock, PhoneCall } from "lucide-react";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  kind: string;
  data: Record<string, unknown>;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const LIMIT = 20;

/**
 * Thông báo của user: 20 cái mới nhất + nhận INSERT qua Supabase Realtime (RLS chỉ gửi dòng của mình).
 * Gọi 1 lần ở AppShell rồi truyền cho cả 2 chuông (desktop + điện thoại) — tránh 2 kênh realtime.
 */
export function useNotifications(userId: string | null) {
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let active = true;
    supabase
      .from("notifications")
      .select("id, kind, data, link, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(LIMIT)
      .then(({ data }) => {
        if (active && data) setItems(data as Notification[]);
      });
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => setItems((prev) => [payload.new as Notification, ...prev].slice(0, LIMIT)),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Ghi DB ngay khi mở; giao diện giữ chấm "mới" tới khi đóng popover để user còn thấy cái nào mới.
  const markAllRead = async () => {
    if (!userId || !items.some((n) => !n.read_at)) return;
    await createClient()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
  };
  const clearUnread = () =>
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));

  return { items, unread: items.filter((n) => !n.read_at).length, markAllRead, clearUnread };
}

export type NotificationsState = ReturnType<typeof useNotifications>;

/** Chuông thông báo ở header: badge chưa đọc, bấm mở danh sách; bấm 1 thông báo → mở link. */
export function NotificationBell({ state }: { state: NotificationsState }) {
  const t = useTranslations("common");
  const tr = useTranslations("reminders.notify");
  const tp = useTranslations("potential.notify");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { items, unread, markAllRead, clearUnread } = state;

  const text = (n: Notification) => {
    const d = n.data;
    if (n.kind === "reminder_digest") {
      const today = Number(d.today ?? 0);
      const overdue = Number(d.overdue ?? 0);
      return [today ? tr("digestToday", { n: today }) : null, overdue ? tr("digestOverdue", { n: overdue }) : null]
        .filter(Boolean)
        .join(" · ");
    }
    if (n.kind === "follow_up_digest") {
      const today = Number(d.today ?? 0);
      const overdue = Number(d.overdue ?? 0);
      return [today ? tp("digestToday", { n: today }) : null, overdue ? tp("digestOverdue", { n: overdue }) : null]
        .filter(Boolean)
        .join(" · ");
    }
    if (n.kind === "follow_up_due") {
      return tp("due", {
        customer: String(d.customer ?? "—"),
        time: d.follow_up_at ? dayjs(String(d.follow_up_at)).format("DD-MM HH:mm") : "—",
      });
    }
    if (n.kind === "reminder_assigned") {
      return tr("assigned", {
        by: String(d.by ?? "—"),
        customer: String(d.customer ?? "—"),
        time: d.remind_at ? dayjs(String(d.remind_at)).format("DD-MM HH:mm") : "—",
      });
    }
    return n.kind;
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void markAllRead();
    else clearUnread();
  };

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      arrow={false}
      open={open}
      onOpenChange={onOpenChange}
      title={t("notifications")}
      content={
        <div className="-mx-3 max-h-[60vh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto">
          {items.length ? (
            <ul className="m-0 list-none p-0">
              {items.map((n) => {
                const Icon = n.kind.endsWith("_digest") ? BellRing : n.kind === "follow_up_due" ? PhoneCall : CalendarClock;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-start hover:bg-muted",
                        !n.read_at && "bg-primary/5",
                      )}
                      onClick={() => {
                        onOpenChange(false);
                        if (n.link) router.push(n.link);
                      }}
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-5">{text(n)}</span>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          {dayjs(n.created_at).format("DD-MM-YYYY HH:mm")}
                        </span>
                      </span>
                      {!n.read_at && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-4">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("noNotifications")} />
            </div>
          )}
        </div>
      }
    >
      <Badge count={unread} size="small" offset={[-4, 4]}>
        <Button
          type="text"
          shape="circle"
          aria-label={t("notifications")}
          title={t("notifications")}
          icon={<Bell className="size-[18px]" />}
        />
      </Badge>
    </Popover>
  );
}
