import { Sparkles, CheckCircle2, Gauge, Users } from "lucide-react";

export interface StatsSummary {
  totalStickers: number;
  totalSuccess: number;
  totalFailed: number;
  successRate: number;
  avgProcessMs: number;
  avgSizeKb: number;
  totalWaUsers: number;
}

interface StatsCardsProps {
  summary: StatsSummary;
}

export default function StatsCards({ summary }: StatsCardsProps) {
  const cards = [
    {
      title: "Total Stiker Dibuat",
      value: summary.totalStickers.toLocaleString("id-ID"),
      subtitle: `${summary.totalSuccess.toLocaleString("id-ID")} sukses • ${summary.totalFailed.toLocaleString("id-ID")} gagal`,
      icon: Sparkles,
      iconClass: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Success Rate",
      value: `${summary.successRate}%`,
      subtitle: "Tingkat keberhasilan render WebP",
      icon: CheckCircle2,
      iconClass: "bg-blue-50 text-blue-600",
    },
    {
      title: "Rata-rata Latency",
      value: `${summary.avgProcessMs.toLocaleString("id-ID")} ms`,
      subtitle: `Rata-rata ukuran ${summary.avgSizeKb} KB (< 100 KB)`,
      icon: Gauge,
      iconClass: "bg-amber-50 text-amber-600",
    },
    {
      title: "User WhatsApp Aktif",
      value: summary.totalWaUsers.toLocaleString("id-ID"),
      subtitle: "Pengguna unik terdaftar di bot",
      icon: Users,
      iconClass: "bg-violet-50 text-violet-600",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  {card.title}
                </p>
                <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
                  {card.value}
                </p>
              </div>
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconClass}`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">{card.subtitle}</p>
          </div>
        );
      })}
    </div>
  );
}