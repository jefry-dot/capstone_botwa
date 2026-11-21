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
    className: "bg-violet-50 text-violet-700 border-violet-200",
  },
  quote_chat: {
    label: "Quote Chat (/qc)",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  brat_text: {
    label: "Brat Text (/brat)",
    className: "bg-lime-100 text-lime-800 border-lime-300",
  },
  breaking_news: {
    label: "Breaking News",
    className: "bg-rose-50 text-rose-700 border-rose-200",
  },
  meme_text: {
    label: "Classic Meme",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  crop: {
    label: "Smart Crop",
    className: "bg-sky-50 text-sky-700 border-sky-200",
  },
  standard: {
    label: "Standard",
    className: "bg-slate-100 text-slate-700 border-slate-200",
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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Aktivitas Terbaru
          </h2>
          <p className="text-xs text-slate-500">
            20 permintaan pembuatan stiker terakhir dari WhatsApp Bot dan Web Studio
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Activity className="h-4 w-4" />
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center text-slate-500">
          <Activity className="mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm font-medium">Belum ada log aktivitas</p>
          <p className="mt-1 text-xs">
            Coba buat satu stiker lewat Web Studio atau kirim foto ke Bot WA untuk mulai mencatat telemetri.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                <th className="px-5 py-3">Waktu (WIB)</th>
                <th className="px-4 py-3">Kanal</th>
                <th className="px-4 py-3">Pengguna</th>
                <th className="px-4 py-3">Mode Stiker</th>
                <th className="px-4 py-3 text-right">Latency</th>
                <th className="px-4 py-3 text-right">Ukuran</th>
                <th className="px-5 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((row) => {
                const cmdBadge = COMMAND_BADGE[row.command_type] ?? {
                  label: row.command_type,
                  className: "bg-slate-100 text-slate-700 border-slate-200",
                };
                const isWhatsApp = row.source === "whatsapp";
                const isSuccess = row.status === "success";

                return (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-slate-600">
                      {formatWibDateTime(row.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          isWhatsApp
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-700"
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
                    <td className="max-w-[160px] truncate px-4 py-3.5 font-medium text-slate-900">
                      {row.display_name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${cmdBadge.className}`}
                      >
                        {cmdBadge.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-xs text-slate-700">
                      {row.processing_time_ms != null
                        ? `${row.processing_time_ms.toLocaleString("id-ID")} ms`
                        : "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-xs text-slate-700">
                      {row.file_size_kb != null ? `${row.file_size_kb} KB` : "-"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          isSuccess
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
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