import {
  Activity,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Globe,
} from "lucide-react";
import type {
  RecentActivityRow,
  StickerCommandType,
} from "@/types/database";

interface RecentLogsTableProps {
  logs: RecentActivityRow[];
}

const COMMAND_BADGE: Record<
  StickerCommandType,
  { label: string; className: string }
> = {
  ai_meme: {
    label: "AI Meme / Roast",
    className: "bg-[#FFD646] text-[#161614]",
  },
  quote_chat: {
    label: "Quote Chat (/qc)",
    className: "bg-[#B9F32B] text-[#161614]",
  },
  brat_text: {
    label: "Brat Text (/brat)",
    className: "bg-[#8ACE00] text-[#161614]",
  },
  breaking_news: {
    label: "Breaking News",
    className: "bg-[#EB3B2E] text-white",
  },
  meme_text: {
    label: "Classic Meme",
    className: "bg-[#EFE7D8] text-[#161614]",
  },
  crop: {
    label: "Smart Crop",
    className: "bg-[#F5F0E6] text-[#161614]",
  },
  standard: {
    label: "Standard",
    className: "bg-[#EFE7D8] text-[#161614]",
  },
};

function formatWibDateTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(/\./g, ":");
}

export default function RecentLogsTable({ logs }: RecentLogsTableProps) {
  return (
    <div className="zine-card overflow-hidden">
      <div className="flex items-center justify-between border-b-2 border-[#161614] px-5 py-4">
        <div>
          <h2 className="font-display text-base font-bold text-[#161614]">
            Aktivitas Terbaru
          </h2>
          <p className="font-mono text-[11px] text-[#5C584F]">
            20 permintaan pembuatan stiker terakhir dari WhatsApp Bot &amp; Web
            Studio
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center border-2 border-[#161614] bg-[#EFE7D8] text-[#161614]">
          <Activity className="h-4 w-4" />
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-[#F5F0E6] px-6 py-14 text-center text-[#5C584F]">
          <Activity className="mb-2 h-8 w-8 opacity-50" />
          <p className="font-display text-sm font-bold text-[#161614]">
            Belum ada log aktivitas
          </p>
          <p className="mt-1 font-mono text-xs">
            Coba buat satu stiker lewat Web Studio atau kirim foto ke Bot WA
            untuk mulai mencatat telemetri.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b-2 border-[#161614] bg-[#EFE7D8] font-mono text-[11px] font-bold tracking-wider text-[#161614] uppercase">
                <th className="px-5 py-3">Waktu (WIB)</th>
                <th className="px-4 py-3">Kanal</th>
                <th className="px-4 py-3">Pengguna</th>
                <th className="px-4 py-3">Mode Stiker</th>
                <th className="px-4 py-3 text-right">Latency</th>
                <th className="px-4 py-3 text-right">Ukuran</th>
                <th className="px-5 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#161614]/15">
              {logs.map((row) => {
                const cmdBadge = COMMAND_BADGE[row.command_type] ?? {
                  label: row.command_type,
                  className: "bg-[#EFE7D8] text-[#161614]",
                };
                const isWhatsApp = row.source === "whatsapp";
                const isSuccess = row.status === "success";

                return (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-[#F5F0E6]/80"
                  >
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-[#45433D]">
                      {formatWibDateTime(row.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 border border-[#161614] px-2 py-0.5 font-mono text-[11px] font-bold ${
                          isWhatsApp
                            ? "bg-[#B9F32B] text-[#161614]"
                            : "bg-[#FFFDF7] text-[#161614]"
                        }`}
                      >
                        {isWhatsApp ? (
                          <MessageCircle className="h-3 w-3" />
                        ) : (
                          <Globe className="h-3 w-3" />
                        )}
                        {isWhatsApp ? "WhatsApp" : "Web"}
                      </span>
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-3.5 font-semibold text-[#161614]">
                      {row.display_name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <span
                        className={`inline-block border border-[#161614] px-2 py-0.5 font-mono text-[11px] font-bold ${cmdBadge.className}`}
                      >
                        {cmdBadge.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-xs text-[#161614]">
                      {row.processing_time_ms != null
                        ? `${row.processing_time_ms.toLocaleString("id-ID")} ms`
                        : "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-xs text-[#161614]">
                      {row.file_size_kb != null ? `${row.file_size_kb} KB` : "-"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 border border-[#161614] px-2 py-0.5 font-mono text-[11px] font-bold ${
                          isSuccess
                            ? "bg-[#B9F32B] text-[#161614]"
                            : "bg-[#EB3B2E] text-white"
                        }`}
                      >
                        {isSuccess ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        {isSuccess ? "Sukses" : "Gagal"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
