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
    barColor: "bg-[#161614]",
    badgeClass: "bg-[#FFD646] text-[#161614]",
  },
  quote_chat: {
    label: "Quote Chat (/qc)",
    barColor: "bg-[#B9F32B]",
    badgeClass: "bg-[#B9F32B] text-[#161614]",
  },
  brat_text: {
    label: "Brat Text (/brat)",
    barColor: "bg-[#8ACE00]",
    badgeClass: "bg-[#8ACE00] text-[#161614]",
  },
  breaking_news: {
    label: "Breaking News (/news)",
    barColor: "bg-[#EB3B2E]",
    badgeClass: "bg-[#EB3B2E] text-white",
  },
  meme_text: {
    label: "Classic Meme",
    barColor: "bg-[#FFD646]",
    badgeClass: "bg-[#EFE7D8] text-[#161614]",
  },
  crop: {
    label: "Smart Crop 1:1",
    barColor: "bg-[#5C584F]",
    badgeClass: "bg-[#F5F0E6] text-[#161614]",
  },
  standard: {
    label: "Standard WebP",
    barColor: "bg-[#3B3934]",
    badgeClass: "bg-[#EFE7D8] text-[#161614]",
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
      <div className="zine-card p-5 lg:col-span-7">
        <div className="mb-4 flex items-center justify-between gap-2 border-b-2 border-[#161614] pb-3">
          <div>
            <h2 className="font-display text-base font-bold text-[#161614]">
              Tren Pembuatan Stiker Harian
            </h2>
            <p className="font-mono text-[11px] text-[#5C584F]">
              Perbandingan WhatsApp Bot vs Web Studio (14 hari terakhir)
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center border-2 border-[#161614] bg-[#B9F32B] text-[#161614]">
            <BarChart3 className="h-4 w-4" />
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center border-2 border-dashed border-[#161614]/40 bg-[#F5F0E6] text-center text-[#5C584F]">
            <BarChart3 className="mb-2 h-8 w-8 opacity-50" />
            <p className="font-display text-sm font-bold text-[#161614]">
              Belum ada data harian
            </p>
            <p className="mt-1 font-mono text-xs">
              Buat stiker dari Web Studio atau Bot WA untuk melihat grafik di
              sini.
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
                  stroke="#d5cdbe"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#3B3934" }}
                  axisLine={{ stroke: "#161614" }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#3B3934" }}
                  axisLine={{ stroke: "#161614" }}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "#EFE7D8" }}
                  contentStyle={{
                    borderRadius: "0px",
                    border: "2px solid #161614",
                    backgroundColor: "#FFFDF7",
                    fontSize: "12px",
                    boxShadow: "3px 3px 0px #161614",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                />
                <Bar
                  dataKey="whatsapp"
                  name="WhatsApp Bot"
                  fill="#8ACE00"
                  stroke="#161614"
                  strokeWidth={1.5}
                  maxBarSize={30}
                />
                <Bar
                  dataKey="web"
                  name="Web Studio"
                  fill="#161614"
                  stroke="#161614"
                  strokeWidth={1.5}
                  maxBarSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Kanan: Breakdown Popularitas Fitur */}
      <div className="zine-card p-5 lg:col-span-5">
        <div className="mb-4 flex items-center justify-between gap-2 border-b-2 border-[#161614] pb-3">
          <div>
            <h2 className="font-display text-base font-bold text-[#161614]">
              Popularitas Fitur Stiker
            </h2>
            <p className="font-mono text-[11px] text-[#5C584F]">
              Pemakaian per mode &amp; rata-rata latency
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center border-2 border-[#161614] bg-[#FFD646] text-[#161614]">
            <Flame className="h-4 w-4" />
          </div>
        </div>

        {featureStats.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center border-2 border-dashed border-[#161614]/40 bg-[#F5F0E6] text-center text-[#5C584F]">
            <Flame className="mb-2 h-8 w-8 opacity-50" />
            <p className="font-display text-sm font-bold text-[#161614]">
              Belum ada statistik fitur
            </p>
            <p className="mt-1 font-mono text-xs">
              Data tren 7 mode stiker akan muncul otomatis di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {featureStats.map((item) => {
              const meta = FEATURE_META[item.command_type] ?? {
                label: item.command_type,
                barColor: "bg-[#161614]",
                badgeClass: "bg-[#EFE7D8] text-[#161614]",
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
                      className={`border border-[#161614] px-2 py-0.5 font-mono text-[11px] font-bold ${meta.badgeClass}`}
                    >
                      {meta.label}
                    </span>
                    <div className="flex items-center gap-2 font-mono text-[#45433D]">
                      <span className="font-bold text-[#161614]">
                        {used.toLocaleString("id-ID")}x
                      </span>
                      <span className="text-[11px] text-[#5C584F]">
                        ({item.avg_process_ms ?? 0} ms)
                      </span>
                    </div>
                  </div>
                  <div className="h-3 w-full overflow-hidden border border-[#161614] bg-[#F5F0E6]">
                    <div
                      className={`h-full transition-all ${meta.barColor}`}
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
