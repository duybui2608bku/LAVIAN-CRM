import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 renamed Middleware -> Proxy (see node_modules/next/dist/docs proxy guide).
// Cổng xác thực: refresh session + chặn chưa-đăng-nhập / banned / route admin.

// Route công khai (không cần đăng nhập).
const PUBLIC_PATHS = ["/login", "/banned"];

export async function proxy(request: NextRequest) {
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
  if (isPublic) {
    return redirectTo("/");
  }

  // Route quản trị chỉ dành cho admin.
  if (path.startsWith("/users") && profile?.role !== "admin") {
    return redirectTo("/");
  }

  return response;
}

export const config = {
  // Run on all routes except static assets and image files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
