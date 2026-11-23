import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { UserPlan, UserProfileRow } from "@/types/database";

export interface CurrentUserSession {
  id: string;
  email: string;
  fullName: string;
  plan: UserPlan;
  isProActive: boolean;
  proExpiresAt: string | null;
  customPackName: string | null;
  customPackAuthor: string | null;
  linkedWaId: string | null;
  maskedLinkedWaId: string | null;
  linkCode: string | null;
  linkCodeExpiresAt: string | null;
  createdAt: string;
}

export function maskWaPhone(waId: string | null): string | null {
  if (!waId) return null;
  const digits = waId.replace(/\D/g, "");
  if (digits.length <= 6) return `${digits.slice(0, 2)}****`;
  return `${digits.slice(0, 5)}****${digits.slice(-3)}`;
}

export function resolveEffectivePlan(
  plan: UserPlan,
  proExpiresAt: string | null
): { effectivePlan: UserPlan; isProActive: boolean } {
  if (plan !== "pro") {
    return { effectivePlan: "free", isProActive: false };
  }
  if (!proExpiresAt) {
    return { effectivePlan: "pro", isProActive: true };
  }
  const expiresMs = new Date(proExpiresAt).getTime();
  if (Number.isNaN(expiresMs) || expiresMs > Date.now()) {
    return { effectivePlan: "pro", isProActive: true };
  }
  return { effectivePlan: "free", isProActive: false };
}

/**
 * Ambil profil user biasa (bukan admin) yang sedang login dari Supabase Auth + public.user_profiles.
 */
export async function getCurrentUserProfile(): Promise<CurrentUserSession | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return null;
    }

    const adminDb = getSupabaseAdmin();
    const { data: existing, error: profileError } = await adminDb
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle<UserProfileRow>();

    if (profileError) {
      // Jangan crash jika tabel premium_migration.sql belum dijalankan
      return null;
    }

    let profile = existing;

    // Jika user ada di auth.users tapi belum punya user_profiles (misal admin mencoba buka /account),
    // pastikan hanya buat otomatis jika bukan admin-only atau buat profil standar 'free'
    if (!profile) {
      const fullName =
        (typeof user.user_metadata?.full_name === "string" &&
          user.user_metadata.full_name.trim()) ||
        user.email.split("@")[0] ||
        "Pengguna";

      const { data: inserted, error: insertError } = await adminDb
        .from("user_profiles")
        .upsert(
          {
            id: user.id,
            email: user.email,
            full_name: fullName,
            plan: "free",
          },
          { onConflict: "id" }
        )
        .select("*")
        .single<UserProfileRow>();

      if (insertError || !inserted) {
        return null;
      }
      profile = inserted;
    }

    const { effectivePlan, isProActive } = resolveEffectivePlan(
      profile.plan,
      profile.pro_expires_at
    );

    // Jika masa aktif Pro sudah lewat, turunkan otomatis di DB
    if (profile.plan === "pro" && !isProActive) {
      await adminDb
        .from("user_profiles")
        .update({ plan: "free", updated_at: new Date().toISOString() })
        .eq("id", profile.id);
    }

    const linkCodeValid =
      profile.link_code &&
      profile.link_code_expires_at &&
      new Date(profile.link_code_expires_at).getTime() > Date.now();

    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      plan: effectivePlan,
      isProActive,
      proExpiresAt: isProActive ? profile.pro_expires_at : null,
      customPackName: profile.custom_pack_name,
      customPackAuthor: profile.custom_pack_author,
      linkedWaId: profile.linked_wa_id,
      maskedLinkedWaId: maskWaPhone(profile.linked_wa_id),
      linkCode: linkCodeValid ? profile.link_code : null,
      linkCodeExpiresAt: linkCodeValid ? profile.link_code_expires_at : null,
      createdAt: profile.created_at,
    };
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      (err as { digest?: string }).digest === "DYNAMIC_SERVER_USAGE"
    ) {
      return null;
    }
    console.error("[UserAuth] Failed to resolve current user:", err);
    return null;
  }
}

export async function requireUserApi(): Promise<
  | { ok: true; user: CurrentUserSession }
  | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUserProfile();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Silakan login terlebih dahulu untuk mengakses fitur ini." },
        { status: 401 }
      ),
    };
  }
  return { ok: true, user };
}
