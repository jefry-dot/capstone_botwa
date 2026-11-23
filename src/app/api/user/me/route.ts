import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/user-auth";
import { getBotSettings, getTodayAiUsage } from "@/lib/bot-guard";
import { getSupabaseAdmin } from "@/lib/supabase";
import type {
  StickerCommandType,
  StickerSource,
  StickerStatus,
  SubscriptionOrderRow,
} from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface UserHistoryItem {
  id: string;
  source: StickerSource;
  command_type: StickerCommandType;
  caption_text: string | null;
  status: StickerStatus;
  processing_time_ms: number | null;
  file_size_kb: number | null;
  created_at: string;
}

export async function GET() {
  const auth = await requireUserApi();
  if (!auth.ok) return auth.response;

  const { user } = auth;

  try {
    const [settings, adminDb] = [await getBotSettings(), getSupabaseAdmin()];

    const dailyLimit = user.isProActive
      ? settings.daily_pro_ai_limit
      : settings.daily_ai_limit_per_user;

    const rateKey = user.linkedWaId
      ? `wa:${user.linkedWaId}`
      : `user:${user.id}`;

    const [aiUsedToday, ordersRes] = await Promise.all([
      getTodayAiUsage(rateKey),
      adminDb
        .from("subscription_orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    // Ambil riwayat stiker pribadi (baik lewat user_id maupun nomor WA yang sudah ditautkan)
    let logsQuery = adminDb
      .from("sticker_logs")
      .select(
        "id, source, command_type, caption_text, status, processing_time_ms, file_size_kb, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(20);

    if (user.linkedWaId) {
      logsQuery = logsQuery.or(
        `user_id.eq.${user.id},wa_id.eq.${user.linkedWaId}`
      );
    } else {
      logsQuery = logsQuery.eq("user_id", user.id);
    }

    let totalStickersQuery = adminDb
      .from("sticker_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "success");

    if (user.linkedWaId) {
      totalStickersQuery = totalStickersQuery.or(
        `user_id.eq.${user.id},wa_id.eq.${user.linkedWaId}`
      );
    } else {
      totalStickersQuery = totalStickersQuery.eq("user_id", user.id);
    }

    const [logsRes, totalRes] = await Promise.all([
      logsQuery,
      totalStickersQuery,
    ]);

    if (ordersRes.error) {
      console.error(
        "[API /api/user/me] Failed to load subscription_orders:",
        ordersRes.error.message
      );
    }
    if (logsRes.error) {
      console.error(
        "[API /api/user/me] Failed to load sticker_logs:",
        logsRes.error.message
      );
    }
    if (totalRes.error) {
      console.error(
        "[API /api/user/me] Failed to count sticker_logs:",
        totalRes.error.message
      );
    }

    return NextResponse.json(
      {
        user,
        quota: {
          usedToday: aiUsedToday,
          dailyLimit,
          remaining: Math.max(0, dailyLimit - aiUsedToday),
          freeLimit: settings.daily_ai_limit_per_user,
          proLimit: settings.daily_pro_ai_limit,
        },
        stats: {
          totalStickers: totalRes.count ?? 0,
        },
        recentLogs: (logsRes.data ?? []) as UserHistoryItem[],
        orders: (ordersRes.data ?? []) as SubscriptionOrderRow[],
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Gagal memuat data akun.";
    console.error("[API /api/user/me] Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
