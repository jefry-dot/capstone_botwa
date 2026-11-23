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
  daily_pro_ai_limit?: number;
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
          daily_pro_ai_limit: Number(settings.daily_pro_ai_limit ?? 50),
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
        <div className="zine-card h-96 animate-pulse lg:col-span-8" />
        <div className="zine-card h-72 animate-pulse lg:col-span-4" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Kiri: Form Konfigurasi Live Bot */}
      <form
        onSubmit={handleSave}
        className="zine-card space-y-6 p-5 sm:p-6 lg:col-span-8"
      >
        <div className="flex items-center justify-between border-b-2 border-[#161614] pb-4">
          <div>
            <h2 className="font-display text-base font-bold text-[#161614]">
              Kontrol Operasional Bot &amp; Kuota AI
            </h2>
            <p className="font-mono text-[11px] text-[#5C584F]">
              Perubahan berlaku instan pada Bot WhatsApp &amp; Web Studio tanpa
              redeploy.
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center border-2 border-[#161614] bg-[#FFD646] text-[#161614]">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 border-2 border-[#161614] bg-[#EB3B2E] p-3.5 text-xs font-medium text-white shadow-[2px_2px_0_#161614]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-start gap-2.5 border-2 border-[#161614] bg-[#B9F32B] p-3.5 text-xs font-bold text-[#161614] shadow-[2px_2px_0_#161614]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {settings && (
          <>
            {/* Toggle Switches */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div
                className={`border-2 border-[#161614] p-4 transition-colors ${
                  settings.maintenance_mode
                    ? "bg-[#FFD646] shadow-[3px_3px_0_#161614]"
                    : "bg-[#F5F0E6]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-[#161614]" />
                    <span className="font-display text-sm font-bold text-[#161614]">
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
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer border-2 border-[#161614] transition-colors ${
                      settings.maintenance_mode ? "bg-[#161614]" : "bg-[#FFFDF7]"
                    }`}
                  >
                    <span
                      className={`mt-0.5 inline-block h-4 w-4 transform border border-[#161614] transition-transform ${
                        settings.maintenance_mode
                          ? "translate-x-5 bg-[#FFD646]"
                          : "translate-x-0.5 bg-[#161614]"
                      }`}
                    />
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#3B3934]">
                  Jeda sementara seluruh pembuatan stiker di WA &amp; Web dan
                  tampilkan pesan pemeliharaan.
                </p>
              </div>

              <div
                className={`border-2 border-[#161614] p-4 transition-colors ${
                  settings.ai_meme_enabled
                    ? "bg-[#B9F32B]/45 shadow-[3px_3px_0_#161614]"
                    : "bg-[#F5F0E6]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#161614]" />
                    <span className="font-display text-sm font-bold text-[#161614]">
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
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer border-2 border-[#161614] transition-colors ${
                      settings.ai_meme_enabled ? "bg-[#161614]" : "bg-[#FFFDF7]"
                    }`}
                  >
                    <span
                      className={`mt-0.5 inline-block h-4 w-4 transform border border-[#161614] transition-transform ${
                        settings.ai_meme_enabled
                          ? "translate-x-5 bg-[#B9F32B]"
                          : "translate-x-0.5 bg-[#161614]"
                      }`}
                    />
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#3B3934]">
                  Aktifkan atau matikan fitur Gemini Vision (`/aimeme` &amp;
                  `/roast`) untuk menghemat kuota API.
                </p>
              </div>
            </div>

            {/* Limit Kuota AI Harian */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="limit-wa-ai"
                  className="mb-1.5 block font-mono text-xs font-bold uppercase text-[#161614]"
                >
                  Limit AI WA (Free)
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
                  className="w-full border-2 border-[#161614] bg-[#FFFDF7] px-3.5 py-2.5 font-mono text-sm text-[#161614] focus:bg-[#FFFBEB] focus:outline-none"
                />
                <p className="mt-1 font-mono text-[11px] text-[#5C584F]">
                  Reset 00:00 WIB.
                </p>
              </div>

              <div>
                <label
                  htmlFor="limit-pro-ai"
                  className="mb-1.5 block font-mono text-xs font-bold uppercase text-[#161614]"
                >
                  Limit AI WA (PRO)
                </label>
                <input
                  id="limit-pro-ai"
                  type="number"
                  min={0}
                  max={10000}
                  value={settings.daily_pro_ai_limit ?? 50}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            daily_pro_ai_limit: Math.max(
                              0,
                              Number.parseInt(e.target.value || "0", 10)
                            ),
                          }
                        : prev
                    )
                  }
                  className="w-full border-2 border-[#161614] bg-[#FFD646]/35 px-3.5 py-2.5 font-mono text-sm font-bold text-[#161614] focus:bg-[#FFFBEB] focus:outline-none"
                />
                <p className="mt-1 font-mono text-[11px] text-[#5C584F]">
                  Khusus akun PRO tertaut.
                </p>
              </div>

              <div>
                <label
                  htmlFor="limit-web-ai"
                  className="mb-1.5 block font-mono text-xs font-bold uppercase text-[#161614]"
                >
                  Limit AI API Web
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
                  className="w-full border-2 border-[#161614] bg-[#FFFDF7] px-3.5 py-2.5 font-mono text-sm text-[#161614] focus:bg-[#FFFBEB] focus:outline-none"
                />
                <p className="mt-1 font-mono text-[11px] text-[#5C584F]">
                  Batas request per IP.
                </p>
              </div>
            </div>

            {/* Pesan Maintenance */}
            <div>
              <label
                htmlFor="maintenance-msg"
                className="mb-1.5 block font-mono text-xs font-bold uppercase text-[#161614]"
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
                className="w-full border-2 border-[#161614] bg-[#FFFDF7] px-3.5 py-2.5 text-sm text-[#161614] focus:bg-[#FFFBEB] focus:outline-none"
              />
            </div>

            <div className="flex justify-end border-t-2 border-dashed border-[#161614]/25 pt-4">
              <button
                type="submit"
                disabled={isSaving}
                className="zine-btn inline-flex cursor-pointer items-center gap-2 bg-[#161614] px-5 py-2.5 font-display text-sm font-bold text-[#F5F0E6] disabled:opacity-60"
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
      <div className="zine-card flex flex-col justify-between p-5 sm:p-6 lg:col-span-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b-2 border-[#161614] pb-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#161614]">
                Ekspor Laporan CSV
              </h2>
              <p className="font-mono text-[11px] text-[#5C584F]">
                Unduh data telemetri untuk lampiran laporan &amp; sidang.
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center border-2 border-[#161614] bg-[#B9F32B] text-[#161614]">
              <Download className="h-4 w-4" />
            </div>
          </div>

          <div>
            <label
              htmlFor="export-source"
              className="mb-1.5 block font-mono text-xs font-bold uppercase text-[#161614]"
            >
              Filter Kanal
            </label>
            <select
              id="export-source"
              value={exportSource}
              onChange={(e) =>
                setExportSource(e.target.value as "all" | "whatsapp" | "web")
              }
              className="w-full border-2 border-[#161614] bg-[#FFFDF7] px-3.5 py-2.5 text-sm text-[#161614] focus:outline-none"
            >
              <option value="all">Semua Kanal (WhatsApp + Web)</option>
              <option value="whatsapp">WhatsApp Bot Saja</option>
              <option value="web">Web Studio Saja</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="export-days"
              className="mb-1.5 block font-mono text-xs font-bold uppercase text-[#161614]"
            >
              Rentang Waktu
            </label>
            <select
              id="export-days"
              value={exportDays}
              onChange={(e) =>
                setExportDays(e.target.value as "7" | "30" | "90" | "all")
              }
              className="w-full border-2 border-[#161614] bg-[#FFFDF7] px-3.5 py-2.5 text-sm text-[#161614] focus:outline-none"
            >
              <option value="7">7 Hari Terakhir</option>
              <option value="30">30 Hari Terakhir</option>
              <option value="90">90 Hari Terakhir</option>
              <option value="all">Semua Data (Maks. 5.000 baris)</option>
            </select>
          </div>

          <div className="border-2 border-dashed border-[#161614]/40 bg-[#F5F0E6] p-3 font-mono text-[11px] leading-relaxed text-[#45433D]">
            File CSV sudah menggunakan UTF-8 BOM (langsung rapi di Excel) dan
            tidak menyertakan nomor HP mentah demi privasi pengguna.
          </div>
        </div>

        <a
          href={exportUrl}
          className="zine-btn mt-6 flex w-full items-center justify-center gap-2 bg-[#B9F32B] px-4 py-3 font-display text-sm font-bold text-[#161614]"
        >
          <Download className="h-4 w-4" />
          <span>Download Laporan (.csv)</span>
        </a>
      </div>
    </div>
  );
}
