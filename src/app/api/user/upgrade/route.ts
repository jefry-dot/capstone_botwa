import { NextRequest, NextResponse } from "next/server";
import { requireUserApi } from "@/lib/user-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const VALID_DEMO_VOUCHERS = new Set(["CAPSTONEPRO", "AMBABOTPRO", "DEMO2026"]);
const PRO_DURATION_DAYS = 30;
const PRO_PRICE_IDR = 15000;

interface UpgradeBody {
  method?: unknown;
  voucherCode?: unknown;
}

export async function POST(request: NextRequest) {
  const auth = await requireUserApi();
  if (!auth.ok) return auth.response;

  const { user } = auth;

  try {
    const body = (await request.json().catch(() => ({}))) as UpgradeBody;
    const method = body.method === "voucher" ? "voucher" : "qris_demo";
    const voucherCode =
      typeof body.voucherCode === "string"
        ? body.voucherCode.trim().toUpperCase()
        : "";

    if (method === "voucher") {
      if (!VALID_DEMO_VOUCHERS.has(voucherCode)) {
        return NextResponse.json(
          {
            error:
              "Kode voucher tidak valid. Gunakan kode demo: CAPSTONEPRO atau AMBABOTPRO.",
          },
          { status: 400 }
        );
      }
    }

    // Perpanjang 30 hari dari tanggal sekarang (atau dari pro_expires_at jika masih aktif)
    const baseTime =
      user.isProActive && user.proExpiresAt
        ? Math.max(Date.now(), new Date(user.proExpiresAt).getTime())
        : Date.now();
    const nextExpiresAt = new Date(
      baseTime + PRO_DURATION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const adminDb = getSupabaseAdmin();

    const { error: updateErr } = await adminDb
      .from("user_profiles")
      .update({
        plan: "pro",
        pro_expires_at: nextExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateErr) throw new Error(updateErr.message);

    const { error: orderErr } = await adminDb
      .from("subscription_orders")
      .insert({
        user_id: user.id,
        plan: "pro",
        amount_idr: method === "voucher" ? 0 : PRO_PRICE_IDR,
        payment_method: method,
        voucher_code: method === "voucher" ? voucherCode : null,
        status: "paid",
      });

    if (orderErr) {
      console.error("[API /api/user/upgrade] Order log error:", orderErr);
    }

    return NextResponse.json(
      {
        ok: true,
        plan: "pro",
        proExpiresAt: nextExpiresAt,
        message:
          method === "voucher"
            ? `Voucher ${voucherCode} berhasil diklaim! Paket PRO CREATOR aktif 30 hari.`
            : "Simulasi pembayaran QRIS berhasil! Paket PRO CREATOR aktif 30 hari.",
      },
      { status: 200 }
    );
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Gagal memproses upgrade Pro.";
    console.error("[API /api/user/upgrade] Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
