"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { BarChart3, Flame } from "lucide-react";
import type {
  DailyStatsRow,
  FeatureStatsRow,
  StickerCommandType,
} from "@/types/database";

interface ActivityChartProps {
  dailyStats: DailyStatsRow[];
  featureStats: FeatureStatsRow[];
}

const FEATURE_META: Record<
  StickerCommandType,
  { label: string; barColor: string; badgeClass: string }
> = {
  ai_meme: {
    label: "AI Meme / Roast",
    barColor: "bg-violet-500",
    badgeClass: "bg-violet-50 text-violet-700",
  },
  quote_chat: {
    label: "Quote Chat (/qc)",
    barColor: "bg-emerald-500",
    badgeClass: "bg-emerald-50 text-emerald-700",
  },
  brat_text: {
    label: "Brat Text (/brat)",
    barColor: "bg-lime-500",
    badgeClass: "bg-lime-100 text-lime-800",
  },
  breaking_news: {
    label: "Breaking News (/news)",
    barColor: "bg-rose-500",
    badgeClass: "bg-rose-50 text-rose-700",
  },
  meme_text: {
    label: "Classic Meme",
    barColor: "bg-amber-500",
    badgeClass: "bg-amber-50 text-amber-700",
  },
  crop: {
    label: "Smart Crop 1:1",
    barColor: "bg-sky-500",
    badgeClass: "bg-sky-50 text-sky-700",
  },
  standard: {
    label: "Standard WebP",
    barColor: "bg-slate-600",
    badgeClass: "bg-slate-100 text-slate-700",
  },
};

function formatShortDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
  }).format(parsed);
}

export default function ActivityChart({
  dailyStats,
  featureStats,
}: ActivityChartProps) {
  // Gabungkan data harian per tanggal agar WhatsApp & Web muncul berdampingan (maks 14 hari terakhir)
  const chartData = useMemo(() => {
    const grouped = new Map<
      string,
      { date: string; label: string; whatsapp: number; web: number }
    >();

    for (const row of dailyStats) {
      const existing = grouped.get(row.log_date) ?? {
        date: row.log_date,
        label: formatShortDate(row.log_date),
        whatsapp: 0,
        web: 0,
      };

      const count = Number(row.success_count ?? 0);
      if (row.source === "whatsapp") {
        existing.whatsapp += count;
      } else {
        existing.web += count;
      }

      grouped.set(row.log_date, existing);
    }

    return Array.from(grouped.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);
  }, [dailyStats]);

  const maxFeatureUsage = useMemo(() => {
    return featureStats.reduce(
      (max, item) => Math.max(max, Number(item.total_used ?? 0)),
      0
    );
  }, [featureStats]);

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Kiri: Grafik Tren Harian WA vs Web */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Tren Pembuatan Stiker Harian
            </h2>
            <p className="text-xs text-slate-500">
              Perbandingan stiker sukses dari WhatsApp Bot vs Web Studio (14 hari terakhir)
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <BarChart3 className="h-4 w-4" />
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-slate-500">
            <BarChart3 className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">Belum ada data harian</p>
            <p className="mt-1 text-xs">
              Buat stiker dari Web Studio atau Bot WA untuk melihat grafik di sini.
            </p>
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                />
                <Bar
                  dataKey="whatsapp"
                  name="WhatsApp Bot"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={30}
                />
                <Bar
                  dataKey="web"
                  name="Web Studio"
                  fill="#0f172a"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Kanan: Breakdown Popularitas Fitur */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Popularitas Fitur Stiker
            </h2>
            <p className="text-xs text-slate-500">
              Pemakaian per mode &amp; rata-rata waktu proses
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Flame className="h-4 w-4" />
          </div>
        </div>

        {featureStats.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-slate-500">
            <Flame className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">Belum ada statistik fitur</p>
            <p className="mt-1 text-xs">
              Data tren 7 mode stiker akan muncul otomatis di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {featureStats.map((item) => {
              const meta = FEATURE_META[item.command_type] ?? {
                label: item.command_type,
                barColor: "bg-slate-500",
                badgeClass: "bg-slate-100 text-slate-700",
              };
              const used = Number(item.total_used ?? 0);
              const widthPercent =
                maxFeatureUsage > 0
                  ? Math.max(6, Math.round((used / maxFeatureUsage) * 100))
                  : 0;

              return (
                <div key={item.command_type} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span
                      className={`rounded-md px-2 py-0.5 font-semibold ${meta.badgeClass}`}
                    >
                      {meta.label}
                    </span>
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="font-bold text-slate-900">
                        {used.toLocaleString("id-ID")}x
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ({item.avg_process_ms ?? 0} ms)
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${meta.barColor}`}
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}