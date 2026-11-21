"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Wrench,
  Sparkles,
  Save,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";

interface BotSettingsState {
  maintenance_mode: boolean;
  ai_meme_enabled: boolean;
  daily_ai_limit_per_user: number;
  daily_web_ai_limit_per_ip: number;
  maintenance_message: string;
  updated_at?: string;
}

interface AdminBotControlsProps {
  onUnauthorized?: () => void;
}

export default function AdminBotControls({
  onUnauthorized,
}: AdminBotControlsProps) {
  const [settings, setSettings] = useState<BotSettingsState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter untuk Export CSV
  const [exportSource, setExportSource] = useState<"all" | "whatsapp" | "web">(
    "all"
  );
  const [exportDays, setExportDays] = useState<"7" | "30" | "90" | "all">("30");

  useEffect(() => {
    let active = true;

    fetch("/api/admin/settings", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          onUnauthorized?.();
          throw new Error("Sesi admin telah berakhir. Silakan login ulang.");
        }
        const json = (await res.json().catch(() => ({}))) as {
          settings?: BotSettingsState;
          error?: string;
        };
        if (!res.ok || !json.settings) {
          throw new Error(json.error || "Gagal memuat konfigurasi bot.");
        }
        return json.settings;
      })
      .then((loaded) => {
        if (!active) return;
        setSettings(loaded);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Gagal memuat pengaturan bot."
        );
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [onUnauthorized]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;

    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maintenance_mode: settings.maintenance_mode,
          ai_meme_enabled: settings.ai_meme_enabled,
          daily_ai_limit_per_user: Number(settings.daily_ai_limit_per_user),
          daily_web_ai_limit_per_ip: Number(settings.daily_web_ai_limit_per_ip),
          maintenance_message: settings.maintenance_message,
        }),
      });

      if (res.status === 401 || res.status === 403) {
        onUnauthorized?.();
        throw new Error("Sesi admin habis. Silakan login kembali.");
      }

      const json = (await res.json().catch(() => ({}))) as {
        settings?: BotSettingsState;
        error?: string;
      };

      if (!res.ok || !json.settings) {
        throw new Error(json.error || `Gagal menyimpan (${res.status}).`);
      }

      setSettings(json.settings);
      setSuccessMsg(
        "Konfigurasi bot berhasil disimpan dan langsung aktif di WA & Web."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menyimpan pengaturan bot."
      );
    } finally {
      setIsSaving(false);
    }
  }

  const exportUrl = `/api/admin/export?source=${encodeURIComponent(
    exportSource
  )}&days=${encodeURIComponent(exportDays)}`;

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white lg:col-span-8" />
        <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white lg:col-span-4" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Kiri: Form Konfigurasi Live Bot */}
      <form
        onSubmit={handleSave}
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 lg:col-span-8"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Kontrol Operasional Bot &amp; Kuota AI
            </h2>
            <p className="text-xs text-slate-500">
              Perubahan berlaku instan pada Webhook WhatsApp dan Web Sticker
              Studio tanpa redeploy.
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {settings && (
          <>
            {/* Toggle Switches */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Toggle Maintenance Mode */}
              <div
                className={`rounded-xl border p-4 transition-colors ${
                  settings.maintenance_mode
                    ? "border-amber-300 bg-amber-50/70"
                    : "border-slate-200 bg-slate-50/60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Wrench
                      className={`h-4 w-4 ${
                        settings.maintenance_mode
                          ? "text-amber-600"
                          : "text-slate-500"
                      }`}
                    />
                    <span className="text-sm font-bold text-slate-900">
                      Maintenance Mode
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.maintenance_mode}
                    onClick={() =>
                      setSettings((prev) =>
                        prev
                          ? {
                              ...prev,
                              maintenance_mode: !prev.maintenance_mode,
                            }
                          : prev
                      )
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                      settings.maintenance_mode
                        ? "bg-amber-500"
                        : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                        settings.maintenance_mode
                          ? "translate-x-5.5"
                          : "translate-x-0.5"
                      } mt-0.5`}
                    />
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Jeda sementara seluruh pembuatan stiker di WA &amp; Web dan
                  tampilkan pesan pemeliharaan.
                </p>
              </div>

              {/* Toggle AI Vision */}
              <div
                className={`rounded-xl border p-4 transition-colors ${
                  settings.ai_meme_enabled
                    ? "border-emerald-200 bg-emerald-50/60"
                    : "border-slate-200 bg-slate-50/60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className={`h-4 w-4 ${
                        settings.ai_meme_enabled
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }`}
                    />
                    <span className="text-sm font-bold text-slate-900">
                      AI Vision (/aimeme)
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.ai_meme_enabled}
                    onClick={() =>
                      setSettings((prev) =>
                        prev
                          ? {
                              ...prev,
                              ai_meme_enabled: !prev.ai_meme_enabled,
                            }
                          : prev
                      )
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                      settings.ai_meme_enabled
                        ? "bg-emerald-600"
                        : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                        settings.ai_meme_enabled
                          ? "translate-x-5.5"
                          : "translate-x-0.5"
                      } mt-0.5`}
                    />
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Aktifkan atau matikan fitur Gemini Vision (`/aimeme` &amp;
                  `/roast`) untuk menghemat kuota API.
                </p>
              </div>
            </div>

            {/* Limit Kuota AI Harian */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="limit-wa-ai"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  Limit AI Harian per User WhatsApp
                </label>
                <input
                  id="limit-wa-ai"
                  type="number"
                  min={0}
                  max={1000}
                  value={settings.daily_ai_limit_per_user}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            daily_ai_limit_per_user: Math.max(
                              0,
                              Number.parseInt(e.target.value || "0", 10)
                            ),
                          }
                        : prev
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Reset otomatis tiap pukul 00:00 WIB.
                </p>
              </div>

              <div>
                <label
                  htmlFor="limit-web-ai"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  Limit AI Harian per IP Web Studio
                </label>
                <input
                  id="limit-web-ai"
                  type="number"
                  min={0}
                  max={1000}
                  value={settings.daily_web_ai_limit_per_ip}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            daily_web_ai_limit_per_ip: Math.max(
                              0,
                              Number.parseInt(e.target.value || "0", 10)
                            ),
                          }
                        : prev
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Mencegah spam request Gemini dari pengunjung anonim.
                </p>
              </div>
            </div>

            {/* Pesan Maintenance */}
            <div>
              <label
                htmlFor="maintenance-msg"
                className="mb-1.5 block text-xs font-semibold text-slate-700"
              >
                Pesan Saat Maintenance Mode Aktif
              </label>
              <textarea
                id="maintenance-msg"
                rows={3}
                maxLength={300}
                value={settings.maintenance_message}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev
                      ? { ...prev, maintenance_message: e.target.value }
                      : prev
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-xs transition-colors hover:bg-slate-800 disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Simpan Perubahan</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </form>

      {/* Kanan: Panel Export Laporan CSV */}
      <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 lg:col-span-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Ekspor Laporan CSV
              </h2>
              <p className="text-xs text-slate-500">
                Unduh data log telemetri untuk lampiran laporan &amp; analisis
                sidang.
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Download className="h-4 w-4" />
            </div>
          </div>

          <div>
            <label
              htmlFor="export-source"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              Filter Kanal
            </label>
            <select
              id="export-source"
              value={exportSource}
              onChange={(e) =>
                setExportSource(e.target.value as "all" | "whatsapp" | "web")
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              <option value="all">Semua Kanal (WhatsApp + Web)</option>
              <option value="whatsapp">WhatsApp Bot Saja</option>
              <option value="web">Web Studio Saja</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="export-days"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              Rentang Waktu
            </label>
            <select
              id="export-days"
              value={exportDays}
              onChange={(e) =>
                setExportDays(e.target.value as "7" | "30" | "90" | "all")
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              <option value="7">7 Hari Terakhir</option>
              <option value="30">30 Hari Terakhir</option>
              <option value="90">90 Hari Terakhir</option>
              <option value="all">Semua Data (Maks. 5.000 baris)</option>
            </select>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
            File CSV sudah menggunakan UTF-8 BOM (langsung rapi di Excel) dan
            tidak menyertakan nomor HP mentah demi privasi pengguna.
          </div>
        </div>

        <a
          href={exportUrl}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-xs transition-colors hover:bg-emerald-700"
        >
          <Download className="h-4 w-4" />
          <span>Download Laporan (.csv)</span>
        </a>
      </div>
    </div>
  );
}