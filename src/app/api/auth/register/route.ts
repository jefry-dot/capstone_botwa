import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

interface RegisterBody {
  fullName?: unknown;
  email?: unknown;
  password?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as RegisterBody | null;
    const fullName =
      typeof body?.fullName === "string" ? body.fullName.trim() : "";
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!fullName || fullName.length < 2 || fullName.length > 60) {
      return NextResponse.json(
        { error: "Nama lengkap wajib diisi (2–60 karakter)." },
        { status: 400 }
      );
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Format email tidak valid." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password minimal 6 karakter." },
        { status: 400 }
      );
    }

    const adminDb = getSupabaseAdmin();

    // Buat akun langsung aktif tanpa konfirmasi email (email_confirm: true)
    const { data: created, error: createErr } =
      await adminDb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (createErr || !created.user) {
      const rawMsg = createErr?.message ?? "";
      const isDuplicate =
        rawMsg.toLowerCase().includes("already") ||
        rawMsg.toLowerCase().includes("exists");
      return NextResponse.json(
        {
          error: isDuplicate
            ? "Email ini sudah terdaftar. Silakan masuk di halaman Login."
            : rawMsg || "Gagal membuat akun baru.",
        },
        { status: isDuplicate ? 409 : 400 }
      );
    }

    // Simpan ke tabel user_profiles (BUKAN admin_profiles)
    const { error: profileErr } = await adminDb.from("user_profiles").upsert(
      {
        id: created.user.id,
        email,
        full_name: fullName,
        plan: "free",
      },
      { onConflict: "id" }
    );

    if (profileErr) {
      console.error("[API /api/auth/register] Profile insert error:", profileErr);
      return NextResponse.json(
        {
          error:
            "Akun berhasil dibuat, namun tabel user_profiles belum tersedia. Pastikan supabase/premium_migration.sql sudah dijalankan.",
        },
        { status: 500 }
      );
    }

    // Langsung login agar session cookie terpasang
    const supabase = await createSupabaseServerClient();
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInErr) {
      return NextResponse.json(
        {
          ok: true,
          message: "Akun berhasil dibuat. Silakan login.",
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: created.user.id,
          email,
          fullName,
          plan: "free",
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Terjadi kesalahan saat registrasi.";
    console.error("[API /api/auth/register] Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
