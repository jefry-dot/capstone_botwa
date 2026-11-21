"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, AlertCircle, Wand2, Clock } from "lucide-react";
import StatsCards from "@/components/StatsCards";
import ActivityChart from "@/components/ActivityChart";
import RecentLogsTable from "@/components/RecentLogsTable";
import type { DashboardStatsResponse } from "@/app/api/stats/route";

function formatClockWib(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return (
    new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .format(date)
      .replace(/\./g, ":") + " WIB"
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async (manual = false) => {
    if (manual) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          errBody.error || `Gagal mengambil data statistik (${res.status})`
        );
      }

      const json = (await res.json()) as DashboardStatsResponse;
      setData(json);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Tidak dapat terhubung ke server statistik."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadStats(false);
  }, [loadStats]);

  return (
    <div className="space-y-6">
      {/* Header Dashboard */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Live Telemetry Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Monitoring performa engine stiker, tren kanal WhatsApp vs Web, dan popularitas fitur secara real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {data?.generatedAt && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
              <Clock className="h-3.5 w-3.5" />
              Update: {formatClockWib(data.generatedAt)}
            </span>
          )}

          <button
            type="button"
            onClick={() => void loadStats(true)}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-800 disabled:opacity-60 sm:text-sm"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span>{isRefreshing ? "Memuat..." : "Refresh Data"}</span>
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-100 sm:text-sm"
          >
            <Wand2 className="h-4 w-4 text-emerald-600" />
            <span>Buat Stiker</span>
          </Link>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="font-bold">Gagal memuat data dashboard</p>
              <p className="text-xs text-red-700">
                {error} — Pastikan schema SQL Supabase sudah dijalankan dan variabel environment sudah terisi.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadStats(true)}
            className="w-fit shrink-0 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Initial Loading Skeleton */}
      {isLoading && !data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="h-3 w-24 rounded bg-slate-200" />
                <div className="mt-4 h-7 w-20 rounded bg-slate-200" />
                <div className="mt-4 h-3 w-36 rounded bg-slate-100" />
              </div>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white lg:col-span-7" />
            <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white lg:col-span-5" />
          </div>
          <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      ) : data ? (
        <>
          <StatsCards summary={data.summary} />
          <ActivityChart
            dailyStats={data.dailyStats}
            featureStats={data.featureStats}
          />
          <RecentLogsTable logs={data.recentActivity} />
        </>
      ) : null}
    </div>
  );
}