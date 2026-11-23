import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[API /api/auth/logout] Error:", err);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
