import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, recordAdminAudit } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface AdminWaUserRow {
  wa_id: string;
  masked_wa_id: string;
  profile_name: string | null;
  total_stickers: number;
  first_seen_at: string;
  last_active_at: string;
  is_blocked: boolean;
  blocked_reason: string | null;
  blocked_at: string | null;
}

interface RawWaUserRow {
  wa_id: string;
  profile_name: string | null;
  total_stickers: number;
  first_seen_at: string;
  last_active_at: string;
  is_blocked: boolean;
  blocked_reason: string | null;
  blocked_at: string | null;
}

interface PatchUserBody {
  wa_id?: unknown;
  is_blocked?: unknown;
  blocked_reason?: unknown;
}

function maskWaId(waId: string): string {
  if (waId.length <= 6) return waId;
  return `${waId.slice(0, 4)}****${waId.slice(-3)}`;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get("filter") ?? "all";
    const search = (searchParams.get("search") ?? "").trim();

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("wa_users")
      .select(
        "wa_id, profile_name, total_stickers, first_seen_at, last_active_at, is_blocked, blocked_reason, blocked_at"
      )
      .order("last_active_at", { ascending: false })
      .limit(100);

    if (filter === "blocked") {
      query = query.eq("is_blocked", true);
    } else if (filter === "active") {
      query = query.eq("is_blocked", false);
    }

    if (search) {
      const safeSearch = search.replace(/[%_(),]/g, "");
      if (safeSearch) {
        query = query.or(
          `profile_name.ilike.%${safeSearch}%,wa_id.ilike.%${safeSearch}%`
        );
      }
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as RawWaUserRow[];
    const users: AdminWaUserRow[] = rows.map((row) => ({
      ...row,
      masked_wa_id: maskWaId(row.wa_id),
    }));

    return NextResponse.json(
      { users },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Gagal memuat daftar pengguna WA.";
    console.error("[API /api/admin/users GET] Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json().catch(() => null)) as
      | PatchUserBody
      | null;

    const waId = typeof body?.wa_id === "string" ? body.wa_id.trim() : "";
    const isBlocked = body?.is_blocked;
    const rawReason =
      typeof body?.blocked_reason === "string"
        ? body.blocked_reason.trim().slice(0, 200)
        : "";

    if (!waId) {
      return NextResponse.json(
        { error: "wa_id wajib diisi." },
        { status: 400 }
      );
    }

    if (typeof isBlocked !== "boolean") {
      return NextResponse.json(
        { error: "is_blocked harus bernilai boolean." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("wa_users")
      .update({
        is_blocked: isBlocked,
        blocked_reason: isBlocked
          ? rawReason || "Diblokir oleh Admin"
          : null,
        blocked_at: isBlocked ? new Date().toISOString() : null,
      })
      .eq("wa_id", waId)
      .select(
        "wa_id, profile_name, total_stickers, first_seen_at, last_active_at, is_blocked, blocked_reason, blocked_at"
      )
      .maybeSingle<RawWaUserRow>();

    if (error) throw new Error(error.message);
    if (!data) {
      return NextResponse.json(
        { error: "Pengguna WhatsApp tidak ditemukan." },
        { status: 404 }
      );
    }

    const masked = maskWaId(data.wa_id);

    await recordAdminAudit({
      admin: auth.admin,
      action: isBlocked ? "block_wa_user" : "unblock_wa_user",
      target: masked,
      details: {
        profile_name: data.profile_name,
        is_blocked: isBlocked,
        blocked_reason: data.blocked_reason,
      },
    });

    return NextResponse.json(
      {
        user: {
          ...data,
          masked_wa_id: masked,
        } satisfies AdminWaUserRow,
      },
      { status: 200 }
    );
  } catch (err) {
    const errMsg =
      err instanceof Error
        ? err.message
        : "Gagal mengubah status blokir pengguna.";
    console.error("[API /api/admin/users PATCH] Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}