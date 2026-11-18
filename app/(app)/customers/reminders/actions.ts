"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ReminderInput } from "@/types/reminder";

type Result = { error?: string };

// Lịch nhắc hiện ở cột Nhắc hẹn (Booking management) và trang calendar.
function revalidateReminders() {
  revalidatePath("/customers/bookings");
  revalidatePath("/customers/reminders");
}

function clean(input: ReminderInput): ReminderInput {
  if (!input.remind_at || Number.isNaN(Date.parse(input.remind_at))) throw new Error("Missing date");
  return {
    remind_at: new Date(input.remind_at).toISOString(),
    assignee_id: input.assignee_id || null,
    note: (input.note ?? "").trim().slice(0, 5000),
  };
}

async function run(fn: () => PromiseLike<{ error: unknown }>): Promise<Result> {
  try {
    await requirePermission("customers.edit");
    const { error } = await fn();
    if (error) throw error;
    revalidateReminders();
    return {};
  } catch (e) {
    return { error: normalizeError(e).message };
  }
}

export async function createReminder(customerId: string, input: ReminderInput): Promise<Result> {
  const supabase = await createClient();
  return run(() => supabase.from("customer_reminders").insert({ customer_id: customerId, ...clean(input) }));
}

export async function updateReminder(id: string, input: ReminderInput): Promise<Result> {
  const supabase = await createClient();
  return run(() => supabase.from("customer_reminders").update(clean(input)).eq("id", id));
}

export async function setReminderDone(id: string, done: boolean): Promise<Result> {
  const supabase = await createClient();
  return run(() =>
    supabase.from("customer_reminders").update({ done_at: done ? new Date().toISOString() : null }).eq("id", id),
  );
}

export async function deleteReminder(id: string): Promise<Result> {
  const supabase = await createClient();
  return run(() => supabase.from("customer_reminders").delete().eq("id", id));
}
