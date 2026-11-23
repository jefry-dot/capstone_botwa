import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/user-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * POST: Generate kode verifikasi 6 digit (berlaku 15 menit) untuk dikirim ke Bot WA lewat `/link <kode>`.
 */
export async function POST() {
  const auth = await requireUserApi();
  if (!auth.ok) return auth.response;

  try {
    const adminDb = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    let code = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = String(crypto.randomInt(100000, 1000000));
      const { data: existing } = await adminDb
        .from("user_profiles")
        .select("id")
        .eq("link_code", candidate)
        .gt("link_code_expires_at", nowIso)
        .neq("id", auth.user.id)
        .limit(1);

      if (!existing || existing.length === 0) {
        code = candidate;
        break;
      }
    }

    if (!code) {
      throw new Error(
        "Gagal menghasilkan kode verifikasi unik. Silakan coba lagi."
      );
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error } = await adminDb
      .from("user_profiles")
      .update({
        link_code: code,
        link_code_expires_at: expiresAt,
        updated_at: nowIso,
      })
      .eq("id", auth.user.id);

    if (error) throw new Error(error.message);

    return NextResponse.json(
      {
        ok: true,
        linkCode: code,
        linkCodeExpiresAt: expiresAt,
      },
      { status: 200 }
    );
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Gagal membuat kode tautan WA.";
    console.error("[API /api/user/link-wa POST] Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

/**
 * DELETE: Putuskan tautan nomor WhatsApp dari akun ini.
 */
export async function DELETE() {
  const auth = await requireUserApi();
  if (!auth.ok) return auth.response;

  try {
    const adminDb = getSupabaseAdmin();
    const { error } = await adminDb
      .from("user_profiles")
      .update({
        linked_wa_id: null,
        link_code: null,
        link_code_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auth.user.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Gagal memutus tautan WhatsApp.";
    console.error("[API /api/user/link-wa DELETE] Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
