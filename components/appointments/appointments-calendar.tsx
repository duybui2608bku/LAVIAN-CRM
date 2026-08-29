"use client";

import { useMemo, type CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";

import { assignLanes, groupByDay, localTime } from "@/lib/appointments";
import { formatISODate, parseISODate } from "@/lib/date";
import { cn } from "@/lib/utils";
import { STATUS_META } from "@/components/appointments/status-tag";
import type { Appointment } from "@/types/appointment";

const HOUR_PX = 48; // 1 giờ = 48px trên lưới tuần

// Card/chip màu theo trạng thái — cùng pattern CSS var `--tag` của EnumTag.
const tagClass =
  "bg-(--tag)/15 text-(--tag) hover:bg-(--tag)/25 dark:bg-(--tag)/25 dark:text-[color-mix(in_oklab,var(--tag)_65%,white)]";

const cardTitle = (a: Appointment) =>
  `${a.scheduled_at ? localTime(a.scheduled_at) : ""} ${a.customer?.full_name ?? ""}`.trim();

/** Lưới calendar Tuần (giờ × 7 ngày) / Tháng (ô ngày + chip) cho lịch hẹn.
 *  Chỉ hiển thị — toolbar (đổi kiểu, điều hướng) nằm ở AppointmentsManager. */
export function AppointmentsCalendar({
  appointments,
  view,
  anchor,
  onPick,
  onPickDay,
}: {
  appointments: Appointment[];
  view: "week" | "month";
  anchor: string; // YYYY-MM-DD — ngày neo của tuần/tháng đang xem
  onPick: (a: Appointment) => void;
  onPickDay: (day: string) => void;
}) {
  const t = useTranslations("appointments");
  const locale = useLocale();
  const anchorDate = parseISODate(anchor) ?? new Date();
  const byDay = useMemo(() => groupByDay(appointments), [appointments]);
  const todayKey = formatISODate(new Date());

  const chip = (a: Appointment, style?: CSSProperties, className?: string) => (
    <button
      key={a.id}
      type="button"
      onClick={() => onPick(a)}
      title={cardTitle(a)}
      className={cn(
        "block overflow-hidden rounded-sm px-1 py-0.5 text-left text-xs leading-tight",
        tagClass,
        className,
      )}
      style={{ "--tag": STATUS_META[a.status].color, ...style } as CSSProperties}
    >
      <span className="font-medium tabular-nums">
        {a.scheduled_at ? localTime(a.scheduled_at) : ""}
      </span>{" "}
      {a.customer?.full_name ?? "—"}
    </button>
  );

  if (view === "week") {
    const weekStart = startOfWeek(anchorDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    // Dải giờ mặc định 08–20h, tự nới nếu có lịch ngoài dải.
    let firstHour = 8;
    let lastHour = 20;
    for (const d of days) {
      for (const a of byDay.get(formatISODate(d)) ?? []) {
        const s = new Date(a.scheduled_at!);
        const endH = Math.ceil(
          (s.getHours() * 60 + s.getMinutes() + a.duration_minutes) / 60,
        );
        firstHour = Math.min(firstHour, s.getHours());
        lastHour = Math.max(lastHour, Math.min(endH, 24));
      }
    }
    const hours = Array.from(
      { length: lastHour - firstHour },
      (_, i) => firstHour + i,
    );

    return (
      <div className="overflow-x-auto rounded-md border">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b">
            <div />
            {days.map((d) => {
              const key = formatISODate(d);
              return (
                <div
                  key={key}
                  className={cn(
                    "border-l px-2 py-1.5 text-center",
                    key === todayKey && "bg-accent",
                  )}
                >
                  <div className="text-xs text-muted-foreground">
                    {d.toLocaleDateString(locale, { weekday: "short" })}
                  </div>
                  <div
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      key === todayKey && "text-primary",
                    )}
                  >
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
            <div>
              {hours.map((h) => (
                <div key={h} className="relative" style={{ height: HOUR_PX }}>
                  <span className="absolute -top-2 right-1.5 text-xs text-muted-foreground tabular-nums">
                    {String(h).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>
            {days.map((d) => {
              const key = formatISODate(d);
              const items = assignLanes(byDay.get(key) ?? []);
              return (
                <div
                  key={key}
                  className={cn(
                    "relative overflow-hidden border-l",
                    key === todayKey && "bg-accent/40",
                  )}
                >
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="border-b last:border-b-0"
                      style={{ height: HOUR_PX }}
                    />
                  ))}
                  {items.map(({ a, lane, lanes }) => {
                    const s = new Date(a.scheduled_at!);
                    const startMin =
                      s.getHours() * 60 + s.getMinutes() - firstHour * 60;
                    return chip(
                      a,
                      {
                        position: "absolute",
                        top: (startMin / 60) * HOUR_PX,
                        height: Math.max(
                          (a.duration_minutes / 60) * HOUR_PX - 2,
                          20,
                        ),
                        left: `calc(${(lane / lanes) * 100}% + 2px)`,
                        width: `calc(${100 / lanes}% - 4px)`,
                      },
                      "border-l-2 border-l-(--tag)",
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Tháng: lưới tuần đủ phủ tháng, mỗi ô tối đa 3 chip + "+n".
  const gridStart = startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="grid grid-cols-7 bg-muted/50 text-center text-xs text-muted-foreground">
        {days.slice(0, 7).map((d) => (
          <div key={d.getDay()} className="px-2 py-1.5">
            {d.toLocaleDateString(locale, { weekday: "short" })}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const key = formatISODate(d);
          const list = byDay.get(key) ?? [];
          const extra = list.length - 3;
          return (
            <div
              key={key}
              className={cn(
                "min-h-24 border-t p-1",
                i % 7 > 0 && "border-l",
                d.getMonth() !== anchorDate.getMonth() &&
                  "bg-muted/30 text-muted-foreground",
              )}
            >
              <button
                type="button"
                onClick={() => onPickDay(key)}
                className={cn(
                  "mb-0.5 inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums hover:bg-accent",
                  key === todayKey &&
                    "bg-primary font-medium text-primary-foreground hover:bg-primary/90",
                )}
              >
                {d.getDate()}
              </button>
              <div className="space-y-0.5">
                {list.slice(0, 3).map((a) => chip(a, undefined, "w-full truncate"))}
                {extra > 0 && (
                  <button
                    type="button"
                    onClick={() => onPickDay(key)}
                    className="block px-1 text-xs text-muted-foreground hover:underline"
                  >
                    {t("more", { count: extra })}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
