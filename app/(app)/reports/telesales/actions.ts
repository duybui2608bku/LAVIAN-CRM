"use server";

import { requirePermission } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import { fetchFbAdsDaily, fetchSmaxHandledConversations, supaRange } from "@/lib/marketing";
import { previousRange, rangeError } from "@/lib/reports";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import {
  buildTelesalesReport,
  type TelesalesAppointment,
  type TelesalesReportData,
  type TelesalesStaff,
} from "@/lib/telesales-report";
import { TELESALES_DEPARTMENTS } from "@/types/user";

const MAX_DAYS = 366;
const APPT_COLUMNS =
  "id, created_at, scheduled_at, booking_confirm, visit_status, staff_id, customer:customers!inner(created_at, source)";

export interface TelesalesReport {
  data: TelesalesReportData | null;
  previous: { from: string; to: string };
  /** Lỗi từng nguồn — nguồn lỗi hiện "—", các phần khác vẫn chạy. */
  errors: { fb?: string; smax?: string };
  error?: string;
}

/** Báo cáo Leader Telesales theo khoảng ngày VN `YYYY-MM-DD` (kèm kỳ liền trước để so sánh). */
export async function getTelesalesReport(from: string, to: string): Promise<TelesalesReport> {
  await requirePermission("telesales.view");
  const error = rangeError(from, to, MAX_DAYS);
  const previous = error ? { from, to } : previousRange(from, to);
  const out: TelesalesReport = { data: null, previous, errors: {} };
  if (error) return { ...out, error };

  const supabase = await createClient();
  const range = supaRange(previous.from, to);
  // Lịch tạo trong 2 kỳ (booking) + lịch hẹn trong 2 kỳ (khách đến); khách đã xoá thì bỏ (giống /appointments).
  const appts = (column: "created_at" | "scheduled_at") =>
    fetchAll<TelesalesAppointment>((a, b) =>
      supabase
        .from("clinic_appointments")
        .select(APPT_COLUMNS)
        .is("deleted_at", null)
        .is("customer.deleted_at", null)
        .gte(column, range.start)
        .lt(column, range.end)
        .order("id")
        .range(a, b)
        .overrideTypes<TelesalesAppointment[], { merge: false }>(),
    );

  const [byCreated, byScheduled, profiles, fb, smax] = await Promise.allSettled([
    appts("created_at"),
    appts("scheduled_at"),
    supabase
      .from("profiles")
      .select("id, user_name, avatar_url, smax_user_id, department, status")
      .order("user_name")
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data ?? []) as (TelesalesStaff & { department: string | null; status: string })[];
      }),
    fetchFbAdsDaily(previous.from, to),
    fetchSmaxHandledConversations(from, to),
  ]);

  const dbError = [byCreated, byScheduled, profiles].find((r) => r.status === "rejected");
  if (dbError) return { ...out, error: normalizeError(dbError.reason).message };
  if (fb.status === "rejected") out.errors.fb = normalizeError(fb.reason).message;
  if (smax.status === "rejected") out.errors.smax = normalizeError(smax.reason).message;

  // Danh sách bảng: Telesales đang hoạt động + bất kỳ ai đã ghép ID SMAX.
  const staff = (profiles as PromiseFulfilledResult<(TelesalesStaff & { department: string | null; status: string })[]>).value
    .filter((p) => p.smax_user_id || (p.status === "active" && TELESALES_DEPARTMENTS.includes(p.department ?? "")))
    .map(({ id, user_name, avatar_url, smax_user_id }) => ({ id, user_name, avatar_url, smax_user_id }));

  out.data = buildTelesalesReport({
    from,
    to,
    prev: previous,
    appointments: [
      ...(byCreated as PromiseFulfilledResult<TelesalesAppointment[]>).value,
      ...(byScheduled as PromiseFulfilledResult<TelesalesAppointment[]>).value,
    ],
    fb: fb.status === "fulfilled" ? new Map([...fb.value.days].map(([d, v]) => [d, v.messages])) : null,
    handled: smax.status === "fulfilled" ? smax.value : null,
    staff,
  });
  return out;
}
