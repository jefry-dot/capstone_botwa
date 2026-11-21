import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase";

export type AdminRole = "superadmin" | "admin";

export interface AdminSession {
  userId: string;
  email: string;
  fullName: string | null;
  role: AdminRole;
}

interface AdminProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: AdminRole;
  is_active: boolean;
}

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Aman diabaikan saat dipanggil dari Server Component (cookie read-only)
        }
      },
    },
  });
}

/**
 * Mengambil sesi Admin aktif yang sudah terverifikasi di Supabase Auth & tabel admin_profiles.
 * Mengembalikan null jika belum login atau bukan admin aktif.
 */
export async function getCurrentAdmin(): Promise<AdminSession | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    const adminDb = getSupabaseAdmin();
    const { data: profile, error: profileError } = await adminDb
      .from("admin_profiles")
      .select("id, email, full_name, role, is_active")
      .eq("id", user.id)
      .eq("is_active", true)
      .maybeSingle<AdminProfileRow>();

    if (profileError || !profile) {
      return null;
    }

    return {
      userId: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role,
    };
  } catch (err) {
    console.error("[Auth] Failed to resolve current admin:", err);
    return null;
  }
}

/**
 * Guard untuk Server Component halaman privat (/dashboard, /admin/*).
 */
export async function requireAdminPage(
  currentPath = "/dashboard",
  allowedRoles: AdminRole[] = ["superadmin", "admin"]
): Promise<AdminSession> {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect(`/admin/login?next=${encodeURIComponent(currentPath)}`);
  }

  if (!allowedRoles.includes(admin.role)) {
    redirect("/admin/login?error=forbidden");
  }

  return admin;
}

/**
 * Guard untuk Backend API Routes (/api/stats, /api/admin/*).
 */
export async function requireAdminApi(
  allowedRoles: AdminRole[] = ["superadmin", "admin"]
): Promise<
  | { ok: true; admin: AdminSession }
  | { ok: false; response: NextResponse }
> {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized. Silakan login sebagai admin." },
        { status: 401 }
      ),
    };
  }

  if (!allowedRoles.includes(admin.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden. Hak akses role tidak mencukupi." },
        { status: 403 }
      ),
    };
  }

  return { ok: true, admin };
}

/**
 * Mencatat aktivitas perubahan penting admin ke tabel admin_audit_logs.
 */
export async function recordAdminAudit(params: {
  admin: AdminSession;
  action: string;
  target?: string | null;
  details?: Record<string, unknown> | null;
}) {
  try {
    const adminDb = getSupabaseAdmin();
    const { error } = await adminDb.from("admin_audit_logs").insert({
      admin_id: params.admin.userId,
      admin_email: params.admin.email,
      action: params.action,
      target: params.target ?? null,
      details: params.details ?? null,
    });

    if (error) {
      console.error("[Audit] Failed to insert admin_audit_logs:", error);
    }
  } catch (err) {
    console.error("[Audit] Unexpected audit log error:", err);
  }
}