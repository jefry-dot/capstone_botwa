import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

interface LoginBody {
  email?: unknown;
  password?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as LoginBody | null;
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan password wajib diisi." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: "Email atau password salah." },
        { status: 401 }
      );
    }

    // Pastikan baris user_profiles tersedia
    const adminDb = getSupabaseAdmin();
    const fullName =
      (typeof data.user.user_metadata?.full_name === "string" &&
        data.user.user_metadata.full_name.trim()) ||
      email.split("@")[0] ||
      "Pengguna";

    await adminDb.from("user_profiles").upsert(
      {
        id: data.user.id,
        email,
        full_name: fullName,
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Gagal memproses login.";
    console.error("[API /api/auth/login] Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
