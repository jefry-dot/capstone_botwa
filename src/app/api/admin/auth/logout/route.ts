import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  getCurrentAdmin,
  recordAdminAudit,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    const currentAdmin = await getCurrentAdmin();
    const supabase = await createSupabaseServerClient();

    await supabase.auth.signOut();

    if (currentAdmin) {
      await recordAdminAudit({
        admin: currentAdmin,
        action: "admin_logout",
        target: currentAdmin.email,
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Logout gagal.";
    console.error("[API /api/admin/auth/logout] Error:", errMsg);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat logout." },
      { status: 500 }
    );
  }
}