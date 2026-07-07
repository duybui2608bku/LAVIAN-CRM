import "server-only";

import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY. Dùng secret key (service_role) → BYPASS RLS.
// TUYỆT ĐỐI không import file này ở Client Component. Chỉ gọi trong Server Action
// đã kiểm tra người gọi có role=admin (xem lib/auth.ts requireAdmin()).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
