"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Empty, Popover } from "antd";
import dayjs from "dayjs";
import { Bell, BellRing, CalendarClock, CreditCard, FileText, PhoneCall, Sparkles, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ensureJourneyDigest } from "@/app/(app)/customers/journey/actions";
import { createClient } from "@/lib/supabase/client";
import {
  mergeNotification, notificationIcon, notificationParts, todayUtc7,
  type AppNotification, type NotificationIcon,
} from "@/lib/notifications";
import { toast } from "@/lib/toast";

const LIMIT = 20;
/** Cùng `ref` tới dồn dập (VD tạo 3 tour 1 lúc → 3 INSERT) → chỉ toast 1 lần trong khoảng này. */
const TOAST_GAP_MS = 5_000;

const ICONS: Record<NotificationIcon, LucideIcon> = {
  calendar: CalendarClock, phone: PhoneCall, digest: BellRing, tour: Sparkles, card: CreditCard, document: FileText,
};

/** Chữ hiển thị của 1 thông báo (kind + data → i18n `notify`). */
function useNotificationText() {
  const t = useTranslations("notify");
  return useCallback(
    (n: AppNotification) => notificationParts(n).map(([key, values]) => t(key, values)).join(" · ") || n.kind,
    [t],
  );
}

/**
 * Thông báo của user: 20 cái mới nhất + nhận INSERT qua Supabase Realtime (RLS chỉ gửi dòng của mình),
 * toast khi có cái mới. Gọi 1 lần ở AppShell rồi truyền cho cả 2 chuông (desktop + điện thoại) — tránh 2 kênh realtime.
 */
export function useNotifications(userId: string | null) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const text = useNotificationText();
  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const toasted = new Map<string, number>();
    let active = true;
    supabase
      .from("notifications")
      .select("id, kind, data, link, ref, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(LIMIT)
      .then(({ data }) => {
        if (active && data) setItems(data as AppNotification[]);
      });
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as AppNotification;
          setItems((prev) => mergeNotification(prev, n, LIMIT));
          const key = n.ref ?? n.id;
          const now = Date.now();
          if (now - (toasted.get(key) ?? 0) > TOAST_GAP_MS) toast.info(textRef.current(n));
          toasted.set(key, now);
        },
      )
      .subscribe();

    // Tổng hợp Đến hạn liệu trình: 1 lần / ngày / trình duyệt (server chặn trùng lần nữa).
    const digestKey = `journey-digest:${userId}`;
    const today = todayUtc7();
    if (localStorage.getItem(digestKey) !== today) {
      localStorage.setItem(digestKey, today);
      void ensureJourneyDigest();
    }

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
  const text = useNotificationText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { items, unread, markAllRead, clearUnread } = state;

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
                const Icon = ICONS[notificationIcon(n.kind)];
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-start hover:bg-muted"
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
