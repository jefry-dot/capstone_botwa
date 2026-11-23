"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Crown,
  Link2,
  Unlink,
  Sparkles,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  MessageCircle,
  ArrowUpRight,
  RefreshCw,
  Tag,
  Receipt,
  Activity,
  QrCode,
  X,
} from "lucide-react";
import type { CurrentUserSession } from "@/lib/user-auth";
import type { SubscriptionOrderRow } from "@/types/database";
import type { UserHistoryItem } from "@/app/api/user/me/route";

const WA_BOT_NUMBER =
  process.env.NEXT_PUBLIC_WA_BOT_NUMBER || "6285959632681";

interface AccountPayload {
  user: CurrentUserSession;
  quota: {
    usedToday: number;
    dailyLimit: number;
    remaining: number;
    freeLimit: number;
    proLimit: number;
  };
  stats: {
    totalStickers: number;
  };
  recentLogs: UserHistoryItem[];
  orders: SubscriptionOrderRow[];
}

interface UserDashboardClientProps {
  openUpgradeInitially?: boolean;
}

function formatDateId(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function formatDateTimeWib(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(/\./g, ":");
}

async function fetchAccountData(): Promise<AccountPayload> {
  const res = await fetch("/api/user/me", { cache: "no-store" });
  if (res.status === 401) {
    throw new Error("UNAUTHORIZED");
  }
  const json = (await res.json().catch(() => ({}))) as AccountPayload & {
    error?: string;
  };
  if (!res.ok || !json.user) {
    throw new Error(json.error || `Gagal memuat profil (${res.status})`);
  }
  return json;
}

export default function UserDashboardClient({
  openUpgradeInitially = false,
}: UserDashboardClientProps) {
  const router = useRouter();

  const [data, setData] = useState<AccountPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // Branding EXIF state
  const [packName, setPackName] = useState("");
  const [packAuthor, setPackAuthor] = useState("");
  const [isSavingBrand, setIsSavingBrand] = useState(false);
  const [brandMsg, setBrandMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  // WA Link state
  const [isLinkingBusy, setIsLinkingBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [linkMsg, setLinkMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  // Upgrade Simulator state
  const [showUpgradePanel, setShowUpgradePanel] =
    useState(openUpgradeInitially);
  const [upgradeTab, setUpgradeTab] = useState<"qris" | "voucher">("voucher");
  const [voucherCode, setVoucherCode] = useState("CAPSTONEPRO");
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const hydrateFromPayload = useCallback((payload: AccountPayload) => {
    setData(payload);
    setPackName(payload.user.customPackName ?? "");
    setPackAuthor(payload.user.customPackAuthor ?? "");
  }, []);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    setPageError(null);
    try {
      const payload = await fetchAccountData();
      hydrateFromPayload(payload);
    } catch (err) {
      if (err instanceof Error && err.message === "UNAUTHORIZED") {
        router.replace("/login?next=/account");
        return;
      }
      setPageError(
        err instanceof Error ? err.message : "Gagal memuat data akun."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [hydrateFromPayload, router]);

  useEffect(() => {
    let active = true;
    fetchAccountData()
      .then((payload) => {
        if (!active) return;
        hydrateFromPayload(payload);
        setPageError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof Error && err.message === "UNAUTHORIZED") {
          router.replace("/login?next=/account");
          return;
        }
        setPageError(
          err instanceof Error ? err.message : "Gagal memuat data akun."
        );
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [hydrateFromPayload, router]);

  async function handleSaveBranding(e: FormEvent) {
    e.preventDefault();
    setBrandMsg(null);
    setIsSavingBrand(true);

    try {
      const res = await fetch("/api/user/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customPackName: packName,
          customPackAuthor: packAuthor,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Gagal menyimpan branding stiker.");
      }

      setBrandMsg({
        type: "ok",
        text: "Nama Pack & Author EXIF berhasil disimpan! Stiker WA berikutnya otomatis memakai branding kamu.",
      });
      await refreshData();
    } catch (err) {
      setBrandMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Gagal menyimpan branding.",
      });
    } finally {
      setIsSavingBrand(false);
    }
  }

  async function handleGenerateLinkCode() {
    setLinkMsg(null);
    setIsLinkingBusy(true);
    try {
      const res = await fetch("/api/user/link-wa", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        linkCode?: string;
        error?: string;
      };
      if (!res.ok || !json.linkCode) {
        throw new Error(json.error || "Gagal membuat kode tautan.");
      }
      await refreshData();
      setLinkMsg({
        type: "ok",
        text: `Kode /link ${json.linkCode} berhasil dibuat (berlaku 15 menit). Kirim ke Bot WA sekarang!`,
      });
    } catch (err) {
      setLinkMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Gagal membuat kode tautan.",
      });
    } finally {
      setIsLinkingBusy(false);
    }
  }

  async function handleUnlinkWa() {
    if (
      !window.confirm(
        "Putuskan tautan nomor WhatsApp dari akun ini? Nomor WA tersebut akan kembali ke kuota gratis biasa."
      )
    ) {
      return;
    }

    setLinkMsg(null);
    setIsLinkingBusy(true);
    try {
      const res = await fetch("/api/user/link-wa", { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal memutus tautan WhatsApp.");
      await refreshData();
      setLinkMsg({
        type: "ok",
        text: "Tautan WhatsApp berhasil diputus.",
      });
    } catch (err) {
      setLinkMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Gagal memutus tautan.",
      });
    } finally {
      setIsLinkingBusy(false);
    }
  }

  async function handleUpgrade(method: "qris_demo" | "voucher") {
    setUpgradeMsg(null);
    setIsUpgrading(true);
    try {
      const res = await fetch("/api/user/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          voucherCode: method === "voucher" ? voucherCode : undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || "Gagal mengaktifkan paket Pro.");
      }

      setUpgradeMsg({
        type: "ok",
        text: json.message || "Paket PRO CREATOR berhasil diaktifkan!",
      });
      await refreshData();
      router.refresh();
    } catch (err) {
      setUpgradeMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Gagal upgrade ke Pro.",
      });
    } finally {
      setIsUpgrading(false);
    }
  }

  function handleCopyLinkCmd(code: string) {
    void navigator.clipboard?.writeText(`/link ${code}`);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <div className="zine-card h-28 animate-pulse" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="zine-card h-64 animate-pulse" />
          <div className="zine-card h-64 animate-pulse" />
        </div>
      </div>
    );
  }

  if (pageError && !data) {
    return (
      <div className="zine-card bg-[#EB3B2E] p-6 text-white">
        <p className="font-display text-lg font-bold">Gagal memuat akun</p>
        <p className="mt-1 font-mono text-xs">{pageError}</p>
        <button
          type="button"
          onClick={() => void refreshData()}
          className="zine-btn mt-4 cursor-pointer bg-[#FFFDF7] px-4 py-2 font-mono text-xs font-bold uppercase text-[#161614]"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { user, quota, stats, recentLogs, orders } = data;
  const quotaPct =
    quota.dailyLimit > 0
      ? Math.min(100, Math.round((quota.usedToday / quota.dailyLimit) * 100))
      : 100;

  return (
    <div className="space-y-8">
      {/* Header Akun */}
      <div className="flex flex-col justify-between gap-4 border-b-2 border-[#161614] pb-6 sm:flex-row sm:items-end">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 border-2 border-[#161614] px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase ${
                user.isProActive
                  ? "bg-[#B9F32B] text-[#161614]"
                  : "bg-[#EFE7D8] text-[#161614]"
              }`}
            >
              {user.isProActive && <Crown className="h-3.5 w-3.5" />}
              <span>{user.isProActive ? "PRO CREATOR AKTIF" : "FREE PLAN"}</span>
            </span>
            {user.isProActive && user.proExpiresAt && (
              <span className="font-mono text-xs text-[#5C584F]">
                Berlaku s/d {formatDateId(user.proExpiresAt)}
              </span>
            )}
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[#161614]">
            Halo, {user.fullName}
          </h1>
          <p className="font-mono text-xs text-[#5C584F]">{user.email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void refreshData()}
            disabled={isRefreshing}
            className="zine-btn inline-flex cursor-pointer items-center gap-1.5 bg-[#FFFDF7] px-3.5 py-2 font-mono text-xs font-bold uppercase text-[#161614] disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </button>

          <a
            href={`https://wa.me/${WA_BOT_NUMBER}?text=${encodeURIComponent(
              "/status"
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="zine-btn inline-flex items-center gap-1.5 bg-[#B9F32B] px-4 py-2 font-mono text-xs font-bold uppercase text-[#161614]"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span>Buka Bot WA</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>

          <button
            type="button"
            onClick={() => setShowUpgradePanel((prev) => !prev)}
            className={`zine-btn inline-flex cursor-pointer items-center gap-1.5 px-4 py-2 font-mono text-xs font-bold uppercase text-[#161614] ${
              showUpgradePanel ? "bg-[#EFE7D8]" : "bg-[#FFD646]"
            }`}
          >
            {showUpgradePanel ? (
              <X className="h-3.5 w-3.5" />
            ) : (
              <Crown className="h-3.5 w-3.5" />
            )}
            <span>
              {showUpgradePanel
                ? "Tutup Panel PRO"
                : user.isProActive
                  ? "Perpanjang PRO"
                  : "Upgrade PRO"}
            </span>
          </button>
        </div>
      </div>

      {/* Ringkasan KPI Pribadi */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="zine-card-sm p-5">
          <p className="font-mono text-[11px] font-bold uppercase text-[#5C584F]">
            Kuota AI Vision Hari Ini
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-[#161614]">
            {quota.usedToday} / {quota.dailyLimit}{" "}
            <span className="font-mono text-xs font-normal text-[#5C584F]">
              terpakai
            </span>
          </p>
          <div className="mt-3 h-3 w-full border border-[#161614] bg-[#F5F0E6]">
            <div
              className="h-full bg-[#B9F32B] transition-all"
              style={{ width: `${quotaPct}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-[10px] text-[#5C584F]">
            Sisa {quota.remaining}x hari ini (reset 00:00 WIB)
          </p>
        </div>

        <div className="zine-card-sm p-5">
          <p className="font-mono text-[11px] font-bold uppercase text-[#5C584F]">
            Total Stiker Dibuat
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-[#161614]">
            {stats.totalStickers.toLocaleString("id-ID")}
          </p>
          <p className="mt-3 font-mono text-[11px] text-[#5C584F]">
            {user.linkedWaId
              ? "Tersinkron langsung dari Bot WhatsApp"
              : "Tautkan nomor WA agar riwayat tercatat"}
          </p>
        </div>

        <div className="zine-card-sm bg-[#FFD646] p-5">
          <p className="font-mono text-[11px] font-bold uppercase text-[#161614]">
            Pack EXIF Aktif di WA
          </p>
          <p className="mt-2 truncate font-display text-xl font-bold text-[#161614]">
            {user.isProActive && user.customPackName
              ? user.customPackName
              : "AmbaBot Studio"}
          </p>
          <p className="mt-2 truncate font-mono text-[11px] text-[#2B2925]">
            Author:{" "}
            {user.isProActive && user.customPackAuthor
              ? user.customPackAuthor
              : "Capstone Press 2026"}
          </p>
        </div>
      </div>

      {/* Panel Simulasi Upgrade PRO (Muncul saat tombol diklik atau default untuk akun Free) */}
      {showUpgradePanel && (
        <div className="zine-card border-[#161614] bg-[#161614] p-6 text-[#F5F0E6]">
          <div className="flex flex-col justify-between gap-4 border-b border-[#F5F0E6]/20 pb-4 sm:flex-row sm:items-center">
            <div>
              <span className="inline-flex items-center gap-1 border border-[#B9F32B] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#B9F32B]">
                <Crown className="h-3 w-3" />
                {user.isProActive ? "PERPANJANG PRO" : "UPGRADE KE PRO CREATOR"}
              </span>
              <h2 className="mt-2 font-display text-xl font-bold text-[#FFFDF7]">
                Buka Kuota AI {quota.proLimit}x/Hari &amp; Custom Nama Pack EXIF
              </h2>
              <p className="mt-1 text-xs text-[#D6CFC2]">
                Untuk keperluan demo Capstone, aktifkan paket Pro 30 hari secara
                instan menggunakan kode voucher demo atau simulasi QRIS.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setUpgradeTab("voucher")}
                className={`cursor-pointer border-2 px-3 py-1.5 font-mono text-xs font-bold uppercase ${
                  upgradeTab === "voucher"
                    ? "border-[#B9F32B] bg-[#B9F32B] text-[#161614]"
                    : "border-[#F5F0E6]/30 text-[#F5F0E6]"
                }`}
              >
                Kode Voucher
              </button>
              <button
                type="button"
                onClick={() => setUpgradeTab("qris")}
                className={`cursor-pointer border-2 px-3 py-1.5 font-mono text-xs font-bold uppercase ${
                  upgradeTab === "qris"
                    ? "border-[#FFD646] bg-[#FFD646] text-[#161614]"
                    : "border-[#F5F0E6]/30 text-[#F5F0E6]"
                }`}
              >
                Simulasi QRIS
              </button>
              <button
                type="button"
                onClick={() => setShowUpgradePanel(false)}
                aria-label="Tutup panel upgrade PRO"
                className="inline-flex cursor-pointer items-center justify-center border-2 border-[#F5F0E6]/30 p-1.5 text-[#F5F0E6] hover:border-[#EB3B2E] hover:bg-[#EB3B2E]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {upgradeMsg && (
            <div
              className={`mt-4 flex items-start gap-2 border-2 border-[#161614] p-3 text-xs font-bold ${
                upgradeMsg.type === "ok"
                  ? "bg-[#B9F32B] text-[#161614]"
                  : "bg-[#EB3B2E] text-white"
              }`}
            >
              {upgradeMsg.type === "ok" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{upgradeMsg.text}</span>
            </div>
          )}

          {upgradeTab === "voucher" ? (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                placeholder="Masukkan kode: CAPSTONEPRO"
                className="flex-1 border-2 border-[#F5F0E6]/40 bg-[#242421] px-3.5 py-2.5 font-mono text-sm font-bold text-[#FFFDF7] uppercase focus:border-[#B9F32B] focus:outline-none"
              />
              <button
                type="button"
                disabled={isUpgrading}
                onClick={() => void handleUpgrade("voucher")}
                className="inline-flex cursor-pointer items-center justify-center gap-2 border-2 border-[#B9F32B] bg-[#B9F32B] px-6 py-2.5 font-display text-sm font-bold text-[#161614] disabled:opacity-60"
              >
                {isUpgrading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span>Klaim Voucher PRO</span>
              </button>
            </div>
          ) : (
            <div className="mt-5 flex flex-col items-start justify-between gap-4 border border-[#F5F0E6]/20 bg-[#242421] p-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-[#FFD646] bg-[#FFFDF7] text-[#161614]">
                  <QrCode className="h-7 w-7" />
                </div>
                <div>
                  <p className="font-display text-sm font-bold text-[#FFFDF7]">
                    Simulasi Checkout QRIS — Rp 15.000 / 30 Hari
                  </p>
                  <p className="font-mono text-[11px] text-[#D6CFC2]">
                    Mode sandbox demo sidang (tanpa pemotongan saldo asli).
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isUpgrading}
                onClick={() => void handleUpgrade("qris_demo")}
                className="inline-flex shrink-0 cursor-pointer items-center gap-2 border-2 border-[#FFD646] bg-[#FFD646] px-5 py-2.5 font-display text-sm font-bold text-[#161614] disabled:opacity-60"
              >
                {isUpgrading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span>Konfirmasi Bayar Demo</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2 Kolom Inti: Tautkan WA (/link) + Custom Pack EXIF */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Kiri: Tautkan Nomor WhatsApp */}
        <div className="zine-card flex flex-col justify-between p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#161614] pb-3">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase text-[#5C584F]">
                  STEP 1 // SINKRONISASI BOT
                </p>
                <h2 className="font-display text-lg font-bold text-[#161614]">
                  Tautkan Nomor WhatsApp
                </h2>
              </div>
              <div className="flex h-9 w-9 items-center justify-center border-2 border-[#161614] bg-[#B9F32B]">
                <Link2 className="h-4 w-4 text-[#161614]" />
              </div>
            </div>

            {linkMsg && (
              <div
                className={`flex items-start gap-2 border-2 border-[#161614] p-3 text-xs font-medium ${
                  linkMsg.type === "ok"
                    ? "bg-[#B9F32B] text-[#161614]"
                    : "bg-[#EB3B2E] text-white"
                }`}
              >
                <span>{linkMsg.text}</span>
              </div>
            )}

            {user.linkedWaId ? (
              <div className="space-y-3 border-2 border-[#161614] bg-[#F5F0E6] p-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 border border-[#161614] bg-[#B9F32B] px-2 py-0.5 font-mono text-[11px] font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    WHATSAPP TERHUBUNG
                  </span>
                  <span className="font-mono text-xs font-bold text-[#161614]">
                    {user.maskedLinkedWaId}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-[#45433D]">
                  Nomor WA ini otomatis memakai kuota AI{" "}
                  <strong>{quota.dailyLimit}x/hari</strong> dan metadata Pack
                  EXIF dari akun kamu setiap kali mengirim perintah ke Bot WA.
                </p>
                <button
                  type="button"
                  disabled={isLinkingBusy}
                  onClick={() => void handleUnlinkWa()}
                  className="zine-btn inline-flex cursor-pointer items-center gap-1.5 bg-[#FFFDF7] px-3 py-1.5 font-mono text-xs font-bold text-[#EB3B2E] disabled:opacity-60"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  <span>Putuskan Tautan</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-[#45433D]">
                  Agar Bot WhatsApp mengenali paket{" "}
                  <strong>{user.isProActive ? "PRO" : "FREE"}</strong> &amp;
                  nama pack EXIF milikmu, buat kode 6 digit di bawah lalu kirim
                  ke Bot WA.
                </p>

                {user.linkCode ? (
                  <div className="space-y-3 border-2 border-[#161614] bg-[#FFD646] p-4">
                    <p className="font-mono text-[10px] font-bold uppercase text-[#161614]">
                      KIRIM PERINTAH INI KE BOT WHATSAPP:
                    </p>
                    <div className="flex items-center justify-between border-2 border-[#161614] bg-[#161614] px-3.5 py-2.5 font-mono text-base font-bold text-[#B9F32B]">
                      <span>/link {user.linkCode}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyLinkCmd(user.linkCode!)}
                        className="inline-flex cursor-pointer items-center gap-1 bg-[#FFFDF7] px-2 py-1 text-[10px] font-bold text-[#161614]"
                      >
                        {copiedCode ? (
                          <>
                            <Check className="h-3 w-3" />
                            <span>Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Salin</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`https://wa.me/${WA_BOT_NUMBER}?text=${encodeURIComponent(
                          `/link ${user.linkCode}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="zine-btn inline-flex flex-1 items-center justify-center gap-1.5 bg-[#B9F32B] px-4 py-2.5 font-display text-xs font-bold text-[#161614]"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span>Kirim Kode ke WA Sekarang</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => void refreshData()}
                        className="zine-btn cursor-pointer bg-[#FFFDF7] px-3 py-2.5 font-mono text-xs font-bold text-[#161614]"
                      >
                        Cek Status
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isLinkingBusy}
                    onClick={() => void handleGenerateLinkCode()}
                    className="zine-btn inline-flex w-full cursor-pointer items-center justify-center gap-2 bg-[#B9F32B] px-4 py-3 font-display text-sm font-bold text-[#161614] disabled:opacity-60"
                  >
                    {isLinkingBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                    <span>Buat Kode Verifikasi WA (6 Digit)</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Kanan: Custom Pack EXIF Branding (Fitur Premium) */}
        <div className="zine-card relative flex flex-col justify-between p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#161614] pb-3">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase text-[#5C584F]">
                  STEP 2 // FITUR EKSKLUSIF PRO
                </p>
                <h2 className="font-display text-lg font-bold text-[#161614]">
                  Custom Pack EXIF Branding
                </h2>
              </div>
              <div className="flex h-9 w-9 items-center justify-center border-2 border-[#161614] bg-[#FFD646]">
                {user.isProActive ? (
                  <Tag className="h-4 w-4 text-[#161614]" />
                ) : (
                  <Lock className="h-4 w-4 text-[#161614]" />
                )}
              </div>
            </div>

            {brandMsg && (
              <div
                className={`border-2 border-[#161614] p-3 text-xs font-bold ${
                  brandMsg.type === "ok"
                    ? "bg-[#B9F32B] text-[#161614]"
                    : "bg-[#EB3B2E] text-white"
                }`}
              >
                {brandMsg.text}
              </div>
            )}

            <form onSubmit={handleSaveBranding} className="space-y-4">
              <div>
                <label
                  htmlFor="pack-name"
                  className="mb-1.5 block font-mono text-xs font-bold uppercase text-[#161614]"
                >
                  Nama Pack Stiker di WhatsApp
                </label>
                <input
                  id="pack-name"
                  type="text"
                  maxLength={32}
                  disabled={!user.isProActive}
                  value={packName}
                  onChange={(e) => setPackName(e.target.value)}
                  placeholder="Contoh: Stiker Keren Budi"
                  className="w-full border-2 border-[#161614] bg-[#FFFDF7] px-3.5 py-2.5 text-sm text-[#161614] focus:bg-[#FFFBEB] focus:outline-none disabled:cursor-not-allowed disabled:bg-[#EFE7D8] disabled:opacity-70"
                />
              </div>

              <div>
                <label
                  htmlFor="pack-author"
                  className="mb-1.5 block font-mono text-xs font-bold uppercase text-[#161614]"
                >
                  Nama Pembuat (Author)
                </label>
                <input
                  id="pack-author"
                  type="text"
                  maxLength={32}
                  disabled={!user.isProActive}
                  value={packAuthor}
                  onChange={(e) => setPackAuthor(e.target.value)}
                  placeholder="Contoh: @budi.official"
                  className="w-full border-2 border-[#161614] bg-[#FFFDF7] px-3.5 py-2.5 text-sm text-[#161614] focus:bg-[#FFFBEB] focus:outline-none disabled:cursor-not-allowed disabled:bg-[#EFE7D8] disabled:opacity-70"
                />
              </div>

              {user.isProActive ? (
                <button
                  type="submit"
                  disabled={isSavingBrand}
                  className="zine-btn flex w-full cursor-pointer items-center justify-center gap-2 bg-[#161614] px-4 py-3 font-display text-sm font-bold text-[#F5F0E6] disabled:opacity-60"
                >
                  {isSavingBrand ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span>Simpan Branding Stiker WA</span>
                </button>
              ) : (
                <div className="flex flex-col justify-between gap-3 border-2 border-dashed border-[#161614] bg-[#EFE7D8] p-3 text-xs sm:flex-row sm:items-center">
                  <span className="font-medium text-[#3B3934]">
                    🔒 Fitur ini terkunci di paket Free. Upgrade ke Pro untuk
                    menghapus watermark AmbaBot Studio.
                  </span>
                  {!showUpgradePanel && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUpgradePanel(true);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="zine-btn shrink-0 cursor-pointer bg-[#FFD646] px-3 py-1.5 font-mono text-[11px] font-bold uppercase text-[#161614]"
                    >
                      Upgrade Pro
                    </button>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Riwayat Stiker WA Pribadi & Riwayat Order Pro */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="zine-card overflow-hidden lg:col-span-8">
          <div className="flex items-center justify-between border-b-2 border-[#161614] px-5 py-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#161614]">
                Riwayat Stiker WA Kamu
              </h2>
              <p className="font-mono text-[11px] text-[#5C584F]">
                20 stiker terakhir yang dibuat dari nomor WhatsApp tertaut
              </p>
            </div>
            <Activity className="h-4 w-4 text-[#161614]" />
          </div>

          {recentLogs.length === 0 ? (
            <div className="bg-[#F5F0E6] px-6 py-10 text-center font-mono text-xs text-[#5C584F]">
              Belum ada riwayat stiker. Tautkan WA kamu lalu kirim perintah ke
              Bot WA!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-[#161614] bg-[#EFE7D8] font-mono text-[10px] font-bold uppercase text-[#161614]">
                    <th className="px-4 py-2.5">Waktu</th>
                    <th className="px-4 py-2.5">Mode</th>
                    <th className="px-4 py-2.5 text-right">Ukuran</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#161614]/15">
                  {recentLogs.map((item) => (
                    <tr key={item.id} className="hover:bg-[#F5F0E6]/70">
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[#45433D]">
                        {formatDateTimeWib(item.created_at)}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-[#161614]">
                        {item.command_type}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono">
                        {item.file_size_kb != null
                          ? `${item.file_size_kb} KB`
                          : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`inline-block border border-[#161614] px-2 py-0.5 font-mono text-[10px] font-bold ${
                            item.status === "success"
                              ? "bg-[#B9F32B] text-[#161614]"
                              : "bg-[#EB3B2E] text-white"
                          }`}
                        >
                          {item.status === "success" ? "Sukses" : "Gagal"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="zine-card overflow-hidden lg:col-span-4">
          <div className="flex items-center justify-between border-b-2 border-[#161614] px-5 py-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#161614]">
                Riwayat Paket Pro
              </h2>
              <p className="font-mono text-[11px] text-[#5C584F]">
                Catatan aktivasi &amp; voucher
              </p>
            </div>
            <Receipt className="h-4 w-4 text-[#161614]" />
          </div>

          {orders.length === 0 ? (
            <div className="bg-[#F5F0E6] px-5 py-10 text-center font-mono text-xs text-[#5C584F]">
              Belum ada transaksi upgrade Pro.
            </div>
          ) : (
            <div className="divide-y divide-[#161614]/15">
              {orders.map((ord) => (
                <div key={ord.id} className="p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="border border-[#161614] bg-[#FFD646] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase">
                      {ord.payment_method === "voucher"
                        ? `VOUCHER: ${ord.voucher_code}`
                        : ord.payment_method === "admin_grant"
                          ? "ADMIN GRANT"
                          : "QRIS DEMO"}
                    </span>
                    <span className="font-mono font-bold text-[#161614]">
                      Rp {ord.amount_idr.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <p className="mt-1.5 font-mono text-[10px] text-[#5C584F]">
                    {formatDateTimeWib(ord.created_at)} WIB • Status:{" "}
                    {ord.status.toUpperCase()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
