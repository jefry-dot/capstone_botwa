import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Halaman login admin & endpoint login/logout selalu boleh diakses
  if (
    pathname === "/admin/login" ||
    pathname === "/api/admin/auth/login" ||
    pathname === "/api/admin/auth/logout"
  ) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Server auth configuration is missing." },
        { status: 500 }
      );
    }
    return NextResponse.redirect(new URL("/admin/login?error=config", request.url));
  }

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

  if (!user) {
    // Jika akses API privat tanpa sesi, kembalikan JSON 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized. Admin authentication required." },
        { status: 401 }
      );
    }

    // Jika akses halaman Dashboard / Admin UI tanpa sesi, arahkan ke /admin/login
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
    "/api/stats",
    "/api/admin/:path*",
  ],
};