import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import type {
  DailyStatsRow,
  DashboardStatsResponse,
  FeatureStatsRow,
  RecentActivityRow,
} from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const supabase = getSupabaseAdmin();

    const [
      dailyRes,
      featureRes,
      recentRes,
      waUsersRes,
      totalSuccessRes,
      totalFailedRes,
    ] = await Promise.all([
      supabase
        .from("dashboard_daily_stats")
        .select("*")
        .order("log_date", { ascending: false })
        .limit(1000),
      supabase
        .from("dashboard_feature_stats")
        .select("*")
        .order("total_used", { ascending: false }),
      supabase
        .from("dashboard_recent_activity")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
      // Hanya ambil angka COUNT, jangan pernah select wa_id
      supabase.from("wa_users").select("*", { count: "exact", head: true }),
      supabase
        .from("sticker_logs")
        .select("id", { count: "exact", head: true })
        .eq("status", "success"),
      supabase
        .from("sticker_logs")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),
    ]);

    if (dailyRes.error) throw new Error(dailyRes.error.message);
    if (featureRes.error) throw new Error(featureRes.error.message);
    if (recentRes.error) throw new Error(recentRes.error.message);
    if (waUsersRes.error) throw new Error(waUsersRes.error.message);
    if (totalSuccessRes.error) throw new Error(totalSuccessRes.error.message);
    if (totalFailedRes.error) throw new Error(totalFailedRes.error.message);

    const allDailyStats = (dailyRes.data ?? []) as DailyStatsRow[];
    const dailyStats = allDailyStats.slice(0, 60);
    const featureStats = (featureRes.data ?? []) as FeatureStatsRow[];
    const recentActivity = (recentRes.data ?? []) as RecentActivityRow[];
    const totalWaUsers = waUsersRes.count ?? 0;

    // Hitung agregasi KPI global all-time (tidak terpotong limit 60 baris grafik)
    const totalSuccess = totalSuccessRes.count ?? 0;
    const totalFailed = totalFailedRes.count ?? 0;

    let weightedFeatureMs = 0;
    let featureUsedTotal = 0;
    for (const row of featureStats) {
      const used = Number(row.total_used ?? 0);
      if (used > 0 && row.avg_process_ms != null) {
        weightedFeatureMs += Number(row.avg_process_ms) * used;
        featureUsedTotal += used;
      }
    }

    let weightedSizeKb = 0;
    let sizeSuccessTotal = 0;
    for (const row of allDailyStats) {
      const success = Number(row.success_count ?? 0);
      if (success > 0 && row.avg_size_kb != null) {
        weightedSizeKb += Number(row.avg_size_kb) * success;
        sizeSuccessTotal += success;
      }
    }

    const totalStickers = totalSuccess + totalFailed;
    const successRate =
      totalStickers > 0
        ? Number(((totalSuccess / totalStickers) * 100).toFixed(1))
        : 0;
    const avgProcessMs =
      featureUsedTotal > 0
        ? Math.round(weightedFeatureMs / featureUsedTotal)
        : 0;
    const avgSizeKb =
      sizeSuccessTotal > 0
        ? Number((weightedSizeKb / sizeSuccessTotal).toFixed(2))
        : 0;

    const payload: DashboardStatsResponse = {
      summary: {
        totalStickers,
        totalSuccess,
        totalFailed,
        successRate,
        avgProcessMs,
        avgSizeKb,
        totalWaUsers,
      },
      dailyStats,
      featureStats,
      recentActivity,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Failed to load stats.";
    console.error("[API /api/stats] Error:", errMsg);

    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}