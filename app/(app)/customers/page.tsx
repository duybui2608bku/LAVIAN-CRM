import { createClient } from "@/lib/supabase/server";
import {
  hydrateLedgerUpsales,
  normalizeAppointmentRow,
  type AppointmentRow,
} from "@/lib/appointments";
import { CustomersManager } from "@/components/customers/customers-manager";
import type { Customer, EnumOption } from "@/types/customer";
import type { Service } from "@/types/service";

// Mọi user đăng nhập đều xem được (RLS customers cho authenticated). Proxy đã gác login.
export default async function CustomersPage() {
  const supabase = await createClient();
  const [customersRes, staffRes, optionsRes, servicesRes, apptsRes] = await Promise.all([
    supabase
      .from("customers")
      // Nested select qua FK bảng nối — 1 query, không N+1.
      .select("*, customer_services(service_id)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, user_name, avatar_url, department")
      .order("user_name", { ascending: true }),
    // Nạp tất cả option (kể cả inactive) để hiện nhãn đúng cho dữ liệu cũ;
    // dropdown sẽ tự lọc is_active phía client.
    supabase
      .from("enum_options")
      .select("*")
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true }),
    // Services cũng nạp cả inactive (hiện tên dịch vụ cũ còn gắn trên khách).
    supabase
      .from("services")
      .select("*")
      .order("sort_order", { ascending: true }),
    // Lịch hẹn cho dialog "Lịch hẹn - {khách}" (lọc theo khách phía client).
    supabase
      .from("appointments")
      .select(
        "*, appointment_services(service_id), appointment_upsales(*), appointment_payments(*), ledger:service_ledgers(*, appointment_payments(*)), customer:customers(full_name, phone)",
      )
      .is("deleted_at", null)
      .order("scheduled_at", { ascending: false }),
  ]);

  type Row = Customer & { customer_services: { service_id: string }[] | null };
  const customers = (((customersRes.data as Row[]) ?? []).map(
    ({ customer_services, ...c }) => ({
      ...c,
      service_ids: (customer_services ?? []).map((r) => r.service_id),
    }),
  ) as Customer[]);

  if (apptsRes.error) throw apptsRes.error;
  const appointments = hydrateLedgerUpsales(
    ((apptsRes.data as unknown as AppointmentRow[]) ?? []).map(
      normalizeAppointmentRow,
    ),
  );

  return (
    <CustomersManager
      customers={customers}
      appointments={appointments}
      staff={
        (staffRes.data as {
          id: string;
          user_name: string;
          avatar_url: string | null;
          department: string | null;
        }[]) ?? []
      }
      options={(optionsRes.data as EnumOption[]) ?? []}
      services={(servicesRes.data as Service[]) ?? []}
    />
  );
}
