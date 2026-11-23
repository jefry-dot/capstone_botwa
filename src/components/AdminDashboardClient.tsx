"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  AlertCircle,
  Wand2,
  Clock,
  BarChart3,
  SlidersHorizontal,
  Users,
  ShieldCheck,
  Crown,
} from "lucide-react";
import StatsCards from "@/components/StatsCards";
import ActivityChart from "@/components/ActivityChart";
import RecentLogsTable from "@/components/RecentLogsTable";
import AdminBotControls from "@/components/AdminBotControls";
import AdminUserTable from "@/components/AdminUserTable";
import AdminMembersTable from "@/components/AdminMembersTable";
import type { DashboardStatsResponse } from "@/types/database";

type DashboardTab = "overview" | "controls" | "users" | "members";

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

class UnauthorizedError extends Error {
  constructor() {
    super("Sesi admin telah berakhir. Mengalihkan ke halaman login...");
    this.name = "UnauthorizedError";
  }
}

async function fetchDashboardStats(): Promise<DashboardStatsResponse> {
  const res = await fetch("/api/stats", { cache: "no-store" });
  if (res.status === 401 || res.status === 403) {
    throw new UnauthorizedError();
  }
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(
      errBody.error || `Gagal mengambil data statistik (${res.status})`
    );
  }
  return (await res.json()) as DashboardStatsResponse;
}

export default function AdminDashboardClient() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [data, setData] = useState<DashboardStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnauthorized = useCallback(() => {
    router.replace("/admin/login?next=/dashboard");
    router.refresh();
  }, [router]);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const json = await fetchDashboardStats();
      setData(json);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        handleUnauthorized();
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : "Tidak dapat terhubung ke server statistik."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    let active = true;

    fetchDashboardStats()
      .then((json) => {
        if (!active) return;
        setData(json);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof UnauthorizedError) {
          handleUnauthorized();
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : "Tidak dapat terhubung ke server statistik."
        );
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [handleUnauthorized]);

  const tabs: Array<{
    id: DashboardTab;
    label: string;
    icon: typeof BarChart3;
  }> = [
    { id: "overview", label: "Overview Telemetri", icon: BarChart3 },
    { id: "controls", label: "Kontrol Bot & Export", icon: SlidersHorizontal },
    { id: "users", label: "Moderasi User WA", icon: Users },
    { id: "members", label: "Akun Web & Pro", icon: Crown },
  ];

  return (
    <div className="space-y-6">
      {/* Header Dashboard */}
      <div className="flex flex-col justify-between gap-4 border-b-2 border-[#161614] pb-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 border-2 border-[#161614] bg-[#B9F32B] px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#161614]">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>ADMIN CONTROL CENTER • RBAC PROTECTED</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#161614] sm:text-3xl">
            Live Telemetry &amp; Bot Management
          </h1>
          <p className="mt-1 text-sm text-[#45433D]">
            Monitoring performa engine stiker, kontrol fitur AI, moderasi
            pengguna WA, dan ekspor laporan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {data?.generatedAt && activeTab === "overview" && (
            <span className="inline-flex items-center gap-1.5 border-2 border-[#161614] bg-[#FFFDF7] px-3 py-2 font-mono text-xs font-medium text-[#3B3934]">
              <Clock className="h-3.5 w-3.5" />
              {formatClockWib(data.generatedAt)}
            </span>
          )}

          {activeTab === "overview" && (
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isLoading || isRefreshing}
              className="zine-btn inline-flex cursor-pointer items-center gap-2 bg-[#161614] px-4 py-2 font-mono text-xs font-bold uppercase text-[#F5F0E6] disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span>{isRefreshing ? "Memuat..." : "Refresh"}</span>
            </button>
          )}

          <Link
            href="/"
            className="zine-btn inline-flex items-center gap-2 bg-[#FFFDF7] px-4 py-2 font-mono text-xs font-bold uppercase text-[#161614]"
          >
            <Wand2 className="h-3.5 w-3.5" />
            <span>Halaman Utama</span>
          </Link>
        </div>
      </div>

      {/* Tab Navigasi Admin Panel */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`inline-flex cursor-pointer items-center gap-2 border-2 border-[#161614] px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                isActive
                  ? "bg-[#FFD646] text-[#161614] shadow-[3px_3px_0_#161614]"
                  : "bg-[#FFFDF7] text-[#3B3934] hover:bg-[#EFE7D8]"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview Telemetri */}
      {activeTab === "overview" && (
        <>
          {error && (
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div>
                  <p className="font-bold">Gagal memuat data dashboard</p>
                  <p className="text-xs text-red-700">
                    {error} — Pastikan schema SQL Supabase sudah dijalankan dan
                    variabel environment sudah terisi.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleManualRefresh}
                className="w-fit shrink-0 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                Coba Lagi
              </button>
            </div>
          )}

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
        </>
      )}

      {/* Tab 2: Kontrol Bot & Export CSV */}
      {activeTab === "controls" && (
        <AdminBotControls onUnauthorized={handleUnauthorized} />
      )}

      {/* Tab 3: Moderasi Pengguna WA */}
      {activeTab === "users" && (
        <AdminUserTable onUnauthorized={handleUnauthorized} />
      )}

      {/* Tab 4: Manajemen Akun Web & Pro */}
      {activeTab === "members" && (
        <AdminMembersTable onUnauthorized={handleUnauthorized} />
      )}
    </div>
  );
}
