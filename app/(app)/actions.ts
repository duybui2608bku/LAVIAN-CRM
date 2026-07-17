"use server";

import {
  fetchSmaxStats,
  fetchSmaxTags,
  fetchFbSpend,
  fetchSmaxStaffStats,
  supaRange,
  type SmaxTagStat,
  type SmaxStaffStat,
} from "@/lib/marketing";
import { normalizeError } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/marketing";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface AppointmentBreakdown {
  total: number | null;
  deposited: number | null;
  notDeposited: number | null;
}

export interface DashboardStats {
  spend: number | null;
  messages: number | null;
  leads: number | null;
  appointments: number | null;
  visited: number | null;
  revenue: number | null;
  tags: SmaxTagStat[] | null;
  staffStats: SmaxStaffStat[] | null;
  appointmentSummary: {
    total: AppointmentBreakdown;
    today: AppointmentBreakdown;
    tomorrow: AppointmentBreakdown;
  };
  errors: { fb?: string; smax?: string; tags?: string; staff?: string; db?: string };
  error?: string;
}

const EMPTY_BREAKDOWN: AppointmentBreakdown = {
  total: null,
  deposited: null,
  notDeposited: null,
};

const EMPTY: DashboardStats = {
  spend: null,
  messages: null,
  leads: null,
  appointments: null,
  visited: null,
  revenue: null,
  tags: null,
  staffStats: null,
  appointmentSummary: {
    total: { ...EMPTY_BREAKDOWN },
    today: { ...EMPTY_BREAKDOWN },
    tomorrow: { ...EMPTY_BREAKDOWN },
  },
  errors: {},
};

type AppointmentRow = {
  id: string;
  appointment_payments: { kind: string }[] | null;
};

type PaymentRow = { kind: "deposit" | "payment" | "refund"; amount: number };

function appointmentBreakdown(rows: AppointmentRow[]): AppointmentBreakdown {
  const deposited = rows.filter((row) =>
    row.appointment_payments?.some((payment) => payment.kind === "deposit"),
  ).length;
  return {
    total: rows.length,
    deposited,
    notDeposited: rows.length - deposited,
  };
}

function netRevenue(rows: PaymentRow[]) {
  return rows.reduce(
    (total, payment) =>
      total + (payment.kind === "refund" ? -payment.amount : payment.amount),
    0,
  );
}

/** Số liệu báo cáo theo khoảng ngày Việt Nam `YYYY-MM-DD`. */
export async function getMarketingStats(
  from: string,
  to: string,
  includeSpend = false,
): Promise<DashboardStats> {
  await requireAdmin();

  if (!YMD_RE.test(from) || !YMD_RE.test(to) || from > to)
    return { ...EMPTY, error: "Khoảng ngày không hợp lệ." };

  const supabase = await createClient();
  const selectedRange = supaRange(from, to);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const tomorrow = addDays(today, 1);
  const todayRange = supaRange(today, today);
  const tomorrowRange = supaRange(tomorrow, tomorrow);

  const appointmentQuery = (start: string, end: string) =>
    supabase
      .from("appointments")
      .select(
        "id, appointment_payments!appointment_payments_appointment_id_fkey(kind)",
      )
      .is("deleted_at", null)
      .gte("scheduled_at", start)
      .lt("scheduled_at", end);

  const [spend, staff, smax, tags, selectedAppointments, todayAppointments, tomorrowAppointments, visited, payments] =
    await Promise.allSettled([
      includeSpend ? fetchFbSpend(from, to) : Promise.resolve(null),
      fetchSmaxStaffStats(from, to),
      fetchSmaxStats(from, to),
      fetchSmaxTags(from, to),
      appointmentQuery(selectedRange.start, selectedRange.end),
      appointmentQuery(todayRange.start, todayRange.end),
      appointmentQuery(tomorrowRange.start, tomorrowRange.end),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("stage", "visited")
        .gte("created_at", selectedRange.start)
        .lt("created_at", selectedRange.end),
      supabase
        .from("appointment_payments")
        .select("kind, amount")
        .gte("paid_at", selectedRange.start)
        .lt("paid_at", selectedRange.end),
    ]);

  const stats: DashboardStats = {
    ...EMPTY,
    appointmentSummary: {
      total: { ...EMPTY_BREAKDOWN },
      today: { ...EMPTY_BREAKDOWN },
      tomorrow: { ...EMPTY_BREAKDOWN },
    },
    errors: {},
  };

  if (spend.status === "fulfilled") stats.spend = spend.value;
  else stats.errors.fb = normalizeError(spend.reason).message;

  if (staff.status === "fulfilled") stats.staffStats = staff.value;
  else stats.errors.staff = normalizeError(staff.reason).message;

  if (smax.status === "fulfilled") {
    stats.messages = smax.value.messages;
    stats.leads = smax.value.leads;
  } else stats.errors.smax = normalizeError(smax.reason).message;

  if (tags.status === "fulfilled") stats.tags = tags.value;
  else stats.errors.tags = normalizeError(tags.reason).message;

  const dbResults = [
    selectedAppointments,
    todayAppointments,
    tomorrowAppointments,
    visited,
    payments,
  ];
  const dbFailure = dbResults.find((result) => result.status === "rejected");
  const dbResponseError = dbResults
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value.error)
    .find(Boolean);

  if (dbFailure?.status === "rejected" || dbResponseError) {
    stats.errors.db = normalizeError(
      dbFailure?.status === "rejected" ? dbFailure.reason : dbResponseError,
    ).message;
  } else if (
    selectedAppointments.status === "fulfilled" &&
    todayAppointments.status === "fulfilled" &&
    tomorrowAppointments.status === "fulfilled" &&
    visited.status === "fulfilled" &&
    payments.status === "fulfilled"
  ) {
    stats.appointmentSummary.total = appointmentBreakdown(
      (selectedAppointments.value.data ?? []) as AppointmentRow[],
    );
    stats.appointmentSummary.today = appointmentBreakdown(
      (todayAppointments.value.data ?? []) as AppointmentRow[],
    );
    stats.appointmentSummary.tomorrow = appointmentBreakdown(
      (tomorrowAppointments.value.data ?? []) as AppointmentRow[],
    );
    stats.appointments = stats.appointmentSummary.total.total;
    stats.visited = visited.value.count ?? 0;
    stats.revenue = netRevenue((payments.value.data ?? []) as PaymentRow[]);
  }

  return stats;
}
