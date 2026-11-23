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
      iconClass: "bg-[#B9F32B] text-[#161614]",
    },
    {
      title: "Success Rate",
      value: `${summary.successRate}%`,
      subtitle: "Tingkat keberhasilan render WebP",
      icon: CheckCircle2,
      iconClass: "bg-[#FFD646] text-[#161614]",
    },
    {
      title: "Rata-rata Latency",
      value: `${summary.avgProcessMs.toLocaleString("id-ID")} ms`,
      subtitle: `Rata-rata ukuran ${summary.avgSizeKb} KB (< 100 KB)`,
      icon: Gauge,
      iconClass: "bg-[#EFE7D8] text-[#161614]",
    },
    {
      title: "User WhatsApp Aktif",
      value: summary.totalWaUsers.toLocaleString("id-ID"),
      subtitle: "Pengguna unik terdaftar di bot",
      icon: Users,
      iconClass: "bg-[#161614] text-[#F5F0E6]",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.title} className="zine-card-sm p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] font-bold uppercase text-[#5C584F]">
                  {card.title}
                </p>
                <p className="mt-2 font-display text-2xl font-bold tracking-tight text-[#161614]">
                  {card.value}
                </p>
              </div>
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[#161614] ${card.iconClass}`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 font-mono text-[11px] text-[#5C584F]">
              {card.subtitle}
            </p>
          </div>
        );
      })}
    </div>
  );
}