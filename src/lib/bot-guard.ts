import crypto from "crypto";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { UserPlan, UserProfileRow } from "@/types/database";

export interface BotSettings {
  id: number;
  maintenance_mode: boolean;
  ai_meme_enabled: boolean;
  daily_ai_limit_per_user: number;
  daily_web_ai_limit_per_ip: number;
  daily_pro_ai_limit: number;
  maintenance_message: string;
  updated_at: string;
}

export interface AiQuotaResult {
  allowed: boolean;
  currentCount: number;
  remaining: number;
  limit: number;
}

export interface LinkedWaMember {
  userId: string;
  email: string;
  fullName: string;
  plan: UserPlan;
  isProActive: boolean;
  proExpiresAt: string | null;
  customPackName: string | null;
  customPackAuthor: string | null;
}

const DEFAULT_BOT_SETTINGS: BotSettings = {
  id: 1,
  maintenance_mode: false,
  ai_meme_enabled: true,
  daily_ai_limit_per_user: 10,
  daily_web_ai_limit_per_ip: 5,
  daily_pro_ai_limit: 50,
  maintenance_message:
    "Bot sedang dalam pemeliharaan sementara. Silakan coba lagi beberapa saat lagi.",
  updated_at: new Date(0).toISOString(),
};

function getTodayWibDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Ambil konfigurasi live bot dari tabel public.bot_settings (row id = 1).
 * Fallback aman ke default jika tabel atau kolom migrasi belum dijalankan.
 */
export async function getBotSettings(): Promise<BotSettings> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("bot_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle<Partial<BotSettings>>();

    if (error || !data) {
      if (error) {
        console.error("[BotGuard] Failed to read bot_settings:", error.message);
      }
      return DEFAULT_BOT_SETTINGS;
    }

    return {
      ...DEFAULT_BOT_SETTINGS,
      ...data,
      daily_pro_ai_limit:
        typeof data.daily_pro_ai_limit === "number"
          ? data.daily_pro_ai_limit
          : DEFAULT_BOT_SETTINGS.daily_pro_ai_limit,
    };
  } catch (err) {
    console.error("[BotGuard] Unexpected error reading bot_settings:", err);
    return DEFAULT_BOT_SETTINGS;
  }
}

/**
 * Cek apakah nomor WA pengirim sedang diblokir oleh Admin.
 */
export async function isWaUserBlocked(waId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("wa_users")
      .select("is_blocked")
      .eq("wa_id", waId)
      .maybeSingle<{ is_blocked: boolean }>();

    if (error || !data) {
      return false;
    }

    return Boolean(data.is_blocked);
  } catch (err) {
    console.error("[BotGuard] Unexpected error checking block status:", err);
    return false;
  }
}

/**
 * Ambil hash SHA-256 dari IP pengunjung Web Studio untuk rate limit tanpa menyimpan IP mentah.
 */
export function getWebClientRateKey(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const rawIp =
    forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || "unknown-client";

  const salt = process.env.WHATSAPP_VERIFY_TOKEN || "wa-sticker-studio-salt";
  const hashedIp = crypto
    .createHash("sha256")
    .update(`${rawIp}:${salt}`)
    .digest("hex")
    .slice(0, 32);

  return `web:${hashedIp}`;
}

interface ConsumeQuotaRpcRow {
  allowed: boolean;
  current_count: number;
  remaining: number;
}

/**
 * Kurangi kuota AI harian secara atomik via PostgreSQL RPC `consume_ai_quota`.
 */
export async function consumeAiQuota(
  rateKey: string,
  dailyLimit: number
): Promise<AiQuotaResult> {
  if (dailyLimit <= 0) {
    return { allowed: false, currentCount: 0, remaining: 0, limit: 0 };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("consume_ai_quota", {
      p_rate_key: rateKey,
      p_daily_limit: dailyLimit,
    });

    if (error) {
      console.error("[BotGuard] consume_ai_quota RPC error:", error.message);
      return {
        allowed: true,
        currentCount: 0,
        remaining: dailyLimit,
        limit: dailyLimit,
      };
    }

    const row = (Array.isArray(data) ? data[0] : data) as
      | ConsumeQuotaRpcRow
      | undefined;

    if (!row) {
      return {
        allowed: true,
        currentCount: 0,
        remaining: dailyLimit,
        limit: dailyLimit,
      };
    }

    return {
      allowed: Boolean(row.allowed),
      currentCount: Number(row.current_count ?? 0),
      remaining: Number(row.remaining ?? 0),
      limit: dailyLimit,
    };
  } catch (err) {
    console.error("[BotGuard] Unexpected error consuming AI quota:", err);
    return {
      allowed: true,
      currentCount: 0,
      remaining: dailyLimit,
      limit: dailyLimit,
    };
  }
}

/**
 * Kembalikan 1 kuota AI harian (best-effort) jika proses upstream (download media / Gemini API) gagal.
 */
export async function refundAiQuota(rateKey: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const today = getTodayWibDate();
    const { data, error } = await supabase
      .from("rate_limits")
      .select("ai_count")
      .eq("rate_key", rateKey)
      .eq("window_date", today)
      .maybeSingle<{ ai_count: number }>();

    if (error || !data || data.ai_count <= 0) return;

    await supabase
      .from("rate_limits")
      .update({
        ai_count: Math.max(0, Number(data.ai_count) - 1),
        updated_at: new Date().toISOString(),
      })
      .eq("rate_key", rateKey)
      .eq("window_date", today);
  } catch (err) {
    console.error("[BotGuard] Failed to refund AI quota:", err);
  }
}

/**
 * Baca jumlah pemakaian AI hari ini (zona WIB) tanpa mengurangi kuota.
 */
export async function getTodayAiUsage(rateKey: string): Promise<number> {
  try {
    const supabase = getSupabaseAdmin();
    const today = getTodayWibDate();
    const { data, error } = await supabase
      .from("rate_limits")
      .select("ai_count")
      .eq("rate_key", rateKey)
      .eq("window_date", today)
      .maybeSingle<{ ai_count: number }>();

    if (error || !data) return 0;
    return Number(data.ai_count ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Cari akun Web User yang tertaut dengan nomor/ID WhatsApp ini (untuk cek status PRO & Custom EXIF).
 */
export async function getLinkedUserByWaId(
  waId: string
): Promise<LinkedWaMember | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("linked_wa_id", waId)
      .maybeSingle<UserProfileRow>();

    if (error || !data) return null;

    const isProActive =
      data.plan === "pro" &&
      (!data.pro_expires_at ||
        new Date(data.pro_expires_at).getTime() > Date.now());

    if (data.plan === "pro" && !isProActive) {
      await supabase
        .from("user_profiles")
        .update({ plan: "free", updated_at: new Date().toISOString() })
        .eq("id", data.id);
    }

    return {
      userId: data.id,
      email: data.email,
      fullName: data.full_name,
      plan: isProActive ? "pro" : "free",
      isProActive,
      proExpiresAt: isProActive ? data.pro_expires_at : null,
      customPackName: isProActive ? data.custom_pack_name : null,
      customPackAuthor: isProActive ? data.custom_pack_author : null,
    };
  } catch {
    return null;
  }
}

/**
 * Verifikasi kode 6 digit dari perintah `/link <kode>` di WhatsApp dan tautkan ke user_profiles.
 */
export async function verifyAndLinkWaCode(
  rawCode: string,
  waId: string
): Promise<
  | { ok: true; member: LinkedWaMember }
  | { ok: false; message: string }
> {
  const code = rawCode.replace(/\D/g, "").trim();
  if (code.length !== 6) {
    return {
      ok: false,
      message: "Kode tautan harus terdiri dari 6 angka. Contoh: `/link 482910`",
    };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: candidates, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("link_code", code)
      .order("link_code_expires_at", { ascending: false })
      .limit(5);

    const rows = (candidates ?? []) as UserProfileRow[];
    if (error || rows.length === 0) {
      return {
        ok: false,
        message:
          "Kode tidak ditemukan atau sudah dipakai. Buat kode baru di menu *Akun Saya* pada website.",
      };
    }

    const nowMs = Date.now();
    const target = rows.find(
      (row) =>
        row.link_code_expires_at &&
        new Date(row.link_code_expires_at).getTime() > nowMs
    );

    if (!target) {
      return {
        ok: false,
        message:
          "Kode sudah kedaluwarsa (batas 15 menit). Silakan klik buat kode baru di halaman *Akun Saya*.",
      };
    }

    // Lepaskan nomor WA ini jika sebelumnya tertaut ke akun lain
    await supabase
      .from("user_profiles")
      .update({ linked_wa_id: null, updated_at: new Date().toISOString() })
      .eq("linked_wa_id", waId)
      .neq("id", target.id);

    const { error: updateErr } = await supabase
      .from("user_profiles")
      .update({
        linked_wa_id: waId,
        link_code: null,
        link_code_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", target.id);

    if (updateErr) {
      return {
        ok: false,
        message: "Gagal menautkan nomor WhatsApp. Silakan coba lagi.",
      };
    }

    const isProActive =
      target.plan === "pro" &&
      (!target.pro_expires_at ||
        new Date(target.pro_expires_at).getTime() > Date.now());

    return {
      ok: true,
      member: {
        userId: target.id,
        email: target.email,
        fullName: target.full_name,
        plan: isProActive ? "pro" : "free",
        isProActive,
        proExpiresAt: isProActive ? target.pro_expires_at : null,
        customPackName: isProActive ? target.custom_pack_name : null,
        customPackAuthor: isProActive ? target.custom_pack_author : null,
      },
    };
  } catch (err) {
    console.error("[BotGuard] verifyAndLinkWaCode error:", err);
    return {
      ok: false,
      message: "Terjadi kendala saat memverifikasi kode tautan.",
    };
  }
}
