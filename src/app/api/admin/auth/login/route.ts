import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  recordAdminAudit,
  type AdminRole,
} from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

interface LoginBody {
  email?: string;
  password?: string;
}

interface AdminProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: AdminRole;
  is_active: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as LoginBody | null;
    const email = body?.email?.trim().toLowerCase() ?? "";
    const password = body?.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan password wajib diisi." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Email atau password salah." },
        { status: 401 }
      );
    }

    // Verifikasi apakah user terdaftar sebagai admin aktif di tabel admin_profiles
    const adminDb = getSupabaseAdmin();
    const { data: profile, error: profileError } = await adminDb
      .from("admin_profiles")
      .select("id, email, full_name, role, is_active")
      .eq("id", authData.user.id)
      .eq("is_active", true)
      .maybeSingle<AdminProfileRow>();

    if (profileError || !profile) {
      // Cabut sesi agar akun non-admin tidak menyimpan cookie auth
      await supabase.auth.signOut();
      return NextResponse.json(
        {
          error:
            "Akun ini tidak memiliki hak akses Admin atau statusnya nonaktif.",
        },
        { status: 403 }
      );
    }

    await recordAdminAudit({
      admin: {
        userId: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role,
      },
      action: "admin_login",
      target: profile.email,
      details: { role: profile.role },
    });

    return NextResponse.json(
      {
        admin: {
          email: profile.email,
          fullName: profile.full_name,
          role: profile.role,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Login gagal.";
    console.error("[API /api/admin/auth/login] Error:", errMsg);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memproses login." },
      { status: 500 }
    );
  }
}