import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, recordAdminAudit } from "@/lib/auth";
import { maskWaPhone, resolveEffectivePlan } from "@/lib/user-auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { UserPlan, UserProfileRow } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PatchMemberBody {
  userId?: unknown;
  plan?: unknown;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const planFilter = request.nextUrl.searchParams.get("plan") ?? "all";

    const adminDb = getSupabaseAdmin();
    let query = adminDb
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (planFilter === "pro" || planFilter === "free") {
      query = query.eq("plan", planFilter);
    }

    if (search) {
      const safe = search.replace(/[%_,'()]/g, "");
      if (safe) {
        query = query.or(
          `full_name.ilike.%${safe}%,email.ilike.%${safe}%,linked_wa_id.ilike.%${safe}%`
        );
      }
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const members = ((data ?? []) as UserProfileRow[]).map((row) => {
      const { effectivePlan, isProActive } = resolveEffectivePlan(
        row.plan,
        row.pro_expires_at
      );
      return {
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        plan: effectivePlan,
        is_pro_active: isProActive,
        pro_expires_at: isProActive ? row.pro_expires_at : null,
        custom_pack_name: row.custom_pack_name,
        custom_pack_author: row.custom_pack_author,
        masked_wa_id: maskWaPhone(row.linked_wa_id),
        created_at: row.created_at,
      };
    });

    return NextResponse.json(
      { members },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Gagal memuat daftar akun web.";
    console.error("[API /api/admin/members GET] Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json().catch(() => null)) as PatchMemberBody | null;
    const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
    const plan = body?.plan as UserPlan;

    if (!userId || (plan !== "free" && plan !== "pro")) {
      return NextResponse.json(
        { error: "Parameter userId dan plan ('free' atau 'pro') wajib valid." },
        { status: 400 }
      );
    }

    const proExpiresAt =
      plan === "pro"
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const adminDb = getSupabaseAdmin();
    const { data: updated, error } = await adminDb
      .from("user_profiles")
      .update({
        plan,
        pro_expires_at: proExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("*")
      .single<UserProfileRow>();

    if (error || !updated) {
      throw new Error(error?.message || "Gagal memperbarui paket user.");
    }

    if (plan === "pro") {
      await adminDb.from("subscription_orders").insert({
        user_id: userId,
        plan: "pro",
        amount_idr: 0,
        payment_method: "admin_grant",
        voucher_code: "ADMIN_GRANT",
        status: "paid",
      });
    }

    await recordAdminAudit({
      admin: auth.admin,
      action: plan === "pro" ? "grant_pro_plan" : "revoke_pro_plan",
      target: `user_profile:${updated.email}`,
      details: { userId, plan, proExpiresAt },
    });

    return NextResponse.json(
      {
        ok: true,
        member: {
          id: updated.id,
          email: updated.email,
          full_name: updated.full_name,
          plan: updated.plan,
          is_pro_active: updated.plan === "pro",
          pro_expires_at: updated.pro_expires_at,
          custom_pack_name: updated.custom_pack_name,
          custom_pack_author: updated.custom_pack_author,
          masked_wa_id: maskWaPhone(updated.linked_wa_id),
          created_at: updated.created_at,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Gagal mengubah paket user.";
    console.error("[API /api/admin/members PATCH] Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
