import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rute login/register publik selalu boleh diakses
  if (
    pathname === "/admin/login" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/api/admin/auth/login" ||
    pathname === "/api/admin/auth/logout" ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next();
  }

  const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const isAdminRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/stats") ||
    pathname.startsWith("/api/admin");

  const isProtectedRoute =
    isAdminRoute ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/api/user");

  if (!rawSupabaseUrl || !supabaseAnonKey) {
    if (!isProtectedRoute) {
      return NextResponse.next();
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Server auth configuration is missing." },
        { status: 500 }
      );
    }
    const fallbackLogin = isAdminRoute ? "/admin/login" : "/login";
    return NextResponse.redirect(
      new URL(`${fallbackLogin}?error=config`, request.url)
    );
  }

  // Pada halaman publik (/), hanya refresh sesi jika pengunjung memang memiliki cookie sesi Supabase
  if (
    !isProtectedRoute &&
    !request.cookies.getAll().some((c) => c.name.startsWith("sb-"))
  ) {
    return NextResponse.next();
  }

  const supabaseUrl = rawSupabaseUrl
    .replace(/\/rest\/v1\/?$/i, "")
    .replace(/\/+$/, "");

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh sesi & validasi token user dari Supabase Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedRoute) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: isAdminRoute
            ? "Unauthorized. Admin authentication required."
            : "Unauthorized. Silakan login terlebih dahulu.",
        },
        { status: 401 }
      );
    }

    const loginPath = isAdminRoute ? "/admin/login" : "/login";
    const loginUrl = new URL(loginPath, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/",
    "/dashboard",
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
    "/account",
    "/account/:path*",
    "/api/stats",
    "/api/admin/:path*",
    "/api/user/:path*",
  ],
};
