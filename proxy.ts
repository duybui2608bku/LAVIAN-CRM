import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { LOCALE_COOKIE } from "@/i18n/config";

// Next.js 16 renamed Middleware -> Proxy (see node_modules/next/dist/docs proxy guide).
// Cổng xác thực: refresh session + chặn chưa-đăng-nhập / banned / route admin.

// Trang auth: đã đăng nhập thì đá về trang chủ.
const AUTH_PAGES = ["/login", "/banned"];
// Route công khai (không cần đăng nhập) — /lead-form nhúng iframe SMAX,
// người đã đăng nhập vẫn mở được (không redirect như trang auth).
const PUBLIC_PATHS = [...AUTH_PAGES, "/lead-form"];

export async function proxy(request: NextRequest) {
  // /lead-form hướng tới khách quốc tế: chưa chọn ngôn ngữ thì mặc định tiếng Anh.
  // Chỉ override cookie trên request (SSR đọc "en"), không ghi cookie thật —
  // khách chọn tay qua switcher mới ghi (i18n/actions.ts setLocale).
  if (
    request.nextUrl.pathname.startsWith("/lead-form") &&
    !request.cookies.has(LOCALE_COOKIE)
  ) {
    request.cookies.set(LOCALE_COOKIE, "en");
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() vừa xác thực vừa kích hoạt refresh token + ghi lại cookie.
  // KHÔNG chèn code khác giữa createServerClient và getClaims().
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(p + "/"),
  );

  // Chuyển hướng nhưng giữ cookie session đã refresh.
  const redirectTo = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  // Chưa đăng nhập → chỉ vào được route công khai.
  if (!userId) {
    return isPublic ? response : redirectTo("/login");
  }

  // Đã đăng nhập → lấy role + status (RLS cho phép đọc chính mình).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", userId)
    .single();

  // Bị khoá → ép về /banned.
  if (profile?.status === "banned") {
    return path === "/banned" ? response : redirectTo("/banned");
  }

  // Active mà vào lại trang login/banned → về trang chủ.
  if (AUTH_PAGES.some((p) => path === p || path.startsWith(p + "/"))) {
    return redirectTo("/");
  }

  // Route public còn lại (vd /lead-form): ai cũng xem được, không gác gì thêm.
  if (isPublic) {
    return response;
  }

  // Route quản trị chỉ dành cho admin.
  const isAdminRoute =
    path.startsWith("/marketing") ||
    path.startsWith("/users") ||
    path.startsWith("/enums") ||
    path.startsWith("/services");
  if (isAdminRoute && profile?.role !== "admin") {
    return redirectTo("/");
  }

  return response;
}

export const config = {
  // API tự trả JSON + tự xác thực trong Route Handler; không redirect sang HTML login.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
