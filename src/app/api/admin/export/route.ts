import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, recordAdminAudit } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExportLogRow {
  id: string;
  created_at: string;
  source: string;
  command_type: string;
  status: string;
  processing_time_ms: number | null;
  file_size_kb: number | null;
  caption_text: string | null;
  error_message: string | null;
  wa_users: { profile_name: string | null } | { profile_name: string | null }[] | null;
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value).replace(/\r?\n/g, " ");

  // Cegah CSV Formula Injection saat dibuka di Excel
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  if (/[",]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatWibIso(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return (
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date) + " WIB"
  );
}

function resolveDisplayName(row: ExportLogRow): string {
  if (row.source === "web") return "Web User";
  const relation = Array.isArray(row.wa_users) ? row.wa_users[0] : row.wa_users;
  return relation?.profile_name || "User WA";
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const sourceFilter = searchParams.get("source") ?? "all";
    const daysParam = searchParams.get("days") ?? "30";

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("sticker_logs")
      .select(
        "id, created_at, source, command_type, status, processing_time_ms, file_size_kb, caption_text, error_message, wa_users(profile_name)"
      )
      .order("created_at", { ascending: false })
      .limit(5000);

    if (sourceFilter === "whatsapp" || sourceFilter === "web") {
      query = query.eq("source", sourceFilter);
    }

    if (daysParam !== "all") {
      const days = Math.min(365, Math.max(1, Number.parseInt(daysParam, 10) || 30));
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", since);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as ExportLogRow[];

    const header = [
      "ID",
      "Waktu (WIB)",
      "Kanal",
      "Pengguna",
      "Mode Stiker",
      "Status",
      "Latency (ms)",
      "Ukuran (KB)",
      "Caption / Input",
      "Pesan Error",
    ];

    const csvLines = [
      header.map(escapeCsvCell).join(","),
      ...rows.map((row) =>
        [
          row.id,
          formatWibIso(row.created_at),
          row.source,
          resolveDisplayName(row),
          row.command_type,
          row.status,
          row.processing_time_ms ?? "",
          row.file_size_kb ?? "",
          row.caption_text ?? "",
          row.error_message ?? "",
        ]
          .map(escapeCsvCell)
          .join(",")
      ),
    ];

    // UTF-8 BOM agar Excel langsung membaca karakter UTF-8 dengan benar
    const csvContent = "\uFEFF" + csvLines.join("\r\n");

    const dateTag = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Jakarta",
    }).format(new Date());

    await recordAdminAudit({
      admin: auth.admin,
      action: "export_sticker_logs_csv",
      target: `source:${sourceFilter},days:${daysParam}`,
      details: { row_count: rows.length },
    });

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="wa-sticker-logs-${dateTag}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Gagal mengekspor laporan CSV.";
    console.error("[API /api/admin/export GET] Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}