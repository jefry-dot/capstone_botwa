import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, recordAdminAudit } from "@/lib/auth";
import { getBotSettings, type BotSettings } from "@/lib/bot-guard";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PatchSettingsBody {
  maintenance_mode?: unknown;
  ai_meme_enabled?: unknown;
  daily_ai_limit_per_user?: unknown;
  daily_web_ai_limit_per_ip?: unknown;
  maintenance_message?: unknown;
}

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const settings = await getBotSettings();
    return NextResponse.json(
      { settings },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Gagal memuat pengaturan bot.";
    console.error("[API /api/admin/settings GET] Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json().catch(() => null)) as
      | PatchSettingsBody
      | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Payload JSON tidak valid." },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (body.maintenance_mode !== undefined) {
      if (typeof body.maintenance_mode !== "boolean") {
        return NextResponse.json(
          { error: "maintenance_mode harus bernilai boolean." },
          { status: 400 }
        );
      }
      updates.maintenance_mode = body.maintenance_mode;
    }

    if (body.ai_meme_enabled !== undefined) {
      if (typeof body.ai_meme_enabled !== "boolean") {
        return NextResponse.json(
          { error: "ai_meme_enabled harus bernilai boolean." },
          { status: 400 }
        );
      }
      updates.ai_meme_enabled = body.ai_meme_enabled;
    }

    if (body.daily_ai_limit_per_user !== undefined) {
      const val = Number(body.daily_ai_limit_per_user);
      if (!Number.isInteger(val) || val < 0 || val > 1000) {
        return NextResponse.json(
          { error: "daily_ai_limit_per_user harus bilangan bulat 0–1000." },
          { status: 400 }
        );
      }
      updates.daily_ai_limit_per_user = val;
    }

    if (body.daily_web_ai_limit_per_ip !== undefined) {
      const val = Number(body.daily_web_ai_limit_per_ip);
      if (!Number.isInteger(val) || val < 0 || val > 1000) {
        return NextResponse.json(
          { error: "daily_web_ai_limit_per_ip harus bilangan bulat 0–1000." },
          { status: 400 }
        );
      }
      updates.daily_web_ai_limit_per_ip = val;
    }

    if (body.maintenance_message !== undefined) {
      if (typeof body.maintenance_message !== "string") {
        return NextResponse.json(
          { error: "maintenance_message harus berupa teks." },
          { status: 400 }
        );
      }
      const trimmedMsg = body.maintenance_message.trim();
      if (!trimmedMsg || trimmedMsg.length > 300) {
        return NextResponse.json(
          { error: "Pesan maintenance harus 1–300 karakter." },
          { status: 400 }
        );
      }
      updates.maintenance_message = trimmedMsg;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Tidak ada perubahan yang dikirim." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("bot_settings")
      .upsert(
        {
          id: 1,
          ...updates,
          updated_by: auth.admin.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select(
        "id, maintenance_mode, ai_meme_enabled, daily_ai_limit_per_user, daily_web_ai_limit_per_ip, maintenance_message, updated_at"
      )
      .single<BotSettings>();

    if (error || !data) {
      throw new Error(error?.message || "Gagal menyimpan pengaturan bot.");
    }

    await recordAdminAudit({
      admin: auth.admin,
      action: "update_bot_settings",
      target: "bot_settings:1",
      details: updates,
    });

    return NextResponse.json({ settings: data }, { status: 200 });
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Gagal memperbarui pengaturan bot.";
    console.error("[API /api/admin/settings PATCH] Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}