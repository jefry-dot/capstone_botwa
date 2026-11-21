import crypto from "crypto";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export interface BotSettings {
  id: number;
  maintenance_mode: boolean;
  ai_meme_enabled: boolean;
  daily_ai_limit_per_user: number;
  daily_web_ai_limit_per_ip: number;
  maintenance_message: string;
  updated_at: string;
}

export interface AiQuotaResult {
  allowed: boolean;
  currentCount: number;
  remaining: number;
  limit: number;
}

const DEFAULT_BOT_SETTINGS: BotSettings = {
  id: 1,
  maintenance_mode: false,
  ai_meme_enabled: true,
  daily_ai_limit_per_user: 10,
  daily_web_ai_limit_per_ip: 5,
  maintenance_message:
    "Bot sedang dalam pemeliharaan sementara. Silakan coba lagi beberapa saat lagi.",
  updated_at: new Date(0).toISOString(),
};

/**
 * Ambil konfigurasi live bot dari tabel public.bot_settings (row id = 1).
 * Fallback aman ke default jika tabel migrasi belum dijalankan.
 */
export async function getBotSettings(): Promise<BotSettings> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("bot_settings")
      .select(
        "id, maintenance_mode, ai_meme_enabled, daily_ai_limit_per_user, daily_web_ai_limit_per_ip, maintenance_message, updated_at"
      )
      .eq("id", 1)
      .maybeSingle<BotSettings>();

    if (error || !data) {
      if (error) {
        console.error("[BotGuard] Failed to read bot_settings:", error.message);
      }
      return DEFAULT_BOT_SETTINGS;
    }

    return data;
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
      // Fail-open jika RPC belum dibuat agar demo tidak mati total
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